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
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ARQUIVO_SESSAO = path.join(__dirname, '.sessao-aliexpress.json');
// Guarda e-mail/senha do admin + chave do Groq localmente pra não
// perguntar de novo a cada importação. Fica só no seu computador (nunca
// vai pro GitHub — já está no .gitignore) mas é TEXTO PURO, sem
// criptografia nenhuma — não compartilha essa pasta com ninguém.
export const ARQUIVO_CREDENCIAIS = path.join(__dirname, '.credenciais.json');

export async function carregarCredenciais(){
  try {
    return JSON.parse(await readFile(ARQUIVO_CREDENCIAIS, 'utf-8'));
  } catch {
    return {};
  }
}

export async function salvarCredenciais(dados){
  try {
    // Guarda senha de admin e chave da API do Groq em texto puro — mode
    // 0o600 (só o dono do arquivo lê/escreve) evita que outro usuário do
    // mesmo computador consiga ler isso, já que o padrão do sistema
    // operacional às vezes deixa arquivo novo legível por qualquer um
    // (bug real encontrado numa revisão). O `mode` do writeFile só vale
    // na criação do arquivo — o chmod depois garante isso mesmo se o
    // arquivo já existia de uma versão anterior desta ferramenta.
    await writeFile(ARQUIVO_CREDENCIAIS, JSON.stringify(dados, null, 2), { mode: 0o600 });
    await chmod(ARQUIVO_CREDENCIAIS, 0o600).catch(() => {});
  } catch { /* não trava a importação por causa disso */ }
}

// Mesma URL/chave pública já usadas em todo o site (shared.js) — a chave
// "anon" é pública de propósito, quem realmente autentica é o login do
// admin logo abaixo, não essa chave.
export const SUPABASE_URL = 'https://pqhdtteeukfcjstfsnkn.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxaGR0dGVldWtmY2pzdGZzbmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzc0MTAsImV4cCI6MjEwMTk1MzQxMH0.VwOKgaNEmKaT-xGqF-S0Cr2mY9i4O_4eIFkqpdv0KiY';

// Checa se esse link já foi importado antes — usa uma função do banco
// (produto_por_link_fornecedor) que devolve só o mínimo (id/nome/
// categoria/ativo), sem precisar estar logado como admin ainda (link_fornecedor
// em si continua escondido do público, só essa checagem pontual é liberada).
// Roda ANTES de abrir o navegador/AliExpress de propósito — sem sentido
// gastar 1+ minuto clicando em variações pra descobrir só depois que já
// existe.
export async function buscarProdutoExistente(sb, link){
  if (!link) return null;
  try {
    const { data, error } = await sb.rpc('produto_por_link_fornecedor', { p_link: link }).maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

// Mesma tabela de conversão de tamanho de anel EUA -> BR já usada no
// admin do site (admin.html, CONVERSAO_TAMANHO_EUA_BR) — o AliExpress
// sempre mostra tamanho americano, o site só guarda/mostra o BR
// convertido. Copiada aqui de propósito (arquivos são independentes); se
// um dia mudar lá, muda aqui também.
const CONVERSAO_TAMANHO_EUA_BR = {
  "3": "4", "3.5": "6", "4": "7", "4.5": "8", "5": "9", "5.5": "11",
  "6": "12", "6.5": "13", "7": "14", "7.5": "16", "8": "17", "8.5": "18",
  "9": "20", "9.5": "21", "10": "22", "10.5": "23", "11": "25", "11.5": "26",
  "12": "27", "12.5": "29", "13": "30"
};

// Acha, entre as variações encontradas, o grupo que é tamanho de anel —
// pelo nome ("Tamanho", "Tamanho do anel"...) ou, se nenhum grupo tiver
// nome reconhecível, pelo valor já bater com a tabela EUA (3 a 13, com
// meios) — e converte pra numeração BR, igual o admin faz.
export function converterTamanhosParaBR(variacoes){
  const porNome = variacoes.find(v => /tamanho/i.test(v.nome));
  const porValor = variacoes.find(v => v.valores.some(x => CONVERSAO_TAMANHO_EUA_BR[x.trim()]));
  const grupo = porNome || porValor;
  if (!grupo) return { tamanhosBR: [], avisoTamanho: null };

  const convertidos = [];
  const naoReconhecidos = [];
  grupo.valores.forEach(v => {
    const br = CONVERSAO_TAMANHO_EUA_BR[v.trim()];
    if (br) convertidos.push(br); else naoReconhecidos.push(v);
  });
  const tamanhosBR = [...new Set(convertidos)].sort((a, b) => parseFloat(a) - parseFloat(b));
  const avisoTamanho = naoReconhecidos.length
    ? `Não reconheci esses valores de "${grupo.nome}" (fora da tabela EUA 3-13): ${naoReconhecidos.join(', ')} — confere/adiciona na mão.`
    : null;
  return { tamanhosBR, avisoTamanho };
}

// Mesmas cores pré-definidas do admin (admin.html, BANHO_PRESETS) — tenta
// bater o nome que o AliExpress deu (geralmente em inglês, tipo "Silver",
// "Rose Gold") com uma dessas; se não reconhecer, mantém o nome original
// (o admin trata como "Outra cor" nesse caso, funciona igual, só não some
// automaticamente marcado num preset).
function traduzirNomeBanho(nomeOriginal){
  const n = nomeOriginal.toLowerCase();
  // Não reduz todo "gold" a Ouro 18k: fornecedores frequentemente usam a
  // mesma variação para "925 Gold Plated" e "14K Gold". Tratar os dois
  // como o mesmo banho cria combinações que nem existem e troca o preço.
  if (/925/.test(n) && /(gold|dourad|ouro|plated|banhad)/.test(n)) return 'Prata 925 banhada a ouro';
  if (/14\s*k|14k|au\s*585|585/.test(n)) return 'Ouro 14k';
  if (/18\s*k|18k|au\s*750|750/.test(n)) return 'Ouro 18k';
  // O admin já tem "Ouro 18k" como opção padrão. "yellow gold color"
  // descreve a cor amarela do ouro, não uma cor personalizada nova.
  if (/yellow|amarel/.test(n)) return 'Ouro 18k';
  if (/rose|rosé|rosa/.test(n)) return 'Ouro Rosé';
  if (/white|branco/.test(n)) return 'Ouro Branco';
  if (/(black|negro|preto).*(rhod|ródio|rodio)|(rhod|ródio|rodio).*(black|negro|preto)/.test(n)) return 'Ródio negro';
  if (/rhod|ródio|rodio/.test(n)) return 'Ródio';
  if (/gold|dourad|ouro/.test(n)) return 'Ouro 18k';
  if (/silver|prata/.test(n)) return 'Prata 925';
  return nomeOriginal;
}

// Separa as variações encontradas em "quilate" (tamanho da pedra) e
// "banho" (cor/acabamento) — os dois eixos que o admin já sabe cadastrar
// com preço próprio por combinação:
//  - "separado": o AliExpress já dá cada eixo num grupo próprio (o de
//    quilate tem todo mundo no formato "1ct", "2ct"...).
//  - "combinado": um fornecedor descuidado junta os dois numa "cor" só
//    (ex: "Silver-1CT") — separa cada valor em (cor, quilate) por regex.
//  - "nenhum": não deu pra separar com segurança (não mexe em nada,
//    melhor não arriscar dado errado do que inventar uma estrutura).
// Acha o "Nct" no COMEÇO de um valor, mesmo com mais coisa depois (ex:
// "0.5ct 5mm" — o diâmetro da pedra em mm, informação redundante que dá
// pra descartar) — devolve só o quilate normalizado ("0.5ct") ou null se
// nem o começo bater.
function inicioQuilate(valor){
  const m = valor.trim().match(/^(\d+(?:[.,]\d+)?)\s*ct\b/i);
  return m ? `${m[1].replace(',', '.')}ct` : null;
}

// "1ct (5x7mm)" é um grupo limpo de quilates; já "1ct gold" não é —
// contém uma cor/material escondido na mesma opção e deve cair na IA para
// ser desmembrado, em vez de sumir com o "gold" na importação.
function ehOpcaoQuilatePura(valor){
  if (!inicioQuilate(valor)) return false;
  const resto = String(valor).replace(/^\s*\d+(?:[.,]\d+)?\s*ct\b\s*/i, '').trim();
  return !resto || /^[\d\s().×xX-]*(?:mm)?[\d\s().×xX-]*$/i.test(resto);
}

// Alguns vendedores escrevem a mesma informação de maneiras bem fora do
// padrão: "gold 1ct", "1ct gold", "2ct (7x9mm)"... Para validar o que a
// IA devolve, basta que o CT exista de verdade em algum ponto do texto
// original; a IA nunca ganha permissão para inventar um tamanho de pedra.
function quilateNoTexto(valor){
  const m = String(valor || '').match(/(\d+(?:[.,]\d+)?)\s*ct\b/i);
  return m ? `${m[1].replace(',', '.')}ct` : null;
}

export function classificarGruposVariacao(variacoes){
  const semTamanho = variacoes.filter(v => !/tamanho/i.test(v.nome) && v.valores.length);
  const ehQuilatePuro = (v) => v.valores.every(ehOpcaoQuilatePura);

  const grupoQuilate = semTamanho.find(ehQuilatePuro);
  if (grupoQuilate){
    const grupoBanho = semTamanho.find(v => v !== grupoQuilate) || null;
    return { modo: 'separado', grupoQuilate, grupoBanho };
  }

  const regexCombo = /^(.*?)[\s\-]*([\d.,]+)\s*ct\.?$/i;
  for (const grupo of semTamanho){
    const partes = grupo.valores.map(v => v.match(regexCombo));
    if (partes.length && partes.every(Boolean)){
      const combos = grupo.valores.map((v, i) => ({
        valorOriginal: v,
        banho: partes[i][1].trim() || 'Padrão',
        quilate: `${partes[i][2].replace(',', '.')}ct`
      }));
      return { modo: 'combinado', grupoOriginal: grupo, combos };
    }
  }

  return { modo: 'nenhum' };
}

// A IA entra justamente quando as regras não conseguem entender a escrita
// do fornecedor. Ela recebe SOMENTE os grupos e opções que vieram da página
// e devolve uma estrutura fechada. Antes de aceitar, validamos cada nome e
// cada CT contra os dados crus: assim ela ajuda a interpretar "1ct gold",
// mas não consegue criar uma cor/quilate que o AliExpress não vende.
function validarClassificacaoIA(variacoes, resultado){
  if (!resultado || resultado.confianca !== 'alta') return null;
  const grupos = new Map((variacoes || []).map(g => [g.nome, g]));
  const modo = resultado.modo;

  if (modo === 'separado'){
    const grupoQuilate = grupos.get(resultado.grupoQuilate);
    const grupoBanho = resultado.grupoBanho ? grupos.get(resultado.grupoBanho) : null;
    if (!grupoQuilate || (resultado.grupoBanho && !grupoBanho) || grupoQuilate === grupoBanho) return null;
    if (!grupoQuilate.valores.every(quilateNoTexto)) return null;
    return { modo, grupoQuilate, grupoBanho, origem: 'ia', motivo: String(resultado.motivo || '').slice(0, 180) };
  }

  if (modo === 'combinado'){
    const grupoOriginal = grupos.get(resultado.grupoCombinado);
    const combosRecebidos = Array.isArray(resultado.combos) ? resultado.combos : [];
    if (!grupoOriginal || combosRecebidos.length !== grupoOriginal.valores.length) return null;
    const usados = new Set();
    const combos = [];
    for (const item of combosRecebidos){
      const valorOriginal = String(item?.valorOriginal || '');
      const quilate = String(item?.quilate || '').trim().toLowerCase();
      const banho = String(item?.banho || '').trim();
      if (!grupoOriginal.valores.includes(valorOriginal) || usados.has(valorOriginal) || !banho || banho.length > 80) return null;
      if (!/^\d+(?:\.\d+)?ct$/.test(quilate) || quilateNoTexto(valorOriginal) !== quilate) return null;
      usados.add(valorOriginal);
      combos.push({ valorOriginal, quilate, banho });
    }
    if (usados.size !== grupoOriginal.valores.length) return null;
    return { modo, grupoOriginal, combos, origem: 'ia', motivo: String(resultado.motivo || '').slice(0, 180) };
  }
  return null;
}

export async function interpretarVariacoesComIA({ nomeProduto, variacoes }, chaveApi){
  if (!chaveApi || !Array.isArray(variacoes) || !variacoes.length) return null;
  const grupos = variacoes.map(g => ({ nome: String(g.nome || '').slice(0, 100), valores: (g.valores || []).map(v => String(v).slice(0, 120)).slice(0, 30) }));
  const prompt = `Você é a etapa de interpretação de variações da Pavan & Co., loja de joias. Um anúncio do AliExpress pode chamar as opções de qualquer jeito: por exemplo, "1ct gold", "gold 2ct", "925 Gold Plated 1CT", ou separar cor e quilate em grupos diferentes.

Produto: ${String(nomeProduto || '').slice(0, 500)}
Grupos extraídos literalmente da página (não invente nenhum nome/opção):
${JSON.stringify(grupos)}

Decida apenas quando tiver certeza ALTA. Ignore grupos de tamanho de aro. Você pode devolver:
- "separado": há um grupo de quilates e, opcionalmente, um grupo separado de cor/banho;
- "combinado": cada opção de UM grupo mistura CT e cor/banho; separe cada opção em quilate e banho;
- "nenhum": não é seguro decidir.

Regras obrigatórias:
- Cada valorOriginal de combos deve ser copiado idêntico da lista recebida.
- quilate deve ser somente "1ct", "2ct", etc. e já existir dentro daquele valorOriginal.
- banho é só a parte de cor/material da mesma opção; não invente 14k/18k se a opção só disser gold.
- Use confianca "alta" somente se todos os valores do grupo combinado forem explicados. Se houver dúvida, use "baixa" e modo "nenhum".

Responda SOMENTE JSON válido em um destes formatos:
{"modo":"separado","confianca":"alta","grupoQuilate":"nome exato","grupoBanho":"nome exato ou null","motivo":"curto"}
{"modo":"combinado","confianca":"alta","grupoCombinado":"nome exato","combos":[{"valorOriginal":"texto exato","quilate":"1ct","banho":"gold"}],"motivo":"curto"}
{"modo":"nenhum","confianca":"baixa","motivo":"curto"}`;
  try {
    return validarClassificacaoIA(variacoes, await chamarGroqJSON(prompt, chaveApi));
  } catch {
    return null;
  }
}

// Converte um preço no formato brasileiro ("R$149,14", "R$1.234,56") pro
// número puro que o banco espera (149.14, 1234.56). Se não conseguir
// entender o texto, devolve null — melhor deixar vazio do que salvar
// errado.
export function paraNumero(precoTexto){
  if (!precoTexto) return null;
  const limpo = precoTexto.replace(/[^\d.,]/g, '');
  const normalizado = limpo.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

// Acha o primeiro "R$X,XX" dentro de uma frase qualquer (ex: "Compra
// internacional, R$35,20+ em impostos estimados.") e converte só essa
// parte — paraNumero() sozinho quebraria aqui, porque pegaria também
// vírgula/ponto de outras partes da frase que não são o valor.
export function extrairValorReais(texto){
  if (!texto) return null;
  const m = texto.match(/R\$\s*([\d.,]+)/);
  return m ? paraNumero(m[1]) : null;
}

// Clica numa opção de variação pelo valor (o mesmo valor que já vem no
// title="" ou no alt="" da imagem, ver extração de variações acima) —
// devolve true/false em vez de deixar o erro subir, pra quem chama poder
// só pular essa opção específica sem travar o resto.
async function clicarOpcaoVariacao(page, valor){
  try {
    const valorEscapado = valor.replace(/"/g, '\\"');
    await page.locator(`[data-sku-col][title="${valorEscapado}"], [data-sku-col]:has(img[alt="${valorEscapado}"])`)
      .first().click({ timeout: 3000 });
    await page.waitForTimeout(700); // dá tempo do preço/foto na tela atualizar depois do clique
    return true;
  } catch { return false; }
}

async function lerPrecoAtual(page){
  try {
    const t = await page.locator('[class*="price-default--current"]').first().textContent({ timeout: 3000 });
    return extrairValorReais(t);
  } catch { return null; }
}

// O imposto de importação NÃO é proporcional ao valor (a regra real —
// Remessa Conforme — tem um desconto FIXO de US$30 acima de US$50, então
// quanto maior o valor, MAIOR a fatia de imposto, não a mesma fração) —
// por isso lê o imposto de verdade que o próprio AliExpress mostra pra
// CADA combinação clicada, em vez de aproximar pela proporção do produto
// base (isso já rendeu um valor errado pra menos num teste real).
async function lerTextoImposto(page){
  try {
    const t = await page.locator('[class*="vat-installment--item"]').first().textContent({ timeout: 2000 });
    return t?.replace(/\s+/g, ' ').trim() || null;
  } catch { return null; }
}

// O preço do AliExpress muda antes do bloco de imposto. Espera o texto do
// imposto trocar depois de cada clique para não salvar o imposto do CT
// anterior (precisão vale mais que alguns milissegundos na importação).
async function lerImpostoAtual(page, textoAnterior = null){
  let ultimoTexto = null;
  const limite = Date.now() + (textoAnterior ? 4500 : 2000);
  do {
    const texto = await lerTextoImposto(page);
    if (texto){
      ultimoTexto = texto;
      if (!textoAnterior || texto !== textoAnterior) return extrairValorReais(texto);
    }
    if (Date.now() < limite) await page.waitForTimeout(220);
  } while (Date.now() < limite);
  try {
    return extrairValorReais(ultimoTexto);
  } catch { return null; }
}

// Tenta achar a foto principal mostrada NA TELA agora (depois de um
// clique de variação) — diferente das fotos do produto (essas vêm prontas
// escondidas no JS da página e não mudam quando clica numa cor). Isso
// aqui é mais especulativo (não tem como eu testar contra o AliExpress
// de verdade daqui), por isso sempre com fallback: se não achar, quem
// chamar usa uma foto padrão em vez de travar.
async function fotoAtualDaVariante(page){
  try {
    const src = await page.locator('img[class*="magnifier"]').first().getAttribute('src', { timeout: 2000 });
    if (src) return src.startsWith('http') ? src : `https:${src}`;
  } catch { /* segue pro próximo jeito de tentar */ }
  return null;
}

// Monta a matriz de custo por quilate/banho clicando em cada opção de
// verdade na página (não tem como saber o preço de cada combinação sem
// isso — o AliExpress só mostra o preço da combinação selecionada no
// momento). Devolve null quando não dá pra separar quilate de banho com
// segurança (quem chama cai pro modo antigo: mostra tudo cru pro admin
// decidir na mão nesse caso).
async function capturarMatrizVariacoes(page, variacoes, classificacaoPronta = null){
  const classificacao = classificacaoPronta || classificarGruposVariacao(variacoes);
  const avisos = [];

  if (classificacao.modo === 'nenhum') return null;

  if (classificacao.modo === 'combinado'){
    // Um grupo só, tipo "Silver-1CT" — cada opção já é uma combinação
    // completa, um clique único seleciona ela.
    const resultados = [];
    for (const combo of classificacao.combos){
      const impostoAntes = await lerTextoImposto(page);
      const clicou = await clicarOpcaoVariacao(page, combo.valorOriginal);
      if (!clicou){ avisos.push(`Não consegui clicar em "${combo.valorOriginal}"`); continue; }
      const preco = await lerPrecoAtual(page);
      if (preco === null){ avisos.push(`Não consegui ler o preço de "${combo.valorOriginal}"`); continue; }
      const imposto = await lerImpostoAtual(page, impostoAntes);
      const foto = await fotoAtualDaVariante(page);
      resultados.push({ ...combo, preco, foto, custoComImposto: imposto !== null ? preco + imposto : null });
    }
    if (!resultados.length) return { quilatesCustos: [], banhosCustos: [], avisos };

    const porBanho = {};
    resultados.forEach(r => { (porBanho[r.banho] ??= []).push(r); });
    const nomesBanho = Object.keys(porBanho);
    const banhoRef = nomesBanho[0];

    const quilatesCustos = porBanho[banhoRef].map(r => ({ valor: r.quilate, custo: r.preco, custoComImposto: r.custoComImposto }));
    const banhosCustos = [];
    for (const nomeBanho of nomesBanho){
      // O banho de REFERÊNCIA também precisa virar uma opção selecionável
      // (custo 0, é a base) — sem isso ele nunca entra em banhos_custos e
      // fica impossível escolher essa cor no site (bug real: um banho de
      // verdade do fornecedor some do catálogo).
      if (nomeBanho === banhoRef){
        banhosCustos.push({ nome: traduzirNomeBanho(nomeBanho), custo: 0, foto: porBanho[nomeBanho][0]?.foto });
        continue;
      }
      const itensBanho = porBanho[nomeBanho];
      const deltas = itensBanho
        .map(r => {
          const ref = porBanho[banhoRef].find(x => x.quilate === r.quilate);
          return ref ? r.preco - ref.preco : null;
        })
        .filter(d => d !== null);
      const deltaMedio = deltas.length
        ? deltas.reduce((a, b) => a + b, 0) / deltas.length
        : itensBanho[0].preco - quilatesCustos[0].custo; // sem quilate em comum pra comparar — aproxima pelo primeiro
      banhosCustos.push({
        nome: traduzirNomeBanho(nomeBanho),
        custo: Math.round(deltaMedio * 100) / 100,
        foto: itensBanho[0].foto
      });
    }
    // Mantém também a lista de combinações EXATAS. Nem todo anúncio tem
    // uma grade completa (ex.: 925/1ct, 925/2ct, 14k/2ct, 14k/3ct), então
    // transformar isso num cruzamento cor × quilate inventaria 14k/1ct e
    // 925/3ct — opções que o fornecedor não vende.
    const combosExatos = resultados.map(r => ({
      quilate: r.quilate,
      banho: traduzirNomeBanho(r.banho),
      custo: r.preco,
      custoComImposto: r.custoComImposto,
      foto: r.foto
    }));
    return { quilatesCustos, banhosCustos, combosExatos, avisos };
  }

  // modo "separado": um grupo de quilate limpo + (opcional) um grupo de
  // banho limpo, cada um clicado de propósito.
  const { grupoQuilate, grupoBanho } = classificacao;

  async function precoEImpostoNoQuilate(valorQuilate){
    const impostoAntes = await lerTextoImposto(page);
    const clicou = await clicarOpcaoVariacao(page, valorQuilate);
    if (!clicou) return { preco: null, custoComImposto: null };
    const preco = await lerPrecoAtual(page);
    if (preco === null) return { preco: null, custoComImposto: null };
    const imposto = await lerImpostoAtual(page, impostoAntes);
    return { preco, custoComImposto: imposto !== null ? preco + imposto : null };
  }

  if (!grupoBanho){
    // só quilate, sem cor/banho pra variar
    const quilatesCustos = [];
    for (const valor of grupoQuilate.valores){
      const { preco, custoComImposto } = await precoEImpostoNoQuilate(valor);
      if (preco === null){ avisos.push(`Não consegui ler o preço do quilate "${valor}"`); continue; }
      quilatesCustos.push({ valor: inicioQuilate(valor) || valor, custo: preco, custoComImposto });
    }
    return { quilatesCustos, banhosCustos: [], avisos };
  }

  // Os dois grupos existem: fixa cada banho e varre os quilates dentro
  // dele — o primeiro banho vira a referência (vai pra quilates_custos),
  // os outros viram delta (banhos_custos), comparando no mesmo quilate.
  const porBanho = {};
  for (const nomeBanho of grupoBanho.valores){
    const clicouBanho = await clicarOpcaoVariacao(page, nomeBanho);
    if (!clicouBanho){ avisos.push(`Não consegui clicar na cor/banho "${nomeBanho}"`); continue; }
    const foto = await fotoAtualDaVariante(page);
    const itens = [];
    for (const valorQuilate of grupoQuilate.valores){
      const { preco, custoComImposto } = await precoEImpostoNoQuilate(valorQuilate);
      if (preco === null){ avisos.push(`Não consegui ler o preço de "${nomeBanho}" + "${valorQuilate}"`); continue; }
      itens.push({ quilate: valorQuilate, preco, custoComImposto });
    }
    if (itens.length) porBanho[nomeBanho] = { itens, foto };
  }

  const nomesBanho = Object.keys(porBanho);
  if (!nomesBanho.length) return { quilatesCustos: [], banhosCustos: [], avisos };

  const banhoRef = nomesBanho[0];
  const quilatesCustos = porBanho[banhoRef].itens.map(i => ({ valor: inicioQuilate(i.quilate) || i.quilate, custo: i.preco, custoComImposto: i.custoComImposto }));
  const banhosCustos = [];
  for (const nomeBanho of nomesBanho){
    // O banho de REFERÊNCIA também precisa virar opção selecionável
    // (custo 0, é a base) — mesma correção do modo "combinado" acima,
    // sem isso essa cor real do fornecedor some do catálogo.
    if (nomeBanho === banhoRef){
      banhosCustos.push({ nome: traduzirNomeBanho(nomeBanho), custo: 0, foto: porBanho[nomeBanho].foto });
      continue;
    }
    const deltas = porBanho[nomeBanho].itens
      .map(i => {
        const ref = porBanho[banhoRef].itens.find(r => r.quilate === i.quilate);
        return ref ? i.preco - ref.preco : null;
      })
      .filter(d => d !== null);
    const deltaMedio = deltas.length
      ? deltas.reduce((a, b) => a + b, 0) / deltas.length
      : porBanho[nomeBanho].itens[0].preco - quilatesCustos[0].custo;
    banhosCustos.push({
      nome: traduzirNomeBanho(nomeBanho),
      custo: Math.round(deltaMedio * 100) / 100,
      foto: porBanho[nomeBanho].foto
    });
  }
  // Aqui a página tem cor e quilate em controles separados. Mesmo assim,
  // lê cada cruzamento de verdade: imposto pode mudar com a cor, mesmo
  // quando o valor anunciado parece igual. Essa lista é a fonte de
  // verdade na publicação; os deltas acima ficam só como referência.
  const combosExatos = nomesBanho.flatMap(nomeBanho => porBanho[nomeBanho].itens.map(item => ({
    quilate: inicioQuilate(item.quilate) || item.quilate,
    banho: traduzirNomeBanho(nomeBanho),
    custo: item.preco,
    custoComImposto: item.custoComImposto,
    foto: porBanho[nomeBanho].foto
  })));
  return { quilatesCustos, banhosCustos, combosExatos, avisos };
}

// Monta a matriz preço/custo por combinação de quilate × banho — é o
// campo que o SITE usa de verdade pra saber o preço quando o cliente
// escolhe uma opção (resolverPrecoVariante(), em shared.js). SEM isso, o
// preço mostrado no site NUNCA muda quando o cliente troca de quilate/
// cor, mesmo com quilates_disponiveis/banhos_disponiveis preenchidos —
// vira bug real de precificação, não só cosmético (bug real encontrado
// num teste: produto com matriz vazia sempre mostrava o preço base,
// mesmo escolhendo um quilate bem mais caro). Mesmo formato que o
// admin.html calcula sozinho ao salvar (calcularMatrizPrecos/Custos) —
// só que aqui usa o imposto de verdade que o AliExpress mostrou (quando
// disponível por quilate — ver custoComImposto em capturarMatrizVariacoes)
// em vez de aproximar todo mundo pela mesma proporção do produto base
// (o imposto real NÃO é proporcional ao valor — regra Remessa Conforme
// tem um desconto fixo de US$30 acima de US$50, então valores maiores
// pagam uma fatia maior de imposto, não a mesma fração; aproximar pela
// proporção do mais barato SUBESTIMA o imposto dos quilates maiores —
// bug real encontrado num teste). O delta do banho continua aproximado
// pela proporção (costuma ser pequeno ou zero, erro pouco relevante ali).
export function montarMatrizes({ quilatesCustos, banhosCustos, custoPecaBase, taxaImposto, margemNumero, freteNumero, custoOperacaoNumero = 0, taxaPagamentoNumero = 0 }){
  if (!quilatesCustos.length && !banhosCustos.length) return { matrizPrecos: [], matrizCustos: [] };
  const quilates = quilatesCustos.length ? quilatesCustos : [{ valor: null, custo: custoPecaBase }];
  const banhos = banhosCustos.length ? banhosCustos : [{ nome: null, custo: 0 }];
  // Frete e operação (embalagem, reenvio no Brasil etc.) não variam por
  // quilate/banho — são custos fixos por unidade e entram antes da margem.
  const frete = Number(freteNumero) || 0;
  const operacao = Number(custoOperacaoNumero) || 0;
  // A taxa de pagamento é percentual sobre a venda. Divide o preço em vez
  // de só somar ao custo, para a margem escolhida continuar sendo líquida.
  const taxaPagamento = Math.min(Math.max(Number(taxaPagamentoNumero) || 0, 0), 95) / 100;

  const matrizPrecos = [];
  const matrizCustos = [];
  for (const q of quilates){
    // Se lemos o imposto real desse quilate específico na página, usa
    // ele; senão cai na aproximação por proporção (mesmo comportamento
    // de antes).
    const custoQuilateComImposto = q.custoComImposto != null
      ? Number(q.custoComImposto)
      : (Number(q.custo) || 0) * (1 + (taxaImposto || 0));
    for (const b of banhos){
      const custoBanhoComImposto = (Number(b.custo) || 0) * (1 + (taxaImposto || 0));
      const custoTotal = Math.round((custoQuilateComImposto + custoBanhoComImposto + frete + operacao) * 100) / 100;
      const preco = margemNumero ? Math.round((custoTotal * (1 + margemNumero / 100) / (1 - taxaPagamento)) * 100) / 100 : 0;
      matrizCustos.push({ quilate: q.valor ?? null, banho: b.nome ?? null, custo: custoTotal });
      matrizPrecos.push({ quilate: q.valor ?? null, banho: b.nome ?? null, preco });
    }
  }
  return { matrizPrecos, matrizCustos };
}

// Extensão do arquivo a partir só do PATH da URL (não a URL inteira) —
// olhar a URL inteira fazia o ".com"/".cn" do próprio domínio contar como
// se fosse a extensão em fotos sem extensão de verdade no path (ex:
// ".../kf/Sabc123def456", sem nenhum ponto no nome do arquivo): o `.pop()`
// pegava "com/kf/Sabc123def456" (não tinha outro ponto depois de "com"),
// e o resultado incluía uma "/" no meio — o Storage rejeitava ou criava
// uma pasta aninhada sem querer, e a foto era descartada em silêncio (bug
// real encontrado numa revisão). Sem extensão reconhecível, cai pra "jpg".
function extensaoDaUrl(urlFoto){
  try {
    const nomeArquivo = new URL(urlFoto).pathname.split('/').pop() || '';
    const match = nomeArquivo.match(/\.([a-zA-Z0-9]{1,5})$/);
    return match ? match[1].toLowerCase() : 'jpg';
  } catch {
    return 'jpg';
  }
}

// Nunca usa a ferramenta como ponte para endereços da própria máquina ou
// da rede local. Além de bloquear os formatos comuns de IP, resolve o DNS
// antes do fetch para não aceitar um domínio que aponta para uma faixa
// privada. É usado tanto no proxy da prévia quanto no upload definitivo.
function enderecoPrivadoOuReservado(endereco){
  const tipo = isIP(endereco);
  if (tipo === 4){
    const partes = endereco.split('.').map(Number);
    const [a, b] = partes;
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (tipo === 6){
    const ip = endereco.toLowerCase();
    if (ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || /^fe[89ab]/.test(ip)) return true;
    const mapeado = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return Boolean(mapeado && enderecoPrivadoOuReservado(mapeado[1]));
  }
  return true;
}

export async function urlExternaPublicaPermitida(alvo){
  let url;
  try { url = new URL(alvo); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  try {
    const enderecos = isIP(host)
      ? [{ address: host }]
      : await lookup(host, { all: true, verbatim: true });
    return enderecos.length > 0 && enderecos.every(({ address }) => !enderecoPrivadoOuReservado(address));
  } catch {
    return false;
  }
}

export function linkAliExpressPermitido(alvo){
  try {
    const url = new URL(alvo);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password &&
      (host === 'aliexpress.com' || host.endsWith('.aliexpress.com'));
  } catch {
    return false;
  }
}

// Baixa uma foto de uma URL externa e sobe pro mesmo bucket que o admin
// usa pra upload manual — reaproveitado tanto pras fotos principais do
// produto quanto pras fotos de cada banho/cor. Devolve a URL pública, ou
// null se der qualquer erro (quem chamar decide o que fazer, não trava).
export async function baixarESubirFoto(sb, urlFoto, pasta){
  try {
    if (!(await urlExternaPublicaPermitida(urlFoto))) return null;
    const resp = await fetch(urlFoto, { signal: AbortSignal.timeout(20_000) });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const contentType = resp.headers.get('content-type') || '';
    const tamanhoDeclarado = Number(resp.headers.get('content-length')) || 0;
    if (!contentType.startsWith('image/') || tamanhoDeclarado > 15 * 1024 * 1024) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.length > 15 * 1024 * 1024) return null;
    const extensao = extensaoDaUrl(urlFoto);
    // Nome aleatório, sem mencionar o fornecedor — alguém inspecionando a
    // foto no site não pode ver de onde ela veio.
    const nomeArquivo = `${pasta}/${crypto.randomUUID()}.${extensao}`;
    const { error: erroUpload } = await sb.storage.from('produtos').upload(nomeArquivo, bytes, {
      contentType
    });
    if (erroUpload) throw erroUpload;
    const { data: urlData } = sb.storage.from('produtos').getPublicUrl(nomeArquivo);
    return urlData.publicUrl;
  } catch {
    return null;
  }
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
export async function abrirNavegador({ headless, storageState }){
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
  // Esse arquivo tem os cookies da sua sessão logada no AliExpress — quem
  // conseguir ler ele consegue "ser você" lá, então mesma proteção da
  // .credenciais.json (0o600, só o dono do arquivo lê/escreve).
  await chmod(ARQUIVO_SESSAO, 0o600).catch(() => {});
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
export async function extrairDadosProduto(page, { chaveGroq = null } = {}){
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
      const limpo = limpar(t);
      // Às vezes esse mesmo bloco mostra um AVISO DE LIMITE DE COMPRA
      // ("Limite de 1 peça(s) por cliente") em vez do estoque real —
      // não é a mesma coisa, ignora nesse caso (senão salva um número
      // de estoque errado, tipo "1" quando na real tem bem mais).
      if (limpo && /limite/i.test(limpo)) return null;
      return limpo;
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
    // elemento — às vezes texto simples (com o valor certinho no
    // atributo title=""), às vezes um "quadradinho" de imagem (aí o valor
    // vem no alt="" da <img> lá dentro, o div em si não tem title).
    const grupos = await page.evaluate(() => {
      const valoresDe = (container) => [...new Set(
        [...container.querySelectorAll('[class*="sku-item--text"], [class*="sku-item--image"]')]
          .map(el => (el.getAttribute('title') || el.querySelector('img')?.getAttribute('alt') || el.textContent || '').trim())
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

  // Em alguns produtos, cada opção de uma variação (fora tamanho) tem um
  // PREÇO DIFERENTE (ex: "Silver-1CT" custa mais que "Silver-0.5CT" — o
  // fornecedor só não separou "quilate" de "cor" direito). Tenta separar
  // quilate de banho/cor e clicar em cada combinação de verdade pra saber
  // o custo de cada uma — vira matrizVariacoes (pronto pra salvar direto
  // como quilate/banho no produto). Quando não dá pra separar com
  // segurança, cai num modo mais simples: só clica em cada opção de cada
  // grupo (sem cruzar) e reporta os preços crus, pra revisão manual.
  let classificacaoVariacoes = classificarGruposVariacao(variacoes);
  let interpretacaoVariacoes = null;
  // As regras cobrem os formatos já conhecidos e são instantâneas. Quando
  // o vendedor misturou tudo num nome estranho, a IA recebe o anúncio cru
  // ANTES de qualquer dado ir pro formulário e tenta montar a leitura.
  if (classificacaoVariacoes.modo === 'nenhum' && chaveGroq){
    const leituraIA = await interpretarVariacoesComIA({ nomeProduto: nome, variacoes }, chaveGroq);
    if (leituraIA){
      classificacaoVariacoes = leituraIA;
      interpretacaoVariacoes = { origem: 'ia', modo: leituraIA.modo, motivo: leituraIA.motivo || 'A IA separou as opções do fornecedor.' };
    }
  }
  const matrizVariacoes = await capturarMatrizVariacoes(page, variacoes, classificacaoVariacoes);
  const precosPorVariacao = [];
  if (!matrizVariacoes){
    for (const grupo of variacoes){
      if (/tamanho/i.test(grupo.nome) || grupo.valores.length < 2) continue;
      const precos = {};
      for (const valor of grupo.valores){
        const clicou = await clicarOpcaoVariacao(page, valor);
        if (!clicou) continue;
        const t = await page.locator('[class*="price-default--current"]').first().textContent({ timeout: 3000 }).catch(() => null);
        if (t) precos[valor] = limpar(t);
      }
      if (new Set(Object.values(precos)).size > 1){
        precosPorVariacao.push({ nome: grupo.nome, precos });
      }
    }
  }

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

  return { nome, descricao, fotos, preco, variacoes, avisos, impostoEstimado, estoque, precosPorVariacao, matrizVariacoes, interpretacaoVariacoes };
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

export async function formatarComIA({ nomeOriginal, descricaoOriginal }, chaveApi){
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

  const resultado = await chamarGroqJSON(prompt, chaveApi);
  if (!resultado?.nome) throw new Error('Groq não devolveu um nome');
  return { nome: resultado.nome.trim(), descricao: (resultado.descricao || descricaoOriginal || '').trim() };
}

// Chamada crua à API da Groq pedindo resposta em JSON — usada tanto pela
// formatação inicial (formatarComIA) quanto pela revisão com instrução
// (revisarComIA), pra não duplicar a parte de rede/erro.
async function chamarGroqJSON(prompt, chaveApi){
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
  return JSON.parse(texto);
}

// Pega o nome/descrição JÁ FORMATADOS (o que tá na tela agora, editado ou
// não) e uma instrução livre da pessoa (ex: "dá mais destaque no ct",
// "tira o ct do nome", "escreve com mais ânimo e emojis") — pede pra IA
// REVISAR em cima disso, não gerar do zero de novo. Continua seguindo o
// mesmo padrão de nome/descrição (só a instrução muda o que for pedido).
export async function revisarComIA({ nomeAtual, descricaoAtual, instrucao }, chaveApi){
  const prompt = `Você já formatou o nome e a descrição de um produto da Pavan & Co. (loja de joias) seguindo esse padrão:

PADRÃO DO NOME: [Tipo de peça] + [Material/Pedra] + [Detalhe técnico opcional], até 6 palavras, só a primeira letra maiúscula.
PADRÃO DA DESCRIÇÃO: HTML com 2 a 4 tópicos em <p>, cada um começando com <strong>frase curta</strong>, tom caloroso, sem inventar informação.

Nome atual: ${nomeAtual}
Descrição atual (HTML): ${descricaoAtual || '(sem descrição)'}

Agora aplica esse pedido específico da pessoa que tá revisando (só isso — não muda mais nada além do que foi pedido, mantém o resto igual):
"${instrucao}"

Responda SOMENTE com um JSON válido, no mesmo formato de antes:
{"nome": "...", "descricao": "<p><strong>...</strong> ...</p>"}`;

  const resultado = await chamarGroqJSON(prompt, chaveApi);
  if (!resultado?.nome) throw new Error('Groq não devolveu um nome');
  return { nome: resultado.nome.trim(), descricao: (resultado.descricao || descricaoAtual || '').trim() };
}

// Sugere qual categoria já cadastrada na loja combina melhor com o nome
// do produto (evita sempre cair na "categoria provisória" genérica que
// precisa trocar na mão toda vez). Só sugere — nunca decide sozinho:
// devolve o slug escolhido, ou null se não tiver certeza suficiente ou
// se algo der errado (nesse caso quem chamou cai no comportamento de
// sempre, sem essa sugestão).
export async function sugerirCategoria({ nome, categorias }, chaveApi){
  if (!categorias?.length) return null;
  const lista = categorias.map(c => `${c.slug}: ${c.nome}`).join('\n');
  const prompt = `Uma loja de joias (Pavan & Co.) tem essas categorias cadastradas (formato "slug: nome"):
${lista}

Produto: "${nome}"

Qual dessas categorias combina melhor com esse produto? Responda SOMENTE com um JSON válido usando o "slug" exato de uma das categorias acima (nunca invente um slug que não esteja na lista):
{"categoria": "slug-exato-da-lista"}`;

  try {
    const resultado = await chamarGroqJSON(prompt, chaveApi);
    const slug = resultado?.categoria;
    return categorias.some(c => c.slug === slug) ? slug : null;
  } catch {
    return null;
  }
}

/* ============================================================
   IMPORTAR UM PRODUTO
   ============================================================ */
async function modoImportar(url){
  if (!existsSync(ARQUIVO_SESSAO)){
    console.error('Ainda não tem sessão salva. Roda "npm run login" primeiro.');
    process.exit(1);
  }

  // sb criado logo aqui (não precisa de login pra isso — createClient só
  // monta o objeto) pra já poder checar se esse link já foi importado
  // antes, ANTES de gastar 1+ minuto abrindo o navegador e clicando em
  // variação — sem sentido descobrir isso só depois.
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let produtoExistenteId = null;
  const jaExiste = await buscarProdutoExistente(sb, url);
  if (jaExiste){
    console.log(`\n⚠️  Esse link já foi importado antes: "${jaExiste.nome}" (${jaExiste.ativo ? 'ativo no site' : 'rascunho'}, criado em ${new Date(jaExiste.criado_em).toLocaleDateString('pt-BR')}).`);
    const escolha = (await perguntar('O que você quer fazer? [A]tualizar esse produto com os dados mais recentes / [N]ovo produto mesmo assim / [C]ancelar (Enter = Atualizar): ')).trim().toLowerCase();
    if (escolha === 'c' || escolha === 'cancelar'){
      console.log('Cancelado.');
      return;
    }
    if (escolha !== 'n' && escolha !== 'novo'){
      produtoExistenteId = jaExiste.id;
      console.log('Vou atualizar o produto existente com os dados mais recentes do fornecedor.');
    } else {
      console.log('Beleza, vai criar um produto novo separado.');
    }
  }

  // Se a chave já está salva, a IA também participa da interpretação das
  // variações enquanto a página ainda está aberta. No primeiro uso sem
  // chave, ela é pedida mais abaixo e passa a valer nas próximas buscas.
  const credenciais = await carregarCredenciais();
  console.log('Abrindo a página do produto...');
  const { browser, context } = await abrirNavegador({ headless: true, storageState: ARQUIVO_SESSAO });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // dá tempo do JS da página terminar de montar tudo

  let { nome, descricao, fotos, preco, variacoes, avisos, impostoEstimado, estoque, precosPorVariacao, matrizVariacoes } = await extrairDadosProduto(page, { chaveGroq: credenciais.chaveGroq });
  await browser.close();

  console.log(`\nNome (como veio do fornecedor): ${nome || '(não encontrado)'}`);

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

  // Categorias ativas buscadas cedo — usadas tanto pra sugestão da IA
  // aqui embaixo quanto, mais adiante, como fallback "provisória" se
  // nada tiver sido escolhido. Se já vai ATUALIZAR um produto existente,
  // não faz sentido sugerir categoria nova — a categoria que o produto já
  // tem é usada nesse caso (ver mais abaixo).
  const { data: categoriasAtivas } = await sb.from('categorias').select('slug, nome').eq('ativa', true).order('ordem');
  let categoriaSugerida = null;
  if (chaveGroq && !produtoExistenteId && categoriasAtivas?.length){
    try {
      categoriaSugerida = await sugerirCategoria({ nome, categorias: categoriasAtivas }, chaveGroq);
      if (categoriaSugerida) console.log(`Categoria sugerida pela IA: "${categoriaSugerida}" — confere/troca no admin se não for essa mesmo.`);
    } catch { /* sugestão é só um extra, nunca trava a importação */ }
  }

  console.log(`\nCusto da peça (fornecedor): ${preco || '(não encontrado)'} — isso é CUSTO, não preço de venda; vai pro campo "Custo da peça" do admin, o preço de venda fica 0 até você rodar a calculadora de margem`);
  if (impostoEstimado) console.log(`Imposto estimado (mostrado pelo próprio AliExpress): ${impostoEstimado} — vai pro campo "Imposto" do admin como valor fixo`);
  if (estoque) console.log(`Estoque no fornecedor: ${estoque}`);
  console.log(`Fotos encontradas: ${fotos.length}`);
  if (variacoes.length){
    console.log(matrizVariacoes ? 'Variações encontradas:' : 'Variações encontradas (mapeia quilate/banho na mão no admin):');
    variacoes.forEach(v => console.log(`  - ${v.nome}: ${v.valores.join(', ')}`));
  }
  if (matrizVariacoes){
    if (matrizVariacoes.quilatesCustos.length){
      console.log('\nQuilate detectado — custo por quilate (vai direto pro produto):');
      matrizVariacoes.quilatesCustos.forEach(q => console.log(`  - ${q.valor}: R$${q.custo.toFixed(2).replace('.', ',')}`));
    }
    if (matrizVariacoes.banhosCustos.length){
      console.log('Banho/cor detectado — diferença de custo por opção (vai direto pro produto):');
      matrizVariacoes.banhosCustos.forEach(b => console.log(`  - ${b.nome}: ${b.custo >= 0 ? '+' : ''}R$${b.custo.toFixed(2).replace('.', ',')}${b.foto ? '' : ' (sem foto — precisa subir na mão no admin)'}`));
    }
    if (matrizVariacoes.avisos.length){
      console.log(`⚠️  Durante a matriz de quilate/banho: ${matrizVariacoes.avisos.join('; ')}`);
    }
  } else if (precosPorVariacao.length){
    console.log('\n⚠️  O preço muda dependendo da opção escolhida nessas variações (pode ser quilate disfarçado de cor — confere e cadastra como quilate no admin se for o caso):');
    precosPorVariacao.forEach(v => {
      console.log(`  "${v.nome}":`);
      Object.entries(v.precos).forEach(([valor, p]) => console.log(`    - ${valor}: ${p}`));
    });
  }

  // Tamanho de anel é o único tipo de variação que dá pra converter e
  // salvar sozinho com segurança (o resto — quilate, banho, cor — cada
  // fornecedor chama diferente e não tem uma tabela fixa que sirva pra
  // todos, por isso continuam só informativos acima).
  const { tamanhosBR, avisoTamanho } = converterTamanhosParaBR(variacoes);
  if (tamanhosBR.length){
    console.log(`Tamanhos convertidos pra numeração BR (vai direto pro produto): ${tamanhosBR.join(', ')}`);
  }
  if (avisoTamanho){
    console.log(`⚠️  ${avisoTamanho}`);
  }

  if (avisos.length){
    console.log(`\n⚠️  Não consegui achar: ${avisos.join(', ')} — fica vazio, preenche na mão.`);
  }

  // O preço do AliExpress é CUSTO, não preço de venda — vai pro campo
  // "custo_peca" do admin, nunca pro "preco" (esse é o que aparece pro
  // cliente!). O imposto que o próprio AliExpress mostra ("R$35,20+ em
  // impostos estimados") também vira custo, evitando calcular por % de
  // ICMS (que nem sempre bate com o valor real cobrado).
  const custoPecaNumero = paraNumero(preco) ?? 0;
  const custoImpostoNumero = extrairValorReais(impostoEstimado);
  // Frete que o FORNECEDOR cobra pra importar a peça (não é o frete que o
  // cliente vê no site) — mesmo campo que existe na interface visual.
  // Ficava de fora daqui até uma revisão encontrar o bug: todo produto
  // importado por esse modo terminal entrava precificado como se o frete
  // fosse sempre grátis.
  const freteTexto = await perguntar('Frete que o fornecedor cobra pra importar essa peça, em R$ (Enter se for grátis): ');
  const custoFreteNumero = freteTexto ? (parseFloat(freteTexto.replace(',', '.')) || 0) : 0;
  const custoTotalEstimado = custoPecaNumero + (custoImpostoNumero || 0) + custoFreteNumero;

  // Passo opcional: pergunta a margem de lucro e já mostra o preço de
  // venda final, igual a calculadora do admin faz (mesma conta: custo +
  // imposto + frete, vezes a margem). Se pular (Enter), o produto entra
  // com preço ZERADO — mais seguro que arriscar um preço errado sozinho —
  // e você roda a calculadora depois, no admin.
  console.log(`\nCusto estimado (peça + imposto + frete): R$${custoTotalEstimado.toFixed(2).replace('.', ',')}`);
  const margemTexto = await perguntar('Quantos % de lucro você quer aplicar? (Enter pra pular e decidir depois no admin): ');
  const margemNumero = margemTexto ? parseFloat(margemTexto.replace(',', '.')) : null;
  let precoFinalNumero = null;
  if (margemNumero && custoTotalEstimado > 0){
    precoFinalNumero = custoTotalEstimado * (1 + margemNumero / 100);
    console.log(`Com ${margemNumero}% de lucro, o preço de venda ficaria: R$${precoFinalNumero.toFixed(2).replace('.', ',')} (confere/ajusta no admin antes de ativar)`);
  }

  // Login do admin — se já tem e-mail/senha salvos de uma vez anterior,
  // usa direto; senão pergunta. Se o login salvo não funcionar mais
  // (ex: senha foi trocada), pede de novo em vez de travar.
  console.log('\nAgora loga como admin pra salvar o rascunho na loja:');
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

  // Atualizando um produto existente: busca o registro completo agora
  // que já está logado como admin (produtos_admin() devolve tudo,
  // inclusive observacoes_internas/categoria/ativo, que não são públicos)
  // — a categoria e o "ativo" atuais do produto são preservados (não
  // sobrescreve pra "provisória"/rascunho à toa), e as observações novas
  // são ACRESCENTADAS embaixo das antigas, não substituem.
  let produtoExistenteAtual = null;
  if (produtoExistenteId){
    const { data } = await sb.rpc('produtos_admin').select('*').eq('id', produtoExistenteId).maybeSingle();
    produtoExistenteAtual = data || null;
  }

  // Junta tudo que merece revisão manual num campo de observação — assim
  // fica registrado no próprio produto (aba Fornecedor do admin), não só
  // no terminal (que some assim que a janela fecha).
  const observacoesAuto = [];

  // Baixa as fotos e sobe pro mesmo bucket que o admin usa pra upload
  // manual — mesma convenção de nome (pasta "importados/", nome
  // aleatório) pra não colidir com nada.
  console.log('\nBaixando e enviando fotos pro Supabase Storage...');
  const urlsFinal = [];
  for (const [i, urlFoto] of fotos.entries()){
    const url = await baixarESubirFoto(sb, urlFoto, 'importados');
    if (url){ urlsFinal.push(url); console.log(`  foto ${i + 1}/${fotos.length} ok`); }
    else console.log(`  foto ${i + 1}/${fotos.length} falhou — pulei essa, sobe na mão se precisar`);
  }
  if (urlsFinal.length < fotos.length){
    observacoesAuto.push(`${fotos.length - urlsFinal.length} foto(s) do produto falharam no upload — sobe na mão se precisar.`);
  }

  // Fotos de cada banho/cor (se a matriz de variações achou alguma com
  // foto identificada) — banho sem foto fica de fora do que é salvo
  // automaticamente (o admin exige foto por banho), avisado no terminal
  // e nas observações pra você subir na mão.
  const banhosComFoto = [];
  const banhosSemFoto = [];
  if (matrizVariacoes?.banhosCustos.length){
    console.log('\nBaixando e enviando fotos de cada banho/cor...');
    for (const b of matrizVariacoes.banhosCustos){
      if (!b.foto){
        console.log(`  "${b.nome}": sem foto encontrada — sobe na mão no admin se quiser cadastrar essa opção`);
        banhosSemFoto.push(b.nome);
        continue;
      }
      const url = await baixarESubirFoto(sb, b.foto, 'importados');
      if (url){ banhosComFoto.push({ ...b, fotoUrl: url }); console.log(`  "${b.nome}": ok`); }
      else { console.log(`  "${b.nome}": falhou o upload — sobe na mão no admin se quiser cadastrar essa opção`); banhosSemFoto.push(b.nome); }
    }
  }
  if (banhosSemFoto.length){
    observacoesAuto.push(`Banho(s) sem foto (não foram salvos, cadastra na mão se quiser): ${banhosSemFoto.join(', ')}.`);
  }

  // "categoria" é obrigatória no banco e não dá pra adivinhar direito só
  // pelo scraping (o AliExpress não separa por essas categorias) — usa a
  // sugestão da IA (categoriaSugerida, se teve) ou, sem isso, a primeira
  // categoria ativa da loja só pra passar da validação, você troca pela
  // certa na revisão. Atualizando um produto existente, a categoria que
  // ele já tem prevalece (ver produtoExistenteAtual mais abaixo).
  const categoriaProvisoria = categoriaSugerida || categoriasAtivas?.[0]?.slug || null;
  if (!categoriaProvisoria){
    console.error('\nNão achei nenhuma categoria ativa na loja pra usar como provisória — cadastra uma categoria no admin antes de importar.');
    process.exit(1);
  }

  // Estoque vem como texto ("Apenas 7 restante(s)") — extrai só o número.
  const estoqueMatch = estoque?.match(/\d+/);
  const estoqueNumero = estoqueMatch ? parseInt(estoqueMatch[0], 10) : null;

  // Se achou quilate/banho E você deu uma margem, calcula o preço de
  // venda de cada opção também — mesma ideia da calculadora do admin
  // (custo + imposto + margem). Usa o imposto REAL lido em cada quilate
  // (custoComImposto) quando disponível; só aproxima pela proporção do
  // produto base quando não conseguiu ler (ou pro delta do banho, que
  // costuma ser pequeno/zero).
  const taxaImpostoAprox = (custoPecaNumero > 0 && custoImpostoNumero) ? custoImpostoNumero / custoPecaNumero : 0;
  // + custoFreteNumero em cada opção — mesmo frete do produto base, ele
  // não muda por quilate/banho (é o mesmo pacote/envio).
  const precoComMargem = (custo) => margemNumero
    ? Math.round((custo * (1 + taxaImpostoAprox) + custoFreteNumero) * (1 + margemNumero / 100) * 100) / 100
    : 0;
  const precoComMargemDoQuilate = (q) => margemNumero
    ? Math.round(((q.custoComImposto != null ? Number(q.custoComImposto) : q.custo * (1 + taxaImpostoAprox)) + custoFreteNumero) * (1 + margemNumero / 100) * 100) / 100
    : 0;

  // Taxa de cada quilate, separada do custo (o admin agora tem um campo
  // de "Taxa (R$)" próprio por quilate, digitado na mão — antes só
  // existia combinado dentro de custoComImposto). Usa a taxa REAL lida
  // na página desse quilate específico quando deu certo; só aproxima
  // pela proporção do produto base (mesmo fallback de sempre) quando não
  // leu — nesse caso completa/confere na mão no admin antes de ativar.
  const taxaDoQuilate = (q) => Math.round((
    q.custoComImposto != null
      ? Number(q.custoComImposto) - Number(q.custo)
      : (Number(q.custo) || 0) * taxaImpostoAprox
  ) * 100) / 100;

  const quilatesDisponiveis = (matrizVariacoes?.quilatesCustos || []).map(q => ({ valor: q.valor, preco: precoComMargemDoQuilate(q), descricao: '' }));
  const quilatesCustosFinal = (matrizVariacoes?.quilatesCustos || []).map(q => ({ valor: q.valor, custo: q.custo, taxa: taxaDoQuilate(q) }));
  const banhosDisponiveis = banhosComFoto.map(b => ({ nome: b.nome, preco: precoComMargem(custoPecaNumero + b.custo), foto_url: b.fotoUrl }));
  const banhosCustosFinal = banhosComFoto.map(b => ({ nome: b.nome, custo: b.custo }));

  // CRÍTICO: sem isso, o site nunca muda o preço mostrado quando o
  // cliente escolhe um quilate/banho diferente (sempre mostra o preço
  // base) — é o campo que resolverPrecoVariante() (shared.js) usa de
  // verdade, não só quilates_disponiveis/banhos_disponiveis.
  const { matrizPrecos, matrizCustos } = montarMatrizes({
    quilatesCustos: matrizVariacoes?.quilatesCustos || [], // usa a versão com custoComImposto, não a "limpa" (quilatesCustosFinal)
    banhosCustos: banhosCustosFinal,
    custoPecaBase: custoPecaNumero,
    taxaImposto: taxaImpostoAprox,
    margemNumero,
    freteNumero: custoFreteNumero
  });

  // Junta o resto do que já foi avisado ao longo da importação — tudo
  // isso fica só no campo de observação (aba Fornecedor no admin,
  // 📝 aparece na listagem de produtos quando tem algo aqui), não no
  // produto público.
  if (avisos.length) observacoesAuto.push(`Não encontrado na página: ${avisos.join(', ')}.`);
  if (avisoTamanho) observacoesAuto.push(avisoTamanho);
  if (matrizVariacoes?.avisos.length) observacoesAuto.push(`Matriz de quilate/banho: ${matrizVariacoes.avisos.join('; ')}.`);
  if (!matrizVariacoes && precosPorVariacao.length){
    observacoesAuto.push(`Preço muda por variação mas não deu pra separar quilate/banho sozinho: ${precosPorVariacao.map(v => v.nome).join(', ')} — confere e cadastra na mão se for o caso.`);
  }
  observacoesAuto.push(`${produtoExistenteId ? 'Atualizado' : 'Importado'} do AliExpress em ${new Date().toLocaleString('pt-BR')}.`);
  // Atualizando: acrescenta embaixo do que já tinha (não apaga anotação
  // sua de antes). Criando novo: só o que essa importação achou mesmo.
  const observacoesInternas = produtoExistenteAtual?.observacoes_internas
    ? `${produtoExistenteAtual.observacoes_internas}\n\n${observacoesAuto.join('\n')}`
    : observacoesAuto.join('\n');

  // Categoria e "ativo": atualizando um produto existente, os dois ficam
  // como já estavam (nunca reseta uma peça ativa pra rascunho, nem troca
  // a categoria que você já tinha escolhido à toa).
  const categoriaFinal = produtoExistenteAtual?.categoria || categoriaProvisoria;

  // Preço de venda: pular a margem (Enter) é seguro num produto NOVO (fica
  // zerado de propósito, você confere depois no admin antes de ativar) —
  // mas numa ATUALIZAÇÃO de um produto que já está no ar com preço de
  // verdade, pular a margem sem essa checagem zerava o preço de venda de
  // uma peça já ativa na loja (bug real encontrado numa revisão). Se não
  // informou margem nova, mantém o preço que o produto já tinha.
  let precoFinal = precoFinalNumero;
  if (precoFinal === null && produtoExistenteAtual?.preco > 0){
    precoFinal = produtoExistenteAtual.preco;
    console.log(`Sem margem nova informada — mantendo o preço de venda que esse produto já tinha: R$${precoFinal.toFixed(2).replace('.', ',')}`);
  }

  const dadosProduto = {
    nome: nome || '(sem nome — importação parcial, preencher)',
    descricao: descricao || null,
    fotos: urlsFinal,
    link_fornecedor: url,
    observacoes_internas: observacoesInternas,
    categoria: categoriaFinal,
    preco: precoFinal ?? 0,
    custo_peca: custoPecaNumero,
    custo_frete: custoFreteNumero,
    ...(custoImpostoNumero !== null ? { custo_imposto: custoImpostoNumero } : {}),
    ...(margemNumero ? { margem_lucro: margemNumero } : {}),
    ...(estoqueNumero !== null ? { estoque: estoqueNumero } : {}),
    ...(tamanhosBR.length ? { tamanhos_disponiveis: tamanhosBR } : {}),
    ...(quilatesDisponiveis.length ? { quilates_disponiveis: quilatesDisponiveis, quilates_custos: quilatesCustosFinal } : {}),
    ...(banhosDisponiveis.length ? { banhos_disponiveis: banhosDisponiveis, banhos_custos: banhosCustosFinal } : {}),
    ...(matrizPrecos.length ? { matriz_precos: matrizPrecos, matriz_custos: matrizCustos } : {})
  };

  // Sem ".select()" no final de propósito: a leitura direta da tabela
  // produtos é restrita mesmo pra admin (o site normalmente lê produto
  // por uma função própria, não direto na tabela) — insert/update
  // funcionam igual, só não confirmam o retorno.
  //
  // Produto NOVO entra como RASCUNHO (ativo:false — não aparece pro
  // cliente até você revisar e ativar no admin). Se você pulou a margem
  // acima, o preço de venda entra ZERADO de propósito — mais seguro que
  // arriscar vender pelo preço de custo sem querer. Produto EXISTENTE
  // mantém o "ativo" que já tinha (não mexe nisso ao atualizar).
  const { error: erroSalvar } = produtoExistenteId
    ? await sb.from('produtos').update(dadosProduto).eq('id', produtoExistenteId)
    : await sb.from('produtos').insert({ ...dadosProduto, ativo: false });

  if (erroSalvar){
    console.error(`\nDeu erro ao ${produtoExistenteId ? 'atualizar' : 'salvar'} o produto:`, erroSalvar.message);
    process.exit(1);
  }

  console.log(produtoExistenteId ? `\n✅ Produto atualizado: "${nome || '(sem nome)'}"` : `\n✅ Rascunho criado: "${nome || '(sem nome)'}"`);
  console.log(`Categoria: "${categoriaFinal}"${produtoExistenteAtual ? '' : ' (provisória — troca pela certa na revisão)'}.`);
  if (quilatesDisponiveis.length) console.log(`Quilates salvos: ${quilatesDisponiveis.length} opção(ões).`);
  if (banhosDisponiveis.length) console.log(`Banhos/cores salvos (com foto): ${banhosDisponiveis.length} opção(ões).`);
  console.log(precoFinalNumero
    ? `Preço de venda: R$${precoFinalNumero.toFixed(2).replace('.', ',')} (${margemNumero}% de lucro) — confere no admin antes de ativar.`
    : '⚠️  Preço de venda ainda está ZERADO de propósito — abre o admin, acha esse produto na lista (aparece como inativo, com o ícone 🔗) e roda a calculadora de margem (custo + imposto já vieram preenchidos) antes de ativar.');
}

/* ============================================================
   ENTRADA — só roda quando esse arquivo é executado direto (npm run
   login / npm run importar), não quando é importado por outro arquivo
   (o servidor da interface visual importa as funções daqui sem querer
   disparar esse modo terminal).
   ============================================================ */
const ehExecutadoDireto = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (ehExecutadoDireto){
  const args = process.argv.slice(2);
  if (args.includes('--login')){
    await modoLogin();
  } else if (args.length){
    // Vários links de uma vez: importa um atrás do outro, na ordem —
    // cada um já pergunta a margem/duplicidade dele próprio, igual a um
    // link só, só não precisa ficar rodando o comando de novo pra cada.
    for (const [i, url] of args.entries()){
      if (args.length > 1) console.log(`\n\n========== Produto ${i + 1}/${args.length} ==========`);
      await modoImportar(url);
    }
  } else {
    console.log('Uso:');
    console.log('  npm run login                              -> loga na sua conta AliExpress (faz de vez em quando)');
    console.log('  npm run importar -- <link>                 -> importa um produto');
    console.log('  npm run importar -- <link1> <link2> ...    -> importa vários, um atrás do outro');
    console.log('  npm run interface                          -> abre a interface visual no navegador');
  }
}

