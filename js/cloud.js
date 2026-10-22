/* Nuvem (Supabase): autenticação, loja e sincronização.
   Os dados continuam salvos no aparelho (funciona offline); cada registro alterado
   é enviado para a tabela "itens" e mudanças de outros aparelhos chegam em tempo real. */
const SYNC_COLS = ['clientes', 'os', 'orcamentos', 'pecas', 'fornecedores', 'movEstoque', 'produtos', 'vendas', 'servicos', 'lancamentos', 'caixas', 'auditoria'];
const META_KEYS = ['settings', 'seq'];
const SNAP_KEY = 'rbtech_sync_snap';

// JSON com chaves ordenadas: o jsonb do Postgres reordena chaves, então comparamos sempre nesta forma
function stableStr(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(x => x === undefined ? 'null' : stableStr(x)).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function').sort().map(k => JSON.stringify(k) + ':' + stableStr(v[k])).join(',') + '}';
}
function hash(s) { // cyrb53
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const Cloud = {
  sb: null,
  user: null,
  loja: null,      // { id, nome, codigo_convite, papel }
  status: 'off',   // off | ok | sync | offline | erro
  snap: {},        // "colecao:id" -> hash do que está no servidor
  timer: null,
  pushing: false,
  again: false,
  channel: null,
  refreshTimer: null,

  get enabled() { const c = window.RBTECH_CONFIG || {}; return !!(c.supabaseUrl && c.supabaseAnonKey && window.supabase); },

  async init() {
    if (!this.enabled) return;
    const c = window.RBTECH_CONFIG;
    this.sb = supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data, error } = await this.sb.auth.getSession();
    this.user = data.session?.user || null;
    if (!this.user && error) {
      // sem internet e o login precisa ser renovado: continua com o último usuário (renova quando a conexão voltar)
      try { const c = JSON.parse(localStorage.getItem('rbtech_loja')); if (c?.user) this.user = c.user; } catch {}
    }
    this.sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'SIGNED_OUT' || session) this.user = session?.user || null;
      if (ev === 'PASSWORD_RECOVERY') { this.recovery = true; if ($('#app').children.length) setTimeout(() => App.checkRecovery(), 0); }
    });
    addEventListener('online', () => this.schedule(0));
    addEventListener('offline', () => this.setStatus('offline'));
  },

  /* ---------- Autenticação ---------- */
  async signIn(email, senha) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message.includes('Invalid login') ? 'E-mail ou senha incorretos' : error.message.includes('not confirmed') ? 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).' : error.message);
    this.user = data.user;
  },
  async signUp(email, senha) {
    const { data, error } = await this.sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw new Error(error.message.includes('already') ? 'Este e-mail já tem conta. Use "Entrar".' : error.message);
    this.user = data.session ? data.user : null;
    return !!data.session; // false = precisa confirmar e-mail
  },
  async resetSenha(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(error.message);
  },
  async novaSenha(senha) {
    const { error } = await this.sb.auth.updateUser({ password: senha });
    if (error) throw new Error(error.message);
  },
  async signOut() {
    this.stop();
    await this.sb.auth.signOut().catch(() => {});
    this.user = null; this.loja = null;
    localStorage.removeItem(DB_KEY); localStorage.removeItem(SNAP_KEY); localStorage.removeItem('rbtech_loja');
    Store.load();
  },

  /* ---------- Loja ---------- */
  async carregarLoja() {
    const { data, error } = await this.sb.from('membros').select('papel, lojas(id, nome, codigo_convite)').eq('user_id', this.user.id).order('criado_em').limit(1);
    if (error) throw error;
    const m = data && data[0];
    this.loja = m ? { ...m.lojas, papel: m.papel } : null;
    return this.loja;
  },
  async criarLoja(nome) {
    const { data, error } = await this.sb.rpc('criar_loja', { p_nome: nome });
    if (error) throw new Error(error.message);
    this.loja = { ...data, papel: 'dono' };
  },
  async entrarNaLoja(codigo) {
    const { data, error } = await this.sb.rpc('entrar_na_loja', { p_codigo: codigo });
    if (error) throw new Error(error.message.includes('inválido') ? 'Código de convite inválido' : error.message);
    this.loja = { ...data, papel: 'membro' };
  },
  async membros() {
    const { data, error } = await this.sb.from('membros').select('user_id, email, papel, criado_em').eq('loja_id', this.loja.id).order('criado_em');
    if (error) throw error;
    return data;
  },
  async removerMembro(uid) {
    const { error } = await this.sb.from('membros').delete().eq('loja_id', this.loja.id).eq('user_id', uid);
    if (error) throw new Error(error.message);
  },
  async novoCodigo() {
    const { data, error } = await this.sb.rpc('novo_codigo_convite', { p_loja: this.loja.id });
    if (error) throw new Error(error.message);
    this.loja.codigo_convite = data;
    return data;
  },

  /* Dados locais que ainda não pertencem a nenhuma loja (uso antes da nuvem) */
  temDadosLocais() {
    const d = Store.db;
    return !d.lojaId && (d.os.length || d.clientes.length || d.pecas.length || d.produtos.length || d.vendas.length);
  },

  /* ---------- Sincronização ---------- */
  // Liga a sincronização para a loja atual. enviarLocais = sobe os dados que já estão no aparelho.
  async start(enviarLocais = false) {
    const lojaId = this.loja.id;
    let fresh = false; // aparelho novo nesta loja: a nuvem manda, nada local é pendência
    if (Store.db.lojaId !== lojaId) {
      const enviar = enviarLocais && !Store.db.lojaId;
      if (!enviar) { const auth = Store.db.auth; Store.db = defaultDB(); Store.db.auth = auth; fresh = true; }
      Store.db.lojaId = lojaId;
      this.snap = {};
      Store.save(true);
    } else {
      try { const s = JSON.parse(localStorage.getItem(SNAP_KEY)); this.snap = s && s.lojaId === lojaId ? s.map : {}; } catch { this.snap = {}; }
    }
    // primeiro envia o que ficou pendente offline, depois baixa tudo
    if (!fresh) await this.push().catch(() => {});
    await this.pull(fresh);
    this.subscribe();
  },
  stop() {
    clearTimeout(this.timer);
    if (this.channel) { this.sb.removeChannel(this.channel); this.channel = null; }
    this.setStatus('off');
  },

  setStatus(s) {
    this.status = s;
    const el = $('#sync-ind'); if (!el) return;
    const map = { ok: ['checkCircle', 'Sincronizado', 'var(--green)'], sync: ['repeat', 'Sincronizando...', 'var(--gold)'], offline: ['alert', 'Sem internet — salvo no aparelho', 'var(--orange)'], erro: ['alert', 'Erro ao sincronizar — toque para tentar de novo', 'var(--red)'], off: ['info', 'Modo local', 'var(--muted)'] };
    const [ic, t, c] = map[s] || map.off;
    el.innerHTML = icon(ic, 'sm'); el.title = t; el.style.color = c;
  },

  saveSnap() { try { localStorage.setItem(SNAP_KEY, JSON.stringify({ lojaId: this.loja?.id, map: this.snap })); } catch {} },

  // Mapa "colecao:id" -> {col, id, obj, str} do estado local atual
  localMap() {
    const m = new Map();
    for (const col of SYNC_COLS) for (const o of Store.db[col] || []) if (o && o.id) { const s = stableStr(o); m.set(col + ':' + o.id, { col, id: String(o.id), obj: o, str: s }); }
    for (const k of META_KEYS) { const s = stableStr(Store.db[k]); m.set('meta:' + k, { col: 'meta', id: k, obj: Store.db[k], str: s }); }
    return m;
  },

  schedule(ms = 700) {
    if (!this.loja || !this.sb) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push().catch(() => {}), ms);
  },

  async push() {
    if (!this.loja) return;
    if (this.pushing) { this.again = true; return; }
    if (!navigator.onLine) { this.setStatus('offline'); return; }
    this.pushing = true;
    try {
      const local = this.localMap();
      const up = [], del = [];
      for (const [k, v] of local) { const h = hash(v.str); if (this.snap[k] !== h) up.push({ k, h, row: { loja_id: this.loja.id, colecao: v.col, id: v.id, dados: JSON.parse(v.str) } }); }
      for (const k of Object.keys(this.snap)) if (!local.has(k)) del.push(k);
      if (!up.length && !del.length) { this.setStatus('ok'); return; }
      this.setStatus('sync');
      for (let i = 0; i < up.length; i += 400) {
        const part = up.slice(i, i + 400);
        const { error } = await this.sb.from('itens').upsert(part.map(p => p.row), { onConflict: 'loja_id,colecao,id' });
        if (error) throw error;
        part.forEach(p => this.snap[p.k] = p.h);
        this.saveSnap();
      }
      const byCol = {};
      del.forEach(k => { const i = k.indexOf(':'); (byCol[k.slice(0, i)] ||= []).push(k.slice(i + 1)); });
      for (const [col, ids] of Object.entries(byCol)) {
        for (let i = 0; i < ids.length; i += 200) {
          const part = ids.slice(i, i + 200);
          const { error } = await this.sb.from('itens').delete().eq('loja_id', this.loja.id).eq('colecao', col).in('id', part);
          if (error) throw error;
          part.forEach(id => delete this.snap[col + ':' + id]);
          this.saveSnap();
        }
      }
      this.setStatus('ok');
    } catch (e) {
      console.warn('sync push', e);
      this.setStatus(navigator.onLine ? 'erro' : 'offline');
      clearTimeout(this.timer); this.timer = setTimeout(() => this.push().catch(() => {}), 15000);
      throw e;
    } finally {
      this.pushing = false;
      if (this.again) { this.again = false; this.schedule(200); }
    }
  },

  async pull(fresh = false) {
    if (!navigator.onLine) { this.setStatus('offline'); return; }
    this.setStatus('sync');
    const rows = [];
    try {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await this.sb.from('itens').select('colecao, id, dados').eq('loja_id', this.loja.id).order('colecao').order('id').range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
    } catch (e) { console.warn('sync pull', e); this.setStatus('erro'); return; }
    // pendências locais (feitas durante o download) têm prioridade
    const local = this.localMap();
    const pend = fresh ? new Set() : new Set([...local].filter(([k, v]) => this.snap[k] !== hash(v.str)).map(([k]) => k));
    const seen = new Set();
    let mudou = 0;
    for (const r of rows) {
      const k = r.colecao + ':' + r.id; seen.add(k);
      const h = hash(stableStr(r.dados));
      this.snap[k] = h;
      if (pend.has(k)) continue;
      const l = local.get(k);
      if (!l || hash(l.str) !== h) { this.applyRow(r.colecao, r.id, r.dados); mudou++; }
    }
    // registros que sumiram do servidor (apagados em outro aparelho)
    for (const [k, v] of local) if (!seen.has(k) && v.col !== 'meta' && !pend.has(k) && k in this.snap) { this.removeLocal(v.col, v.id); mudou++; }
    for (const k of Object.keys(this.snap)) if (!seen.has(k)) delete this.snap[k];
    if (mudou) this.afterRemote();
    this.saveSnap();
    if (pend.size) this.schedule(0); else this.setStatus('ok');
  },

  // Atualiza o objeto no lugar (mantém referências usadas pelas telas abertas)
  applyRow(col, id, dados) {
    if (col === 'meta') {
      if (!META_KEYS.includes(id)) return;
      const cur = Store.db[id];
      for (const k of Object.keys(cur)) if (!(k in dados)) delete cur[k];
      Object.assign(cur, dados);
      return;
    }
    if (!SYNC_COLS.includes(col)) return;
    const arr = Store.db[col];
    const cur = arr.find(o => String(o.id) === String(id));
    if (cur) { for (const k of Object.keys(cur)) if (!(k in dados)) delete cur[k]; Object.assign(cur, dados); }
    else arr.push(dados);
  },
  removeLocal(col, id) {
    if (!SYNC_COLS.includes(col)) return;
    const arr = Store.db[col]; const i = arr.findIndex(o => String(o.id) === String(id));
    if (i >= 0) arr.splice(i, 1);
  },
  afterRemote() {
    const byDate = (a, b) => String(b.data).localeCompare(String(a.data));
    Store.db.auditoria.sort(byDate); Store.db.movEstoque.sort(byDate);
    for (const k in defaultDB().settings) if (Store.db.settings[k] === undefined) Store.db.settings[k] = defaultDB().settings[k];
    Store.save(true);
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => { if (App.logged() && $('#main')) App.remoteRefresh(); }, 250);
  },

  subscribe() {
    if (this.channel) this.sb.removeChannel(this.channel);
    const lojaId = this.loja.id;
    this.channel = this.sb.channel('itens-' + lojaId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens', filter: `loja_id=eq.${lojaId}` }, p => this.onChange(p))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'itens' }, p => this.onChange(p))
      .subscribe(st => { if (st === 'SUBSCRIBED') this.pull(); /* reconectou: atualiza o que perdeu */ });
  },
  onChange(p) {
    if (p.eventType === 'DELETE') {
      const o = p.old || {}; if (o.loja_id && o.loja_id !== this.loja?.id) return;
      if (!o.colecao) return;
      const k = o.colecao + ':' + o.id;
      if (!(k in this.snap)) return;
      delete this.snap[k]; this.removeLocal(o.colecao, o.id);
    } else {
      const r = p.new; if (!r || r.loja_id !== this.loja?.id) return;
      const k = r.colecao + ':' + r.id, h = hash(stableStr(r.dados));
      if (this.snap[k] === h) return; // eco do que este aparelho enviou
      this.snap[k] = h; this.applyRow(r.colecao, r.id, r.dados);
    }
    this.saveSnap(); this.afterRemote();
  },
};
