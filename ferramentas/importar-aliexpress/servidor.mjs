// Servidor local da interface visual do importador de AliExpress — roda
// só na sua máquina (nada muda de segurança/privacidade em relação ao
// script de terminal: mesma sessão do AliExpress, mesmo Supabase, mesma
// chave do Groq — só ganha uma tela pra ver e editar tudo antes de
// publicar, em vez de responder perguntas no terminal às cegas).
//
// Como usar: depois de já ter rodado "npm run login" uma vez,
//   npm run interface
// abre sozinho http://localhost:3737 no navegador (se não abrir sozinho,
// copia esse endereço e cola no navegador na mão).

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import {
  __dirname, ARQUIVO_SESSAO,
  SUPABASE_URL, SUPABASE_ANON_KEY,
  carregarCredenciais, salvarCredenciais,
  abrirNavegador, extrairDadosProduto, formatarComIA, revisarComIA,
  converterTamanhosParaBR, paraNumero, extrairValorReais, baixarESubirFoto,
  montarMatrizes, buscarProdutoExistente, sugerirCategoria
} from './importar.mjs';

const PORTA = 3737;

async function lerCorpoJSON(req){
  const pedacos = [];
  for await (const pedaco of req) pedacos.push(pedaco);
  const texto = Buffer.concat(pedacos).toString('utf-8');
  return texto ? JSON.parse(texto) : {};
}

function responderJSON(res, status, dados){
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dados));
}

// ---------------------------------------------------------------
// GET /api/status — o front-end usa isso pra saber se já tem sessão do
// AliExpress salva (senão nem adianta tentar buscar) e se já tem login
// do admin/chave do Groq salvos (pra não pedir de novo). NUNCA manda os
// valores reais de senha/chave pro navegador, só true/false.
async function handleStatus(req, res){
  const credenciais = await carregarCredenciais();
  responderJSON(res, 200, {
    temSessaoAliExpress: existsSync(ARQUIVO_SESSAO),
    temLoginAdminSalvo: Boolean(credenciais.email && credenciais.senha),
    temChaveGroq: Boolean(credenciais.chaveGroq)
  });
}

// ---------------------------------------------------------------
// GET /api/imagem-proxy?url=... — repassa uma foto externa (do AliExpress)
// pro navegador através do servidor, em vez do navegador buscar direto.
// O AliExpress às vezes bloqueia imagem carregada de outro site
// (hotlink) checando de onde veio o pedido — pedindo pelo servidor (Node,
// sem essa checagem de origem de navegador) evita isso.
async function handleImagemProxy(req, res, url){
  const alvo = url.searchParams.get('url');
  if (!alvo) { res.writeHead(400); return res.end(); }
  try {
    const resp = await fetch(alvo);
    if (!resp.ok) throw new Error('status ' + resp.status);
    res.writeHead(200, {
      'Content-Type': resp.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(Buffer.from(await resp.arrayBuffer()));
  } catch {
    res.writeHead(502);
    res.end();
  }
}

// ---------------------------------------------------------------
// GET /api/categorias — lista pública de categorias ativas, pro seletor
// no formulário (mesma consulta que o site inteiro já usa, não precisa
// de login pra isso).
async function handleCategorias(req, res){
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await sb.from('categorias').select('slug, nome').eq('ativa', true).order('ordem');
  if (error) return responderJSON(res, 500, { erro: error.message });
  responderJSON(res, 200, data || []);
}

// ---------------------------------------------------------------
// POST /api/buscar { link } — abre o produto, extrai tudo (mesma lógica
// do script de terminal), tenta a IA se tiver chave salva, devolve um
// pacote pronto pro formulário editável.
async function handleBuscar(req, res){
  let link;
  try {
    ({ link } = await lerCorpoJSON(req));
    if (!link) throw new Error('faltou o link');
  } catch (err) {
    return responderJSON(res, 400, { erro: 'Link inválido: ' + err.message });
    }
  if (!existsSync(ARQUIVO_SESSAO)){
    return responderJSON(res, 400, { erro: 'Ainda não tem sessão do AliExpress salva — roda "npm run login" no terminal primeiro (só precisa fazer isso de vez em quando).' });
  }

  // Checa cedo (antes de abrir o navegador — sem sentido gastar 1+ minuto
  // clicando em variação só pra descobrir depois que já existe) se esse
  // link já foi importado antes.
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const produtoExistente = await buscarProdutoExistente(sbAnon, link);

  let browser;
  try {
    const abertura = await abrirNavegador({ headless: true, storageState: ARQUIVO_SESSAO });
    browser = abertura.browser;
    const page = await abertura.context.newPage();
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const dados = await extrairDadosProduto(page);
    await browser.close();
    browser = null;

    const credenciais = await carregarCredenciais();
    let nomeIA = null, descricaoIA = null, erroIA = null;
    if (credenciais.chaveGroq){
      try {
        const formatado = await formatarComIA({ nomeOriginal: dados.nome, descricaoOriginal: dados.descricao }, credenciais.chaveGroq);
        nomeIA = formatado.nome;
        descricaoIA = formatado.descricao;
      } catch (err) {
        erroIA = err.message;
      }
    }

    // Sugestão de categoria pela IA — só quando NÃO é atualização de um
    // produto existente (nesse caso a categoria que ele já tem prevalece,
    // o front-end decide isso ao montar o formulário).
    let categoriaSugerida = null;
    if (credenciais.chaveGroq && !produtoExistente){
      try {
        const { data: categoriasAtivas } = await sbAnon.from('categorias').select('slug, nome').eq('ativa', true).order('ordem');
        categoriaSugerida = await sugerirCategoria({ nome: nomeIA || dados.nome, categorias: categoriasAtivas || [] }, credenciais.chaveGroq);
      } catch { /* sugestão é só um extra, nunca trava a busca */ }
    }

    const custoPecaNumero = paraNumero(dados.preco) ?? 0;
    const custoImpostoNumero = extrairValorReais(dados.impostoEstimado);
    const { tamanhosBR, avisoTamanho } = converterTamanhosParaBR(dados.variacoes);

    responderJSON(res, 200, {
      nomeOriginal: dados.nome,
      nomeIA,
      descricaoOriginal: dados.descricao,
      descricaoIA,
      erroIA,
      fotos: dados.fotos,
      custoPeca: custoPecaNumero,
      custoImposto: custoImpostoNumero,
      estoque: dados.estoque,
      variacoes: dados.variacoes,
      quilates: dados.matrizVariacoes?.quilatesCustos || [],
      banhos: (dados.matrizVariacoes?.banhosCustos || []).map(b => ({ nome: b.nome, custo: b.custo, foto: b.foto })),
      precosPorVariacao: dados.precosPorVariacao,
      tamanhosBR,
      avisoTamanho,
      avisos: dados.avisos,
      avisosMatriz: dados.matrizVariacoes?.avisos || [],
      categoriaSugerida,
      produtoExistente,
      link
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    responderJSON(res, 500, { erro: err.message });
  }
}

// ---------------------------------------------------------------
// POST /api/regenerar { nome, descricao, instrucao } — revisa o nome/
// descrição que já estão na tela (editados ou não) seguindo uma instrução
// livre (ex: "tira o ct do nome", "mais emoji"). Precisa de chave do Groq
// salva — sem chave, devolve erro claro em vez de travar/tentar sem IA.
async function handleRegenerar(req, res){
  let corpo;
  try {
    corpo = await lerCorpoJSON(req);
  } catch (err) {
    return responderJSON(res, 400, { erro: 'JSON inválido: ' + err.message });
  }
  if (!corpo.instrucao?.trim()){
    return responderJSON(res, 400, { erro: 'Escreve o que você quer mudar.' });
  }
  const credenciais = await carregarCredenciais();
  if (!credenciais.chaveGroq){
    return responderJSON(res, 400, { erro: 'Sem chave do Groq salva — roda uma importação com a chave preenchida uma vez pra ela ficar salva, ou usa o script de terminal.' });
  }
  try {
    const resultado = await revisarComIA({
      nomeAtual: corpo.nome || '',
      descricaoAtual: corpo.descricao || '',
      instrucao: corpo.instrucao.trim()
    }, credenciais.chaveGroq);
    responderJSON(res, 200, resultado);
  } catch (err) {
    responderJSON(res, 500, { erro: err.message });
  }
}

// ---------------------------------------------------------------
// POST /api/publicar — recebe o formulário já editado pelo usuário e
// salva de verdade: loga como admin, sobe as fotos (produto + banhos que
// ainda não estão no nosso Storage) e insere o produto.
async function handlePublicar(req, res){
  let corpo;
  try {
    corpo = await lerCorpoJSON(req);
  } catch (err) {
    return responderJSON(res, 400, { erro: 'JSON inválido: ' + err.message });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const credenciais = await carregarCredenciais();
  const email = corpo.email || credenciais.email;
  const senha = corpo.senha || credenciais.senha;
  if (!email || !senha) return responderJSON(res, 400, { erro: 'Faltou e-mail/senha do admin.' });

  const { error: erroLogin } = await sb.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) return responderJSON(res, 401, { erro: 'Login do admin falhou: ' + erroLogin.message });

  if (corpo.salvarLogin){
    credenciais.email = email;
    credenciais.senha = senha;
    await salvarCredenciais(credenciais);
  }

  // Atualizando um produto existente: busca o registro completo agora
  // que já está logado como admin (produtos_admin() devolve tudo,
  // inclusive observacoes_internas, que não é público) — as observações
  // novas são ACRESCENTADAS embaixo das antigas, nunca substituem uma
  // anotação sua de antes.
  let produtoExistenteAtual = null;
  if (corpo.produtoExistenteId){
    const { data } = await sb.rpc('produtos_admin').select('*').eq('id', corpo.produtoExistenteId).maybeSingle();
    produtoExistenteAtual = data || null;
  }

  // Sobe cada foto que ainda não é do nosso Storage (uma foto já
  // reaproveitada de uma tentativa anterior — ex: você voltou e mandou
  // publicar de novo — não é baixada e subida de novo à toa).
  async function garantirNoStorage(url, pasta){
    if (!url) return null;
    if (url.includes('supabase.co/storage')) return url;
    return baixarESubirFoto(sb, url, pasta);
  }

  const fotosFinal = [];
  for (const url of (corpo.fotos || [])){
    const final = await garantirNoStorage(url, 'importados');
    if (final) fotosFinal.push(final);
  }

  const banhosFinal = [];
  for (const b of (corpo.banhos || [])){
    const fotoUrl = await garantirNoStorage(b.foto, 'importados');
    if (!fotoUrl) continue; // o site exige foto por banho — sem foto, essa opção não é salva
    banhosFinal.push({ nome: b.nome, custo: Number(b.custo) || 0, preco: Number(b.preco) || 0, foto_url: fotoUrl });
  }

  const { data: categoriaValida } = await sb.from('categorias').select('slug').eq('slug', corpo.categoria).eq('ativa', true).maybeSingle();
  if (!categoriaValida) return responderJSON(res, 400, { erro: 'Categoria inválida ou inativa — escolhe uma da lista.' });

  // CRÍTICO: sem isso, o site nunca muda o preço mostrado quando o
  // cliente escolhe um quilate/banho diferente (sempre mostra o preço
  // base) — é o campo que resolverPrecoVariante() (shared.js) usa de
  // verdade, não só quilates_disponiveis/banhos_disponiveis.
  const custoPecaNumero = Number(corpo.custoPeca) || 0;
  const custoImpostoNumero = corpo.custoImposto !== null && corpo.custoImposto !== undefined && corpo.custoImposto !== '' ? Number(corpo.custoImposto) : null;
  const custoFreteNumero = Number(corpo.custoFrete) || 0;
  const taxaImpostoAprox = (custoPecaNumero > 0 && custoImpostoNumero) ? custoImpostoNumero / custoPecaNumero : 0;
  const margemNumero = Number(corpo.margemLucro) || null;
  const { matrizPrecos, matrizCustos } = montarMatrizes({
    quilatesCustos: (corpo.quilates || []).map(q => ({
      valor: q.valor,
      custo: Number(q.custo) || 0,
      custoComImposto: q.custoComImposto != null ? Number(q.custoComImposto) : null
    })),
    banhosCustos: banhosFinal.map(b => ({ nome: b.nome, custo: b.custo })),
    custoPecaBase: custoPecaNumero,
    taxaImposto: taxaImpostoAprox,
    margemNumero,
    freteNumero: custoFreteNumero
  });

  // Atualizando: acrescenta a observação nova embaixo da que já existia,
  // não substitui. Produto novo: só o que veio do formulário mesmo.
  const observacoesFinal = produtoExistenteAtual?.observacoes_internas
    ? `${produtoExistenteAtual.observacoes_internas}\n\n${corpo.observacoes || ''}`.trim()
    : (corpo.observacoes || null);

  const dadosProduto = {
    nome: corpo.nome || '(sem nome)',
    descricao: corpo.descricao || null,
    fotos: fotosFinal,
    link_fornecedor: corpo.linkFornecedor || null,
    observacoes_internas: observacoesFinal,
    categoria: corpo.categoria,
    ativo: Boolean(corpo.ativo),
    preco: Number(corpo.preco) || 0,
    custo_peca: custoPecaNumero,
    custo_frete: custoFreteNumero,
    ...(custoImpostoNumero !== null ? { custo_imposto: custoImpostoNumero } : {}),
    ...(margemNumero ? { margem_lucro: margemNumero } : {}),
    ...(corpo.estoque !== null && corpo.estoque !== undefined && corpo.estoque !== '' ? { estoque: Number(corpo.estoque) } : {}),
    ...(corpo.tamanhos?.length ? { tamanhos_disponiveis: corpo.tamanhos } : {}),
    ...(corpo.quilates?.length ? {
      quilates_disponiveis: corpo.quilates.map(q => ({ valor: q.valor, preco: Number(q.preco) || 0, descricao: q.descricao || '' })),
      // Taxa separada do custo (campo próprio no admin agora, digitado na
      // mão) — usa a taxa REAL lida naquele quilate quando veio
      // (custoComImposto), só aproxima pela proporção do produto base
      // quando não leu (mesmo fallback de sempre, ver montarMatrizes).
      quilates_custos: corpo.quilates.map(q => {
        const custo = Number(q.custo) || 0;
        const taxa = q.custoComImposto != null
          ? Math.round((Number(q.custoComImposto) - custo) * 100) / 100
          : Math.round(custo * taxaImpostoAprox * 100) / 100;
        return { valor: q.valor, custo, taxa };
      })
    } : {}),
    ...(banhosFinal.length ? {
      banhos_disponiveis: banhosFinal.map(b => ({ nome: b.nome, preco: b.preco, foto_url: b.foto_url })),
      banhos_custos: banhosFinal.map(b => ({ nome: b.nome, custo: b.custo }))
    } : {}),
    ...(matrizPrecos.length ? { matriz_precos: matrizPrecos, matriz_custos: matrizCustos } : {})
  };

  // Sem ".select()" no final de propósito (mesmo motivo do script de
  // terminal): a leitura direta da tabela produtos é restrita mesmo pra
  // admin — insert/update funcionam igual, só não confirmam id/slug de volta.
  const { error: erroSalvar } = corpo.produtoExistenteId
    ? await sb.from('produtos').update(dadosProduto).eq('id', corpo.produtoExistenteId)
    : await sb.from('produtos').insert(dadosProduto);

  if (erroSalvar){
    return responderJSON(res, 500, { erro: erroSalvar.message });
  }
  responderJSON(res, 200, {
    ok: true,
    atualizado: Boolean(corpo.produtoExistenteId),
    fotosEnviadas: fotosFinal.length,
    banhosSalvos: banhosFinal.length
  });
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORTA}`);
    if (req.method === 'GET' && url.pathname === '/'){
      const html = await readFile(path.join(__dirname, 'interface.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (req.method === 'GET' && url.pathname === '/api/status'){
      await handleStatus(req, res);
    } else if (req.method === 'GET' && url.pathname === '/api/imagem-proxy'){
      await handleImagemProxy(req, res, url);
    } else if (req.method === 'GET' && url.pathname === '/api/categorias'){
      await handleCategorias(req, res);
    } else if (req.method === 'POST' && url.pathname === '/api/buscar'){
      await handleBuscar(req, res);
    } else if (req.method === 'POST' && url.pathname === '/api/regenerar'){
      await handleRegenerar(req, res);
    } else if (req.method === 'POST' && url.pathname === '/api/publicar'){
      await handlePublicar(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado');
    }
  } catch (err) {
    responderJSON(res, 500, { erro: err.message });
  }
});

// Desliga o limite de tempo padrão do Node pra um pedido — buscar um
// produto com bastante quilate/cor pode demorar vários minutos (clica
// em cada combinação de verdade), o padrão cortaria a conexão antes de
// terminar.
servidor.requestTimeout = 0;
servidor.headersTimeout = 0;

servidor.listen(PORTA, () => {
  const enderecoLocal = `http://localhost:${PORTA}`;
  console.log(`\nInterface pronta! Abrindo no navegador: ${enderecoLocal}`);
  console.log('(se não abrir sozinho, copia esse endereço e cola no navegador)');
  console.log('\nDeixa esse terminal aberto enquanto usa a interface — fecha com Ctrl+C quando terminar.\n');

  // Abre o navegador padrão sozinho — comando muda por sistema
  // operacional, tenta os três principais (só um vai funcionar, os
  // outros erros são ignorados de propósito).
  const comando = process.platform === 'win32' ? `start ${enderecoLocal}`
    : process.platform === 'darwin' ? `open ${enderecoLocal}`
    : `xdg-open ${enderecoLocal}`;
  exec(comando, () => { /* se não conseguiu abrir sozinho, o usuário abre na mão mesmo */ });
});
