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

  async start() {
    addEventListener('hashchange', () => this.render());
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (Cloud.enabled) {
      $('#app').innerHTML = `<div class="login"><img class="login-logo" src="assets/logo.jpg" alt="RB Tech" style="width:160px"></div>`;
      try { await Cloud.init(); } catch (e) { console.warn(e); }
      if (Cloud.user) await this.bootCloud();
    }
    this.render();
  },

  // Depois do login: descobre a loja do usuário e liga a sincronização
  async bootCloud(enviarLocais = false) {
    try { await Cloud.carregarLoja(); this.cacheLoja(); }
    catch (e) {
      // offline: usa a loja guardada no aparelho
      try { const l = JSON.parse(localStorage.getItem('rbtech_loja')); if (l && l.id === Store.db.lojaId && l.user?.id === Cloud.user.id) Cloud.loja = l; } catch {}
    }
    if (Cloud.loja) Cloud.start(enviarLocais).catch(e => console.warn(e));
  },

  cacheLoja() { localStorage.setItem('rbtech_loja', JSON.stringify({ ...Cloud.loja, user: { id: Cloud.user.id, email: Cloud.user.email } })); },

  logged() {
    if (Cloud.enabled) return !!(Cloud.user && Cloud.loja);
    return Store.db.auth && localStorage.getItem(SESSION_KEY) === Store.db.auth.email;
  },
  userEmail() { return Cloud.enabled ? (Cloud.user?.email || '') : (Store.db.auth?.email || ''); },

  go(route, params) {
    const q = params ? '?' + new URLSearchParams(params) : '';
    if (location.hash === `#/${route}${q}`) this.render(); else location.hash = `#/${route}${q}`;
  },

  parseHash() {
    let h = location.hash.replace(/^#\/?/, '');
    if (/access_token=|error_description=/.test(h)) h = '';
    const [r, q] = h.split('?');
    this.route = r || 'dashboard';
    this.params = Object.fromEntries(new URLSearchParams(q || ''));
  },

  checkRecovery() { if (Cloud.recovery) { Cloud.recovery = false; Pages.config.senha(true); } },

  render() {
    closeAllModals(); closeDropdown();
    setTimeout(() => this.checkRecovery(), 0);
    if (!this.logged()) {
      if (Cloud.enabled) return Cloud.user ? this.renderOnboarding() : this.renderCloudLogin();
      return this.renderLogin();
    }
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

  // Atualização vinda da nuvem: não atrapalha quem está digitando numa busca
  remoteRefresh() {
    this.updateNav(); this.updateBrand();
    if (window._dd) return setTimeout(() => this.remoteRefresh(), 800); // menu aberto: espera fechar
    const a = document.activeElement;
    if (a && $('#main')?.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) {
      a.addEventListener('blur', () => setTimeout(() => this.remoteRefresh(), 50), { once: true });
      return;
    }
    this.refresh();
  },
  updateBrand() {
    const s = Store.s; const ini = esc((s.responsavel || s.loja || 'R')[0].toUpperCase());
    $$('.js-ini').forEach(e => e.textContent = ini);
    const n = $('#sb-loja'); if (n) n.textContent = s.loja;
  },

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
          <div class="avatar js-ini">${esc((s.responsavel || s.loja || 'R')[0].toUpperCase())}</div>
          <div class="grow"><div class="bold ellipsis" id="sb-loja">${esc(s.loja)}</div><div class="xs muted ellipsis">${esc(this.userEmail())}</div></div>
          <button class="icon-btn" title="Sair" onclick="App.logout()">${icon('logout')}</button>
        </div>
      </aside>
      <div class="sidebar-backdrop hidden" id="sb-backdrop" onclick="App.closeMenu()"></div>
      <div class="shell">
        <header class="topbar">
          <button class="icon-btn menu-btn" onclick="App.openMenu()" aria-label="Menu">${icon('menu')}</button>
          <a class="brand" href="#/dashboard"><img src="assets/icon-192.png" alt=""><span>RB <span class="gold">Tech</span></span></a>
          <div class="spacer"></div>
          ${Cloud.enabled ? `<button class="icon-btn" id="sync-ind" onclick="App.syncAgora()"></button>` : ''}
          <button class="icon-btn" title="Nova OS" onclick="OSPage.novaOS()">${icon('plus')}</button>
          <a class="avatar js-ini" href="#/config" title="Configurações">${esc((s.responsavel || s.loja || 'R')[0].toUpperCase())}</a>
        </header>
        <main class="main" id="main"></main>
      </div>`;
    if (Cloud.enabled) Cloud.setStatus(Cloud.status);
  },

  async syncAgora() {
    toast({ ok: 'Tudo sincronizado com a nuvem', sync: 'Sincronizando...', offline: 'Sem internet: os dados estão salvos no aparelho e serão enviados quando a conexão voltar', erro: 'Tentando sincronizar novamente...' }[Cloud.status] || 'Sincronizando...', Cloud.status === 'erro');
    try { await Cloud.push(); await Cloud.pull(); } catch {}
  },

  updateNav() {
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.r === this.route));
    const counts = {
      bancada: Store.db.os.filter(o => !o.deleted && OS_ATIVOS.includes(o.status)).length,
      orcamentos: Store.db.orcamentos.filter(o => !o.deleted && o.status === 'pendente').length,
      pecas: Store.db.pecas.filter(p => !p.deleted && p.qtd <= (p.minimo || 0)).length,
      posvenda: PosVenda.pendentes(),
    };
    for (const [r, n] of Object.entries(counts)) {
      const el = $(`#nav a[data-r="${r}"] .count`);
      if (el) { el.textContent = n; el.classList.toggle('hidden', !n); }
    }
  },

  openMenu() { $('#sidebar').classList.add('open'); $('#sb-backdrop').classList.remove('hidden'); },
  closeMenu() { $('#sidebar')?.classList.remove('open'); $('#sb-backdrop')?.classList.add('hidden'); },

  async logout() {
    if (Cloud.enabled) {
      if (['erro', 'offline', 'sync'].includes(Cloud.status) && !(await confirmDialog('Há alterações que ainda não foram enviadas para a nuvem e serão perdidas se sair agora. Sair mesmo assim?', { danger: true, ok: 'Sair' }))) return;
      await Cloud.signOut();
    } else localStorage.removeItem(SESSION_KEY);
    location.hash = ''; $('#app').innerHTML = ''; this.render();
  },

  /* ---------- Login na nuvem ---------- */
  renderCloudLogin(modo = 'entrar') {
    const criar = modo === 'criar';
    $('#app').innerHTML = `
      <div class="login">
        <form class="login-box" id="login-form" autocomplete="on">
          <img class="login-logo" src="assets/logo.jpg" alt="RB Tech Celulares">
          <h1>${criar ? 'Criar <span class="gold">conta</span>' : 'Bem-vindo de <span class="gold">volta</span>'}</h1>
          <p class="muted" style="margin:0 0 20px">${criar ? 'Crie sua conta para acessar o sistema de qualquer aparelho.' : 'Acesse sua conta para gerenciar sua assistência.'}</p>
          <div class="tabs mb"><button type="button" data-m="entrar" class="${criar ? '' : 'on'}" style="flex:1">Entrar</button><button type="button" data-m="criar" class="${criar ? 'on' : ''}" style="flex:1">Criar conta</button></div>
          ${field('E-mail', inputIcon('mail', 'name="email" type="email" required placeholder="seu@email.com" autocomplete="username"'))}
          ${field('Senha', `<div class="input-icon">${icon('lock')}<input class="input" name="senha" type="password" required minlength="6" placeholder="••••••••" autocomplete="${criar ? 'new-password' : 'current-password'}"><button type="button" class="icon-btn" style="position:absolute;right:4px;top:3px" onclick="const i=this.previousElementSibling;i.type=i.type==='password'?'text':'password'">${icon('eye')}</button></div>`)}
          ${criar ? field('Confirmar senha', inputIcon('lock', 'name="senha2" type="password" required minlength="6" placeholder="••••••••" autocomplete="new-password"')) : ''}
          <button class="btn primary block" id="lg-btn" style="margin-top:8px;min-height:54px;font-size:17px">${criar ? 'Criar conta' : 'Acessar Painel'} ${icon('arrowRight')}</button>
          ${criar ? '' : `<p class="center small" style="margin-top:18px"><a href="#" id="forgot">Esqueceu a senha?</a></p>`}
          <div class="foot">© ${new Date().getFullYear()} <span class="gold">RB Tech Celulares</span>. Todos os direitos reservados.</div>
        </form>
      </div>`;
    $$('[data-m]').forEach(b => b.onclick = () => this.renderCloudLogin(b.dataset.m));
    $('#login-form').onsubmit = async e => {
      e.preventDefault();
      const f = readForm(e.target); const btn = $('#lg-btn'); btn.disabled = true;
      try {
        if (criar) {
          if (f.senha !== f.senha2) throw new Error('As senhas não conferem');
          const logado = await Cloud.signUp(f.email.toLowerCase(), f.senha);
          if (!logado) {
            openModal({ title: 'Confirme seu e-mail', icon: 'mail', body: `<p style="margin-top:0">Enviamos um link de confirmação para <b class="gold">${esc(f.email)}</b>. Abra o e-mail, toque no link e depois entre com sua senha.</p>`, foot: '<button class="btn primary" data-close>Entendi</button>' });
            return this.renderCloudLogin('entrar');
          }
        } else await Cloud.signIn(f.email.toLowerCase(), f.senha);
        await this.bootCloud();
        this.render();
      } catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
    };
    const fg = $('#forgot');
    if (fg) fg.onclick = async e => {
      e.preventDefault();
      const email = $('[name=email]').value.trim();
      if (!email) return toast('Digite seu e-mail no campo acima', true);
      try { await Cloud.resetSenha(email); toast('Enviamos um link para redefinir a senha no seu e-mail'); } catch (err) { toast(err.message, true); }
    };
  },

  // Usuário logado mas ainda sem loja: cria uma nova ou entra com código de convite
  renderOnboarding() {
    const locais = Cloud.temDadosLocais();
    $('#app').innerHTML = `
      <div class="login"><div class="login-box">
        <img class="login-logo" src="assets/logo.jpg" alt="RB Tech" style="width:150px">
        <h1>Quase <span class="gold">lá!</span></h1>
        <p class="muted" style="margin:0 0 20px">Logado como <b>${esc(Cloud.user.email)}</b>. Crie sua loja ou entre na equipe de uma loja existente.</p>
        <form class="card mb" id="ob-criar">
          <h3>${icon('bag', 'sm')} Criar minha <span class="gold">loja</span></h3>
          ${field('Nome da loja', `<input class="input" name="nome" value="${esc(Store.s.loja || 'RB Tech Celulares')}" required>`)}
          ${locais ? `<label class="check"><input type="checkbox" name="enviar" checked> <span>Enviar para a nuvem os dados já salvos neste aparelho <span class="muted small">(${Store.db.os.length} OS, ${Store.db.clientes.length} clientes)</span></span></label>` : ''}
          <button class="btn primary block">${icon('check')} Criar loja</button>
        </form>
        <form class="card mb" id="ob-entrar">
          <h3>${icon('users', 'sm')} Entrar com <span class="gold">código de convite</span></h3>
          <p class="small muted" style="margin-top:0">Peça o código ao dono da loja (Configurações → Equipe).</p>
          ${field('Código', '<input class="input" name="codigo" placeholder="Ex: A1B2C3D4" required style="text-transform:uppercase;letter-spacing:.15em">')}
          <button class="btn outline-gold block">${icon('arrowRight')} Entrar na equipe</button>
        </form>
        <button class="btn ghost block" onclick="App.logout()">${icon('logout')} Sair</button>
      </div></div>`;
    $('#ob-criar').onsubmit = async e => {
      e.preventDefault(); const f = readForm(e.target);
      try {
        await Cloud.criarLoja(f.nome);
        this.cacheLoja();
        await Cloud.start(!!f.enviar);
        Store.s.loja = f.nome; Store.save();
        toast('Loja criada!'); this.render();
      } catch (err) { toast(err.message, true); }
    };
    $('#ob-entrar').onsubmit = async e => {
      e.preventDefault(); const f = readForm(e.target);
      try {
        if (locais && await confirmDialog('Este aparelho tem dados que não estão na nuvem. Baixar um backup deles antes de entrar na equipe?', { ok: 'Baixar backup' })) Pages.config.backup();
        await Cloud.entrarNaLoja(f.codigo);
        this.cacheLoja();
        await Cloud.start(false);
        toast(`Você entrou na equipe de ${Cloud.loja.nome}`); this.render();
      } catch (err) { toast(err.message, true); }
    };
  },

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
