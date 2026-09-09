// Importa um produto do AliExpress pra Pavan & Co. usando a SUA sessão
// logada de verdade (não um servidor) — é assim que ferramentas como o
// DSers conseguem fazer isso sem levar bloqueio: quem acessa a página é
// um navegador de verdade, com cookies de uma conta de verdade, não um
// robô anônimo rodando num datacenter.
//
// Como usar:
//   1. npm install
//   2. npm run login          -> abre um navegador, você loga no AliExpress
//                                 normalmente, aperta Enter aqui no terminal
//                                 quando terminar. Só precisa fazer isso de
//                                 vez em quando (a sessão expira com o tempo).
//   3. npm run importar -- <link-do-produto>
//
// O produto entra na loja como RASCUNHO (inativo, não aparece pro
// cliente) com o link do fornecedor já preenchido — você revisa, ajusta
// categoria/preço no admin normal do site, e só aí ativa.
//
// Layout do AliExpress muda com o tempo — se algum campo vier vazio, o
// aviso aparece no terminal e você preenche esse campo específico na mão
// no admin, sem travar o resto (é assim mesmo de propósito, ver
// conversa que gerou essa ferramenta).

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVO_SESSAO = path.join(__dirname, '.sessao-aliexpress.json');

// Mesma URL/chave pública já usadas em todo o site (shared.js) — a chave
// "anon" é pública de propósito, quem realmente autentica é o login do
// admin logo abaixo, não essa chave.
const SUPABASE_URL = 'https://pqhdtteeukfcjstfsnkn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxaGR0dGVldWtmY2pzdGZzbmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzc0MTAsImV4cCI6MjEwMTk1MzQxMH0.VwOKgaNEmKaT-xGqF-S0Cr2mY9i4O_4eIFkqpdv0KiY';

// Converte um preço no formato brasileiro ("R$149,14", "R$1.234,56") pro
// número puro que o banco espera (149.14, 1234.56). Se não conseguir
// entender o texto, devolve null — melhor deixar vazio do que salvar
// errado.
function paraNumero(precoTexto){
  if (!precoTexto) return null;
  const limpo = precoTexto.replace(/[^\d.,]/g, '');
  const normalizado = limpo.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

async function perguntar(pergunta, opts = {}){
  const rl = createInterface({ input: stdin, output: stdout });
  const resposta = await rl.question(pergunta);
  rl.close();
  return resposta.trim();
}

// O Playwright, do jeito padrão, deixa sinais no navegador que sistemas
// anti-robô (tipo o "arraste pra verificar" do AliExpress) detectam fácil
// — por isso a verificação dava erro direto, em qualquer tipo de login.
// Aqui a gente: usa o Chrome DE VERDADE já instalado no PC (não o
// Chromium de teste que vem junto do Playwright, que é mais "denunciado"),
// e apaga/disfarça as marcas mais óbvias de automação antes de qualquer
// página carregar. Não é 100% garantido (nada é), mas resolve a maioria
// dos casos.
async function abrirNavegador({ headless, storageState }){
  const browser = await chromium.launch({
    headless,
    channel: 'chrome', // precisa ter o Google Chrome instalado no Windows/Mac
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    ...(storageState ? { storageState } : {}),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'pt-BR'
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = window.chrome || { runtime: {} };
  });
  return { browser, context };
}

/* ============================================================
   MODO LOGIN — abre um navegador de verdade, espera você logar na sua
   conta AliExpress, salva a sessão (cookies + storage) num arquivo local
   que fica só na sua máquina (já está no .gitignore).
   ============================================================ */
async function modoLogin(){
  console.log('Abrindo o navegador — loga na sua conta AliExpress normalmente.');
  console.log('Quando terminar (já estiver na sua conta), volta aqui e aperta Enter.\n');

  const { browser, context } = await abrirNavegador({ headless: false });
  const page = await context.newPage();
  await page.goto('https://www.aliexpress.com/', { waitUntil: 'domcontentloaded' });

  await perguntar('Já logou? Aperta Enter aqui pra salvar a sessão... ');

  await context.storageState({ path: ARQUIVO_SESSAO });
  await browser.close();
  console.log(`\nSessão salva em ${ARQUIVO_SESSAO}. Agora já dá pra importar produtos.`);
}

/* ============================================================
   EXTRAÇÃO DOS DADOS DA PÁGINA — várias tentativas em camadas, porque o
   AliExpress muda o formato da página de vez em quando. Cada campo tenta
   várias fontes em ordem; só entra no aviso de "não achei" se TODAS as
   tentativas daquele campo falharem (uma tentativa que dá certo depois de
   outra falhar não deixa rastro de erro).
   ============================================================ */
async function extrairDadosProduto(page){
  const avisos = [];

  // A página do AliExpress é montada por JavaScript DEPOIS que ela abre
  // (o HTML original vem "vazio" nessa parte) — então tem que esperar
  // ela terminar de montar antes de tentar ler nome/preço. Esse seletor
  // (`data-pl="product-title"`) é o mesmo que o PRÓPRIO AliExpress usa
  // internamente pra saber se o título do produto já apareceu na tela.
  try {
    await page.waitForSelector('[data-pl="product-title"], [class*="title--line-one"]', { timeout: 15000 });
  } catch { /* não achou nesse tempo — segue mesmo assim com o que carregou */ }
  await page.waitForTimeout(1200); // folga pra preço/imagens acabarem de montar também

  // Além do que está na tela, alguns dados (principalmente as FOTOS) vêm
  // prontos escondidos num objeto JavaScript no meio da página — não
  // precisa esperar nada pra pegar esses.
  const dados = await page.evaluate(() => {
    const fontes = [window._d_c_?.DCData, window.runParams?.data, window.runParams, window._d_c_];
    for (const f of fontes){
      if (f && typeof f === 'object' && Object.keys(f).length) return f;
    }
    // Procura em qualquer <script> um "window.algumaCoisa = {...}" que
    // pareça ter dado de produto (título, imagens) — layout antigo/alternativo.
    const scripts = [...document.querySelectorAll('script')];
    for (const s of scripts){
      const texto = s.textContent || '';
      if (!texto.includes('"title"') && !texto.includes('imagePathList')) continue;
      const match = texto.match(/window\.\w+\s*=\s*(\{[\s\S]*\});?/);
      if (match){
        try { return JSON.parse(match[1]); } catch { /* ignora, tenta o próximo */ }
      }
    }
    return null;
  }) || {};

  // Tenta uma lista de jeitos diferentes de achar o mesmo campo, em ordem;
  // só registra aviso se NENHUM deles der certo.
  async function tentarCadeia(nomeCampo, ...tentativas){
    for (const t of tentativas){
      try {
        const v = await t();
        if (v !== undefined && v !== null && v !== '') return v;
      } catch { /* tenta a próxima */ }
    }
    avisos.push(nomeCampo);
    return null;
  }

  const limpar = (t) => t?.replace(/\s+/g, ' ').trim();

  const nome = await tentarCadeia('nome',
    async () => limpar(await page.locator('[data-pl="product-title"]').first().textContent({ timeout: 3000 })),
    async () => limpar(await page.locator('[class*="title--line-one"]').first().textContent({ timeout: 2000 })),
    () => dados?.titleModule?.subject || dados?.title,
    async () => limpar((await page.title())?.replace(/\s*[-|]\s*AliExpress.*$/i, ''))
  );

  const preco = await tentarCadeia('preço',
    async () => limpar(await page.locator('[class*="price-default--current"]').first().textContent({ timeout: 3000 })),
    () => dados?.priceModule?.formatedActivityPrice || dados?.priceModule?.formatedPrice
  );

  const fotos = await tentarCadeia('fotos', () => {
    const lista = dados?.imagePathList || dados?.imageModule?.imagePathList;
    if (!Array.isArray(lista) || !lista.length) throw new Error('sem lista');
    return lista.map(u => u.startsWith('http') ? u : `https:${u}`);
  }) || [];

  const descricao = await tentarCadeia('descrição/especificações',
    async () => limpar(await page.locator('[class*="seo-sellpoints--sellerPoint"]').first().textContent({ timeout: 3000 })),
    () => dados?.descriptionModule?.description ||
      (dados?.specsModule?.props || []).map(p => `${p.attrName}: ${p.attrValue}`).join('\n')
  );

  const variacoes = await tentarCadeia('variações (tamanho/cor/etc — precisa mapear na mão)', () => {
    const props = dados?.skuModule?.productSKUPropertyList;
    if (!Array.isArray(props) || !props.length) throw new Error('sem variação');
    return props.map(p => ({
      nome: p.skuPropertyName,
      valores: (p.skuPropertyValues || []).map(v => v.propertyValueDisplayName || v.propertyValueName)
    }));
  }) || [];

  // Quando algum campo importante não foi achado, salva um "raio-x" da
  // página (o que estava escondido no JavaScript + a página já renderizada
  // na tela) numa pasta local — não vai pro site nem pro GitHub, é só pra
  // você me mandar o conteúdo desses arquivos e eu ajustar os caminhos
  // certos, sem ficar advinhando de novo.
  if (avisos.length){
    try {
      const pastaDebug = path.join(__dirname, 'debug');
      await mkdir(pastaDebug, { recursive: true });
      const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
      await writeFile(path.join(pastaDebug, `${carimbo}-dados-embutidos.json`), JSON.stringify(dados, null, 2));
      await writeFile(path.join(pastaDebug, `${carimbo}-pagina.html`), await page.content());
      console.log(`\n(criei um "raio-x" da página em debug/${carimbo}-*.* — se algum campo continuar faltando depois de revisar no admin, me manda esses dois arquivos que eu ajusto certinho)`);
    } catch { /* isso é só um extra, não pode travar a importação por causa disso */ }
  }

  return { nome, descricao, fotos, preco, variacoes, avisos };
}

/* ============================================================
   IMPORTAR UM PRODUTO
   ============================================================ */
async function modoImportar(url){
  if (!existsSync(ARQUIVO_SESSAO)){
    console.error('Ainda não tem sessão salva. Roda "npm run login" primeiro.');
    process.exit(1);
  }

  console.log('Abrindo a página do produto...');
  const { browser, context } = await abrirNavegador({ headless: true, storageState: ARQUIVO_SESSAO });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // dá tempo do JS da página terminar de montar tudo

  const { nome, descricao, fotos, preco, variacoes, avisos } = await extrairDadosProduto(page);
  await browser.close();

  console.log(`\nNome: ${nome || '(não encontrado)'}`);
  console.log(`Preço listado: ${preco || '(não encontrado)'} — confere/ajusta no admin, não é necessariamente o preço de fábrica`);
  console.log(`Fotos encontradas: ${fotos.length}`);
  if (variacoes.length){
    console.log('Variações encontradas (mapeia pra quilate/banho/tamanho na mão no admin):');
    variacoes.forEach(v => console.log(`  - ${v.nome}: ${v.valores.join(', ')}`));
  }
  if (avisos.length){
    console.log(`\n⚠️  Não consegui achar: ${avisos.join(', ')} — fica vazio, preenche na mão.`);
  }

  // Login do admin — pedido na hora, nunca salvo em arquivo nenhum.
  console.log('\nAgora loga como admin pra salvar o rascunho na loja:');
  const email = await perguntar('E-mail do admin: ');
  const rlSenha = createInterface({ input: stdin, output: stdout });
  const senha = await rlSenha.question('Senha: ');
  rlSenha.close();

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: erroLogin } = await sb.auth.signInWithPassword({ email, password: senha });
  if (erroLogin){
    console.error('Não consegui logar como admin:', erroLogin.message);
    process.exit(1);
  }

  // Baixa as fotos e sobe pro mesmo bucket que o admin usa pra upload
  // manual — mesma convenção de nome (pasta "importados/", nome
  // aleatório) pra não colidir com nada.
  console.log('\nBaixando e enviando fotos pro Supabase Storage...');
  const urlsFinal = [];
  for (const [i, urlFoto] of fotos.entries()){
    try {
      const resp = await fetch(urlFoto);
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const extensao = urlFoto.split('.').pop().split(/[?#]/)[0].slice(0, 5) || 'jpg';
      const nomeArquivo = `importados/aliexpress-${crypto.randomUUID()}.${extensao}`;
      const { error: erroUpload } = await sb.storage.from('produtos').upload(nomeArquivo, bytes, {
        contentType: resp.headers.get('content-type') || 'image/jpeg'
      });
      if (erroUpload) throw erroUpload;
      const { data: urlData } = sb.storage.from('produtos').getPublicUrl(nomeArquivo);
      urlsFinal.push(urlData.publicUrl);
      console.log(`  foto ${i + 1}/${fotos.length} ok`);
    } catch (err) {
      console.log(`  foto ${i + 1}/${fotos.length} falhou (${err.message}) — pulei essa, sobe na mão se precisar`);
    }
  }

  // "categoria" é obrigatória no banco e não dá pra adivinhar direito só
  // pelo scraping (o AliExpress não separa por essas categorias) — usa a
  // primeira categoria ativa da loja só pra passar da validação, você
  // troca pela certa na revisão. select público normal (mesma consulta
  // que o site inteiro já usa em carregarCategorias()), não precisa de
  // login pra isso.
  const { data: categorias } = await sb.from('categorias').select('slug').eq('ativa', true).order('ordem').limit(1);
  const categoriaProvisoria = categorias?.[0]?.slug || null;
  if (!categoriaProvisoria){
    console.error('\nNão achei nenhuma categoria ativa na loja pra usar como provisória — cadastra uma categoria no admin antes de importar.');
    process.exit(1);
  }

  // Preço vem como texto formatado (ex: "R$149,14") — converte pro número
  // puro que o banco espera. Se não der pra entender, fica 0 mesmo (fácil
  // de notar no admin que precisa preencher na mão) em vez de travar.
  const precoNumero = paraNumero(preco) ?? 0;

  // Cria o produto como RASCUNHO (ativo:false — não aparece pro cliente
  // até você revisar e ativar no admin). link_fornecedor já vem
  // preenchido com o link original, pra você conferir a página de novo
  // se precisar. Sem ".select()" no final de propósito: a leitura direta
  // da tabela produtos é restrita mesmo pra admin (o site normalmente lê
  // produto por uma função própria, não direto na tabela) — o insert em
  // si funciona igual, só não confirma o retorno.
  const { error: erroInsert } = await sb.from('produtos').insert({
    nome: nome || '(sem nome — importação parcial, preencher)',
    descricao: descricao || null,
    fotos: urlsFinal,
    link_fornecedor: url,
    categoria: categoriaProvisoria,
    ativo: false,
    // preço do AliExpress é só referência (frete, taxa, margem — nada
    // disso é preço final de venda) — ajusta na calculadora do admin
    // antes de ativar, mesmo já vindo preenchido.
    preco: precoNumero
  });

  if (erroInsert){
    console.error('\nDeu erro ao salvar o rascunho:', erroInsert.message);
    process.exit(1);
  }

  console.log(`\n✅ Rascunho criado: "${nome || '(sem nome)'}"`);
  console.log(`Categoria provisória: "${categoriaProvisoria}" — troca pela certa na revisão.`);
  console.log('Abre o admin do site, acha esse produto na lista (aparece como inativo, com o ícone 🔗 de link do fornecedor) e termina de revisar: categoria, quilate/banho/tamanho, preço final.');
}

/* ============================================================
   ENTRADA
   ============================================================ */
const args = process.argv.slice(2);
if (args.includes('--login')){
  await modoLogin();
} else if (args[0]){
  await modoImportar(args[0]);
} else {
  console.log('Uso:');
  console.log('  npm run login                    -> loga na sua conta AliExpress (faz de vez em quando)');
  console.log('  npm run importar -- <link>       -> importa um produto');
}
