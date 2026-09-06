/* ============================================================
   Pavan & Co. — Script compartilhado (v3)
   Incluído em TODAS as páginas via <script src="shared.js">.

   Novidades desta versão:
   - Categorias agora vêm do banco (tabela `categorias`) — criar uma
     categoria nova no admin já cria uma página de verdade no site,
     em categoria.html?c=slug-da-categoria.
   - Filtro por FORMATO DA PEDRA (redondo/oval/princesa/coração/
     marquise/esmeralda) com ícones, estilo Versale.
   - Avaliações de produto (leitura pública; escrita fica pra quando
     tivermos login de cliente).
   - Pequenas animações/microinterações (reveal ao rolar, toast,
     "pulso" no ícone do carrinho, skeleton de carregamento).
   ============================================================ */

const SUPABASE_URL = "https://pqhdtteeukfcjstfsnkn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxaGR0dGVldWtmY2pzdGZzbmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzc0MTAsImV4cCI6MjEwMTk1MzQxMH0.VwOKgaNEmKaT-xGqF-S0Cr2mY9i4O_4eIFkqpdv0KiY";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Escapa texto que veio de alguém DIGITANDO (nome, endereço, mensagem de
// contato, comentário de avaliação...) antes de jogar num innerHTML.
// Sem isso, um campo de texto vira uma forma de rodar código na tela de
// quem for ler — inclusive na tela do admin, logado. Usar em TODO texto
// de origem externa que for inserido via innerHTML/template literal.
function escaparHtml(texto){
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   STATUS DE PEDIDO — labels, cor do badge e linha do tempo.
   Compartilhado entre conta.html (pedidos de quem tá logado) e
   rastreio.html (consulta pública por número do pedido).
   ============================================================ */
const STATUS_PEDIDO_LABEL = { novo: 'Pedido feito', confirmado: 'Pagamento confirmado', em_transito_internacional: 'A caminho do Brasil', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado' };
const STATUS_PEDIDO_COR = { novo: 'amarelo', confirmado: 'verde', em_transito_internacional: 'amarelo', enviado: 'verde', entregue: 'verde', cancelado: 'vermelho' };
const STATUS_PAGAMENTO_LABEL = { pendente: 'Aguardando pagamento', em_analise: 'Pagamento em análise', aprovado: 'Pago', recusado: 'Pagamento recusado', estornado: 'Estornado' };
const STATUS_PAGAMENTO_COR = { pendente: 'amarelo', em_analise: 'amarelo', aprovado: 'verde', recusado: 'vermelho', estornado: 'vermelho' };
const FORMA_PAGAMENTO_LABEL = { pix: 'Pix', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', ticket: 'Boleto', account_money: 'Saldo Mercado Pago' };

// Link de rastreio — Correios tem URL pública de consulta; outras
// transportadoras (Melhor Envio parceiras) não têm um padrão único, então
// cai numa busca que já leva a pessoa a rastrear pelo código.
function linkRastreio(codigo, transportadora){
  const t = (transportadora || '').toLowerCase();
  if (t.includes('correios')) return `https://rastreamento.correios.com.br/app/index.php?objetos=${codigo}`;
  return `https://www.google.com/search?q=rastrear+encomenda+${encodeURIComponent(codigo)}`;
}

const ETAPAS_PEDIDO = [
  { chave: 'novo', rotulo: 'Pedido feito', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>' },
  { chave: 'confirmado', rotulo: 'Pagamento confirmado', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6L16 9.5"/></svg>' },
  { chave: 'em_transito_internacional', rotulo: 'A caminho do Brasil', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12h20"/><path d="M12 2c3 3 4.5 6.5 4.5 10s-1.5 7-4.5 10c-3-3-4.5-6.5-4.5-10S9 5 12 2Z"/></svg>' },
  { chave: 'enviado', rotulo: 'Enviado', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 7h11v9h-11z"/><path d="M13.5 11h4l3 3v2h-7z"/><circle cx="6.5" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>' },
  { chave: 'entregue', rotulo: 'Entregue', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>' }
];
const ICONE_CANCELADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

function timelinePedidoHtml(status){
  if (status === 'cancelado'){
    return `<div class="pedido-cancelado-aviso">${ICONE_CANCELADO}<span>Este pedido foi cancelado.</span></div>`;
  }
  const ordem = ETAPAS_PEDIDO.map(e => e.chave);
  const indiceAtual = Math.max(ordem.indexOf(status), 0);
  const progresso = (indiceAtual / (ordem.length - 1)) * 100;

  return `
    <div class="pedido-timeline" style="--progresso:${progresso}%;">
      <div class="pedido-timeline-linha"><div class="pedido-timeline-linha-fill"></div></div>
      ${ETAPAS_PEDIDO.map((etapa, i) => `
        <div class="pedido-etapa ${i < indiceAtual ? 'concluida' : i === indiceAtual ? 'atual' : ''}">
          <div class="pedido-etapa-icone">${etapa.icone}</div>
          <span class="pedido-etapa-rotulo">${etapa.rotulo}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// Previsão simples: data do pedido + prazo (confecção + entrega) escolhido
// no checkout. Só faz sentido mostrar enquanto o pedido ainda não chegou —
// e não enquanto a peça ainda tá em trânsito internacional (nesse caso o
// prazo de entrega nacional nem começou a contar de verdade ainda; ver
// previsaoChegadaInternacionalHtml(), que mostra a previsão certa pra essa
// etapa, pra não aparecerem dois prazos diferentes ao mesmo tempo).
function previsaoEntregaHtml(p){
  if (!p.frete_prazo_dias || ['entregue', 'cancelado', 'em_transito_internacional'].includes(p.status)) return '';
  const previsao = new Date(p.criado_em);
  previsao.setDate(previsao.getDate() + Number(p.frete_prazo_dias));
  return `<span class="pedido-meta-item">📅 Previsão de entrega: <strong>${previsao.toLocaleDateString('pt-BR')}</strong></span>`;
}

// Enquanto a peça ainda está vindo do fornecedor internacional (sem
// rastreio nacional ainda), mostramos isso de forma transparente — nunca
// um código de rastreio fingido. O rastreio de verdade só aparece quando
// o status vira "enviado" (reenvio já feito daqui, dentro do Brasil).
function previsaoChegadaInternacionalHtml(p){
  if (p.status !== 'em_transito_internacional') return '';
  const previsaoTexto = p.previsao_chegada_internacional
    ? `previsão de chegar por aqui em <strong>${new Date(p.previsao_chegada_internacional + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>`
    : 'ainda sem previsão exata';
  return `<div class="aviso-transito-internacional">🌍 Sua peça está vindo do nosso fornecedor internacional — ${previsaoTexto}. Assim que chegar por aqui, ela é reenviada com código de rastreio nacional.</div>`;
}

// Card de pedido é "produto em primeiro lugar": mostra a foto e o nome do
// que a cliente comprou, não o código do pedido (isso vira um detalhe
// pequeno no canto — ninguém decora "#1E37DC51", mas lembra "o anel que eu comprei").
function resumoItensPedido(itens){
  const lista = itens || [];
  const primeiro = lista[0];
  if (!primeiro) return { foto: '', titulo: 'Pedido', subtitulo: '' };
  const extras = lista.length - 1;
  const titulo = primeiro.nome + (extras > 0 ? ` + ${extras} ${extras === 1 ? 'item' : 'itens'}` : '');
  const subtitulo = [primeiro.quilate, primeiro.banho, primeiro.tamanho ? `aro ${primeiro.tamanho}` : null].filter(Boolean).join(' · ');
  return { foto: primeiro.imagem || '', titulo, subtitulo };
}

/* ============================================================
   FRETE (Melhor Envio) — a chamada de verdade acontece numa Edge
   Function no Supabase (calcular-frete), que esconde o token da
   API. Aqui só formatamos o CEP e chamamos essa função.
   ============================================================ */
function formatarCep(valor){
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

// itensCarrinho (opcional): [{preco, qtd}] pra calcular o carrinho inteiro
// (checkout). Sem isso, calcula só 1 peça (página de produto).
async function calcularFrete(cepDestino, precoProduto, itensCarrinho){
  const corpo = { cep_destino: cepDestino };
  if (itensCarrinho && itensCarrinho.length) corpo.itens = itensCarrinho;
  else corpo.preco = precoProduto;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/calcular-frete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify(corpo)
  });
  return resp.json();
}

/* ============================================================
   NEWSLETTER — usado pelo form no rodapé/faixa de index.html e
   categoria.html. Salva na tabela newsletter_assinantes.
   ============================================================ */
async function assinarNewsletter(form){
  const input = form.querySelector('input[type="email"]');
  const botao = form.querySelector('button[type="submit"]');
  const email = input.value.trim();
  const textoOriginal = botao.textContent;

  botao.disabled = true;
  botao.textContent = '...';

  const { data, error } = await sb.rpc('assinar_newsletter', { p_email: email });

  botao.disabled = false;
  botao.textContent = textoOriginal;

  if (error){
    mostrarToast(error.message || 'Não foi possível assinar agora — tenta de novo.');
    return false;
  }

  if (data === 'duplicado'){
    mostrarToast('Esse e-mail já tá cadastrado ✓');
    form.reset();
    return false;
  }

  mostrarToast('Inscrição confirmada ✓');
  form.reset();
  return false;
}

/* ============================================================
   ÍCONES DE CATEGORIA (por chave "icone" da tabela categorias)
   "padrao" é usado por qualquer categoria nova criada no admin,
   até você (opcionalmente) me pedir um ícone customizado pra ela.
   ============================================================ */
const ICONES_CATEGORIA = {
  aliancas: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="15" cy="20" r="10"/><circle cx="25" cy="20" r="10"/></svg>`,
  aneis: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="20" cy="24" r="10"/><path d="M20 14 L16 6 L24 6 Z"/></svg>`,
  brincos: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="20" cy="10" r="3"/><path d="M20 13 v8"/><path d="M14 21 a6 6 0 0 0 12 0"/></svg>`,
  colares: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 8 q12 18 24 0"/><circle cx="20" cy="27" r="4"/></svg>`,
  pulseiras: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="20" cy="20" rx="14" ry="8"/><circle cx="20" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>`,
  joias: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 15 L20 6 L30 15 L20 34 Z"/><path d="M10 15 H30 M15 15 L20 6 L25 15"/></svg>`,
  padrao: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 15 L20 6 L30 15 L20 34 Z"/><path d="M10 15 H30 M15 15 L20 6 L25 15"/></svg>`
};

/* FOTOS DE CATEGORIA (cards estilo polaroid na home) — IMG: troque por fotos
   reais do seu catálogo quando tiver; por enquanto são fotos de banco de
   imagens gratuitas, só pra dar a cara certa pra cada categoria. */
const FOTOS_CATEGORIA = {
  aliancas: "https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?q=80&w=500&auto=format&fit=crop",
  aneis: "https://images.unsplash.com/photo-1598560917807-1bae44bd2be8?q=80&w=500&auto=format&fit=crop",
  brincos: "https://images.unsplash.com/photo-1705326453282-e4e1b78f5fea?q=80&w=500&auto=format&fit=crop",
  colares: "https://images.unsplash.com/photo-1605201206717-cb9eca0d2eb2?q=80&w=500&auto=format&fit=crop",
  pulseiras: "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?q=80&w=500&auto=format&fit=crop",
  joias: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=500&auto=format&fit=crop",
  padrao: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=500&auto=format&fit=crop"
};

/* FOTOS de FORMATO DA PEDRA — estilo Versale (escolha por formato).
   IMG: coloque os arquivos com esses nomes exatos na raiz do site
   (junto de index.html) — reconhece sozinho, sem precisar mexer em código. */
const FOTOS_FORMATO = {
  "Redondo": "formato-redondo.png",
  "Oval": "formato-oval.png",
  "Princesa": "formato-princesa.png",
  "Coração": "formato-coracao.png",
  "Marquise": "formato-marquise.png",
  "Esmeralda": "formato-esmeralda.png"
};
function fotoFormatoHTML(nomeFormato){
  const arquivo = FOTOS_FORMATO[nomeFormato] || FOTOS_FORMATO['Redondo'];
  return `<img src="${arquivo}" alt="${nomeFormato}" loading="lazy">`;
}

function formatarPreco(valor){
  const num = Number(valor);
  // Acima de R$ 1.000, esconde os centavos (R$ 1.000 em vez de R$ 1.000,00)
  const casas = num >= 1000 ? 0 : 2;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/* ============================================================
   OTIMIZAÇÃO DE IMAGEM ANTES DO UPLOAD — toda foto que sobe pro
   Supabase Storage (produto, categoria, destaque, avaliação, avatar)
   passa por aqui primeiro: redimensiona pro tamanho máximo que o site
   realmente exibe e recomprime em WebP. Uma foto de câmera (D5200,
   celular etc.) que chega com 6-10MB sai daqui com uns 150-400KB, sem
   perda visível — é o que deixava o site pesado pra carregar.
   ============================================================ */
async function otimizarImagemParaUpload(file, { maxLado = 1600, qualidade = 0.82 } = {}){
  // Não é imagem (ex: vídeo) ou já é pequena o bastante — não vale o
  // trabalho de recomprimir, manda como está.
  if (!file || !file.type?.startsWith('image/') || file.size < 180_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close?.();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', qualidade));
    // Navegador sem suporte a exportar WebP (raro hoje em dia) — mantém o original.
    if (!blob) return file;

    const nomeBase = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${nomeBase}.webp`, { type: 'image/webp' });
  } catch (err) {
    // Qualquer falha na otimização não pode travar o upload — sobe a
    // foto original em vez de quebrar o formulário.
    console.error('Erro ao otimizar imagem, enviando original:', err);
    return file;
  }
}

/* ============================================================
   DESTAQUE PRINCIPAL (banner do topo da home) — editável no admin
   ============================================================ */
async function carregarHomeHero(){
  const { data, error } = await sb.from('home_hero').select('*').limit(1).maybeSingle();
  if (error || !data){ console.error('Erro ao carregar destaque principal:', error); return null; }
  return data;
}

/* ============================================================
   CONFIGURAÇÕES GERAIS DO SITE (WhatsApp, redes sociais) —
   editável no admin, usado em toda parte pra não precisar mexer
   em código quando o número/link mudar.
   ============================================================ */
async function carregarConfigSite(){
  if (window.CONFIG_SITE) return window.CONFIG_SITE;
  const { data, error } = await sb.from('config_site').select('whatsapp_numero, instagram_url, tiktok_url').eq('id', 1).maybeSingle();
  if (error){ console.error('Erro ao carregar config do site:', error); }
  window.CONFIG_SITE = data || {};
  return window.CONFIG_SITE;
}

// Monta o link do WhatsApp a partir da config carregada, com uma mensagem opcional.
function linkWhatsappSite(mensagem){
  const numero = window.CONFIG_SITE && window.CONFIG_SITE.whatsapp_numero;
  if (!numero) return '#';
  return `https://wa.me/${numero}${mensagem ? '?text=' + encodeURIComponent(mensagem) : ''}`;
}

// Formata "5511941104553" como "(11) 94110-4553" pra exibir na tela de contato.
function formatarTelefoneBR(numero){
  if (!numero) return '';
  let digitos = String(numero).replace(/\D/g, '');
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2); // tira o 55 do país
  if (digitos.length === 11) return `(${digitos.slice(0,2)}) ${digitos.slice(2,7)}-${digitos.slice(7)}`;
  if (digitos.length === 10) return `(${digitos.slice(0,2)}) ${digitos.slice(2,6)}-${digitos.slice(6)}`;
  return numero;
}

// Preenche os links de redes sociais do rodapé (repetido em cada página) com a config atual.
// Cada link começa escondido no HTML pra nunca mostrar um "#" morto.
function preencherRedesSociaisRodape(config){
  const linkInsta = document.getElementById('linkInstagram');
  const linkTiktok = document.getElementById('linkTiktok');
  const linkWhats = document.getElementById('linkWhatsapp');
  if (linkInsta && config.instagram_url){
    linkInsta.href = config.instagram_url;
    linkInsta.style.display = '';
  }
  if (linkTiktok && config.tiktok_url){
    linkTiktok.href = config.tiktok_url;
    linkTiktok.style.display = '';
  }
  if (linkWhats && config.whatsapp_numero){
    linkWhats.href = linkWhatsappSite();
    linkWhats.style.display = '';
  }
}

/* ============================================================
   COLEÇÕES EM DESTAQUE (grade "vitrine") — até 3, editável no admin
   ============================================================ */
async function carregarHomeColecoes(){
  const { data, error } = await sb.from('home_colecoes').select('*').order('ordem');
  if (error){ console.error('Erro ao carregar coleções em destaque:', error); return []; }
  return data;
}

let categoriasCache = null;
async function carregarCategorias(){
  if (categoriasCache) return categoriasCache;
  const { data, error } = await sb.from('categorias').select('*').eq('ativa', true).order('ordem');
  if (error){ console.error('Erro ao carregar categorias:', error); return []; }
  categoriasCache = data.map(c => ({
    id: c.id,
    nome: c.nome,
    slug: c.slug,
    href: `categoria.html?c=${c.slug}`,
    icon: ICONES_CATEGORIA[c.icone] || ICONES_CATEGORIA.padrao,
    foto: c.foto_url || FOTOS_CATEGORIA[c.icone] || FOTOS_CATEGORIA.padrao
  }));
  return categoriasCache;
}

/* ============================================================
   MAPEAMENTO DB → FRONT-END
   ============================================================ */
// Colunas seguras pra expor no site público. IMPORTANTE: NÃO inclui
// link_fornecedor (uso interno do admin/dropshipping) — se colocar '*' aqui,
// esse link vaza no JSON da resposta (visível no Network do navegador)
// mesmo que a tela não mostre ele em lugar nenhum.
const COLUNAS_PRODUTO_PUBLICO = 'id, nome, categoria, descricao, material_aro, pedra_central, banho, banhos_disponiveis, quilate_pedra, quilates_disponiveis, pedra_lateral, formato_pedra, cravacao, grau_cor, grau_clareza, grau_corte, largura_mm, tamanhos_disponiveis, preco, estoque, fotos, video_url, destaque, ativo, criado_em, frete_gratis_sempre, matriz_precos';

function mapProduto(row){
  const pedra = row.pedra_central || "Sem pedra";
  const banho = row.banho || "Sem banho";
  return {
    id: row.id,
    nome: row.nome,
    categoria: row.categoria,
    descricao: row.descricao || "",
    material: row.material_aro || "",
    pedra: pedra,
    temPedra: pedra !== "Sem pedra",
    banho: banho,
    temBanho: banho !== "Sem banho",
    quilate: row.quilate_pedra || "",
    quilates: row.quilates_disponiveis || [],
    banhos: row.banhos_disponiveis || [],
    // Preço final de cada combinação quilate × banho, já pronto (calculado
    // no admin com imposto sobre o custo combinado) — fonte única de
    // verdade do preço de variante, pra quilate e banho nunca "brigarem"
    // pelo preço mostrado. Ver resolverPrecoVariante().
    matrizPrecos: row.matriz_precos || [],
    formato: row.formato_pedra || "",
    cravacao: row.cravacao || "",
    grauCor: row.grau_cor || "",
    grauClareza: row.grau_clareza || "",
    grauCorte: row.grau_corte || "",
    largura: row.largura_mm || "",
    tamanhos: row.tamanhos_disponiveis || [],
    preco: Number(row.preco),
    estoque: row.estoque,
    fotos: (row.fotos && row.fotos.length) ? row.fotos : ["https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=800&auto=format&fit=crop"],
    image: (row.fotos && row.fotos[0]) || "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=800&auto=format&fit=crop",
    videoUrl: row.video_url || null,
    destaque: !!row.destaque,
    ativo: row.ativo !== false,
    freteGratisSempre: !!row.frete_gratis_sempre
  };
}

// Acha o preço certo pra uma combinação de variante (quilate e/ou banho)
// na matriz pré-calculada — nunca deixa uma dimensão "vencer" a outra
// isoladamente (esse era o bug: escolher o banho jogava o preço pro
// valor do banho sozinho, ignorando o quilate escolhido antes). Sem
// matriz (produto sem variante nenhuma) ou sem combinação encontrada,
// cai no preço base do produto.
function resolverPrecoVariante(p, quilate, banho){
  if (!p.matrizPrecos || !p.matrizPrecos.length) return p.preco;
  const exato = p.matrizPrecos.find(m => (m.quilate || null) === (quilate || null) && (m.banho || null) === (banho || null));
  if (exato) return Number(exato.preco);
  // Produto tem as duas dimensões (quilate e banho) mas a pessoa só
  // escolheu uma até agora — sem isso o preço "voltaria" pro valor base
  // do nada assim que ela escolhe o quilate, parecendo bug. Mostra uma
  // prévia com o que já foi escolhido (o valor final de verdade só bate
  // quando as duas estiverem selecionadas).
  const porQuilate = quilate && p.matrizPrecos.find(m => (m.quilate || null) === quilate);
  if (porQuilate) return Number(porQuilate.preco);
  const porBanho = banho && p.matrizPrecos.find(m => (m.banho || null) === banho);
  if (porBanho) return Number(porBanho.preco);
  return p.preco;
}

async function carregarProdutosPorCategoria(categoriaChave){
  const { data, error } = await sb.from('produtos').select(COLUNAS_PRODUTO_PUBLICO).eq('categoria', categoriaChave).eq('ativo', true);
  if (error){ console.error('Erro ao carregar produtos:', error); return []; }
  return data.map(mapProduto);
}

/* ============================================================
   COLEÇÕES TEMÁTICAS (Noivado / Mais vendidos / Novidades) —
   marcadas à mão no produto (aba Publicação do admin), guardadas em
   produtos.colecoes (array de texto). Página genérica: colecao.html?tipo=...
   ============================================================ */
const LABELS_COLECAO = {
  'noivado': { titulo: 'Coleção Noivado', eyebrow: 'Para sempre' },
  'mais-vendidos': { titulo: 'Mais vendidos', eyebrow: 'Favoritos' },
  'novidades': { titulo: 'Novidades', eyebrow: 'Recém-chegados' }
};

async function carregarProdutosPorColecao(tipo){
  let query = sb.from('produtos').select(COLUNAS_PRODUTO_PUBLICO).eq('ativo', true).contains('colecoes', [tipo]);
  if (tipo === 'novidades') query = query.order('criado_em', { ascending: false });
  const { data, error } = await query;
  if (error){ console.error('Erro ao carregar coleção:', error); return []; }
  return data.map(mapProduto);
}

async function carregarProdutosDestaque(limite = 5){
  const { data, error } = await sb.from('produtos').select(COLUNAS_PRODUTO_PUBLICO).eq('destaque', true).eq('ativo', true).limit(limite);
  if (error){ console.error('Erro ao carregar destaques:', error); return []; }
  return data.map(mapProduto);
}

async function carregarTodosProdutosAtivos(){
  const { data, error } = await sb.from('produtos').select(COLUNAS_PRODUTO_PUBLICO).eq('ativo', true);
  if (error){ console.error('Erro ao carregar produtos:', error); return []; }
  return data.map(mapProduto);
}

async function carregarProdutoPorId(id){
  const { data, error } = await sb.from('produtos').select(COLUNAS_PRODUTO_PUBLICO).eq('id', id).maybeSingle();
  if (error || !data){ console.error('Erro ao carregar produto:', error); return null; }
  return mapProduto(data);
}

/* ============================================================
   AVALIAÇÕES
   ============================================================ */
async function carregarAvaliacoes(produtoId){
  const { data, error } = await sb.from('avaliacoes').select('*').eq('produto_id', produtoId).eq('aprovado', true).order('data_avaliacao', { ascending: false });
  if (error){ console.error('Erro ao carregar avaliações:', error); return []; }
  return data;
}

function formatarDataBR(dataStr){
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function estrelasHTML(nota, tamanho = 16){
  let html = '';
  for (let i = 1; i <= 5; i++){
    html += `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="${i <= Math.round(nota) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>`;
  }
  return `<span class="estrelas">${html}</span>`;
}

/* ============================================================
   HEADER / MENU / RODAPÉ — comum a todas as páginas
   ============================================================ */
async function initHeaderShared(){
  const navList = document.getElementById('navList');
  const mobileNavList = document.getElementById('mobileNavList');
  const footerCatList = document.getElementById('footerCatList');

  const categorias = await carregarCategorias();
  categorias.forEach(cat => {
    if (navList) navList.innerHTML += `<li><a href="${cat.href}">${cat.nome}</a></li>`;
    if (mobileNavList) mobileNavList.innerHTML += `<li><a href="${cat.href}">${cat.nome}</a></li>`;
    if (footerCatList) footerCatList.innerHTML += `<li><a href="${cat.href}">${cat.nome}</a></li>`;
  });

  const header = document.getElementById('siteHeader');
  if (header){
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 8);
    });
  }

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNav = document.getElementById('mobileNav');
  if (hamburgerBtn && mobileNav){
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      hamburgerBtn.setAttribute('aria-expanded', isOpen);
    });
  }

  const searchBtn = document.getElementById('searchBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  if (searchBtn && searchOverlay){
    searchBtn.addEventListener('click', () => {
      searchOverlay.classList.toggle('open');
      if (searchOverlay.classList.contains('open')){
        searchOverlay.querySelector('input').focus();
      }
    });
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const configSite = await carregarConfigSite();
  preencherRedesSociaisRodape(configSite);
  document.dispatchEvent(new CustomEvent('configSiteCarregada', { detail: configSite }));

  injetarSelosSeguranca();
  injetarAvisoCookies();
  ativarRevealAoRolar();
  setTimeout(mostrarPopupCupomBoasVindas, 1800); // espera a página assentar antes de mostrar
  setTimeout(mostrarPopupPrecoFabrica, 2200); // levemente depois, pra não colidir com o de boas-vindas
  iniciarObservadorPrecoFabrica();
  iniciarObservadorPrecoCupomDestaque();
  document.body.classList.add('pronto'); // dispara o fade-in inicial da página
}

/* ============================================================
   ANIMAÇÕES / MICROINTERAÇÕES
   ============================================================ */

// Revela seções suavemente conforme entram na tela
function ativarRevealAoRolar(){
  const alvos = document.querySelectorAll('.reveal');
  if (!alvos.length) return;
  const observer = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
      if (entrada.isIntersecting){
        entrada.target.classList.add('revelado');
        observer.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.12 });
  alvos.forEach(el => observer.observe(el));
}
// Chama de novo depois de conteúdo dinâmico ser inserido (ex: grid de produtos)
function revelarNovosElementos(){ ativarRevealAoRolar(); }

function pulsarCarrinho(){
  const icone = document.querySelector('a[href="carrinho.html"]');
  if (!icone) return;
  icone.classList.remove('pulso');
  void icone.offsetWidth; // reinicia a animação mesmo se clicar rápido várias vezes
  icone.classList.add('pulso');
}

/* ============================================================
   TOAST
   ============================================================ */
function mostrarToast(mensagem){
  let toast = document.getElementById('toastAviso');
  if (!toast){
    toast = document.createElement('div');
    toast.id = 'toastAviso';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = mensagem;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ============================================================
   COMPARTILHAR PRODUTO (botão na página do produto)
   Tenta anexar a própria foto do produto (fica como "figurinha" com
   legenda no WhatsApp, Instagram etc, não só um link) — se o navegador
   não suportar, cai pra compartilhar título+link, e se nem isso tiver
   suporte (ex: Firefox desktop), abre o WhatsApp Web com a mensagem
   pronta.
   ============================================================ */
async function compartilharProduto(nome, preco, imagemUrl){
  const url = window.location.href;
  const texto = `Olha que lindo que eu achei! 😍\n${nome} — ${formatarPreco(preco)}\n${url}`;

  try {
    if (navigator.canShare && imagemUrl){
      const resposta = await fetch(imagemUrl);
      const blob = await resposta.blob();
      const arquivo = new File([blob], 'produto.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare({ files: [arquivo] })){
        await navigator.share({ files: [arquivo], title: nome, text: texto });
        return;
      }
    }
  } catch (err){
    if (err.name === 'AbortError') return; // cancelou o compartilhamento, não é erro
    // qualquer outro problema (CORS ao buscar a foto, etc.) cai pros fallbacks abaixo
  }

  try {
    if (navigator.share){
      await navigator.share({ title: nome, text: texto });
      return;
    }
  } catch (err){
    if (err.name === 'AbortError') return;
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

/* ============================================================
   COMPRAR AGORA — pula o carrinho: troca o carrinho local pra
   conter SÓ essa peça (sobrescreve, não soma) e já manda pro
   checkout. Quem quiser o fluxo normal continua usando "Adicionar
   ao carrinho".
   ============================================================ */
function comprarAgora(produto){
  salvarCarrinho([{
    id: produto.id,
    nome: produto.nome,
    preco: Number(produto.preco) || 0,
    imagem: produto.imagem || '',
    tamanho: produto.tamanho || null,
    quilate: produto.quilate || null,
    banho: produto.banho || null,
    qtd: produto.qtd || 1,
    freteGratisSempre: !!produto.freteGratisSempre
  }]);
  window.location.href = 'checkout.html';
}

/* ============================================================
   FAVORITOS (lista de desejos) — exige login (tabela `favoritos`
   é por user_id, com RLS). Visitante sem login é convidado a
   entrar antes de favoritar.
   ============================================================ */
let favoritosCache = null; // Set de produto_id, só carregado quando precisa

async function carregarFavoritosIds(){
  if (favoritosCache) return favoritosCache;
  const { data: sessao } = await sb.auth.getSession();
  if (!sessao.session){ favoritosCache = new Set(); return favoritosCache; }
  const { data, error } = await sb.from('favoritos').select('produto_id').eq('user_id', sessao.session.user.id);
  favoritosCache = new Set(error ? [] : data.map(f => f.produto_id));
  return favoritosCache;
}

async function estaNosFavoritos(produtoId){
  const ids = await carregarFavoritosIds();
  return ids.has(produtoId);
}

// Retorna o novo estado (true = favoritado) ou null se precisar logar antes
async function alternarFavorito(produtoId){
  const { data: sessao } = await sb.auth.getSession();
  if (!sessao.session){
    mostrarToast('Entre na sua conta pra favoritar peças ♥');
    return null;
  }
  const userId = sessao.session.user.id;
  const ids = await carregarFavoritosIds();
  if (ids.has(produtoId)){
    await sb.from('favoritos').delete().eq('user_id', userId).eq('produto_id', produtoId);
    ids.delete(produtoId);
    return false;
  } else {
    await sb.from('favoritos').insert({ user_id: userId, produto_id: produtoId });
    ids.add(produtoId);
    return true;
  }
}

async function carregarProdutosFavoritos(){
  const { data: sessao } = await sb.auth.getSession();
  if (!sessao.session) return [];
  const { data, error } = await sb
    .from('favoritos')
    .select(`produto_id, produtos (${COLUNAS_PRODUTO_PUBLICO})`)
    .eq('user_id', sessao.session.user.id)
    .order('criado_em', { ascending: false });
  if (error){ console.error('Erro ao carregar favoritos:', error); return []; }
  return data.filter(f => f.produtos).map(f => mapProduto(f.produtos));
}

/* ============================================================
   CUPOM DE DESCONTO — validação real acontece no servidor (RPC
   validar_cupom), o front só mostra o resultado. O desconto final
   também é recalculado de novo no criar_pedido — o valor mostrado
   aqui é só uma prévia.
   ============================================================ */
// itens (opcional): só é usado de verdade pelo tipo "preco_fabrica" — pra
// ele o desconto é calculado item a item (preço de custo de cada produto),
// não dá pra saber só com o subtotal.
async function validarCupom(codigo, subtotal, itens){
  const { data, error } = await sb.rpc('validar_cupom', { p_codigo: codigo, p_subtotal: subtotal, p_itens: itens || null }).maybeSingle();
  if (error || !data) return { valido: false, mensagem: 'Não foi possível validar o cupom agora.' };
  return data;
}

/* ============================================================
   FRETE GRÁTIS — por valor mínimo (R$399) OU porque toda peça no
   carrinho tem "frete grátis sempre" marcado (configurável por
   produto no admin, independente do valor da compra).
   ============================================================ */
function carrinhoTemFreteGratis(itens){
  const subtotal = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  if (subtotal >= FRETE_GRATIS_MINIMO) return true;
  return itens.length > 0 && itens.every(i => i.freteGratisSempre);
}

// Barra/aviso de frete grátis — reaproveitada na gaveta do carrinho e na
// página carrinho.html.
function freteGratisBarraHTML(itens){
  const subtotal = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  if (carrinhoTemFreteGratis(itens)){
    return `<div class="cart-drawer-frete-msg ganhou">🎉 Parabéns! Você ganhou <strong>frete grátis</strong></div>`;
  }
  const falta = FRETE_GRATIS_MINIMO - subtotal;
  const pct = Math.min(100, (subtotal / FRETE_GRATIS_MINIMO) * 100);
  return `
    <div class="cart-drawer-frete-msg">Faltam <strong>${formatarPreco(falta)}</strong> pra ganhar frete grátis</div>
    <div class="cart-drawer-frete-barra"><div class="cart-drawer-frete-progresso" style="width:${pct}%"></div></div>
  `;
}

// Selo "Frete grátis" — retângulo escuro com ícone de caminhão branco.
// Mesmo visual reaproveitado em 3 lugares: sobre a foto do card no
// catálogo, no resultado do cálculo de frete (carrinho/checkout/produto)
// e perto do preço na página do produto. classeExtra: modificador extra
// de posicionamento (ex.: "selo-frete-gratis--foto" pra ficar sobre a foto).
function seloFreteGratisHTML(classeExtra){
  return `<span class="selo-frete-gratis${classeExtra ? ' ' + classeExtra : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/></svg>Frete grátis</span>`;
}

/* ============================================================
   POPUP DE CUPOM DE BOAS-VINDAS — aparece uma vez por sessão (não
   incomoda em toda página) se o admin tiver marcado algum cupom
   pra isso ("Mostrar como popup de boas-vindas" no admin).
   ============================================================ */
// Cache compartilhado (promessa, não só valor) — pra qualquer página que
// precise do cupom em destaque (popup, preço riscado na página do produto,
// futuramente cards) fazer só UMA chamada ao banco, não uma cada uma.
let promessaCupomDestaque = null;
function obterCupomDestaque(){
  if (!promessaCupomDestaque){
    promessaCupomDestaque = sb.rpc('cupom_destaque').maybeSingle().then(({ data, error }) => (error ? null : data));
  }
  return promessaCupomDestaque;
}

// Calcula o preço já com o cupom em destaque aplicado, pra mostrar "de/por"
// na página do produto — respeita o valor mínimo do cupom (se a peça
// sozinha não bater o mínimo, não mostra o preço promocional errado).
function calcularPrecoComCupom(preco, cupom){
  if (!cupom) return null;
  if (cupom.valor_minimo && preco < cupom.valor_minimo) return null;
  const desconto = cupom.tipo === 'percentual' ? preco * (cupom.valor / 100) : Math.min(cupom.valor, preco);
  return Math.max(0, preco - desconto);
}

// Diferente do preço de fábrica (permissão direto na conta), o cupom de
// boas-vindas é público — mas só fica ativo depois que a pessoa clica em
// "Resgatar" no popup. Antes disso ele existe mas não desconta nada em
// lugar nenhum do site (sem popup = sem desconto escondido).
const CUPOM_DESTAQUE_RESGATADO_KEY = 'pavan_cupom_destaque_resgatado';
function obterCupomDestaqueResgatado(){
  try { return localStorage.getItem(CUPOM_DESTAQUE_RESGATADO_KEY) || null; } catch { return null; }
}
function marcarCupomDestaqueResgatado(codigo){
  try { localStorage.setItem(CUPOM_DESTAQUE_RESGATADO_KEY, codigo); } catch {}
}

// Só devolve o cupom (e só guarda ele pro carrinho/checkout baterem) se a
// pessoa já resgatou esse código específico. Se o admin trocar o cupom em
// destaque depois, o resgate antigo não vale mais pro novo código.
async function autoAplicarCupomDestaque(){
  const cupom = await obterCupomDestaque();
  if (!cupom || obterCupomDestaqueResgatado() !== cupom.codigo) return null;
  if (!obterCupomAplicado()) salvarCupomAplicado(cupom.codigo);
  return cupom;
}

async function mostrarPopupCupomBoasVindas(){
  const data = await obterCupomDestaque();
  if (!data) return;
  if (obterCupomDestaqueResgatado() === data.codigo) return; // já resgatou, não mostra de novo
  try {
    if (sessionStorage.getItem('pavan_popup_cupom_visto')) return;
  } catch {}
  if (document.getElementById('painelAdmin')) return; // nunca no admin
  if (['checkout.html', 'carrinho.html'].some(p => location.pathname.endsWith(p))) return; // já tem cupom lá
  try { sessionStorage.setItem('pavan_popup_cupom_visto', '1'); } catch {}

  const desconto = data.tipo === 'percentual' ? `${data.valor}% OFF` : `${formatarPreco(data.valor)} OFF`;
  const minimoTexto = data.valor_minimo > 0 ? ` em compras acima de ${formatarPreco(data.valor_minimo)}` : '';

  const popup = document.createElement('div');
  popup.className = 'popup-cupom';
  popup.innerHTML = `
    <button type="button" class="popup-cupom-fechar" aria-label="Fechar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
    </button>
    <span class="popup-cupom-eyebrow">Presente de boas-vindas 🎁</span>
    <strong class="popup-cupom-desconto">${desconto}</strong>
    <p>Resgate agora${minimoTexto} e o desconto é aplicado automaticamente em toda a loja.</p>
    <button type="button" class="popup-cupom-resgatar" data-codigo="${data.codigo}">Resgatar desconto</button>
  `;
  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add('show'));

  const fechar = () => { popup.classList.remove('show'); setTimeout(() => popup.remove(), 300); };
  popup.querySelector('.popup-cupom-fechar').addEventListener('click', fechar);
  popup.querySelector('.popup-cupom-resgatar').addEventListener('click', (e) => {
    const codigo = e.currentTarget.getAttribute('data-codigo');
    marcarCupomDestaqueResgatado(codigo);
    salvarCupomAplicado(codigo);
    e.currentTarget.textContent = 'Resgatado ✓';
    e.currentTarget.disabled = true;
    mostrarToast(`Cupom ${codigo} resgatado — desconto já aplicado em toda a loja! 🎁`);
    aplicarPrecoCupomDestaqueNoDOM();
    setTimeout(fechar, 1200);
  });
}

/* ============================================================
   CUPOM "PREÇO DE FÁBRICA" — diferente do popup de boas-vindas acima
   (que é público, pra QUALQUER visitante do site): esse é pessoal.
   Só existe pra quem já tem o código salvo no navegador — recebeu de
   você e digitou uma vez no carrinho, ou abriu um link do tipo
   pavanoficial.com.br/?cupom=CODIGO. A partir daí, todo produto que
   essa pessoa vir no site já mostra o preço de fábrica sozinho, e ela
   recebe um aviso discreto toda vez que entra (não só na primeira).
   ============================================================ */

// Permissão concedida pelo admin direto na conta (tela "Clientes" do
// admin) — sem conta logada com a permissão, não tem preço de fábrica
// nenhum. Cacheado numa promise (não um bool) porque a primeira chamada
// já dispara a checagem de sessão + a RPC juntas, e todo mundo que
// perguntar de novo na mesma carga de página reaproveita o resultado.
let promessaPermissaoFabrica = null;
function temPermissaoFabrica(){
  if (!promessaPermissaoFabrica){
    promessaPermissaoFabrica = sb.auth.getSession().then(({ data }) => {
      if (!data.session) return false;
      return sb.rpc('tenho_permissao_fabrica').then(({ data: permitido, error }) => !error && !!permitido);
    });
  }
  return promessaPermissaoFabrica;
}

// Fração de desconto por COMBINAÇÃO de quilate/banho (preço de fábrica ÷
// preço de venda daquela combinação específica) — nunca os valores de
// custo em si, só essa fração final. Cada produto tem uma LISTA de
// combinações (mapa[produto_id] = [{quilate, banho, fator}, ...]), porque
// cada tamanho/cor pode ter um custo diferente — nunca um fator só que
// "serve" pra qualquer tamanho (isso já foi bug: aplicava o fator do
// tamanho mais barato em qualquer tamanho escolhido).
let promessaPrecosFabrica = null;
function obterPrecosFabrica(){
  if (!promessaPrecosFabrica){
    promessaPrecosFabrica = sb.rpc('precos_fabrica_ativos').then(({ data, error }) => {
      const mapa = {};
      (error ? [] : (data || [])).forEach(r => {
        if (!mapa[r.produto_id]) mapa[r.produto_id] = [];
        mapa[r.produto_id].push({ quilate: r.quilate, banho: r.banho, fator: Number(r.fator_desconto) });
      });
      return mapa;
    });
  }
  return promessaPrecosFabrica;
}

// Acha o fator certo pra uma combinação de quilate/banho — mesma lógica
// (e mesma ordem de prioridade) de resolverPrecoVariante(), pra nunca
// mostrar um desconto de fábrica que não bate com o preço realmente
// cobrado daquele tamanho/cor.
function resolverFatorFabrica(combos, quilate, banho){
  if (!combos || !combos.length) return undefined;
  const exato = combos.find(c => (c.quilate || null) === (quilate || null) && (c.banho || null) === (banho || null));
  if (exato) return exato.fator;
  const porQuilate = quilate && combos.find(c => (c.quilate || null) === quilate);
  if (porQuilate) return porQuilate.fator;
  const porBanho = banho && combos.find(c => (c.banho || null) === banho);
  if (porBanho) return porBanho.fator;
  const base = combos.find(c => !c.quilate && !c.banho);
  return base ? base.fator : undefined;
}

// Risca o preço original e mostra o de fábrica em qualquer card de
// produto (index, categoria, busca, favoritos...). Usa um
// MutationObserver porque os cards são renderizados de forma assíncrona,
// em momentos diferentes em cada página — assim funciona não importa a
// ordem de chegada. Cards não têm variante selecionada ainda, então usa
// sempre a combinação-resumo (a mais barata, ver precos_fabrica_ativos()).
async function aplicarPrecoFabricaNoDOM(){
  if (!(await temPermissaoFabrica())) return;
  const mapa = await obterPrecosFabrica();
  document.querySelectorAll('.prod-price[data-produto-id]').forEach(el => {
    if (el.dataset.fabricaAplicado) return;
    const fator = resolverFatorFabrica(mapa[el.dataset.produtoId], null, null);
    if (fator === undefined) return;
    const precoOriginal = parseFloat(el.dataset.precoOriginal);
    if (!precoOriginal) return;
    el.dataset.fabricaAplicado = '1';
    el.innerHTML = `${formatarPreco(precoOriginal * fator)} <s class="preco-riscado">${formatarPreco(precoOriginal)}</s>`;
  });
}
let observadorPrecoFabricaIniciado = false;
function iniciarObservadorPrecoFabrica(){
  if (observadorPrecoFabricaIniciado) return;
  observadorPrecoFabricaIniciado = true;
  aplicarPrecoFabricaNoDOM();
  new MutationObserver(() => aplicarPrecoFabricaNoDOM()).observe(document.body, { childList: true, subtree: true });
}

// Mesma ideia do preço de fábrica acima, mas pro cupom de boas-vindas
// (geral) — só risca o preço nos cards depois que a pessoa resgatou no
// popup. Preço de fábrica tem prioridade quando os dois coexistem (pula
// o card que a função de fábrica já marcou).
async function aplicarPrecoCupomDestaqueNoDOM(){
  const cupom = await autoAplicarCupomDestaque(); // só volta cupom se já resgatado
  if (!cupom) return;
  document.querySelectorAll('.prod-price[data-produto-id]').forEach(el => {
    if (el.dataset.fabricaAplicado || el.dataset.cupomAplicado) return;
    const precoOriginal = parseFloat(el.dataset.precoOriginal);
    if (!precoOriginal) return;
    const precoComCupom = calcularPrecoComCupom(precoOriginal, cupom);
    if (precoComCupom === null) return; // não bateu o valor mínimo do cupom
    el.dataset.cupomAplicado = '1';
    el.innerHTML = `${formatarPreco(precoComCupom)} <s class="preco-riscado">${formatarPreco(precoOriginal)}</s>`;
  });
}
let observadorPrecoCupomDestaqueIniciado = false;
function iniciarObservadorPrecoCupomDestaque(){
  if (observadorPrecoCupomDestaqueIniciado) return;
  observadorPrecoCupomDestaqueIniciado = true;
  aplicarPrecoCupomDestaqueNoDOM();
  new MutationObserver(() => aplicarPrecoCupomDestaqueNoDOM()).observe(document.body, { childList: true, subtree: true });
}

// Aviso pessoal — ao contrário do popup de boas-vindas (uma vez por
// sessão, pra qualquer um), esse é "toda vez que ESSA pessoa entra no
// site" — sessionStorage já cobre isso (reaparece em cada sessão nova,
// não fica repetindo em toda página clicada dentro da mesma visita).
async function mostrarPopupPrecoFabrica(){
  if (!(await temPermissaoFabrica())) return;
  try {
    if (sessionStorage.getItem('pavan_popup_fabrica_visto')) return;
  } catch {}
  if (document.getElementById('painelAdmin')) return; // nunca no admin
  if (['checkout.html', 'carrinho.html'].some(p => location.pathname.endsWith(p))) return;
  try { sessionStorage.setItem('pavan_popup_fabrica_visto', '1'); } catch {}

  const popup = document.createElement('div');
  popup.className = 'popup-cupom popup-cupom--fabrica';
  popup.innerHTML = `
    <button type="button" class="popup-cupom-fechar" aria-label="Fechar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
    </button>
    <span class="popup-cupom-eyebrow">Preço de fábrica 🏭</span>
    <strong class="popup-cupom-desconto">Ativo na sua conta</strong>
    <p>Você tem acesso ao preço de fábrica em toda a loja. O desconto é aplicado automaticamente em cada peça, sem necessidade de nenhuma ação adicional.</p>
  `;
  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add('show'));
  const fechar = () => { popup.classList.remove('show'); setTimeout(() => popup.remove(), 300); };
  popup.querySelector('.popup-cupom-fechar').addEventListener('click', fechar);
}

/* ============================================================
   SELOS DE SEGURANÇA NO RODAPÉ — injetado por JS em todas as
   páginas (o footer é HTML repetido em cada arquivo; fazer aqui
   evita editar página por página).
   ============================================================ */
// Aviso de cookies (LGPD) — barra fixa embaixo, some assim que a pessoa
// clica em "Entendi" e não volta mais nesse navegador (localStorage).
// Como o site já usa cookie/localStorage essenciais desde a primeira
// visita (sessão, carrinho), isso é só o aviso/transparência — não
// bloqueia nada enquanto a pessoa não responde.
const COOKIES_ACEITOS_KEY = 'pavan_cookies_aceitos';
function injetarAvisoCookies(){
  try { if (localStorage.getItem(COOKIES_ACEITOS_KEY)) return; } catch { return; }
  if (document.querySelector('.aviso-cookies')) return;

  const aviso = document.createElement('div');
  aviso.className = 'aviso-cookies';
  aviso.innerHTML = `
    <p>Usamos cookies para melhorar sua experiência de compra. Ao continuar navegando, você concorda com nossa <a href="privacidade.html">Política de privacidade</a>.</p>
    <button type="button" class="aviso-cookies-btn">Entendi</button>
  `;
  document.body.appendChild(aviso);
  requestAnimationFrame(() => aviso.classList.add('show'));
  // Sobe os popups de cupom (bem-vindo/fábrica) pra não ficarem escondidos
  // atrás dessa barra — importante porque quem ainda não aceitou cookies é
  // exatamente quem mais recebe o popup de boas-vindas (visita nova).
  document.body.classList.add('tem-aviso-cookies');

  aviso.querySelector('.aviso-cookies-btn').addEventListener('click', () => {
    try { localStorage.setItem(COOKIES_ACEITOS_KEY, '1'); } catch {}
    aviso.classList.remove('show');
    document.body.classList.remove('tem-aviso-cookies');
    setTimeout(() => aviso.remove(), 350);
  });
}

function injetarSelosSeguranca(){
  const footerBottom = document.querySelector('footer .footer-bottom');
  if (!footerBottom || document.querySelector('.selos-seguranca')) return;
  const selos = document.createElement('div');
  selos.className = 'selos-seguranca';
  selos.innerHTML = `
    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Compra 100% protegida</span>
    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg> Pagamento via Mercado Pago</span>
    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> Pix, cartão ou boleto</span>
  `;
  footerBottom.parentElement.insertBefore(selos, footerBottom);
}

/* ============================================================
   CARRINHO PERSISTENTE (localStorage) + gaveta lateral
   Ao adicionar um item, abre deslizando pela direita (estilo
   Versale), sem sair da página. Funciona em TODAS as páginas
   porque é montado aqui no shared.js.
   ============================================================ */
const CARRINHO_STORAGE_KEY = 'pavan_carrinho';
const CUPOM_STORAGE_KEY = 'pavan_cupom_codigo';
const FRETE_GRATIS_MINIMO = 399;

// Cupom aplicado persiste entre carrinho.html e checkout.html (o cliente não
// precisa digitar o código de novo na hora de pagar) — a validação de
// verdade sempre roda de novo no servidor em cada página, isso aqui só
// guarda QUAL código tentar reaplicar.
function obterCupomAplicado(){
  try { return localStorage.getItem(CUPOM_STORAGE_KEY) || null; } catch { return null; }
}
function salvarCupomAplicado(codigo){
  try { localStorage.setItem(CUPOM_STORAGE_KEY, codigo); } catch {}
}
function removerCupomAplicado(){
  try { localStorage.removeItem(CUPOM_STORAGE_KEY); } catch {}
}

function obterCarrinho(){
  try {
    const bruto = localStorage.getItem(CARRINHO_STORAGE_KEY);
    const itens = bruto ? JSON.parse(bruto) : [];
    if (!Array.isArray(itens)) return [];
    // Autocorrige itens salvos antes de normalizarmos tamanho/quilate pra
    // sempre virar null (em vez de undefined) — carrinhos antigos no
    // localStorage do cliente podiam ficar com essas chaves ausentes, o
    // que travava os botões de +/-/remover silenciosamente (undefined
    // nunca bate com null numa comparação ===).
    return itens.map(i => ({ ...i, tamanho: i.tamanho || null, quilate: i.quilate || null, banho: i.banho || null }));
  } catch {
    return [];
  }
}

function salvarCarrinho(itens){
  try { localStorage.setItem(CARRINHO_STORAGE_KEY, JSON.stringify(itens)); } catch {}
  atualizarContadorCarrinho();
}

function atualizarContadorCarrinho(){
  const total = obterCarrinho().reduce((soma, item) => soma + item.qtd, 0);
  document.querySelectorAll('#cartCount').forEach(el => { el.textContent = total; });
}

// produto: { id, nome, preco, imagem, tamanho, quilate, banho, qtd }
function adicionarAoCarrinho(produto){
  const itens = obterCarrinho();
  const tamanho = produto.tamanho || null;
  const quilate = produto.quilate || null;
  const banho = produto.banho || null;
  // (i.tamanho || null) e não i.tamanho: itens salvos no carrinho antes de
  // normalizarmos esses campos podem ter vindo sem a chave (undefined), e
  // "undefined === null" é false — o item viraria duplicado em vez de somar.
  const existente = itens.find(i => i.id === produto.id && (i.tamanho || null) === tamanho && (i.quilate || null) === quilate && (i.banho || null) === banho);
  if (existente){
    existente.qtd += produto.qtd || 1;
  } else {
    itens.push({
      id: produto.id,
      nome: produto.nome,
      preco: Number(produto.preco) || 0,
      imagem: produto.imagem || '',
      tamanho,
      quilate,
      banho,
      qtd: produto.qtd || 1,
      freteGratisSempre: !!produto.freteGratisSempre
    });
  }
  salvarCarrinho(itens);
  pulsarCarrinho();
  renderCartDrawer();
  abrirCartDrawer();
}

function removerDoCarrinho(id, tamanho, quilate, banho){
  // (i.tamanho || null): mesma proteção contra item antigo salvo sem a
  // chave tamanho/quilate/banho (undefined), que nunca bateria com null e
  // fazia o botão "Remover" clicar sem remover nada.
  const itens = obterCarrinho().filter(i => !(i.id === id && (i.tamanho || null) === (tamanho || null) && (i.quilate || null) === (quilate || null) && (i.banho || null) === (banho || null)));
  salvarCarrinho(itens);
  renderCartDrawer();
}

function alterarQtdCarrinho(id, tamanho, quilate, banho, delta){
  const itens = obterCarrinho();
  const item = itens.find(i => i.id === id && (i.tamanho || null) === (tamanho || null) && (i.quilate || null) === (quilate || null) && (i.banho || null) === (banho || null));
  if (!item) return;
  item.qtd = Math.max(1, item.qtd + delta);
  salvarCarrinho(itens);
  renderCartDrawer();
}

function montarCartDrawer(){
  if (document.getElementById('cartDrawer')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="cart-drawer-overlay" id="cartDrawerOverlay"></div>
    <aside class="cart-drawer" id="cartDrawer" aria-label="Carrinho de compras">
      <div class="cart-drawer-head">
        <span class="cart-drawer-titulo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>
          <span id="cartDrawerContagem">0 itens</span>
        </span>
        <button type="button" class="cart-drawer-fechar" id="cartDrawerFechar" aria-label="Fechar carrinho">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
        </button>
      </div>
      <div class="cart-drawer-frete" id="cartDrawerFrete"></div>
      <div class="cart-drawer-lista" id="cartDrawerLista"></div>
      <div class="cart-drawer-rodape" id="cartDrawerRodape"></div>
    </aside>
  `;
  document.body.appendChild(wrap);

  document.getElementById('cartDrawerOverlay').addEventListener('click', fecharCartDrawer);
  document.getElementById('cartDrawerFechar').addEventListener('click', fecharCartDrawer);

  // O ícone de carrinho do header abre a gaveta em vez de navegar pra carrinho.html
  document.querySelectorAll('a.icon-btn[href="carrinho.html"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      renderCartDrawer();
      abrirCartDrawer();
    });
  });
}

function abrirCartDrawer(){
  document.getElementById('cartDrawerOverlay').classList.add('show');
  document.getElementById('cartDrawer').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function fecharCartDrawer(){
  document.getElementById('cartDrawerOverlay').classList.remove('show');
  document.getElementById('cartDrawer').classList.remove('show');
  document.body.style.overflow = '';
}

function renderCartDrawer(){
  const itens = obterCarrinho();
  const totalItens = itens.reduce((s, i) => s + i.qtd, 0);
  document.getElementById('cartDrawerContagem').textContent = `${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`;

  const subtotal = itens.reduce((s, i) => s + i.preco * i.qtd, 0);

  // Barra de frete grátis — mesma regra usada no resto do site (acima de R$399, ou por produto)
  const freteEl = document.getElementById('cartDrawerFrete');
  freteEl.innerHTML = itens.length === 0 ? '' : freteGratisBarraHTML(itens);

  const lista = document.getElementById('cartDrawerLista');
  const rodape = document.getElementById('cartDrawerRodape');

  if (itens.length === 0){
    lista.innerHTML = `<div class="carrinho-vazio"><p>Seu carrinho está vazio.</p></div>`;
    rodape.innerHTML = `<a href="index.html" class="btn btn-primary" style="width:100%;justify-content:center;">Continuar comprando</a>`;
    return;
  }

  lista.innerHTML = itens.map(item => `
    <div class="carrinho-item">
      <img src="${item.imagem}" alt="${item.nome}">
      <div class="carrinho-info">
        <div class="nome">${item.nome}</div>
        ${item.quilate ? `<div class="tags">${item.quilate}</div>` : ''}
        ${item.banho ? `<div class="tags">${item.banho}</div>` : ''}
        ${item.tamanho ? `<div class="tags">Aro ${item.tamanho}</div>` : ''}
        <div class="carrinho-qtd">
          <button type="button" data-acao="menos" data-id="${item.id}" data-tamanho="${item.tamanho || ''}" data-quilate="${item.quilate || ''}" data-banho="${item.banho || ''}" aria-label="Diminuir quantidade">−</button>
          <span>${item.qtd}</span>
          <button type="button" data-acao="mais" data-id="${item.id}" data-tamanho="${item.tamanho || ''}" data-quilate="${item.quilate || ''}" data-banho="${item.banho || ''}" aria-label="Aumentar quantidade">+</button>
        </div>
        <button type="button" class="carrinho-remover" data-acao="remover" data-id="${item.id}" data-tamanho="${item.tamanho || ''}" data-quilate="${item.quilate || ''}" data-banho="${item.banho || ''}">Remover</button>
      </div>
      <div class="carrinho-preco">${formatarPreco(item.preco * item.qtd)}</div>
    </div>
  `).join('');

  lista.querySelectorAll('button[data-acao]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const tamanho = btn.getAttribute('data-tamanho') || null;
      const quilate = btn.getAttribute('data-quilate') || null;
      const banho = btn.getAttribute('data-banho') || null;
      const acao = btn.getAttribute('data-acao');
      if (acao === 'mais') alterarQtdCarrinho(id, tamanho, quilate, banho, 1);
      if (acao === 'menos') alterarQtdCarrinho(id, tamanho, quilate, banho, -1);
      if (acao === 'remover') removerDoCarrinho(id, tamanho, quilate, banho);
    });
  });

  rodape.innerHTML = `
    <div class="carrinho-resumo" style="margin-top:0;padding-top:0;border-top:none;font-size:1rem;">
      <span>Subtotal</span>
      <span>${formatarPreco(subtotal)}</span>
    </div>
    <a href="checkout.html" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px;">Finalizar compra</a>
    <button type="button" class="btn btn-outline" style="width:100%;justify-content:center;margin-top:8px;" id="cartDrawerContinuar">Continuar comprando</button>
    <a href="carrinho.html" style="display:block;text-align:center;margin-top:10px;font-size:0.8rem;text-decoration:underline;color:var(--texto-suave);">Ver carrinho completo</a>
  `;
  document.getElementById('cartDrawerContinuar').addEventListener('click', fecharCartDrawer);
}

// Usado pelo botão "Adicionar ao carrinho" dos cards (index/categoria/busca) —
// lê os dados do próprio botão (data-*) pra evitar problema de aspas no nome.
function adicionarAoCarrinhoCard(btn){
  const tamanhos = (btn.dataset.tamanhos || '').split(',').filter(Boolean);
  let quilates = [];
  try { quilates = JSON.parse(decodeURIComponent(btn.dataset.quilates || '[]')); } catch { quilates = []; }
  let banhos = [];
  try { banhos = JSON.parse(decodeURIComponent(btn.dataset.banhos || '[]')); } catch { banhos = []; }
  let matrizPrecos = [];
  try { matrizPrecos = JSON.parse(decodeURIComponent(btn.dataset.matriz || '[]')); } catch { matrizPrecos = []; }
  const produto = {
    id: btn.dataset.id,
    nome: btn.dataset.nome,
    preco: parseFloat(btn.dataset.preco),
    imagem: btn.dataset.imagem,
    freteGratisSempre: btn.dataset.freteGratis === 'true',
    matrizPrecos
  };

  // Peça com aro, quilate e/ou banho cadastrado: não dá pra adicionar sem
  // saber qual variante — abre um popup pedindo, em vez de mandar direto
  // (bug que o cliente caía comprando sem a variante definida).
  if (tamanhos.length || quilates.length || banhos.length){
    abrirVarianteModal(produto, { tamanhos, quilates, banhos });
    return;
  }

  btn.classList.add('clicado');
  setTimeout(() => btn.classList.remove('clicado'), 300);
  adicionarAoCarrinho({ ...produto, tamanho: null, quilate: null, banho: null, qtd: 1 });
  mostrarSucessoBotaoAdd(btn);
}

// Troca o texto do botão por "Adicionado ✓" por um instante — feedback
// mais forte que só a ondinha de clique, sem precisar sair da página
// (a gaveta do carrinho já abre também, isso aqui é só o botão em si).
function mostrarSucessoBotaoAdd(btn){
  if (btn.dataset.animando) return;
  btn.dataset.animando = '1';
  const textoOriginal = btn.textContent;
  btn.classList.add('sucesso');
  btn.textContent = 'Adicionado ✓';
  setTimeout(() => {
    btn.classList.remove('sucesso');
    btn.textContent = textoOriginal;
    delete btn.dataset.animando;
  }, 1100);
}

/* ============================================================
   POPUP "ESCOLHA A VARIANTE" — aparece quando o cliente tenta
   adicionar ao carrinho direto do card (categoria/home/busca)
   numa peça que precisa de quilate e/ou aro. Mostra só os
   seletores que a peça realmente tem.
   ============================================================ */
let produtoAguardandoVariante = null;

function montarVarianteModal(){
  if (document.getElementById('tamanhoModalOverlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="tamanho-modal-overlay" id="tamanhoModalOverlay">
      <div class="tamanho-modal">
        <button type="button" class="tamanho-modal-fechar" id="tamanhoModalFechar" aria-label="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
        </button>
        <p id="tamanhoModalNome"></p>

        <div id="varianteModalQuilateSecao" style="display:none;">
          <h3>Escolha o quilate</h3>
          <div class="tamanho-pills" id="varianteModalQuilatePills"></div>
        </div>

        <div id="varianteModalBanhoSecao" style="display:none;margin-top:16px;">
          <h3>Escolha o banho</h3>
          <div class="banho-swatches" id="varianteModalBanhoSwatches"></div>
        </div>

        <div id="varianteModalTamanhoSecao" style="display:none;margin-top:16px;">
          <h3>Escolha o tamanho</h3>
          <div class="tamanho-pills" id="varianteModalTamanhoPills"></div>
          <a href="guia-tamanho.html" target="_blank" class="link-guia-tamanho" style="display:inline-block;margin-top:12px;">Não sabe seu tamanho?</a>
        </div>

        <button type="button" class="btn btn-primary" id="tamanhoModalConfirmar" style="width:100%;justify-content:center;margin-top:18px;" disabled>Adicionar ao carrinho</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  document.getElementById('tamanhoModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'tamanhoModalOverlay') fecharTamanhoModal();
  });
  document.getElementById('tamanhoModalFechar').addEventListener('click', fecharTamanhoModal);
}

function abrirVarianteModal(produto, { tamanhos, quilates, banhos = [] }){
  montarVarianteModal();
  produtoAguardandoVariante = { ...produto, tamanho: null, quilate: null, banho: null };

  document.getElementById('tamanhoModalNome').textContent = produto.nome;

  const confirmar = document.getElementById('tamanhoModalConfirmar');
  confirmar.disabled = true;

  function verificarCompleto(){
    const faltaQuilate = quilates.length && !produtoAguardandoVariante.quilate;
    const faltaBanho = banhos.length && !produtoAguardandoVariante.banho;
    const faltaTamanho = tamanhos.length && !produtoAguardandoVariante.tamanho;
    confirmar.disabled = faltaQuilate || faltaBanho || faltaTamanho;
  }

  const quilateSecao = document.getElementById('varianteModalQuilateSecao');
  quilateSecao.style.display = quilates.length ? 'block' : 'none';
  if (quilates.length){
    document.getElementById('varianteModalQuilatePills').innerHTML = quilates.map(q => `
      <button type="button" class="tamanho-pill" data-quilate="${q.valor}">${q.valor} — ${formatarPreco(q.preco)}</button>
    `).join('');
    document.querySelectorAll('#varianteModalQuilatePills .tamanho-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#varianteModalQuilatePills .tamanho-pill').forEach(b => b.classList.remove('active'));
        pill.classList.add('active');
        produtoAguardandoVariante.quilate = pill.getAttribute('data-quilate');
        // Combina com o banho já escolhido (se tiver) — não é o preço do
        // quilate sozinho, senão o banho apaga ele de novo na hora de somar.
        produtoAguardandoVariante.preco = resolverPrecoVariante(produto, produtoAguardandoVariante.quilate, produtoAguardandoVariante.banho);
        verificarCompleto();
      });
    });
  }

  const banhoSecao = document.getElementById('varianteModalBanhoSecao');
  banhoSecao.style.display = banhos.length ? 'block' : 'none';
  if (banhos.length){
    document.getElementById('varianteModalBanhoSwatches').innerHTML = banhos.map(b => `
      <button type="button" class="banho-swatch" data-banho="${b.nome}" title="${b.nome}" style="background-image:url('${b.foto_url}')"></button>
    `).join('');
    document.querySelectorAll('#varianteModalBanhoSwatches .banho-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('#varianteModalBanhoSwatches .banho-swatch').forEach(b => b.classList.remove('active'));
        swatch.classList.add('active');
        produtoAguardandoVariante.banho = swatch.getAttribute('data-banho');
        // Combina com o quilate já escolhido (se tiver) — mesma lógica do
        // quilate acima, só invertida.
        produtoAguardandoVariante.preco = resolverPrecoVariante(produto, produtoAguardandoVariante.quilate, produtoAguardandoVariante.banho);
        verificarCompleto();
      });
    });
  }

  const tamanhoSecao = document.getElementById('varianteModalTamanhoSecao');
  tamanhoSecao.style.display = tamanhos.length ? 'block' : 'none';
  if (tamanhos.length){
    document.getElementById('varianteModalTamanhoPills').innerHTML = [...tamanhos].sort((a, b) => parseFloat(a) - parseFloat(b)).map(t => `
      <button type="button" class="tamanho-pill" data-tamanho="${t}">${t}</button>
    `).join('');
    document.querySelectorAll('#varianteModalTamanhoPills .tamanho-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#varianteModalTamanhoPills .tamanho-pill').forEach(b => b.classList.remove('active'));
        pill.classList.add('active');
        produtoAguardandoVariante.tamanho = pill.getAttribute('data-tamanho');
        verificarCompleto();
      });
    });
  }

  confirmar.onclick = () => {
    adicionarAoCarrinho({ ...produtoAguardandoVariante, qtd: 1 });
    fecharTamanhoModal();
  };

  document.getElementById('tamanhoModalOverlay').classList.add('show');
}

function fecharTamanhoModal(){
  const overlay = document.getElementById('tamanhoModalOverlay');
  if (overlay) overlay.classList.remove('show');
}

// Monta a gaveta e sincroniza o contador do ícone assim que a página carrega
// — só nas páginas da loja (o admin.html não usa style.css nem tem
// carrinho, então nunca deve receber esse HTML).
if (!document.getElementById('painelAdmin')){
  montarCartDrawer();
  atualizarContadorCarrinho();
}

/* ============================================================
   CARD DE PRODUTO
   Ordem: imagem → título (centralizado) → box 2x2 [preço | banho]
   / [material | pedra] → Comprar → Adicionar ao carrinho.
   ============================================================ */
function cardProdutoHTML(p){
  const esgotado = (p.estoque ?? 0) <= 0;
  // Só destaca frete grátis em peça disponível (esgotado já ocupa o
  // mesmo cantinho da foto, e não faz sentido vender frete de algo
  // que não dá pra comprar agora).
  const temFreteGratis = !esgotado && (p.preco >= FRETE_GRATIS_MINIMO || p.freteGratisSempre);
  return `
    <div class="prod-card reveal ${esgotado ? 'esgotado' : ''}">
      ${esgotado ? '<span class="badge-esgotado-card">Esgotado</span>' : ''}
      ${temFreteGratis ? seloFreteGratisHTML('selo-frete-gratis--foto') : ''}
      <a href="produto.html?id=${p.id}" class="prod-card-link" aria-label="Ver ${p.nome}">
        <div class="prod-img" style="background-image:url('${p.image}')"></div>
        <div class="prod-name">${p.nome}</div>
        <div class="prod-info-box">
          <div class="prod-info-cell">
            <span class="prod-price" data-produto-id="${p.id}" data-preco-original="${p.preco}">${formatarPreco(p.preco)}</span>
          </div>
          <div class="prod-info-cell">
            <span class="prod-spec-label">Banho</span>
            <span class="prod-spec-valor">${p.temBanho ? p.banho : '—'}</span>
          </div>
          <div class="prod-info-cell">
            <span class="prod-spec-label">Material</span>
            <span class="prod-spec-valor">${p.material}</span>
          </div>
          <div class="prod-info-cell">
            <span class="prod-spec-label">Pedra</span>
            <span class="prod-spec-valor">${p.temPedra ? p.pedra : '—'}</span>
          </div>
        </div>
      </a>
      <div class="prod-actions">
        ${esgotado
          ? `<button type="button" class="btn btn-outline" disabled>Esgotado</button>`
          : `<button type="button" class="btn btn-primary btn-add"
              data-id="${p.id}" data-nome="${p.nome.replace(/"/g, '&quot;')}" data-preco="${p.preco}" data-imagem="${p.image}"
              data-tamanhos="${(p.tamanhos || []).join(',')}"
              data-quilates="${encodeURIComponent(JSON.stringify(p.quilates || []))}"
              data-banhos="${encodeURIComponent(JSON.stringify(p.banhos || []))}"
              data-matriz="${encodeURIComponent(JSON.stringify(p.matrizPrecos || []))}"
              data-frete-gratis="${!!p.freteGratisSempre}"
              onclick="adicionarAoCarrinhoCard(this)">Adicionar ao carrinho</button>`}
      </div>
    </div>
  `;
}

function skeletonGridHTML(qtd = 6){
  return Array.from({ length: qtd }).map(() => `
    <div class="prod-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton skeleton-linha" style="width:60%"></div>
      <div class="skeleton skeleton-linha" style="width:40%"></div>
    </div>
  `).join('');
}

// "Carregar mais" reaproveitado por categoria/busca/coleção — em vez de
// jogar a lista inteira na tela de uma vez (lento e cansativo de rolar
// se o catálogo crescer), mostra um tanto por vez. Guarda quanto já tá
// visível de cada grid (WeakMap = não vaza memória entre navegações) pra
// "carregar mais" saber de onde continuar sem re-renderizar do zero.
const ITENS_POR_PAGINA_GRID = 12;
const paginacaoGridState = new WeakMap();

function renderGridPaginado(gridEl, listaCompleta, opts = {}){
  const { manterPagina = false, vazio = '<p class="sem-resultados">Nenhum produto encontrado.</p>' } = opts;
  const visiveis = manterPagina
    ? (paginacaoGridState.get(gridEl) || ITENS_POR_PAGINA_GRID)
    : ITENS_POR_PAGINA_GRID;
  paginacaoGridState.set(gridEl, visiveis);

  const fatia = listaCompleta.slice(0, visiveis);
  gridEl.innerHTML = fatia.length ? fatia.map(cardProdutoHTML).join('') : vazio;

  let wrap = gridEl.nextElementSibling;
  if (!wrap || !wrap.classList.contains('carregar-mais-wrap')){
    wrap = document.createElement('div');
    wrap.className = 'carregar-mais-wrap';
    gridEl.insertAdjacentElement('afterend', wrap);
  }
  if (visiveis >= listaCompleta.length){
    wrap.innerHTML = '';
  } else {
    const restantes = listaCompleta.length - visiveis;
    wrap.innerHTML = `<button type="button" class="btn btn-outline btn-carregar-mais">Carregar mais peças <span class="carregar-mais-contagem">(+${Math.min(restantes, ITENS_POR_PAGINA_GRID)})</span></button>`;
    wrap.querySelector('.btn-carregar-mais').addEventListener('click', () => {
      paginacaoGridState.set(gridEl, visiveis + ITENS_POR_PAGINA_GRID);
      renderGridPaginado(gridEl, listaCompleta, { ...opts, manterPagina: true });
    });
  }
  revelarNovosElementos();
}

/* ============================================================
   PÁGINA DE CATEGORIA (genérica — categoria.html?c=slug)
   Inclui o seletor "Escolha por formato" (estilo Versale) além
   dos filtros de material/pedra.
   ============================================================ */
async function renderCategoryPage(){
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('c');
  const grid = document.getElementById('prodGrid');
  grid.innerHTML = skeletonGridHTML();

  const categorias = await carregarCategorias();
  const catInfo = categorias.find(c => c.slug === slug);

  if (!catInfo){
    document.querySelector('.page-title h1').textContent = 'Categoria não encontrada';
    grid.innerHTML = `<p class="sem-resultados">Essa categoria não existe (ou foi removida). <a href="index.html" style="text-decoration:underline;">Voltar à loja</a>.</p>`;
    return;
  }

  document.title = `${catInfo.nome} | Pavan & Co.`;
  document.getElementById('breadcrumbAtual').textContent = catInfo.nome;
  document.querySelector('.page-title h1').textContent = catInfo.nome;

  const todos = await carregarProdutosPorCategoria(slug);

  const materiaisDisponiveis = [...new Set(todos.map(p => p.material))];
  const pedrasDisponiveis = [...new Set(todos.map(p => p.pedra))];
  const formatosDisponiveis = [...new Set(todos.map(p => p.formato).filter(Boolean))];

  let filtroMateriais = new Set();
  let filtroPedras = new Set();
  let filtroFormato = null;
  let ordenacaoAtual = "relevancia";

  // "Escolha por formato" — só aparece se algum produto da categoria tiver pedra
  const formatoWrap = document.getElementById('formatoWrap');
  if (formatosDisponiveis.length){
    formatoWrap.style.display = 'block';
    formatoWrap.querySelector('.formato-pills').innerHTML = formatosDisponiveis.map(f => `
      <div class="formato-item">
        <button type="button" class="formato-pill" data-formato="${f}">
          <span class="formato-icone">${fotoFormatoHTML(f)}</span>
          <span>${f}</span>
        </button>
        <span class="formato-bar"></span>
      </div>
    `).join('');
    formatoWrap.querySelectorAll('.formato-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.getAttribute('data-formato');
        const jaAtivo = btn.classList.contains('active');
        formatoWrap.querySelectorAll('.formato-pill').forEach(b => b.classList.remove('active'));
        if (jaAtivo){ filtroFormato = null; }
        else { btn.classList.add('active'); filtroFormato = f; }
        renderizarTudo();
      });
    });
  } else {
    formatoWrap.style.display = 'none';
  }

  const painel = document.getElementById('painelFiltros');
  painel.innerHTML = `
    <div class="filtro-grupo">
      <h4>Material</h4>
      ${materiaisDisponiveis.map(m => `
        <label class="filtro-check">
          <input type="checkbox" value="${m}" data-tipo="material">
          <span>${m}</span>
        </label>
      `).join('')}
    </div>
    <div class="filtro-grupo">
      <h4>Pedra</h4>
      ${pedrasDisponiveis.map(p => `
        <label class="filtro-check">
          <input type="checkbox" value="${p}" data-tipo="pedra">
          <span>${p}</span>
        </label>
      `).join('')}
    </div>
    <button type="button" class="btn btn-primary" id="aplicarFiltrosBtn" style="width:100%;justify-content:center;">Aplicar filtros</button>
    <button type="button" class="btn-limpar-filtros" id="limparFiltrosBtn">Limpar tudo</button>
  `;

  function produtosFiltrados(){
    return todos.filter(p => {
      const passaMaterial = filtroMateriais.size === 0 || filtroMateriais.has(p.material);
      const passaPedra = filtroPedras.size === 0 || filtroPedras.has(p.pedra);
      const passaFormato = !filtroFormato || p.formato === filtroFormato;
      return passaMaterial && passaPedra && passaFormato;
    });
  }

  function ordenarLista(lista){
    const copia = [...lista];
    if (ordenacaoAtual === "menor-preco") copia.sort((a,b) => a.preco - b.preco);
    else if (ordenacaoAtual === "maior-preco") copia.sort((a,b) => b.preco - a.preco);
    else if (ordenacaoAtual === "nome") copia.sort((a,b) => a.nome.localeCompare(b.nome));
    return copia;
  }

  function renderChips(){
    const chipsWrap = document.getElementById('chipsFiltros');
    if (!chipsWrap) return;
    const chips = [];
    filtroMateriais.forEach(m => chips.push({ tipo: 'material', valor: m }));
    filtroPedras.forEach(p => chips.push({ tipo: 'pedra', valor: p }));
    if (filtroFormato) chips.push({ tipo: 'formato', valor: filtroFormato });
    chipsWrap.innerHTML = chips.map(c => `
      <span class="filter-chip">
        ${c.valor}
        <button type="button" data-remove-tipo="${c.tipo}" data-remove-valor="${c.valor}" aria-label="Remover filtro">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
        </button>
      </span>
    `).join('');
    chipsWrap.querySelectorAll('button[data-remove-tipo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tipo = btn.getAttribute('data-remove-tipo');
        const valor = btn.getAttribute('data-remove-valor');
        if (tipo === 'material') filtroMateriais.delete(valor);
        else if (tipo === 'pedra') filtroPedras.delete(valor);
        else if (tipo === 'formato'){
          filtroFormato = null;
          formatoWrap.querySelectorAll('.formato-pill').forEach(b => b.classList.remove('active'));
        }
        const chk = painel.querySelector(`input[data-tipo="${tipo}"][value="${valor}"]`);
        if (chk) chk.checked = false;
        renderizarTudo();
      });
    });
  }

  function renderizarTudo(){
    const lista = ordenarLista(produtosFiltrados());
    document.getElementById('resultCount').textContent = `${lista.length} produto${lista.length === 1 ? '' : 's'}`;
    renderChips();
    renderGridPaginado(grid, lista, { vazio: '<p class="sem-resultados">Nenhum produto encontrado com esses filtros.</p>' });
  }

  const filtrosBtn = document.getElementById('filtrosBtn');
  filtrosBtn.addEventListener('click', () => painel.classList.toggle('open'));

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'aplicarFiltrosBtn'){
      filtroMateriais = new Set([...painel.querySelectorAll('input[data-tipo="material"]:checked')].map(el => el.value));
      filtroPedras = new Set([...painel.querySelectorAll('input[data-tipo="pedra"]:checked')].map(el => el.value));
      painel.classList.remove('open');
      renderizarTudo();
    }
    if (e.target && e.target.id === 'limparFiltrosBtn'){
      painel.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
      filtroMateriais = new Set();
      filtroPedras = new Set();
      filtroFormato = null;
      formatoWrap.querySelectorAll('.formato-pill').forEach(b => b.classList.remove('active'));
      renderizarTudo();
    }
  });

  const ordenarBtn = document.getElementById('ordenarBtn');
  const ordenarMenu = document.getElementById('ordenarMenu');
  ordenarBtn.addEventListener('click', () => ordenarMenu.classList.toggle('open'));
  ordenarMenu.querySelectorAll('button').forEach(opt => {
    opt.addEventListener('click', () => {
      ordenacaoAtual = opt.getAttribute('data-valor');
      ordenarBtn.querySelector('.ordenar-label').textContent = opt.textContent;
      ordenarMenu.classList.remove('open');
      renderizarTudo();
    });
  });

  renderizarTudo();
}

/* ============================================================
   BUSCA
   ============================================================ */
async function renderBuscaPage(){
  const params = new URLSearchParams(window.location.search);
  const termo = (params.get('q') || '').trim();

  const inputBusca = document.getElementById('inputBuscaPagina');
  if (inputBusca) inputBusca.value = termo;

  const tituloEl = document.getElementById('buscaTitulo');
  const grid = document.getElementById('prodGrid');
  const countEl = document.getElementById('resultCount');

  if (!termo){
    tituloEl.textContent = "O que você está procurando?";
    countEl.textContent = "";
    grid.innerHTML = `<p class="sem-resultados">Digite algo na busca acima — nome da peça, material (ex: "ouro") ou pedra (ex: "moissanite").</p>`;
    return;
  }

  grid.innerHTML = skeletonGridHTML();

  const { data, error } = await sb
    .from('produtos')
    .select(COLUNAS_PRODUTO_PUBLICO)
    .eq('ativo', true)
    .or(`nome.ilike.%${termo}%,material_aro.ilike.%${termo}%,pedra_central.ilike.%${termo}%,categoria.ilike.%${termo}%`);

  const resultados = error ? [] : data.map(mapProduto);

  tituloEl.textContent = `Resultados para "${termo}"`;
  countEl.textContent = `${resultados.length} produto${resultados.length === 1 ? '' : 's'} encontrado${resultados.length === 1 ? '' : 's'}`;
  renderGridPaginado(grid, resultados, { vazio: `<p class="sem-resultados">Nenhum produto encontrado para "${termo}". Tente outro termo.</p>` });
}

/* ============================================================
   PÁGINA DE COLEÇÃO (genérica — colecao.html?tipo=noivado|mais-vendidos|novidades)
   Mesmo "naipe" visual da categoria (título + grade), sem o painel de
   filtros — a curadoria aqui é manual (produto marcado no admin), não
   por material/pedra.
   ============================================================ */
async function renderColecaoPage(){
  const params = new URLSearchParams(window.location.search);
  const tipo = params.get('tipo');
  const grid = document.getElementById('prodGrid');
  const label = LABELS_COLECAO[tipo];

  if (!label){
    document.querySelector('.page-title h1').textContent = 'Coleção não encontrada';
    grid.innerHTML = `<p class="sem-resultados">Essa coleção não existe. <a href="index.html" style="text-decoration:underline;">Voltar à loja</a>.</p>`;
    return;
  }

  // O texto exibido pode ter sido personalizado no admin (home_colecoes);
  // se não achar, cai no rótulo padrão do tipo.
  const colecoes = await carregarHomeColecoes();
  const card = colecoes.find(c => c.tipo === tipo);
  const titulo = (card && card.titulo) || label.titulo;
  const eyebrow = (card && card.subtexto) || label.eyebrow;

  document.title = `${titulo} | Pavan & Co.`;
  document.getElementById('breadcrumbAtual').textContent = titulo;
  document.querySelector('.page-title .eyebrow').textContent = eyebrow;
  document.querySelector('.page-title h1').textContent = titulo;

  grid.innerHTML = skeletonGridHTML();
  const produtos = await carregarProdutosPorColecao(tipo);
  document.getElementById('resultCount').textContent = `${produtos.length} produto${produtos.length === 1 ? '' : 's'}`;
  renderGridPaginado(grid, produtos, { vazio: '<p class="sem-resultados">Nenhum produto nessa coleção ainda — volte em breve.</p>' });
}

function initBuscaForm(formId, redireciona){
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const termo = form.querySelector('input').value.trim();
    if (redireciona){
      window.location.href = `busca.html?q=${encodeURIComponent(termo)}`;
    } else {
      renderBuscaPage();
    }
  });
}

/* ============================================================
   PÁGINA DE PRODUTO
   ============================================================ */
async function renderProdutoPage(){
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const p = await carregarProdutoPorId(id);
  if (!p){
    document.querySelector('.produto-grid').innerHTML = `<p class="sem-resultados">Produto não encontrado. <a href="index.html" style="text-decoration:underline;">Voltar à loja</a>.</p>`;
    return;
  }

  let tamanhoSelecionado = null;
  let quilateSelecionado = null;
  let banhoSelecionado = null;
  let qtd = 1;

  const categorias = await carregarCategorias();
  const catInfo = categorias.find(c => c.slug === p.categoria);
  document.getElementById('breadcrumbCat').textContent = catInfo ? catInfo.nome : p.categoria;
  document.getElementById('breadcrumbCat').href = catInfo ? catInfo.href : '#';
  document.getElementById('breadcrumbNome').textContent = p.nome;
  document.title = `${p.nome} | Pavan & Co.`;

  const configSite = await carregarConfigSite();
  const linkWhatsProduto = document.getElementById('linkWhatsappProduto');
  if (linkWhatsProduto) linkWhatsProduto.href = linkWhatsappSite(`Oi! Tenho uma dúvida sobre a peça "${p.nome}".`);

  const galeriaPrincipal = document.getElementById('galeriaPrincipal');
  const galeriaThumbs = document.getElementById('galeriaThumbs');
  galeriaPrincipal.style.backgroundImage = `url('${p.fotos[0]}')`;
  galeriaThumbs.innerHTML = p.fotos.map((foto, i) => `
    <button type="button" class="galeria-thumb ${i === 0 ? 'active' : ''}" style="background-image:url('${foto}')" data-foto="${foto}" aria-label="Ver foto ${i + 1}"></button>
  `).join('') + (p.videoUrl ? `
    <button type="button" class="galeria-thumb galeria-thumb--video" style="background-image:url('${p.fotos[0]}')" data-video="${p.videoUrl}" aria-label="Ver vídeo do produto">
      <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)"/><path d="M10 8.5l6 3.5-6 3.5v-7z" fill="#fff"/></svg>
    </button>
  ` : '');
  let fotoIndexAtual = 0;
  function trocarFotoPrincipal(thumb){
    const video = thumb.getAttribute('data-video');
    // Pequeno "flash" de opacidade em vez de corte seco — sem atrasar a
    // troca em si (a imagem já muda no mesmo instante), então passar o
    // mouse rápido pelos thumbnails continua respondendo na hora.
    galeriaPrincipal.classList.add('trocando');
    if (video){
      galeriaPrincipal.style.backgroundImage = 'none';
      galeriaPrincipal.innerHTML = `<video src="${video}" class="galeria-video" controls playsinline></video>`;
    } else {
      galeriaPrincipal.innerHTML = '';
      galeriaPrincipal.style.backgroundImage = `url('${thumb.getAttribute('data-foto')}')`;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => galeriaPrincipal.classList.remove('trocando')));
    galeriaThumbs.querySelectorAll('.galeria-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    fotoIndexAtual = [...galeriaThumbs.children].indexOf(thumb);
  }
  galeriaThumbs.querySelectorAll('.galeria-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => trocarFotoPrincipal(thumb));
    // No desktop, só passar o mouse já troca a foto (sem precisar clicar)
    thumb.addEventListener('mouseenter', () => trocarFotoPrincipal(thumb));
  });

  // Arrastar o dedo pro lado na foto principal troca de imagem (celular) —
  // só conta o gesto se for majoritariamente horizontal, senão o usuário
  // nem consegue rolar a página normalmente com o dedo em cima da foto.
  if (p.fotos.length > 1 || p.videoUrl){
    let toqueInicioX = 0, toqueInicioY = 0;
    galeriaPrincipal.addEventListener('touchstart', (e) => {
      toqueInicioX = e.touches[0].clientX;
      toqueInicioY = e.touches[0].clientY;
    }, { passive: true });
    galeriaPrincipal.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].clientX - toqueInicioX;
      const deltaY = e.changedTouches[0].clientY - toqueInicioY;
      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
      const thumbs = [...galeriaThumbs.querySelectorAll('.galeria-thumb')];
      if (!thumbs.length) return;
      const novoIndice = ((fotoIndexAtual + (deltaX < 0 ? 1 : -1)) % thumbs.length + thumbs.length) % thumbs.length;
      trocarFotoPrincipal(thumbs[novoIndice]);
      thumbs[novoIndice].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, { passive: true });
  }

  // Zoom ao passar o mouse na foto principal (só em telas com mouse de verdade)
  if (window.matchMedia('(hover: hover)').matches){
    galeriaPrincipal.addEventListener('mousemove', (e) => {
      const rect = galeriaPrincipal.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      galeriaPrincipal.style.backgroundSize = '200%';
      galeriaPrincipal.style.backgroundPosition = `${x}% ${y}%`;
    });
    galeriaPrincipal.addEventListener('mouseleave', () => {
      galeriaPrincipal.style.backgroundSize = '';
      galeriaPrincipal.style.backgroundPosition = '';
    });
  }

  document.getElementById('produtoCategoria').textContent = catInfo ? catInfo.nome : '';
  document.getElementById('produtoNome').textContent = p.nome;
  document.getElementById('produtoTags').innerHTML = `
    <span>${p.material}</span>${p.temPedra ? `<span>${p.pedra}</span>` : ''}${p.formato ? `<span>${p.formato}</span>` : ''}
  `;
  document.getElementById('produtoTextoFrete').textContent = p.freteGratisSempre
    ? 'Frete grátis nesta peça'
    : 'Frete grátis acima de R$399';

  // Sem estoque: mostra o selo e trava a compra (sem isso, dava pra comprar
  // peça esgotada normalmente)
  const esgotado = (p.estoque ?? 0) <= 0;
  document.getElementById('produtoEsgotado').style.display = esgotado ? 'inline-block' : 'none';
  if (esgotado){
    const btnAdd = document.getElementById('btnAddCarrinho');
    btnAdd.disabled = true;
    btnAdd.textContent = 'Esgotado';
    document.getElementById('btnComprarAgora').style.display = 'none';
    document.getElementById('qtdMenos').disabled = true;
    document.getElementById('qtdMais').disabled = true;
  }

  // Preço muda conforme o quilate escolhido (cada opção tem o próprio preço)
  let precoAtual = p.preco;
  const cupomDestaque = await autoAplicarCupomDestaque(); // já aplica sozinho pro carrinho/checkout baterem com o preço mostrado aqui
  // Preço de fábrica agora é permissão de conta (não é mais cupom) — tem
  // prioridade sobre o cupom de boas-vindas acima quando os dois existem.
  // combosFabrica guarda TODAS as combinações desse produto (cada tamanho/
  // cor pode ter um fator diferente) — resolvido de novo a cada troca de
  // quilate/banho, igual precoAtual, pra nunca aplicar o desconto errado.
  const combosFabrica = (await temPermissaoFabrica())
    ? (await obterPrecosFabrica())[p.id]
    : undefined;

  function atualizarPrecoExibido(){
    const precoEl = document.getElementById('produtoPreco');
    const cupomEl = document.getElementById('produtoPrecoCupom');

    // Pulso rápido toda vez que o preço muda (troca de quilate/banho) —
    // remove e força reflow antes de adicionar de novo, senão a animação
    // não reinicia numa segunda troca seguida (mesma classe já presente).
    precoEl.classList.remove('pulso-preco');
    void precoEl.offsetWidth;
    precoEl.classList.add('pulso-preco');

    const fatorFabrica = resolverFatorFabrica(combosFabrica, quilateSelecionado, banhoSelecionado);
    if (fatorFabrica !== undefined){
      const precoFabrica = precoAtual * fatorFabrica;
      precoEl.innerHTML = `${formatarPreco(precoFabrica)} <s class="preco-riscado">${formatarPreco(precoAtual)}</s>`;
      cupomEl.style.display = 'block';
      cupomEl.innerHTML = `🏭 Preço de fábrica ativado pra sua conta`;
      document.getElementById('produtoParcelas').textContent = `12x de ${formatarPreco(precoFabrica / 12)} sem juros`;
      return;
    }

    const precoComCupom = calcularPrecoComCupom(precoAtual, cupomDestaque);
    if (precoComCupom !== null){
      precoEl.innerHTML = `${formatarPreco(precoComCupom)} <s class="preco-riscado">${formatarPreco(precoAtual)}</s>`;
      cupomEl.style.display = 'block';
      cupomEl.innerHTML = `🎁 Preço com o cupom de boas-vindas <strong>${cupomDestaque.codigo}</strong> já aplicado`;
      document.getElementById('produtoParcelas').textContent = `12x de ${formatarPreco(precoComCupom / 12)} sem juros`;
    } else {
      precoEl.textContent = formatarPreco(precoAtual);
      cupomEl.style.display = 'none';
      document.getElementById('produtoParcelas').textContent = `12x de ${formatarPreco(precoAtual / 12)} sem juros`;
    }
  }
  atualizarPrecoExibido();

  const quilateWrap = document.getElementById('quilateWrap');
  if (p.quilates.length){
    quilateWrap.style.display = 'block';
    quilateWrap.querySelector('.tamanho-pills').innerHTML = p.quilates.map(q => `
      <button type="button" class="tamanho-pill" data-quilate="${q.valor}">${q.valor}</button>
    `).join('');
    quilateWrap.querySelectorAll('.tamanho-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        quilateWrap.querySelectorAll('.tamanho-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        quilateSelecionado = btn.getAttribute('data-quilate');
        // Recalcula combinando com o banho já escolhido (se tiver) — não
        // é o preço do quilate sozinho, senão o banho "apaga" ele de novo.
        precoAtual = resolverPrecoVariante(p, quilateSelecionado, banhoSelecionado);
        atualizarPrecoExibido();
      });
    });
  } else {
    quilateWrap.style.display = 'none';
  }

  // Banho com foto própria e preço próprio (cada cor pode custar diferente,
  // igual quilate) — só aparece se o admin cadastrou pelo menos uma opção;
  // trocar a cor também troca a foto principal, pra mostrar a peça de verdade
  // naquela cor.
  const banhoWrap = document.getElementById('banhoWrap');
  if (p.banhos.length){
    banhoWrap.style.display = 'block';
    document.getElementById('banhoSelecionadoNome').textContent = 'escolha abaixo';
    banhoWrap.querySelector('.banho-swatches').innerHTML = p.banhos.map(b => `
      <button type="button" class="banho-swatch" data-banho="${b.nome}" data-foto="${b.foto_url}" title="${b.nome}" style="background-image:url('${b.foto_url}')"></button>
    `).join('');
    banhoWrap.querySelectorAll('.banho-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        banhoWrap.querySelectorAll('.banho-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        banhoSelecionado = btn.getAttribute('data-banho');
        document.getElementById('banhoSelecionadoNome').textContent = banhoSelecionado;
        // Recalcula combinando com o quilate já escolhido (se tiver) — não
        // é o preço do banho sozinho, senão ele "apaga" o quilate escolhido.
        precoAtual = resolverPrecoVariante(p, quilateSelecionado, banhoSelecionado);
        atualizarPrecoExibido();
        galeriaPrincipal.innerHTML = '';
        galeriaPrincipal.style.backgroundImage = `url('${btn.getAttribute('data-foto')}')`;
      });
    });
  } else {
    banhoWrap.style.display = 'none';
  }

  const tamanhoWrap = document.getElementById('tamanhoWrap');
  if (p.tamanhos.length){
    tamanhoWrap.style.display = 'block';
    tamanhoWrap.querySelector('.tamanho-pills').innerHTML = [...p.tamanhos].sort((a, b) => parseFloat(a) - parseFloat(b)).map(t => `
      <button type="button" class="tamanho-pill" data-tamanho="${t}">${t}</button>
    `).join('');
    tamanhoWrap.querySelectorAll('.tamanho-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        tamanhoWrap.querySelectorAll('.tamanho-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tamanhoSelecionado = btn.getAttribute('data-tamanho');
      });
    });
  } else {
    tamanhoWrap.style.display = 'none';
  }

  const qtdDisplay = document.getElementById('qtdDisplay');
  document.getElementById('qtdMenos').addEventListener('click', () => { qtd = Math.max(1, qtd - 1); qtdDisplay.textContent = qtd; });
  document.getElementById('qtdMais').addEventListener('click', () => { qtd++; qtdDisplay.textContent = qtd; });

  // Confere se falta escolher alguma variante (quilate/banho/tamanho) antes
  // de adicionar ao carrinho OU comprar direto — os dois botões usam a
  // mesma checagem, só mudam o que fazem depois de validar.
  function faltaVarianteObrigatoria(){
    if (p.quilates.length && !quilateSelecionado){
      mostrarToast('Selecione o quilate da pedra antes de continuar');
      return true;
    }
    if (p.banhos.length && !banhoSelecionado){
      mostrarToast('Selecione o banho antes de continuar');
      return true;
    }
    if (p.tamanhos.length && !tamanhoSelecionado){
      mostrarToast('Selecione um tamanho antes de continuar');
      return true;
    }
    return false;
  }

  function itemAtualDoCarrinho(){
    return {
      id: p.id,
      nome: p.nome,
      preco: precoAtual,
      imagem: p.image,
      tamanho: tamanhoSelecionado || null,
      quilate: quilateSelecionado || null,
      banho: banhoSelecionado || null,
      qtd,
      freteGratisSempre: p.freteGratisSempre
    };
  }

  document.getElementById('btnAddCarrinho').addEventListener('click', (e) => {
    if (faltaVarianteObrigatoria()) return;
    e.target.classList.add('clicado');
    setTimeout(() => e.target.classList.remove('clicado'), 300);
    adicionarAoCarrinho(itemAtualDoCarrinho());
    mostrarSucessoBotaoAdd(e.target);
  });

  document.getElementById('btnComprarAgora').addEventListener('click', () => {
    if (faltaVarianteObrigatoria()) return;
    comprarAgora(itemAtualDoCarrinho());
  });

  // Favoritar (coração) — exige login; se já favoritado, mostra preenchido
  const btnFavoritar = document.getElementById('btnFavoritar');
  estaNosFavoritos(p.id).then(favoritado => {
    btnFavoritar.setAttribute('aria-pressed', favoritado);
  });
  btnFavoritar.addEventListener('click', async () => {
    const novoEstado = await alternarFavorito(p.id);
    if (novoEstado === null) return; // não estava logado — já mostrou o toast
    btnFavoritar.setAttribute('aria-pressed', novoEstado);
    mostrarToast(novoEstado ? 'Adicionado aos favoritos ♥' : 'Removido dos favoritos');
  });

  document.getElementById('btnCompartilharProduto').addEventListener('click', () => {
    compartilharProduto(p.nome, precoAtual, p.image);
  });

  const freteCepInput = document.getElementById('freteCep');
  const freteResultado = document.getElementById('freteResultado');
  freteCepInput.addEventListener('input', (e) => { e.target.value = formatarCep(e.target.value); });
  document.getElementById('btnCalcularFrete').addEventListener('click', async () => {
    const cep = freteCepInput.value.replace(/\D/g, '');
    if (cep.length !== 8){
      freteResultado.innerHTML = `<p class="frete-msg erro">Digite um CEP válido (8 dígitos).</p>`;
      return;
    }
    freteResultado.innerHTML = `<p class="frete-msg">Calculando...</p>`;
    try {
      const resultado = await calcularFrete(cep, precoAtual);
      if (resultado.error){
        freteResultado.innerHTML = `<p class="frete-msg erro">Não foi possível calcular o frete agora. Tente de novo em instantes.</p>`;
        return;
      }
      if (!resultado.opcoes || !resultado.opcoes.length){
        freteResultado.innerHTML = `<p class="frete-msg">Nenhuma transportadora disponível pra esse CEP.</p>`;
        return;
      }
      const gratis = carrinhoTemFreteGratis([{ preco: precoAtual, qtd: 1, freteGratisSempre: p.freteGratisSempre }]);
      freteResultado.innerHTML = resultado.opcoes.map(o => `
        <div class="frete-opcao">
          <div>
            <span class="transportadora">${o.transportadora}${o.servico ? ' — ' + o.servico : ''}</span>
            <span class="prazo">${o.prazoConfeccaoDias} dia${o.prazoConfeccaoDias == 1 ? '' : 's'} de confecção + ${o.prazoEntregaDiasMin} a ${o.prazoEntregaDias} dias úteis de entrega</span>
          </div>
          <span class="preco">${gratis ? seloFreteGratisHTML() : formatarPreco(o.preco)}</span>
        </div>
      `).join('')
        + (gratis ? `<div class="frete-gratis" style="margin-top:10px;">🎉 Essa peça tem frete grátis (compras acima de R$399)</div>` : '');
    } catch (err){
      freteResultado.innerHTML = `<p class="frete-msg erro">Não foi possível calcular o frete agora. Tente de novo em instantes.</p>`;
    }
  });

  document.getElementById('produtoDescricao').innerHTML = `<p>${p.descricao || 'Sem descrição cadastrada ainda.'}</p>`;
  const detalhes = [
    ["Material", p.material],
    p.temBanho ? ["Banho", p.banho] : null,
    p.temPedra ? ["Pedra central", p.pedra] : null,
    p.temPedra && p.quilate ? ["Quilate / tamanho da pedra", p.quilate] : null,
    p.temPedra && p.formato ? ["Formato da pedra", p.formato] : null,
    p.temPedra && p.cravacao ? ["Cravação", p.cravacao] : null,
    p.tamanhos.length ? ["Tamanhos disponíveis", p.tamanhos.join(", ")] : null
  ].filter(Boolean);
  document.getElementById('produtoDetalhes').innerHTML = `
    <table class="tabela-detalhes">
      ${detalhes.map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
    </table>
  `;

  // Blocos educativos sobre Moissanite + certificado + FAQ — só aparecem nas peças com essa pedra
  if (p.pedra === 'Moissanite'){
    document.getElementById('secaoMoissanite').style.display = 'block';
    // Foto fixa (não muda por produto) — troque o arquivo moissanite.jpg na
    // raiz do site pra atualizar a imagem em todas as páginas de produto.
    document.getElementById('faixaMoissaniteImg').style.backgroundImage = `url('moissanite.jpg')`;
    document.getElementById('faixaMoissaniteTexto').textContent =
      'Pedra criada em laboratório com brilho e dispersão de luz ainda mais intensos que os do diamante, e dureza que fica atrás apenas dele — resistente ao uso diário. Uma alternativa mais acessível, sem abrir mão de brilho ou durabilidade.';

    document.getElementById('secaoCertificado').style.display = 'block';

    document.getElementById('secaoFaqMoissanite').style.display = 'block';
    const perguntasMoissanite = [
      { p: "A moissanita brilha mais que o diamante?", r: "Em termos de fogo e dispersão de luz, sim — a moissanita costuma refratar mais luz colorida que o diamante, resultando num brilho mais intenso sob certas iluminações." },
      { p: "A moissanita escurece ou perde o brilho com o tempo?", r: "Não. É uma pedra quimicamente estável, que não muda de cor nem perde brilho com o uso normal. Cuidados básicos de limpeza mantêm o brilho original por muito tempo." },
      { p: "Posso usar a peça no dia a dia?", r: "Sim. A moissanita está entre as pedras mais duras que existem, atrás apenas do diamante — perfeita para uso diário sem se preocupar tanto com riscos." },
      { p: "Qual a diferença entre moissanita e zircônia?", r: "A moissanita é mais dura e mais brilhante, e não perde o brilho com o tempo. A zircônia tende a arranhar e opacar mais rápido com o uso." },
      { p: "A peça vem com certificado?", r: "Sim, toda peça com moissanita da Pavan & Co. acompanha certificado de avaliação da pedra, com informações de corte, cor e clareza." }
    ];
    document.getElementById('listaFaqMoissanite').innerHTML = perguntasMoissanite.map((item, i) => `
      <div class="faq-item" data-i="moissanite-${i}">
        <button type="button" class="faq-pergunta">
          ${item.p}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div class="faq-resposta"><p>${item.r}</p></div>
      </div>
    `).join('');
    document.querySelectorAll('#listaFaqMoissanite .faq-pergunta').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.faq-item').classList.toggle('open'));
    });
  }

  // Avaliações
  const avaliacoes = await carregarAvaliacoes(p.id);
  const media = avaliacoes.length ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length : 0;
  document.getElementById('produtoRatingResumo').innerHTML = avaliacoes.length
    ? `${estrelasHTML(media, 15)} <span class="rating-numero">${media.toFixed(1)}</span> <span class="rating-contagem">(${avaliacoes.length} avaliação${avaliacoes.length === 1 ? '' : 'ões'})</span>`
    : `<span class="rating-contagem">Ainda sem avaliações — seja a primeira pessoa a comprar e avaliar!</span>`;

  const listaAvaliacoesEl = document.getElementById('listaAvaliacoes');
  listaAvaliacoesEl.innerHTML = avaliacoes.length
    ? avaliacoes.map(a => `
        <div class="avaliacao-item">
          <div class="avaliacao-topo">
            ${estrelasHTML(a.nota, 14)}
            <span class="avaliacao-nome">${escaparHtml(a.nome_cliente)}</span>
            <span class="avaliacao-data">${formatarDataBR(a.data_avaliacao)}</span>
          </div>
          ${a.comentario ? `<p>${escaparHtml(a.comentario)}</p>` : ''}
          ${(a.fotos && a.fotos.length) ? `
            <div class="avaliacao-fotos">
              ${a.fotos.map(f => `<img src="${f}" alt="Foto enviada na avaliação">`).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')
    : `<p class="sem-resultados" style="padding:20px 0;">Nenhuma avaliação ainda.</p>`;

  document.getElementById('faqAvaliacoesTitulo').textContent = `Avaliações (${avaliacoes.length})`;
  // Botão "Escrever avaliação" foi removido — não fazia sentido aparecer
  // pra qualquer visitante, já que quem ainda não comprou não devia poder
  // avaliar a peça.

  // Prioriza a mesma categoria, mas completa com qualquer outro produto
  // ativo se faltar (catálogo pequeno/categoria com só essa peça não pode
  // deixar a seção vazia sem necessidade).
  const { data: mesmaCategoriaData } = await sb
    .from('produtos')
    .select(COLUNAS_PRODUTO_PUBLICO)
    .eq('categoria', p.categoria)
    .eq('ativo', true)
    .neq('id', p.id)
    .limit(4);
  let relacionadosData = mesmaCategoriaData || [];
  if (relacionadosData.length < 4){
    const idsJaListados = [p.id, ...relacionadosData.map(r => r.id)];
    const { data: outrosData } = await sb
      .from('produtos')
      .select(COLUNAS_PRODUTO_PUBLICO)
      .eq('ativo', true)
      .not('id', 'in', `(${idsJaListados.join(',')})`)
      .limit(4 - relacionadosData.length);
    relacionadosData = [...relacionadosData, ...(outrosData || [])];
  }
  const relacionados = relacionadosData.map(mapProduto);
  document.getElementById('relacionadosGrid').innerHTML = relacionados.length
    ? relacionados.map(cardProdutoHTML).join('')
    : `<p class="sem-resultados">Nenhum outro produto cadastrado ainda.</p>`;

  revelarNovosElementos();
  alinharTitulosDescricaoDetalhes();
  window.addEventListener('resize', alinharTitulosDescricaoDetalhes);
}

// Alinha o título "Detalhes técnicos" (coluna da imagem) com o título
// "Descrição" (coluna de compra) na mesma altura — como o conteúdo acima
// de cada um varia de produto pra produto (quilate/banho/tamanho mudam a
// altura da coluna de compra), calcula a diferença de verdade em vez de
// usar uma margem fixa. Só faz sentido nas 2 colunas lado a lado (900px+);
// no celular elas empilham, então volta pra margem simples.
function alinharTitulosDescricaoDetalhes(){
  const detalhesItem = document.getElementById('produtoDetalhes')?.closest('.faq-item');
  const descricaoItem = document.getElementById('produtoDescricao')?.closest('.faq-item');
  if (!detalhesItem || !descricaoItem) return;

  if (window.innerWidth < 900){
    detalhesItem.style.marginTop = '24px';
    return;
  }
  detalhesItem.style.marginTop = '24px';
  const diferenca = descricaoItem.getBoundingClientRect().top - detalhesItem.getBoundingClientRect().top;
  if (diferenca > 0) detalhesItem.style.marginTop = `${24 + diferenca}px`;
}

document.addEventListener('DOMContentLoaded', initHeaderShared);
