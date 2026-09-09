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
// Guarda e-mail/senha do admin + chave do Groq localmente pra não
// perguntar de novo a cada importação. Fica só no seu computador (nunca
// vai pro GitHub — já está no .gitignore) mas é TEXTO PURO, sem
// criptografia nenhuma — não compartilha essa pasta com ninguém.
const ARQUIVO_CREDENCIAIS = path.join(__dirname, '.credenciais.json');

async function carregarCredenciais(){
  try {
    return JSON.parse(await readFile(ARQUIVO_CREDENCIAIS, 'utf-8'));
  } catch {
    return {};
  }
}

async function salvarCredenciais(dados){
  try {
    await writeFile(ARQUIVO_CREDENCIAIS, JSON.stringify(dados, null, 2));
  } catch { /* não trava a importação por causa disso */ }
}

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

  // Extras (não travam nada e não entram no aviso de "não encontrado" —
  // são só referência a mais pra você usar no admin, o AliExpress mesmo
  // já mostra pro comprador). Não usa tentarCadeia de propósito: quando
  // faltam, é normal (nem todo produto/loja tem esse aviso), não é erro.
  const impostoEstimado = await (async () => {
    try {
      const t = await page.locator('[class*="vat-installment--item"]').first().textContent({ timeout: 2000 });
      return limpar(t);
    } catch { return null; }
  })();

  const estoque = await (async () => {
    try {
      const t = await page.locator('[class*="quantity--info"]').first().textContent({ timeout: 2000 });
      return limpar(t);
    } catch { return null; }
  })();

  const fotos = await tentarCadeia('fotos', () => {
    const lista = dados?.imagePathList || dados?.imageModule?.imagePathList;
    if (!Array.isArray(lista) || !lista.length) throw new Error('sem lista');
    return lista.map(u => u.startsWith('http') ? u : `https:${u}`);
  }) || [];

  // Descrição sai como HTML de verdade (<p> por tópico), igual ao que o
  // editor de texto do admin já salva — o site injeta a descrição direto
  // na página (innerHTML), então precisa ser HTML válido, não texto puro
  // com \n (que não vira quebra de linha visual nenhuma).
  const descricao = await tentarCadeia('descrição/especificações',
    // Cada tópico da descrição fica num <li> separado, e o próprio
    // AliExpress já bota a frase-título de cada um em <strong> — aproveita
    // esse negrito (não precisa reinventar), só limpa o resto (tira
    // qualquer outra tag que não seja negrito/itálico/quebra de linha,
    // por segurança).
    async () => {
      const paragrafos = await page.evaluate(() => {
        const permitidas = new Set(['STRONG', 'B', 'EM', 'I', 'BR']);
        function limparTags(el){
          [...el.childNodes].forEach(filho => {
            if (filho.nodeType !== 1) return;
            if (!permitidas.has(filho.tagName)){
              filho.replaceWith(document.createTextNode(filho.textContent));
              return;
            }
            [...filho.attributes].forEach(a => filho.removeAttribute(a.name));
            limparTags(filho);
          });
        }
        return [...document.querySelectorAll('[class*="seo-sellpoints--sellerPoint"] li')]
          .map(li => {
            const copia = li.cloneNode(true);
            limparTags(copia);
            return copia.innerHTML.replace(/\s+/g, ' ').trim();
          })
          .filter(Boolean);
      });
      return paragrafos.length ? paragrafos.map(p => `<p>${p}</p>`).join('') : null;
    },
    // Sem a lista de tópicos, cai pra um texto puro qualquer achado no
    // JSON embutido — nesse caso escapa e transforma em parágrafo(s) HTML
    // simples, sem negrito (não tem de onde tirar).
    () => {
      const texto = dados?.descriptionModule?.description ||
        (dados?.specsModule?.props || []).map(p => `${p.attrName}: ${p.attrValue}`).join('\n');
      if (!texto) throw new Error('sem descrição');
      const escapado = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return escapado.split(/\n+/).map(t => t.trim()).filter(Boolean).map(t => `<p>${t}</p>`).join('');
    }
  );

  const variacoes = await tentarCadeia('variações (tamanho/cor/etc — precisa mapear na mão)', async () => {
    // Cada grupo de variação (tamanho, cor metálica etc.) é um bloco com
    // um título ("Tamanho:", "Cor metálica:...") e, dentro, uma opção por
    // elemento com o valor certinho no atributo title="" — não depende de
    // ler o texto visível (que às vezes vem com espaço/lixo junto).
    const grupos = await page.evaluate(() => {
      const valoresDe = (container) => [...new Set(
        [...container.querySelectorAll('[class*="sku-item--text"]')]
          .map(el => (el.getAttribute('title') || el.textContent || '').trim())
          .filter(Boolean)
      )];

      const propriedades = [...document.querySelectorAll('[class*="sku-item--property"]')];
      let achados;
      if (propriedades.length){
        achados = propriedades.map((prop, i) => {
          const tituloTexto = prop.querySelector('[class*="sku-item--title"]')?.textContent || '';
          const nome = tituloTexto.split(':')[0].trim() || `Opção ${i + 1}`;
          return { nome, valores: valoresDe(prop) };
        });
      } else {
        // Não achou o wrapper com título — pega cada grupo de opções
        // direto, sem nome (fica "Opção 1", "Opção 2"...).
        achados = [...document.querySelectorAll('[class*="sku-item--skus"]')].map((g, i) => ({
          nome: `Opção ${i + 1}`,
          valores: valoresDe(g)
        }));
      }

      // A página às vezes repete o mesmo bloco duas vezes (layout
      // duplicado escondido) — tira as duplicatas exatas.
      const vistos = new Set();
      return achados.filter(g => g.valores.length).filter(g => {
        const chave = g.nome + '|' + g.valores.join(',');
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
    });
    if (!grupos.length) throw new Error('sem variação');
    return grupos;
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

  return { nome, descricao, fotos, preco, variacoes, avisos, impostoEstimado, estoque };
}

/* ============================================================
   FORMATAR NOME/DESCRIÇÃO COM IA (Groq, opcional) — pega o texto cru
   do fornecedor (cheio de palavra-chave repetida) e devolve um nome
   seguindo o padrão da loja + uma descrição em parágrafos curtos, sem
   inventar informação nova. Passo opcional: se não tiver chave, o
   produto entra igual, só sem essa reescrita.

   Troca o valor de MODELO_GROQ aqui embaixo se um dia der erro 404 —
   modelos saem de linha de vez em quando (e alguns, como os "Llama",
   pedem plano empresarial — usa um com preço público normal na lista em
   https://console.groq.com/docs/models, tipo os "openai/gpt-oss-*")
   ============================================================ */
const MODELO_GROQ = 'openai/gpt-oss-120b';

async function formatarComIA({ nomeOriginal, descricaoOriginal }, chaveApi){
  const prompt = `Você ajuda a Pavan & Co., uma loja de joias, a transformar anúncios de fornecedor (texto cheio de palavra-chave repetida, tipo AliExpress) em nome e descrição limpos pro site.

PADRÃO DO NOME (sempre seguir):
[Tipo de peça] + [Material/Pedra] + [Detalhe técnico opcional]
- Tipo de peça sempre primeiro (Anel, Aliança, Brinco, Colar, Pulseira...), é a palavra que a busca do site usa pra encontrar o produto
- Nunca usar nome de modelo/marca do fornecedor (ex: "PJ31", "Kosbpin", "BIJOX STORY")
- Nunca usar palavras de venda genéricas ("para mulheres", "presente perfeito", "moda")
- Curto: até 6 palavras. Só a primeira letra maiúscula (nada de Título Em Cada Palavra)
Exemplos já usados na loja (siga esse tom): "Brincos de Moissanite", "Anel Solitário Moissanite 3.6ct"

PADRÃO DA DESCRIÇÃO — a descrição é HTML, não texto puro (o site injeta ela direto na página):
- 2 a 4 tópicos, cada um é um <p>...</p> separado (nunca use \n pra separar, só tags <p>)
- Cada <p> começa com uma frase curta em <strong>...</strong> (tipo um mini-título) seguida da explicação — mesmo estilo do "Resumo do item com IA" que o próprio AliExpress mostra
- Só use as tags <p> e <strong> — nada de markdown (nada de **), nada de outras tags HTML
- Tom caloroso e direto, sem exagero de vendedor
- Mantém as informações técnicas reais que vieram no texto original (material, quilates, tamanho, certificação) — NUNCA inventa informação nova
- Corta repetição e frases de venda genéricas
- O texto original abaixo já pode vir com algumas tags <strong> — pode reorganizar/resumir à vontade, contanto que a SAÍDA continue seguindo esse mesmo padrão

Texto original do fornecedor:
NOME: ${nomeOriginal}
DESCRIÇÃO (HTML): ${descricaoOriginal || '(sem descrição)'}

Responda SOMENTE com um JSON válido nesse formato, sem nenhum texto antes ou depois (o valor de "descricao" é uma string HTML, como descrito acima):
{"nome": "...", "descricao": "<p><strong>...</strong> ...</p>"}`;

  const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${chaveApi}`
    },
    body: JSON.stringify({
      model: MODELO_GROQ,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  if (!resposta.ok){
    throw new Error(`Groq respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  }

  const corpo = await resposta.json();
  const texto = corpo?.choices?.[0]?.message?.content;
  if (!texto) throw new Error('Groq não devolveu texto nenhum');

  const resultado = JSON.parse(texto);
  if (!resultado?.nome) throw new Error('Groq não devolveu um nome');
  return { nome: resultado.nome.trim(), descricao: (resultado.descricao || descricaoOriginal || '').trim() };
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

  let { nome, descricao, fotos, preco, variacoes, avisos, impostoEstimado, estoque } = await extrairDadosProduto(page);
  await browser.close();

  console.log(`\nNome (como veio do fornecedor): ${nome || '(não encontrado)'}`);

  const credenciais = await carregarCredenciais();

  // Passo opcional: reescreve nome/descrição com IA (Groq), seguindo o
  // padrão de título da loja. Se já tem chave salva de uma vez anterior,
  // usa ela direto; senão pergunta e, se você colar uma, salva pra não
  // perguntar de novo.
  let chaveGroq = credenciais.chaveGroq;
  if (chaveGroq){
    console.log('(usando a chave do Groq salva localmente)');
  } else {
    chaveGroq = await perguntar('\nTem chave da API do Groq pra formatar nome/descrição? (cola aqui ou aperta Enter pra pular): ');
    if (chaveGroq){
      credenciais.chaveGroq = chaveGroq;
      await salvarCredenciais(credenciais);
      console.log(`(chave salva em ${path.basename(ARQUIVO_CREDENCIAIS)} pra não perguntar de novo)`);
    }
  }
  if (chaveGroq){
    try {
      console.log('Formatando com IA...');
      const formatado = await formatarComIA({ nomeOriginal: nome, descricaoOriginal: descricao }, chaveGroq);
      nome = formatado.nome;
      descricao = formatado.descricao;
      console.log(`Nome (formatado pela IA): ${nome}`);
    } catch (err) {
      console.log(`Não consegui formatar com IA (${err.message}) — seguindo com o texto original do fornecedor.`);
    }
  }

  console.log(`\nPreço listado: ${preco || '(não encontrado)'} — confere/ajusta no admin, não é necessariamente o preço de fábrica`);
  if (impostoEstimado) console.log(`Imposto estimado (mostrado pelo próprio AliExpress): ${impostoEstimado}`);
  if (estoque) console.log(`Estoque no fornecedor: ${estoque}`);
  console.log(`Fotos encontradas: ${fotos.length}`);
  if (variacoes.length){
    console.log('Variações encontradas (mapeia pra quilate/banho/tamanho na mão no admin):');
    variacoes.forEach(v => console.log(`  - ${v.nome}: ${v.valores.join(', ')}`));
  }
  if (avisos.length){
    console.log(`\n⚠️  Não consegui achar: ${avisos.join(', ')} — fica vazio, preenche na mão.`);
  }

  // Login do admin — se já tem e-mail/senha salvos de uma vez anterior,
  // usa direto; senão pergunta. Se o login salvo não funcionar mais
  // (ex: senha foi trocada), pede de novo em vez de travar.
  console.log('\nAgora loga como admin pra salvar o rascunho na loja:');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let email = credenciais.email;
  let senha = credenciais.senha;
  let usandoSalvo = Boolean(email && senha);
  if (usandoSalvo){
    console.log('(usando login de admin salvo localmente)');
  } else {
    email = await perguntar('E-mail do admin: ');
    const rlSenha = createInterface({ input: stdin, output: stdout });
    senha = await rlSenha.question('Senha: ');
    rlSenha.close();
  }

  let { error: erroLogin } = await sb.auth.signInWithPassword({ email, password: senha });
  if (erroLogin && usandoSalvo){
    console.log(`Login salvo não funcionou (${erroLogin.message}) — digita de novo:`);
    email = await perguntar('E-mail do admin: ');
    const rlSenha2 = createInterface({ input: stdin, output: stdout });
    senha = await rlSenha2.question('Senha: ');
    rlSenha2.close();
    usandoSalvo = false;
    ({ error: erroLogin } = await sb.auth.signInWithPassword({ email, password: senha }));
  }
  if (erroLogin){
    console.error('Não consegui logar como admin:', erroLogin.message);
    process.exit(1);
  }
  if (!usandoSalvo){
    credenciais.email = email;
    credenciais.senha = senha;
    await salvarCredenciais(credenciais);
    console.log(`(login salvo em ${path.basename(ARQUIVO_CREDENCIAIS)} pra não perguntar de novo)`);
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

  // Estoque vem como texto ("Apenas 7 restante(s)") — extrai só o número.
  const estoqueMatch = estoque?.match(/\d+/);
  const estoqueNumero = estoqueMatch ? parseInt(estoqueMatch[0], 10) : null;

  // Cria o produto como RASCUNHO (ativo:false — não aparece pro cliente
  // até você revisar e ativar no admin). link_fornecedor já vem
  // preenchido com o link original, pra você conferir a página de novo
  // se precisar. Sem ".select()" no final de propósito: a leitura direta
  // da tabela produtos é restrita mesmo pra admin (o site normalmente lê
  // produto por uma função própria, não direto na tabela) — o insert em
  // si funciona igual, só não confirma o retorno.
  //
  // "tamanhos_disponiveis" NÃO entra aqui de propósito: o AliExpress usa
  // numeração americana de anel (4, 5, 5.5...), diferente da numeração de
  // aro usada no Brasil — salvar direto botaria tamanho errado pro
  // cliente. Mapeia isso na mão (os tamanhos aparecem no terminal acima).
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
    preco: precoNumero,
    ...(estoqueNumero !== null ? { estoque: estoqueNumero } : {})
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
