/* Shell do app: login, menu lateral e roteamento */
const SESSION_KEY = 'rbtech_session';

const NAV = [
  ['Gestão Operacional', [
    ['dashboard', 'Dashboard', 'dash'],
    ['bancada', 'Bancada', 'phone'],
    ['os', 'Ordens de Serviço', 'file'],
    ['orcamentos', 'Orçamentos', 'card'],
  ]],
  ['Clientes & Vendas', [
    ['clientes', 'Clientes', 'users'],
    ['pecas', 'Peças', 'box'],
    ['vendas', 'Venda de Produtos', 'bag'],
    ['aparelhos', 'Aparelhos', 'devices'],
    ['posvenda', 'Pós-Venda', 'chat'],
  ]],
  ['Administrativo', [
    ['servicos', 'Serviços', 'wrench'],
    ['financeiro', 'Financeiro', 'chart'],
    ['caixa', 'Caixa', 'bank'],
    ['relatorios', 'Relatórios', 'report'],
    ['config', 'Configurações', 'settings'],
  ]],
];

const App = {
  route: 'dashboard',
  params: {},

  start() {
    addEventListener('hashchange', () => this.render());
    this.render();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  },

  logged() { return Store.db.auth && localStorage.getItem(SESSION_KEY) === Store.db.auth.email; },

  go(route, params) {
    const q = params ? '?' + new URLSearchParams(params) : '';
    if (location.hash === `#/${route}${q}`) this.render(); else location.hash = `#/${route}${q}`;
  },

  parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [r, q] = h.split('?');
    this.route = r || 'dashboard';
    this.params = Object.fromEntries(new URLSearchParams(q || ''));
  },

  render() {
    closeAllModals(); closeDropdown();
    if (!this.logged()) return this.renderLogin();
    this.parseHash();
    if (!Pages[this.route]) this.route = 'dashboard';
    if (!$('.shell')) this.renderShell();
    this.updateNav();
    this.closeMenu();
    const main = $('#main');
    main.innerHTML = '';
    Pages[this.route].render(main, this.params);
    scrollTo(0, 0);
  },

  refresh() { const y = scrollY; const main = $('#main'); Pages[this.route].render(main, this.params); this.updateNav(); scrollTo(0, y); },

  renderShell() {
    const s = Store.s;
    $('#app').innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-head">
          <img src="assets/icon-192.png" alt="RB Tech">
          <div><div class="t">RB <span class="gold">Tech</span></div><span class="badge-gold">CELULARES</span></div>
        </div>
        <nav class="nav" id="nav">
          ${NAV.map(([g, items]) => `<div class="nav-title">${g}</div>` + items.map(([r, l, ic]) => `<a href="#/${r}" data-r="${r}">${icon(ic)}<span>${l}</span><span class="count hidden"></span></a>`).join('')).join('')}
        </nav>
        <div class="sidebar-foot">
          <div class="avatar">${esc((s.responsavel || s.loja || 'R')[0].toUpperCase())}</div>
          <div class="grow"><div class="bold ellipsis">${esc(s.loja)}</div><div class="xs muted ellipsis">${esc(Store.db.auth.email)}</div></div>
          <button class="icon-btn" title="Sair" onclick="App.logout()">${icon('logout')}</button>
        </div>
      </aside>
      <div class="sidebar-backdrop hidden" id="sb-backdrop" onclick="App.closeMenu()"></div>
      <div class="shell">
        <header class="topbar">
          <button class="icon-btn menu-btn" onclick="App.openMenu()" aria-label="Menu">${icon('menu')}</button>
          <a class="brand" href="#/dashboard"><img src="assets/icon-192.png" alt=""><span>RB <span class="gold">Tech</span></span></a>
          <div class="spacer"></div>
          <button class="icon-btn" title="Nova OS" onclick="OSPage.novaOS()">${icon('plus')}</button>
          <a class="avatar" href="#/config" title="Configurações">${esc((s.responsavel || s.loja || 'R')[0].toUpperCase())}</a>
        </header>
        <main class="main" id="main"></main>
      </div>`;
  },

  updateNav() {
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.r === this.route));
    const counts = {
      bancada: Store.db.os.filter(o => !o.deleted && OS_ATIVOS.includes(o.status)).length,
      orcamentos: Store.db.orcamentos.filter(o => !o.deleted && o.status === 'pendente').length,
      pecas: Store.db.pecas.filter(p => !p.deleted && p.qtd <= (p.minimo || 0)).length,
    };
    for (const [r, n] of Object.entries(counts)) {
      const el = $(`#nav a[data-r="${r}"] .count`);
      if (el) { el.textContent = n; el.classList.toggle('hidden', !n); }
    }
  },

  openMenu() { $('#sidebar').classList.add('open'); $('#sb-backdrop').classList.remove('hidden'); },
  closeMenu() { $('#sidebar')?.classList.remove('open'); $('#sb-backdrop')?.classList.add('hidden'); },

  logout() { localStorage.removeItem(SESSION_KEY); location.hash = ''; this.render(); },

  renderLogin() {
    const first = !Store.db.auth;
    $('#app').innerHTML = `
      <div class="login">
        <form class="login-box" id="login-form" autocomplete="on">
          <img class="login-logo" src="assets/logo.jpg" alt="RB Tech Celulares">
          <h1>${first ? 'Criar <span class="gold">acesso</span>' : 'Bem-vindo de <span class="gold">volta</span>'}</h1>
          <p class="muted" style="margin:0 0 24px">${first ? 'Primeiro acesso: defina o e-mail e a senha do painel.' : 'Acesse sua conta para gerenciar sua assistência.'}</p>
          ${field('E-mail', inputIcon('mail', `name="email" type="email" required placeholder="seu@email.com" autocomplete="username" value="${esc(Store.db.auth?.email || '')}"`))}
          ${field('Senha', `<div class="input-icon">${icon('lock')}<input class="input" name="senha" type="password" required minlength="4" placeholder="••••••••" autocomplete="${first ? 'new-password' : 'current-password'}"><button type="button" class="icon-btn" style="position:absolute;right:4px;top:3px" onclick="const i=this.previousElementSibling;i.type=i.type==='password'?'text':'password'">${icon('eye')}</button></div>`)}
          ${first ? field('Confirmar senha', inputIcon('lock', 'name="senha2" type="password" required minlength="4" placeholder="••••••••" autocomplete="new-password"')) : ''}
          <button class="btn primary block" style="margin-top:8px;min-height:54px;font-size:17px">${first ? 'Criar e acessar' : 'Acessar Painel'} ${icon('arrowRight')}</button>
          ${first ? '' : `<p class="center small" style="margin-top:18px"><a href="#" id="forgot">Esqueceu a senha?</a></p>`}
          <div class="foot">© ${new Date().getFullYear()} <span class="gold">RB Tech Celulares</span>. Todos os direitos reservados.</div>
        </form>
      </div>`;
    $('#login-form').onsubmit = async e => {
      e.preventDefault();
      const f = readForm(e.target);
      if (first) {
        if (f.senha !== f.senha2) return toast('As senhas não conferem', true);
        Store.db.auth = { email: f.email.toLowerCase(), hash: await sha256(f.senha) };
        Store.save();
      } else {
        const ok = f.email.toLowerCase() === Store.db.auth.email && (await sha256(f.senha)) === Store.db.auth.hash;
        if (!ok) return toast('E-mail ou senha incorretos', true);
      }
      localStorage.setItem(SESSION_KEY, Store.db.auth.email);
      this.render();
    };
    const fg = $('#forgot');
    if (fg) fg.onclick = e => {
      e.preventDefault();
      openModal({
        title: 'Recuperar acesso', icon: 'lock',
        body: `<p class="muted" style="margin-top:0">Os dados ficam salvos apenas neste aparelho. Para redefinir a senha, é preciso apagar o acesso atual — <b class="gold">seus dados (OS, clientes, estoque) são mantidos</b>.</p>`,
        foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="rst">Redefinir senha</button>`,
        onMount: (el, m) => { $('#rst', el).onclick = () => { Store.db.auth = null; Store.save(); m.close(); this.render(); }; },
      });
    };
  },
};

document.addEventListener('DOMContentLoaded', () => App.start());
