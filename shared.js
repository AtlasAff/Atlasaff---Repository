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

  const { error } = await sb.from('newsletter_assinantes').insert({ email });

  botao.disabled = false;
  botao.textContent = textoOriginal;

  if (error){
    if (error.code === '23505'){ // e-mail duplicado (unique constraint)
      mostrarToast('Esse e-mail já tá cadastrado ✓');
    } else {
      mostrarToast('Não foi possível assinar agora — tenta de novo.');
    }
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
   DESTAQUE PRINCIPAL (banner do topo da home) — editável no admin
   ============================================================ */
async function carregarHomeHero(){
  const { data, error } = await sb.from('home_hero').select('*').limit(1).maybeSingle();
  if (error || !data){ console.error('Erro ao carregar destaque principal:', error); return null; }
  return data;
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
const COLUNAS_PRODUTO_PUBLICO = 'id, nome, categoria, descricao, material_aro, pedra_central, banho, banhos_disponiveis, quilate_pedra, quilates_disponiveis, pedra_lateral, formato_pedra, cravacao, grau_cor, grau_clareza, grau_corte, largura_mm, tamanhos_disponiveis, preco, estoque, fotos, destaque, ativo, criado_em';

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
    destaque: !!row.destaque,
    ativo: row.ativo !== false
  };
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

  ativarRevealAoRolar();
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
   CARRINHO PERSISTENTE (localStorage) + gaveta lateral
   Ao adicionar um item, abre deslizando pela direita (estilo
   Versale), sem sair da página. Funciona em TODAS as páginas
   porque é montado aqui no shared.js.
   ============================================================ */
const CARRINHO_STORAGE_KEY = 'pavan_carrinho';
const FRETE_GRATIS_MINIMO = 399;

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
      qtd: produto.qtd || 1
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

  // Barra de frete grátis — mesma regra usada no resto do site (acima de R$399)
  const freteEl = document.getElementById('cartDrawerFrete');
  if (itens.length === 0){
    freteEl.innerHTML = '';
  } else if (subtotal >= FRETE_GRATIS_MINIMO){
    freteEl.innerHTML = `<div class="cart-drawer-frete-msg ganhou">🎉 Parabéns! Você ganhou <strong>frete grátis</strong></div>`;
  } else {
    const falta = FRETE_GRATIS_MINIMO - subtotal;
    const pct = Math.min(100, (subtotal / FRETE_GRATIS_MINIMO) * 100);
    freteEl.innerHTML = `
      <div class="cart-drawer-frete-msg">Faltam <strong>${formatarPreco(falta)}</strong> pra ganhar frete grátis</div>
      <div class="cart-drawer-frete-barra"><div class="cart-drawer-frete-progresso" style="width:${pct}%"></div></div>
    `;
  }

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
  const produto = {
    id: btn.dataset.id,
    nome: btn.dataset.nome,
    preco: parseFloat(btn.dataset.preco),
    imagem: btn.dataset.imagem
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
      <button type="button" class="tamanho-pill" data-quilate="${q.valor}" data-preco="${q.preco}">${q.valor} — ${formatarPreco(q.preco)}</button>
    `).join('');
    document.querySelectorAll('#varianteModalQuilatePills .tamanho-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#varianteModalQuilatePills .tamanho-pill').forEach(b => b.classList.remove('active'));
        pill.classList.add('active');
        produtoAguardandoVariante.quilate = pill.getAttribute('data-quilate');
        produtoAguardandoVariante.preco = parseFloat(pill.getAttribute('data-preco'));
        verificarCompleto();
      });
    });
  }

  const banhoSecao = document.getElementById('varianteModalBanhoSecao');
  banhoSecao.style.display = banhos.length ? 'block' : 'none';
  if (banhos.length){
    document.getElementById('varianteModalBanhoSwatches').innerHTML = banhos.map(b => `
      <button type="button" class="banho-swatch" data-banho="${b.nome}" data-preco="${b.preco}" title="${b.nome}" style="background-image:url('${b.foto_url}')"></button>
    `).join('');
    document.querySelectorAll('#varianteModalBanhoSwatches .banho-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('#varianteModalBanhoSwatches .banho-swatch').forEach(b => b.classList.remove('active'));
        swatch.classList.add('active');
        produtoAguardandoVariante.banho = swatch.getAttribute('data-banho');
        produtoAguardandoVariante.preco = parseFloat(swatch.getAttribute('data-preco'));
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
  return `
    <div class="prod-card reveal ${esgotado ? 'esgotado' : ''}">
      ${esgotado ? '<span class="badge-esgotado-card">Esgotado</span>' : ''}
      <a href="produto.html?id=${p.id}" class="prod-card-link" aria-label="Ver ${p.nome}">
        <div class="prod-img" style="background-image:url('${p.image}')"></div>
        <div class="prod-name">${p.nome}</div>
        <div class="prod-info-box">
          <div class="prod-info-cell">
            <span class="prod-price">${formatarPreco(p.preco)}</span>
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
      <button type="button" class="formato-pill" data-formato="${f}">
        <span class="formato-icone">${fotoFormatoHTML(f)}</span>
        <span>${f}</span>
      </button>
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
    grid.innerHTML = lista.length
      ? lista.map(cardProdutoHTML).join('')
      : `<p class="sem-resultados">Nenhum produto encontrado com esses filtros.</p>`;
    document.getElementById('resultCount').textContent = `${lista.length} produto${lista.length === 1 ? '' : 's'}`;
    renderChips();
    revelarNovosElementos();
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
  grid.innerHTML = resultados.length
    ? resultados.map(cardProdutoHTML).join('')
    : `<p class="sem-resultados">Nenhum produto encontrado para "${termo}". Tente outro termo.</p>`;
  revelarNovosElementos();
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
  grid.innerHTML = produtos.length
    ? produtos.map(cardProdutoHTML).join('')
    : `<p class="sem-resultados">Nenhum produto nessa coleção ainda — volte em breve.</p>`;
  revelarNovosElementos();
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

  const galeriaPrincipal = document.getElementById('galeriaPrincipal');
  const galeriaThumbs = document.getElementById('galeriaThumbs');
  galeriaPrincipal.style.backgroundImage = `url('${p.fotos[0]}')`;
  galeriaThumbs.innerHTML = p.fotos.map((foto, i) => `
    <button type="button" class="galeria-thumb ${i === 0 ? 'active' : ''}" style="background-image:url('${foto}')" data-foto="${foto}" aria-label="Ver foto ${i + 1}"></button>
  `).join('');
  function trocarFotoPrincipal(thumb){
    galeriaPrincipal.style.backgroundImage = `url('${thumb.getAttribute('data-foto')}')`;
    galeriaThumbs.querySelectorAll('.galeria-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
  }
  galeriaThumbs.querySelectorAll('.galeria-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => trocarFotoPrincipal(thumb));
    // No desktop, só passar o mouse já troca a foto (sem precisar clicar)
    thumb.addEventListener('mouseenter', () => trocarFotoPrincipal(thumb));
  });

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

  // Sem estoque: mostra o selo e trava a compra (sem isso, dava pra comprar
  // peça esgotada normalmente)
  const esgotado = (p.estoque ?? 0) <= 0;
  document.getElementById('produtoEsgotado').style.display = esgotado ? 'inline-block' : 'none';
  if (esgotado){
    const btnAdd = document.getElementById('btnAddCarrinho');
    btnAdd.disabled = true;
    btnAdd.textContent = 'Esgotado';
    document.getElementById('qtdMenos').disabled = true;
    document.getElementById('qtdMais').disabled = true;
  }

  // Preço muda conforme o quilate escolhido (cada opção tem o próprio preço)
  let precoAtual = p.preco;
  function atualizarPrecoExibido(){
    document.getElementById('produtoPreco').textContent = formatarPreco(precoAtual);
    document.getElementById('produtoParcelas').textContent = `12x de ${formatarPreco(precoAtual / 12)} sem juros`;
  }
  atualizarPrecoExibido();

  const quilateWrap = document.getElementById('quilateWrap');
  if (p.quilates.length){
    quilateWrap.style.display = 'block';
    quilateWrap.querySelector('.tamanho-pills').innerHTML = p.quilates.map(q => `
      <button type="button" class="tamanho-pill" data-quilate="${q.valor}" data-preco="${q.preco}">${q.valor}</button>
    `).join('');
    quilateWrap.querySelectorAll('.tamanho-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        quilateWrap.querySelectorAll('.tamanho-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        quilateSelecionado = btn.getAttribute('data-quilate');
        precoAtual = parseFloat(btn.getAttribute('data-preco'));
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
      <button type="button" class="banho-swatch" data-banho="${b.nome}" data-preco="${b.preco}" data-foto="${b.foto_url}" title="${b.nome}" style="background-image:url('${b.foto_url}')"></button>
    `).join('');
    banhoWrap.querySelectorAll('.banho-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        banhoWrap.querySelectorAll('.banho-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        banhoSelecionado = btn.getAttribute('data-banho');
        document.getElementById('banhoSelecionadoNome').textContent = banhoSelecionado;
        precoAtual = parseFloat(btn.getAttribute('data-preco'));
        atualizarPrecoExibido();
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

  document.getElementById('btnAddCarrinho').addEventListener('click', (e) => {
    if (p.quilates.length && !quilateSelecionado){
      mostrarToast('Selecione o quilate da pedra antes de continuar');
      return;
    }
    if (p.banhos.length && !banhoSelecionado){
      mostrarToast('Selecione o banho antes de continuar');
      return;
    }
    if (p.tamanhos.length && !tamanhoSelecionado){
      mostrarToast('Selecione um tamanho antes de continuar');
      return;
    }
    e.target.classList.add('clicado');
    setTimeout(() => e.target.classList.remove('clicado'), 300);
    adicionarAoCarrinho({
      id: p.id,
      nome: p.nome,
      preco: precoAtual,
      imagem: p.image,
      tamanho: tamanhoSelecionado || null,
      quilate: quilateSelecionado || null,
      banho: banhoSelecionado || null,
      qtd
    });
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
      const gratis = precoAtual >= 399;
      freteResultado.innerHTML = resultado.opcoes.map(o => `
        <div class="frete-opcao">
          <div>
            <span class="transportadora">${o.transportadora}${o.servico ? ' — ' + o.servico : ''}</span>
            <span class="prazo">${o.prazoConfeccaoDias} dia${o.prazoConfeccaoDias == 1 ? '' : 's'} de confecção + ${o.prazoEntregaDiasMin} a ${o.prazoEntregaDias} dias úteis de entrega</span>
          </div>
          <span class="preco">${gratis ? 'Grátis' : formatarPreco(o.preco)}</span>
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
            <span class="avaliacao-nome">${a.nome_cliente}</span>
            <span class="avaliacao-data">${formatarDataBR(a.data_avaliacao)}</span>
          </div>
          ${a.comentario ? `<p>${a.comentario}</p>` : ''}
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
