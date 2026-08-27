/* ============================================================
   Pavan & Co. — Script compartilhado
   Incluído em TODAS as páginas via <script src="shared.js">.
   A partir de agora, os produtos vêm DE VERDADE do Supabase
   (tabela "produtos" + bucket de Storage "produtos") em vez de
   um catálogo mockado. Todas as páginas do site (home, categoria,
   busca, produto) e o admin.html leem/gravam neste mesmo banco —
   então um produto cadastrado no admin já aparece na loja pública.
   ============================================================ */

const SUPABASE_URL = "https://pqhdtteeukfcjstfsnkn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxaGR0dGVldWtmY2pzdGZzbmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzc0MTAsImV4cCI6MjEwMTk1MzQxMH0.VwOKgaNEmKaT-xGqF-S0Cr2mY9i4O_4eIFkqpdv0KiY";

// "sb" é o nosso cliente Supabase — usado em toda consulta/gravação do site.
// (chamamos de "sb" e não "supabase" pra não bater com o nome global da biblioteca)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Categorias do menu — usada no header, menu mobile e rodapé de TODAS as páginas.
const categorias = [
  { chave: "aliancas", nome: "Alianças", href: "categoria-aliancas.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="15" cy="20" r="10"/><circle cx="25" cy="20" r="10"/></svg>` },
  { chave: "aneis", nome: "Anéis", href: "categoria-aneis.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="20" cy="24" r="10"/><path d="M20 14 L16 6 L24 6 Z"/></svg>` },
  { chave: "brincos", nome: "Brincos", href: "categoria-brincos.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="20" cy="10" r="3"/><path d="M20 13 v8"/><path d="M14 21 a6 6 0 0 0 12 0"/></svg>` },
  { chave: "colares", nome: "Colares", href: "categoria-colares.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 8 q12 18 24 0"/><circle cx="20" cy="27" r="4"/></svg>` },
  { chave: "pulseiras", nome: "Pulseiras", href: "categoria-pulseiras.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="20" cy="20" rx="14" ry="8"/><circle cx="20" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>` },
  { chave: "joias", nome: "Joias", href: "categoria-joias.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 15 L20 6 L30 15 L20 34 Z"/><path d="M10 15 H30 M15 15 L20 6 L25 15"/></svg>` }
];

function formatarPreco(valor){
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ============================================================
   MAPEAMENTO DB → FRONT-END
   A tabela `produtos` usa nomes de coluna "completos" (material_aro,
   pedra_central, tamanhos_disponiveis...). Aqui a gente converte
   cada linha do banco pro formato mais curto que o site já usa
   (material, pedra, tamanhos...), assim o resto do código não
   precisa mudar toda hora que mexemos no banco.
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

/* ============================================================
   CONSULTAS AO SUPABASE (usadas pela loja pública)
   ============================================================ */
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
   HEADER / MENU / RODAPÉ — comum a todas as páginas
   ============================================================ */
function initHeaderShared(){
  const navList = document.getElementById('navList');
  const mobileNavList = document.getElementById('mobileNavList');
  const footerCatList = document.getElementById('footerCatList');

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
}

/* ============================================================
   TOAST — aviso rápido de "adicionado ao carrinho"
   (o carrinho em si ainda é visual — ver observação em carrinho.html)
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
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function adicionarAoCarrinho(nomeProduto){
  mostrarToast(`"${nomeProduto}" adicionado ao carrinho ✓`);
}

/* ============================================================
   CARD DE PRODUTO — usado em todas as listagens (home, categoria, busca)
   ============================================================ */
function cardProdutoHTML(p){
  return `
    <div class="prod-card">
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

/* ============================================================
   MOTOR DE PÁGINA DE CATEGORIA
   Chamado por cada categoria-*.html: renderCategoryPage('aneis','Anéis')
   Busca os produtos da categoria NO SUPABASE, monta os filtros
   (material/pedra) a partir do que veio, aplica filtro e ordena
   tudo no navegador (o catálogo é pequeno, não precisa ir ao
   banco de novo a cada filtro).
   ============================================================ */
async function renderCategoryPage(categoriaChave, tituloExibido){
  const grid = document.getElementById('prodGrid');
  grid.innerHTML = `<p class="sem-resultados">Carregando produtos...</p>`;

  const todos = await carregarProdutosPorCategoria(categoriaChave);

  const materiaisDisponiveis = [...new Set(todos.map(p => p.material))];
  const pedrasDisponiveis = [...new Set(todos.map(p => p.pedra))];

  let filtroMateriais = new Set();
  let filtroPedras = new Set();
  let ordenacaoAtual = "relevancia";

  const painel = document.getElementById('painelFiltros');
  if (painel){
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
  }

  function produtosFiltrados(){
    return todos.filter(p => {
      const passaMaterial = filtroMateriais.size === 0 || filtroMateriais.has(p.material);
      const passaPedra = filtroPedras.size === 0 || filtroPedras.has(p.pedra);
      return passaMaterial && passaPedra;
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
        else filtroPedras.delete(valor);
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
  }

  const filtrosBtn = document.getElementById('filtrosBtn');
  if (filtrosBtn && painel){
    filtrosBtn.addEventListener('click', () => painel.classList.toggle('open'));
  }

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
      renderizarTudo();
    }
  });

  const ordenarBtn = document.getElementById('ordenarBtn');
  const ordenarMenu = document.getElementById('ordenarMenu');
  if (ordenarBtn && ordenarMenu){
    ordenarBtn.addEventListener('click', () => ordenarMenu.classList.toggle('open'));
    ordenarMenu.querySelectorAll('button').forEach(opt => {
      opt.addEventListener('click', () => {
        ordenacaoAtual = opt.getAttribute('data-valor');
        ordenarBtn.querySelector('.ordenar-label').textContent = opt.textContent;
        ordenarMenu.classList.remove('open');
        renderizarTudo();
      });
    });
  }

  renderizarTudo();
}

/* ============================================================
   BUSCA — usado em busca.html
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

  grid.innerHTML = `<p class="sem-resultados">Buscando...</p>`;

  // Busca no Supabase por nome, material ou pedra (case-insensitive)
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
   PÁGINA DE PRODUTO — usado em produto.html
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

  const catInfo = categorias.find(c => c.chave === p.categoria);
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
    <span>${p.material}</span>${p.temPedra ? `<span>${p.pedra}</span>` : ''}
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

  document.getElementById('btnAddCarrinho').addEventListener('click', () => {
    if (p.tamanhos.length && !tamanhoSelecionado){
      mostrarToast('Selecione um tamanho antes de continuar');
      return;
    }
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
}

document.addEventListener('DOMContentLoaded', initHeaderShared);
