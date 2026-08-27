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

/* Ícones de FORMATO DA PEDRA — estilo Versale (escolha por formato) */
const ICONES_FORMATO = {
  "Redondo": `<svg viewBox="0 0 40 40" fill="currentColor"><circle cx="20" cy="20" r="14"/></svg>`,
  "Oval": `<svg viewBox="0 0 40 40" fill="currentColor"><ellipse cx="20" cy="20" rx="11" ry="15"/></svg>`,
  "Princesa": `<svg viewBox="0 0 40 40" fill="currentColor"><rect x="8" y="8" width="24" height="24"/></svg>`,
  "Coração": `<svg viewBox="0 0 40 40" fill="currentColor"><path d="M20 33 C6 24 5 14 12 10 C16 8 19 10 20 13 C21 10 24 8 28 10 C35 14 34 24 20 33 Z"/></svg>`,
  "Marquise": `<svg viewBox="0 0 40 40" fill="currentColor"><path d="M20 5 C30 12 30 28 20 35 C10 28 10 12 20 5 Z"/></svg>`,
  "Esmeralda": `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="22" height="22"/></svg>`
};

function formatarPreco(valor){
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    icon: ICONES_CATEGORIA[c.icone] || ICONES_CATEGORIA.padrao
  }));
  return categoriasCache;
}

/* ============================================================
   MAPEAMENTO DB → FRONT-END
   ============================================================ */
function mapProduto(row){
  const pedra = row.pedra_central || "Sem pedra";
  return {
    id: row.id,
    nome: row.nome,
    categoria: row.categoria,
    descricao: row.descricao || "",
    material: row.material_aro || "",
    pedra: pedra,
    temPedra: pedra !== "Sem pedra",
    quilate: row.quilate_pedra || "",
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
  const { data, error } = await sb.from('produtos').select('*').eq('categoria', categoriaChave).eq('ativo', true);
  if (error){ console.error('Erro ao carregar produtos:', error); return []; }
  return data.map(mapProduto);
}

async function carregarProdutosDestaque(limite = 5){
  const { data, error } = await sb.from('produtos').select('*').eq('destaque', true).eq('ativo', true).limit(limite);
  if (error){ console.error('Erro ao carregar destaques:', error); return []; }
  return data.map(mapProduto);
}

async function carregarTodosProdutosAtivos(){
  const { data, error } = await sb.from('produtos').select('*').eq('ativo', true);
  if (error){ console.error('Erro ao carregar produtos:', error); return []; }
  return data.map(mapProduto);
}

async function carregarProdutoPorId(id){
  const { data, error } = await sb.from('produtos').select('*').eq('id', id).maybeSingle();
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

function adicionarAoCarrinho(nomeProduto){
  mostrarToast(`"${nomeProduto}" adicionado ao carrinho ✓`);
  pulsarCarrinho();
}

/* ============================================================
   CARD DE PRODUTO
   ============================================================ */
function cardProdutoHTML(p){
  return `
    <div class="prod-card reveal">
      <a href="produto.html?id=${p.id}" class="prod-img" style="background-image:url('${p.image}')" aria-label="Ver ${p.nome}"></a>
      <div class="prod-tags">
        <span>${p.material}</span>
        ${p.temPedra ? `<span>${p.pedra}</span>` : ``}
      </div>
      <a href="produto.html?id=${p.id}" class="prod-name-link"><div class="prod-name">${p.nome}</div></a>
      <div class="prod-price">${formatarPreco(p.preco)}</div>
      <button type="button" class="btn btn-outline btn-add" onclick="adicionarAoCarrinho('${p.nome.replace(/'/g, "\\'")}')">Adicionar ao carrinho</button>
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
        <span class="formato-icone">${ICONES_FORMATO[f] || ICONES_FORMATO['Redondo']}</span>
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
    .select('*')
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
  galeriaThumbs.querySelectorAll('.galeria-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      galeriaPrincipal.style.backgroundImage = `url('${thumb.getAttribute('data-foto')}')`;
      galeriaThumbs.querySelectorAll('.galeria-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  document.getElementById('produtoCategoria').textContent = catInfo ? catInfo.nome : '';
  document.getElementById('produtoNome').textContent = p.nome;
  document.getElementById('produtoPreco').textContent = formatarPreco(p.preco);
  document.getElementById('produtoParcelas').textContent = `12x de ${formatarPreco(p.preco / 12)} sem juros`;
  document.getElementById('produtoTags').innerHTML = `
    <span>${p.material}</span>${p.temPedra ? `<span>${p.pedra}</span>` : ''}${p.formato ? `<span>${p.formato}</span>` : ''}
  `;

  const tamanhoWrap = document.getElementById('tamanhoWrap');
  if (p.tamanhos.length){
    tamanhoWrap.style.display = 'block';
    tamanhoWrap.querySelector('.tamanho-pills').innerHTML = p.tamanhos.map(t => `
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
    if (p.tamanhos.length && !tamanhoSelecionado){
      mostrarToast('Selecione um tamanho antes de continuar');
      return;
    }
    e.target.classList.add('clicado');
    setTimeout(() => e.target.classList.remove('clicado'), 300);
    adicionarAoCarrinho(`${p.nome}${tamanhoSelecionado ? ' (aro ' + tamanhoSelecionado + ')' : ''} x${qtd}`);
  });

  document.getElementById('produtoDescricao').innerHTML = `<p>${p.descricao || 'Sem descrição cadastrada ainda.'}</p>`;
  const detalhes = [
    ["Material", p.material],
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
  document.getElementById('btnEscreverAvaliacao').addEventListener('click', () => {
    mostrarToast('Em breve — quando lançarmos contas de cliente, você poderá avaliar por aqui.');
  });

  const { data: relacionadosData } = await sb
    .from('produtos')
    .select('*')
    .eq('categoria', p.categoria)
    .eq('ativo', true)
    .neq('id', p.id)
    .limit(4);
  const relacionados = (relacionadosData || []).map(mapProduto);
  document.getElementById('relacionadosGrid').innerHTML = relacionados.length
    ? relacionados.map(cardProdutoHTML).join('')
    : `<p class="sem-resultados">Nenhum outro produto nessa categoria ainda.</p>`;

  revelarNovosElementos();
}

document.addEventListener('DOMContentLoaded', initHeaderShared);
