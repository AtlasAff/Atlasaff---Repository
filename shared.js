/* ============================================================
   Pavan & Co. — Script compartilhado
   Incluído em TODAS as páginas via <script src="shared.js">.
   Contém: menu de categorias, comportamento do header, catálogo
   de produtos (mock — trocar por Supabase depois), busca, toast
   de "adicionado ao carrinho" e o motor de filtro/ordenação das
   páginas de categoria.
   ============================================================ */

// Categorias do menu — usada no header, menu mobile e rodapé de TODAS as páginas.
const categorias = [
  { chave: "aliancas", nome: "Alianças", href: "categoria-aliancas.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="15" cy="20" r="10"/><circle cx="25" cy="20" r="10"/></svg>` },
  { chave: "aneis", nome: "Anéis", href: "categoria-aneis.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="20" cy="24" r="10"/><path d="M20 14 L16 6 L24 6 Z"/></svg>` },
  { chave: "brincos", nome: "Brincos", href: "categoria-brincos.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="20" cy="10" r="3"/><path d="M20 13 v8"/><path d="M14 21 a6 6 0 0 0 12 0"/></svg>` },
  { chave: "colares", nome: "Colares", href: "categoria-colares.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 8 q12 18 24 0"/><circle cx="20" cy="27" r="4"/></svg>` },
  { chave: "pulseiras", nome: "Pulseiras", href: "categoria-pulseiras.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="20" cy="20" rx="14" ry="8"/><circle cx="20" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>` },
  { chave: "joias", nome: "Joias", href: "categoria-joias.html", icon: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 15 L20 6 L30 15 L20 34 Z"/><path d="M10 15 H30 M15 15 L20 6 L25 15"/></svg>` }
];

/* ============================================================
   CATÁLOGO DE PRODUTOS (mock — estrutura pronta pra virar uma
   tabela "produtos" no Supabase: id, nome, categoria, preco,
   material, pedra, image)
   IMG: troque cada `image` pela foto real do produto (800x800,
   fundo neutro), quando tiver.
   ============================================================ */
const PRODUTOS_CATALOGO = [
  // ---- Alianças ----
  { id: "ali-01", nome: "Aliança Classic 4mm", categoria: "aliancas", preco: 3290, material: "Ouro 18k", pedra: "Sem pedra", image: "https://images.unsplash.com/photo-1602751584547-6d2c85a80f19?q=80&w=800&auto=format&fit=crop" },
  { id: "ali-02", nome: "Aliança Trabalhada Diamantada", categoria: "aliancas", preco: 2790, material: "Ouro Rosé", pedra: "Sem pedra", image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=800&auto=format&fit=crop" },
  { id: "ali-03", nome: "Aliança Prata Anatômica", categoria: "aliancas", preco: 890, material: "Prata 925", pedra: "Sem pedra", image: "https://images.unsplash.com/photo-1611085583191-a3b181a88401?q=80&w=800&auto=format&fit=crop" },
  { id: "ali-04", nome: "Aliança Cravejada 3mm", categoria: "aliancas", preco: 1980, material: "Ouro 18k", pedra: "Zircônia", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800&auto=format&fit=crop" },

  // ---- Anéis ----
  { id: "ane-01", nome: "Anel Solitário Aurora", categoria: "aneis", preco: 2480, material: "Ouro 18k", pedra: "Moissanite", image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=800&auto=format&fit=crop" },
  { id: "ane-02", nome: "Anel Trançado Clássico", categoria: "aneis", preco: 1980, material: "Ouro Rosé", pedra: "Moissanite", image: "https://images.unsplash.com/photo-1611085583191-a3b181a88401?q=80&w=800&auto=format&fit=crop" },
  { id: "ane-03", nome: "Anel Solitário Prata 925", categoria: "aneis", preco: 890, material: "Prata 925", pedra: "Zircônia", image: "https://images.unsplash.com/photo-1602751584547-6d2c85a80f19?q=80&w=800&auto=format&fit=crop" },
  { id: "ane-04", nome: "Anel Vintage Cravejado", categoria: "aneis", preco: 2150, material: "Ouro 18k", pedra: "Diamante", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800&auto=format&fit=crop" },
  { id: "ane-05", nome: "Anel Duo Ouro e Prata", categoria: "aneis", preco: 1340, material: "Ouro 18k", pedra: "Sem pedra", image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800&auto=format&fit=crop" },
  { id: "ane-06", nome: "Anel Meia Aliança", categoria: "aneis", preco: 1590, material: "Prata 925", pedra: "Moissanite", image: "https://images.unsplash.com/photo-1620656798579-1984d9e87df7?q=80&w=800&auto=format&fit=crop" },

  // ---- Brincos ----
  { id: "bri-01", nome: "Brinco Gota Cristal", categoria: "brincos", preco: 890, material: "Prata 925", pedra: "Zircônia", image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800&auto=format&fit=crop" },
  { id: "bri-02", nome: "Brinco Argola Trio", categoria: "brincos", preco: 690, material: "Ouro 18k", pedra: "Moissanite", image: "https://images.unsplash.com/photo-1620656798579-1984d9e87df7?q=80&w=800&auto=format&fit=crop" },
  { id: "bri-03", nome: "Brinco Ponto de Luz", categoria: "brincos", preco: 590, material: "Ouro Rosé", pedra: "Zircônia", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800&auto=format&fit=crop" },
  { id: "bri-04", nome: "Brinco Pérola Clássico", categoria: "brincos", preco: 740, material: "Prata 925", pedra: "Pérola", image: "https://images.unsplash.com/photo-1602751584547-6d2c85a80f19?q=80&w=800&auto=format&fit=crop" },

  // ---- Colares ----
  { id: "col-01", nome: "Colar Ponto de Luz", categoria: "colares", preco: 1190, material: "Ouro 18k", pedra: "Moissanite", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800&auto=format&fit=crop" },
  { id: "col-02", nome: "Colar Folhas Verdes", categoria: "colares", preco: 990, material: "Prata 925", pedra: "Zircônia", image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=800&auto=format&fit=crop" },
  { id: "col-03", nome: "Colar Corrente Fina", categoria: "colares", preco: 650, material: "Ouro Rosé", pedra: "Sem pedra", image: "https://images.unsplash.com/photo-1611085583191-a3b181a88401?q=80&w=800&auto=format&fit=crop" },
  { id: "col-04", nome: "Colar Pérola Pingente", categoria: "colares", preco: 1050, material: "Prata 925", pedra: "Pérola", image: "https://images.unsplash.com/photo-1620656798579-1984d9e87df7?q=80&w=800&auto=format&fit=crop" },

  // ---- Pulseiras ----
  { id: "pul-01", nome: "Pulseira Riviera", categoria: "pulseiras", preco: 1640, material: "Ouro 18k", pedra: "Zircônia", image: "https://images.unsplash.com/photo-1611085583191-a3b181a88401?q=80&w=800&auto=format&fit=crop" },
  { id: "pul-02", nome: "Pulseira Elos Clássica", categoria: "pulseiras", preco: 780, material: "Prata 925", pedra: "Sem pedra", image: "https://images.unsplash.com/photo-1602751584547-6d2c85a80f19?q=80&w=800&auto=format&fit=crop" },
  { id: "pul-03", nome: "Pulseira Tênis Cravejada", categoria: "pulseiras", preco: 2290, material: "Ouro Rosé", pedra: "Moissanite", image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800&auto=format&fit=crop" },

  // ---- Joias (geral) ----
  { id: "joi-01", nome: "Conjunto Cerimônia", categoria: "joias", preco: 3480, material: "Ouro 18k", pedra: "Diamante", image: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=800&auto=format&fit=crop" },
  { id: "joi-02", nome: "Broche Vintage", categoria: "joias", preco: 990, material: "Prata 925", pedra: "Zircônia", image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800&auto=format&fit=crop" },
  { id: "joi-03", nome: "Pingente Solitário Avulso", categoria: "joias", preco: 720, material: "Ouro Rosé", pedra: "Moissanite", image: "https://images.unsplash.com/photo-1620656798579-1984d9e87df7?q=80&w=800&auto=format&fit=crop" }
];

function formatarPreco(valor){
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  // Busca (ícone de lupa) — abre/fecha a barra de busca no topo
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
   (visual apenas: sem backend ainda, o carrinho de verdade
   precisa do Supabase pra persistir entre páginas)
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
      <div class="prod-img" style="background-image:url('${p.image}')"></div>
      <div class="prod-tags">
        <span>${p.material}</span>
        ${p.pedra !== "Sem pedra" ? `<span>${p.pedra}</span>` : ``}
      </div>
      <div class="prod-name">${p.nome}</div>
      <div class="prod-price">${formatarPreco(p.preco)}</div>
      <button type="button" class="btn btn-outline btn-add" onclick="adicionarAoCarrinho('${p.nome.replace(/'/g, "\\'")}')">Adicionar ao carrinho</button>
    </div>
  `;
}

/* ============================================================
   MOTOR DE PÁGINA DE CATEGORIA
   Chamado por cada categoria-*.html: renderCategoryPage('aneis','Anéis')
   Cuida de: montar produtos da categoria, montar filtros (material/pedra)
   a partir do que existe nela, aplicar filtro, ordenar e re-renderizar.
   ============================================================ */
function renderCategoryPage(categoriaChave, tituloExibido){
  const todos = PRODUTOS_CATALOGO.filter(p => p.categoria === categoriaChave);

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
    const grid = document.getElementById('prodGrid');
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
function renderBuscaPage(){
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

  const termoLower = termo.toLowerCase();
  const resultados = PRODUTOS_CATALOGO.filter(p =>
    p.nome.toLowerCase().includes(termoLower) ||
    p.material.toLowerCase().includes(termoLower) ||
    p.pedra.toLowerCase().includes(termoLower) ||
    p.categoria.toLowerCase().includes(termoLower)
  );

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

document.addEventListener('DOMContentLoaded', initHeaderShared);
