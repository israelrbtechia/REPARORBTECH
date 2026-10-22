/* Venda de Produtos (PDV) */
const VendasPage = {
  st: { tab: 'produtos', q: '', cat: '' }, // cat: '' todos os celulares · 'seminovo' · 'novo'
  cart: [],

  render(main) {
    const prods = Store.db.produtos.filter(p => !p.deleted);
    const cels = prods.filter(p => ehCelular(p) && p.qtd > 0);
    const acess = prods.filter(p => !ehCelular(p));
    const baixo = acess.filter(p => p.qtd <= (p.minimo || 0)).length;
    const venda = cels.reduce((s, p) => s + (p.preco || 0) * p.qtd, 0);
    const custo = cels.reduce((s, p) => s + (p.custo || 0) * p.qtd, 0);
    const cx = Store.caixaAberto();
    const cxAntigo = cx && dayKey(cx.abertoEm) !== dayKey();
    main.innerHTML = `
      ${pageHead('bag', 'Venda de Produtos', 'Gerencie seu estoque, venda produtos e acompanhe o histórico.')}
      <div class="row wrap mb">
        ${cx ? `<span class="pill ${cxAntigo ? 'orange' : 'green'}">● Caixa aberto desde ${fmtDate(cx.abertoEm).slice(0, 5)}</span>${cxAntigo ? `<a class="small" href="#/caixa">Fechar e abrir o de hoje</a>` : ''}` : `<span class="pill red">● Caixa fechado</span><a class="small" href="#/caixa">Abrir caixa</a>`}
      </div>
      <div class="tabs mb" id="vd-tabs" style="display:inline-flex">${[['produtos', 'Produtos', 'box'], ['hist', 'Histórico de Vendas', 'history']].map(([k, l, ic]) => `<button data-k="${k}" class="${this.st.tab === k ? 'on' : ''}">${icon(ic, 'sm')} ${l}</button>`).join('')}</div>
      ${!Store.s.exigirCaixa ? `<div class="card mb row small muted" style="align-items:flex-start">${icon('info')}<span>A exigência de caixa aberto está desligada. Recebimentos feitos com o caixa fechado não entram na conferência do caixa.</span></div>` : ''}
      <div id="vd-body"></div>
      <button class="fab" id="vd-fab" onclick="VendasPage.checkout()" title="Carrinho" style="display:${this.cart.length ? 'grid' : 'none'}">${icon('cart')}<span id="vd-count" style="position:absolute;top:-2px;right:-2px;background:#fff;color:#000;border-radius:99px;font-size:12px;font-weight:800;padding:2px 7px">0</span></button>`;
    $$('#vd-tabs button').forEach(b => b.onclick = () => { this.st.tab = b.dataset.k; $$('#vd-tabs button').forEach(x => x.classList.toggle('on', x === b)); this.body(); });
    this.stats = { cels: cels.reduce((s, p) => s + p.qtd, 0), semi: cels.filter(p => p.seminovo).reduce((s, p) => s + p.qtd, 0), acess: acess.length, baixo, venda, custo };
    this.body();
  },

  body() {
    const box = $('#vd-body');
    if (this.st.tab === 'hist') return this.historico(box);
    const { cels, semi, acess, baixo, venda, custo } = this.stats;
    box.innerHTML = `
      <div class="grid grid-2 mb">
        <div class="stat stat-icon"><div class="ic">${icon('phone')}</div><div><div class="label">Celulares em estoque</div><div class="value">${cels}</div><div class="sub">${semi} seminovo(s) · ${cels - semi} novo(s)</div></div></div>
        <div class="stat stat-icon" style="cursor:pointer" onclick="$('#vd-q').focus()"><div class="ic" style="color:var(--muted);background:var(--card-2)">${icon('tag')}</div><div><div class="label">Acessórios</div><div class="value">${acess}</div><div class="sub">${baixo ? `<span class="orange">${baixo} com estoque baixo</span> · ` : ''}use a busca</div></div></div>
      </div>
      <div class="hero mb" style="padding:18px"><div class="stat-icon"><div class="ic">${icon('dollar')}</div><div>
        <div class="label" style="font-size:11.5px;font-weight:700;letter-spacing:.12em;color:var(--muted)">VALOR DOS CELULARES EM ESTOQUE</div>
        <div class="value" style="font-size:24px;font-weight:800">${money(venda)}</div>
        <div class="small muted">Custo ${money(custo)} · Lucro <b class="green">${money(venda - custo)} (${venda ? Math.round((venda - custo) / venda * 100) : 0}%)</b></div></div></div></div>
      <div class="row mb"><div class="input-icon grow">${icon('search')}<input class="input" id="vd-q" placeholder="Buscar celular ou acessório..." value="${esc(this.st.q)}"></div></div>
      <div class="row wrap mb">
        <div class="tabs" id="vd-cat">${[['', 'Todos os celulares'], ['seminovo', 'Seminovos'], ['novo', 'Novos']].map(([k, l]) => `<button data-c="${k}" class="${this.st.cat === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="row wrap mb">
        <button class="btn primary" style="flex:1 1 100%;min-height:54px;font-size:17px" onclick="VendasPage.novaVenda()">${icon('cart')} Nova venda</button>
        <button class="btn sm" onclick="EstoquePage.editar('produto', null, { tipoProduto: 'seminovo' })">${icon('plus', 'sm')} Cadastrar celular</button>
        <button class="btn sm" onclick="EstoquePage.editar('produto', null, { tipoProduto: 'acessorio' })">${icon('plus', 'sm')} Cadastrar acessório</button>
        <button class="btn sm" title="Entrada em lote" onclick="EstoquePage.lote('produto')">${icon('layers', 'sm')} Lote</button>
      </div>
      <div class="xs muted mb" id="vd-dica"></div>
      <div class="grid grid-2" id="vd-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))"></div>`;
    $('#vd-q').oninput = e => { this.st.q = e.target.value; this.renderProdutos(); };
    $$('#vd-cat [data-c]').forEach(b => b.onclick = () => { this.st.cat = b.dataset.c; $$('#vd-cat [data-c]').forEach(x => x.classList.toggle('on', x === b)); this.renderProdutos(); });
    this.renderProdutos();
  },

  renderProdutos() {
    const g = $('#vd-grid'); if (!g) return;
    const cat = this.st.cat, q = this.st.q.trim();
    // Sem busca: só celulares em estoque. Com busca: tudo (inclusive acessórios e esgotados)
    const list = Store.db.produtos.filter(p => !p.deleted && (q
      ? matches(q, p.nome, p.codigo, p.categoria, p.imei, p.cor)
      : ehCelular(p) && p.qtd > 0 && (!cat || tipoProduto(p) === cat)))
      .sort((a, b) => (ehCelular(b) - ehCelular(a)) || a.nome.localeCompare(b.nome));
    const dica = $('#vd-dica');
    if (dica) dica.innerHTML = q ? `${list.length} resultado(s) para "<b>${esc(q)}</b>" · celulares e acessórios` : `${icon('info', 'sm')} Mostrando só celulares em estoque. Acessórios aparecem quando você busca.`;
    g.innerHTML = list.map(p => {
      const inCart = this.cart.find(c => c.id === p.id)?.qtd || 0;
      return `<div class="prod-card" onclick="VendasPage.novaVenda({ produtoId: '${p.id}' })" style="${inCart ? 'border-color:var(--gold)' : ''}">
        <div class="row between"><span class="xs muted ellipsis">${esc(p.categoria || '')}</span><button class="icon-btn" style="width:30px;height:30px" onclick="event.stopPropagation();EstoquePage.editar('produto','${p.id}')">${icon('edit', 'sm')}</button></div>
        <b style="line-height:1.25">${esc(p.nome)}</b>
        ${ehCelular(p) ? `<div class="row wrap" style="gap:4px">${p.seminovo ? '<span class="pill gold xs">Seminovo · 6 meses</span>' : '<span class="pill green xs">Novo</span>'}${p.statusAparelho && p.statusAparelho !== 'disponivel' && STATUS_AP[p.statusAparelho] ? `<span class="pill ${STATUS_AP[p.statusAparelho][1]} xs">${STATUS_AP[p.statusAparelho][0]}</span>` : ''}${p.armazenamento ? `<span class="pill xs">${esc(p.armazenamento)}</span>` : ''}${p.bateria ? `<span class="pill xs">🔋 ${esc(p.bateria)}</span>` : ''}</div>${p.imei || p.cor ? `<div class="xs muted ellipsis">${[p.cor, p.imei && 'IMEI ' + p.imei].filter(Boolean).map(esc).join(' · ')}</div>` : ''}` : '<span class="pill xs" style="align-self:flex-start">Acessório</span>'}
        <div class="gold bold" style="font-size:18px">${money(p.preco)}</div>
        <div class="row between xs"><span class="${p.qtd <= (p.minimo || 0) ? 'red' : 'muted'}">Estoque: ${p.qtd}</span>${inCart ? `<span class="pill gold xs">${inCart} no carrinho</span>` : ''}</div>
      </div>`;
    }).join('') || `<div class="empty" style="grid-column:1/-1">${icon(q ? 'search' : 'phone')}<div>${q ? 'Nada encontrado.' : 'Nenhum celular em estoque.<br>Para vender algo sem cadastro, toque em <b class="gold">Nova venda</b>. Acessórios aparecem pela busca.'}</div></div>`;
    this.updateFab();
  },

  updateFab() {
    const n = this.cart.reduce((s, c) => s + c.qtd, 0);
    const f = $('#vd-fab'); if (!f) return;
    f.style.display = n ? 'grid' : 'none'; $('#vd-count').textContent = n;
  },

  add(id) {
    const p = Store.produto(id);
    const it = this.cart.find(c => c.id === id);
    if ((it?.qtd || 0) + 1 > p.qtd) toast(`Atenção: estoque de "${p.nome}" é ${p.qtd}`, true);
    if (it) it.qtd++; else this.cart.push({ id, nome: p.nome, preco: p.preco || 0, custo: p.custo || 0, qtd: 1, seminovo: !!p.seminovo, aparelho: ehCelular(p), imei: p.imei || '', cor: p.cor || '', garantiaDias: p.seminovo ? GARANTIA_SEMINOVO_DIAS : (p.garantiaDias ?? 90) });
    this.renderProdutos();
    toast(`${p.nome} adicionado`);
  },

  // Item do carrinho a partir de um produto cadastrado
  itemDe(p) {
    return { id: p.id, nome: p.nome, preco: p.preco || 0, custo: p.custo || 0, qtd: 1, tipoProduto: tipoProduto(p), seminovo: !!p.seminovo, aparelho: ehCelular(p), imei: p.imei || '', cor: p.cor || '', garantiaDias: p.seminovo ? GARANTIA_SEMINOVO_DIAS : (p.garantiaDias ?? (ehCelular(p) ? 365 : 90)) };
  },

  /* ---------- Registrar venda (usado pela Nova venda e pela aba Aparelhos) ----------
     itens: [{ id, nome, preco, custo, qtd, seminovo, aparelho, imei, garantiaDias, avulso }]
     troca: { nome, imei, armazenamento, cor, bateria, condicao, valor, preco } */
  registrar({ itens, clienteId = null, clienteNome = '', desconto = 0, forma = 'pix', troca = null }) {
    const subtotal = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
    const custo = itens.reduce((s, i) => s + (i.custo || 0) * i.qtd, 0);
    const total = subtotal - desconto;
    const v = { id: uid(), numero: Store.next('venda'), data: nowISO(), itens: itens.map(i => ({ ...i })), subtotal, desconto, total, custo, forma, clienteId, clienteNome };
    for (const i of v.itens) {
      const p = !i.avulso && Store.produto(i.id);
      if (!p) continue;
      Store.movimentar('produto', p, -i.qtd, `Venda #${v.numero}`);
      if (ehCelular(p)) { p.vendidoEm = v.data; if (!p.imei && i.imei) p.imei = i.imei; }
    }
    let pagar = total;
    if (troca && troca.valor) {
      const np = AparelhosPage.entrarNoEstoque(troca, troca.valor, 'troca', `Venda #${v.numero}`);
      v.troca = { produtoId: np.id, nome: troca.nome, imei: troca.imei, valor: troca.valor };
      pagar = total - troca.valor; v.pago = pagar;
    }
    Store.db.vendas.push(v);
    // faturamento = total da venda; a parte paga com aparelho fica como "Aparelho na troca"
    if (pagar > 0) Store.addReceita({ origem: 'venda', refId: v.id, desc: `Venda #${v.numero}`, valor: pagar, custo, forma, data: v.data });
    if (v.troca) Store.addReceita({ origem: 'venda', refId: v.id, desc: `Venda #${v.numero} (aparelho na troca)`, valor: Math.min(v.troca.valor, total), custo: pagar > 0 ? 0 : custo, forma: 'troca', data: v.data });
    if (pagar < 0) Store.addDespesa({ desc: `Diferença devolvida na troca · Venda #${v.numero}`, valor: -pagar, forma, categoria: 'Compra de aparelhos', estoque: true });
    Store.log('Venda', `#${v.numero} ${money(v.total)}${v.troca ? ` com troca (${v.troca.nome})` : ''}`);
    Store.save();
    return v;
  },

  /* ---------- Nova venda ----------
     Escolhe produtos do estoque ou cadastra na hora, escolhe/cadastra o cliente, troca e pagamento */
  novaVenda(pre = {}) {
    const sale = { itens: this.cart.map(c => ({ ...c })), clienteId: pre.clienteId || null, cli: 'busca', troca: false };
    if (pre.produtoId) { const p = Store.produto(pre.produtoId); if (p && !sale.itens.some(i => i.id === p.id)) sale.itens.push(this.itemDe(p)); }
    const m = openModal({
      title: 'Nova venda', icon: 'cart', wide: true,
      body: `
        <div class="section-title">${icon('bag', 'sm')} Produtos</div>
        <div id="nv-itens"></div>
        <div class="input-icon">${icon('search')}<input class="input" id="nv-q" placeholder="Buscar celular ou acessório para adicionar..."></div>
        <div id="nv-res" class="mt"></div>
        <button class="btn outline-gold block mt" id="nv-novo">${icon('plus')} Produto ou celular sem cadastro</button>
        <div id="nv-form" class="card mt hidden" style="background:#0a0a0a"></div>

        <div class="section-title mt">${icon('user', 'sm')} Cliente</div>
        <div id="nv-cli"></div>

        <label class="check card mt mb" style="padding:12px 14px"><input type="checkbox" id="nv-tem-troca"> <span><b>Cliente vai dar um aparelho na troca</b><br><span class="xs muted">Abate do valor e o aparelho entra no estoque (em revisão).</span></span></label>
        <div id="nv-troca" class="hidden card mb" style="background:#0a0a0a">${AparelhosPage.camposAparelho('tr')}
          <div class="form-row">${field('Valor da troca', '<input class="input" id="tr-valor" inputmode="decimal" placeholder="0,00">', { req: true })}${field('Preço p/ revenda', '<input class="input" id="tr-preco" inputmode="decimal" placeholder="opcional">', { opt: true })}</div></div>

        <div class="form-row">${field('Desconto (R$)', '<input class="input" id="nv-desc" inputmode="decimal" placeholder="0,00">')}${field('Pagamento', `<select class="input" id="nv-forma">${selectOpts(FORMAS_PGTO, 'pix')}</select>`)}</div>
        <div class="card" id="nv-resumo" style="background:var(--gold-soft);border-color:rgba(212,175,55,.4)"></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="nv-ok" style="flex:2">${icon('check')} Confirmar venda</button>`,
      onClose: () => { this.cart = []; if (App.route === 'vendas') this.renderProdutos(); },
    });
    const el = m.el;

    const calc = () => {
      const sub = sale.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
      const desc = parseMoney($('#nv-desc', el).value);
      const troca = sale.troca ? parseMoney($('#tr-valor', el).value) : 0;
      const custo = sale.itens.reduce((s, i) => s + (i.custo || 0) * i.qtd, 0);
      const pagar = sub - desc - troca;
      $('#nv-resumo', el).innerHTML = `<div class="kv"><span class="k">Subtotal (${sale.itens.reduce((s, i) => s + i.qtd, 0)} item)</span><span class="v">${money(sub)}</span></div>
        ${desc ? `<div class="kv"><span class="k">Desconto</span><span class="v red">-${money(desc)}</span></div>` : ''}
        ${troca ? `<div class="kv"><span class="k">Aparelho na troca</span><span class="v red">-${money(troca)}</span></div>` : ''}
        <div class="kv"><span class="k bold">${pagar >= 0 ? 'Cliente paga' : 'Loja devolve'}</span><span class="v gold" style="font-size:24px">${money(Math.abs(pagar))}</span></div>
        <div class="xs muted">Lucro estimado: ${money(sub - desc - custo)}</div>`;
      return { sub, desc, troca };
    };

    const itens = () => {
      $('#nv-itens', el).innerHTML = sale.itens.length ? sale.itens.map((i, k) => `<div class="cart-line" style="flex-wrap:wrap">
          <div class="grow" style="min-width:0"><b>${esc(i.nome)}</b>
            <div class="xs muted">${i.seminovo ? '<span class="gold">Seminovo · 6 meses</span>' : i.aparelho ? 'Celular novo' : 'Acessório'}${i.novo ? ' · <span class="green">cadastro novo</span>' : ''}</div></div>
          ${i.aparelho ? '' : `<div class="qty"><button data-d="-1" data-k="${k}">−</button><span>${i.qtd}</span><button data-d="1" data-k="${k}">+</button></div>`}
          <input class="input" data-preco="${k}" inputmode="decimal" value="${moneyInput(i.preco)}" style="width:104px;min-height:38px;padding:6px 10px;text-align:right">
          <button class="icon-btn" data-rm="${k}" title="Remover">${icon('trash', 'sm')}</button>
          ${i.aparelho ? `<input class="input" data-imei="${k}" placeholder="IMEI do aparelho" value="${esc(i.imei || '')}" style="flex-basis:100%;min-height:38px;padding:6px 12px;font-family:ui-monospace,monospace">` : ''}
        </div>`).join('') : '<p class="small muted" style="margin-top:0">Nenhum produto ainda. Busque abaixo ou cadastre um novo.</p>';
      $$('[data-d]', el).forEach(b => b.onclick = () => { const i = sale.itens[+b.dataset.k]; i.qtd = Math.max(1, i.qtd + +b.dataset.d); itens(); });
      $$('[data-rm]', el).forEach(b => b.onclick = () => { sale.itens.splice(+b.dataset.rm, 1); itens(); busca(); });
      $$('[data-preco]', el).forEach(inp => inp.oninput = () => { sale.itens[+inp.dataset.preco].preco = parseMoney(inp.value); calc(); });
      $$('[data-imei]', el).forEach(inp => inp.oninput = () => { sale.itens[+inp.dataset.imei].imei = inp.value.trim(); });
      calc();
    };

    const busca = () => {
      const q = $('#nv-q', el).value.trim();
      if (!q) { $('#nv-res', el).innerHTML = ''; return; }
      const r = Store.db.produtos.filter(p => !p.deleted && matches(q, p.nome, p.codigo, p.imei, p.cor) && !sale.itens.some(i => i.id === p.id && ehCelular(p)))
        .sort((a, b) => (b.qtd > 0) - (a.qtd > 0) || (ehCelular(b) - ehCelular(a))).slice(0, 6);
      $('#nv-res', el).innerHTML = `<div class="card pad-0">${r.map(p => `<div class="item" data-add="${p.id}" style="padding:10px 14px"><div class="row between"><div class="grow" style="min-width:0"><b class="ellipsis" style="display:block">${esc(p.nome)}</b><div class="xs muted">${ehCelular(p) ? (p.seminovo ? 'Seminovo' : 'Celular novo') : 'Acessório'} · estoque ${p.qtd}${p.imei ? ' · IMEI ' + esc(p.imei) : ''}</div></div><b class="gold">${money(p.preco)}</b></div></div>`).join('')}
        <div class="item" id="nv-cad" style="padding:10px 14px"><b class="gold">${icon('plus', 'sm')} Cadastrar "${esc(q)}" nesta venda</b></div></div>`;
      $$('[data-add]', el).forEach(d => d.onclick = () => {
        const p = Store.produto(d.dataset.add);
        if (p.qtd <= 0) toast(`Atenção: "${p.nome}" está sem estoque`, true);
        const ex = sale.itens.find(i => i.id === p.id);
        if (ex) ex.qtd++; else sale.itens.push(this.itemDe(p));
        $('#nv-q', el).value = ''; busca(); itens();
      });
      $('#nv-cad', el).onclick = () => formNovo(q);
    };

    // Cadastro de produto/celular feito junto com a venda
    const formNovo = (nome = '') => {
      const f = $('#nv-form', el); f.classList.remove('hidden'); $('#nv-res', el).innerHTML = ''; $('#nv-q', el).value = '';
      f.innerHTML = `<div class="section-title">Cadastrar e adicionar</div>
        <input type="hidden" id="nf-tipo" value="${/iphone|galaxy|samsung|motorola|moto |xiaomi|redmi|poco|realme/i.test(nome) ? 'seminovo' : 'acessorio'}">
        <div class="grid grid-3 mb" id="nf-tipos">${[['seminovo', 'Celular seminovo'], ['novo', 'Celular novo'], ['acessorio', 'Acessório']].map(([k, l]) => `<button type="button" class="chip-opt" data-tp="${k}">${l}</button>`).join('')}</div>
        ${field('Nome / modelo', `<input class="input" id="nf-nome" value="${esc(nome)}" placeholder="Ex: iPhone 12 128GB, Capinha anti-impacto">`, { req: true })}
        <div class="form-row">${field('Preço de venda', '<input class="input" id="nf-preco" inputmode="decimal" placeholder="0,00">', { req: true })}${field('Custo', '<input class="input" id="nf-custo" inputmode="decimal" placeholder="0,00">', { opt: true })}</div>
        <div id="nf-cel">
          <div class="form-row">${field('IMEI', '<input class="input" id="nf-imei" style="font-family:ui-monospace,monospace">', { opt: true })}${field('Cor', '<input class="input" id="nf-cor">', { opt: true })}</div>
          <div class="form-row">${field('Armazenamento', '<input class="input" id="nf-arm" placeholder="128 GB">', { opt: true })}${field('Saúde da bateria', '<input class="input" id="nf-bat" placeholder="88%">', { opt: true })}</div>
        </div>
        <div id="nf-ac" class="form-row">${field('Quantidade', '<input class="input" id="nf-qtd" type="number" min="1" value="1">')}${field('Garantia (dias)', '<input class="input" id="nf-gar" type="number" value="90">')}</div>
        <label class="check"><input type="checkbox" id="nf-salvar" checked> Salvar no cadastro de produtos</label>
        <div class="row"><button class="btn" id="nf-cancel">Cancelar</button><button class="btn primary grow" id="nf-ok">${icon('plus')} Adicionar à venda</button></div>`;
      const setTipo = t => { $('#nf-tipo', el).value = t; $$('#nf-tipos [data-tp]', el).forEach(x => x.classList.toggle('on', x.dataset.tp === t)); $('#nf-cel', el).classList.toggle('hidden', t === 'acessorio'); $('#nf-ac', el).classList.toggle('hidden', t !== 'acessorio'); };
      $$('#nf-tipos [data-tp]', el).forEach(b => b.onclick = () => setTipo(b.dataset.tp));
      setTipo($('#nf-tipo', el).value);
      $('#nf-cancel', el).onclick = () => f.classList.add('hidden');
      $('#nf-ok', el).onclick = () => {
        const t = $('#nf-tipo', el).value, nm = $('#nf-nome', el).value.trim(), preco = parseMoney($('#nf-preco', el).value);
        if (!nm || !preco) return toast('Informe o nome e o preço', true);
        const cel = t !== 'acessorio';
        sale.itens.push({ id: 'novo-' + uid(), novo: true, salvar: $('#nf-salvar', el).checked, nome: nm, preco, custo: parseMoney($('#nf-custo', el).value), qtd: cel ? 1 : Math.max(1, +$('#nf-qtd', el).value || 1),
          tipoProduto: t, seminovo: t === 'seminovo', aparelho: cel, imei: cel ? $('#nf-imei', el).value.trim() : '', cor: cel ? $('#nf-cor', el).value.trim() : '',
          armazenamento: cel ? $('#nf-arm', el).value.trim() : '', bateria: cel ? $('#nf-bat', el).value.trim() : '',
          garantiaDias: t === 'seminovo' ? GARANTIA_SEMINOVO_DIAS : t === 'novo' ? 365 : (+$('#nf-gar', el).value || 0) });
        f.classList.add('hidden'); itens();
      };
      $('#nf-nome', el).focus();
    };

    // Cliente: buscar cadastrado, cadastrar novo ou consumidor final
    const cliente = () => {
      const box = $('#nv-cli', el);
      const c = sale.clienteId && Store.cliente(sale.clienteId);
      if (c) {
        box.innerHTML = `<div class="cart-line"><div class="avatar">${esc(c.nome[0].toUpperCase())}</div><div class="grow"><b>${esc(c.nome)}</b><div class="xs muted">${esc(fmtPhone(c.telefone) || 'sem telefone')}</div></div><button class="btn sm" id="nc-trocar">Trocar</button></div>`;
        $('#nc-trocar', el).onclick = () => { sale.clienteId = null; cliente(); };
        return;
      }
      box.innerHTML = `<div class="tabs mb" id="nc-modo">${[['busca', 'Cliente cadastrado'], ['novo', 'Novo cliente'], ['final', 'Consumidor final']].map(([k, l]) => `<button data-m="${k}" class="${sale.cli === k ? 'on' : ''}" style="flex:1">${l}</button>`).join('')}</div>
        ${sale.cli === 'busca' ? `${inputIcon('search', 'id="nc-q" placeholder="Nome, telefone ou CPF"')}<div id="nc-res" class="mt"></div>`
          : sale.cli === 'novo' ? `<div class="form-row">${field('Nome', '<input class="input" id="nc-nome" placeholder="Nome completo">', { req: true })}${field('WhatsApp', '<input class="input" id="nc-tel" type="tel" placeholder="(48) 99999-9999">')}</div>${field('CPF', '<input class="input" id="nc-doc" inputmode="numeric">', { opt: true })}`
          : `${field('Nome do comprador', '<input class="input" id="nc-final" placeholder="Opcional">', { opt: true })}`}`;
      $$('#nc-modo [data-m]', el).forEach(b => b.onclick = () => { sale.cli = b.dataset.m; cliente(); });
      const q = $('#nc-q', el);
      if (q) q.oninput = () => {
        const r = q.value.trim() ? Store.clientesAtivos().filter(x => matches(q.value, x.nome, x.telefone, x.doc)).slice(0, 5) : [];
        $('#nc-res', el).innerHTML = r.length ? `<div class="card pad-0">${r.map(x => `<div class="item" data-c="${x.id}" style="padding:10px 14px"><b>${esc(x.nome)}</b> <span class="xs muted">${esc(fmtPhone(x.telefone) || '')}</span></div>`).join('')}</div>`
          : q.value.trim() ? `<div class="small muted">Nenhum cliente encontrado. <a href="#" id="nc-cad">Cadastrar "${esc(q.value.trim())}"</a></div>` : '';
        $$('[data-c]', el).forEach(d => d.onclick = () => { sale.clienteId = d.dataset.c; cliente(); });
        const cad = $('#nc-cad', el); if (cad) cad.onclick = e => { e.preventDefault(); const nome = q.value.trim(); sale.cli = 'novo'; cliente(); $('#nc-nome', el).value = nome; $('#nc-tel', el).focus(); };
      };
    };

    $('#nv-q', el).oninput = busca;
    $('#nv-novo', el).onclick = () => formNovo('');
    $('#nv-tem-troca', el).onchange = e => { sale.troca = e.target.checked; $('#nv-troca', el).classList.toggle('hidden', !sale.troca); calc(); };
    $$('#nv-desc, #tr-valor', el).forEach(i => i.oninput = calc);
    itens(); cliente();

    $('#nv-ok', el).onclick = () => {
      if (Store.s.exigirCaixa && !Store.caixaAberto()) return toast('Abra o caixa antes de vender', true);
      if (!sale.itens.length) return toast('Adicione pelo menos um produto', true);
      const { sub, desc, troca } = calc();
      if (desc > sub) return toast('Desconto maior que o total', true);
      let tr = null;
      if (sale.troca) { tr = { ...AparelhosPage.lerAparelho(el, 'tr'), valor: troca, preco: parseMoney($('#tr-preco', el).value) }; if (!tr.nome || !troca) return toast('Informe o modelo e o valor do aparelho da troca', true); }
      // cliente
      let clienteId = sale.clienteId, clienteNome = '';
      if (!clienteId && sale.cli === 'novo') {
        const nome = $('#nc-nome', el).value.trim(); if (!nome) return toast('Informe o nome do cliente', true);
        const tel = onlyDigits($('#nc-tel', el).value);
        const ex = tel && Store.clientesAtivos().find(x => onlyDigits(x.telefone) === tel);
        clienteId = ex ? ex.id : Store.saveCliente({ nome, telefone: tel, docTipo: 'CPF', doc: $('#nc-doc', el).value.trim(), aparelhos: [] }).id;
      } else if (!clienteId) clienteNome = $('#nc-final', el)?.value.trim() || '';
      if (!clienteId && sale.itens.some(i => i.seminovo) && !clienteNome) {
        if (!confirm('Venda de celular seminovo sem cliente: o termo de garantia sai sem nome. Continuar?')) return;
      }
      // produtos cadastrados na hora entram no cadastro (e saem do estoque com a venda)
      for (const i of sale.itens.filter(i => i.novo)) {
        if (!i.salvar) { i.avulso = true; continue; }
        const p = { id: uid(), nome: i.nome, preco: i.preco, custo: i.custo, qtd: 0, minimo: i.aparelho ? 0 : 1, tipoProduto: i.tipoProduto, seminovo: i.seminovo,
          categoria: i.seminovo ? 'Celulares seminovos' : i.aparelho ? 'Celulares novos' : '', imei: i.imei, cor: i.cor, armazenamento: i.armazenamento, bateria: i.bateria,
          garantiaDias: i.garantiaDias, statusAparelho: 'disponivel', criadoEm: nowISO(), entradaEm: nowISO() };
        Store.db.produtos.push(p);
        Store.movimentar('produto', p, i.qtd, 'Cadastrado na venda');
        i.id = p.id;
      }
      const v = this.registrar({ itens: sale.itens.map(({ novo, salvar, ...i }) => i), clienteId, clienteNome, desconto: desc, forma: $('#nv-forma', el).value, troca: tr });
      this.cart = []; m.close(); App.refresh();
      this.recibo(v);
    };
  },

  checkout() { this.novaVenda(); },

  recibo(v) {
    const c = v.clienteId && Store.cliente(v.clienteId);
    openModal({
      title: 'Venda concluída!', icon: 'checkCircle', subtitle: `Venda #${v.numero} · ${money(v.total)}`,
      body: `<div class="center"><div class="gold bold" style="font-size:34px">${money(v.total)}</div><p class="muted">${FORMAS_PGTO[v.forma]} · ${v.itens.length} item(ns)</p></div>${this.trocaHTML(v)}${this.garantiasHTML(v)}`,
      foot: `<button class="btn primary" onclick="VendasPage.reciboPdf('${v.id}', true)">${icon('upload')} Recibo (PDF)</button><button class="btn" onclick="VendasPage.reciboPdf('${v.id}')">${icon('download')}</button>
        ${c?.telefone ? `<a class="btn success" target="_blank" href="${waLink(c.telefone, `Olá ${c.nome.split(' ')[0]}! Obrigado pela compra na ${Store.s.loja}! 🛍️\n\n${v.itens.map(i => `• ${i.nome} x${i.qtd}: ${money(i.preco * i.qtd)}`).join('\n')}\n\n*Total: ${money(v.total)}*`)}">${icon('whatsapp')} WhatsApp</a>` : ''}
        <button class="btn" data-close>Fechar</button>`,
    });
  },

  trocaHTML(v) {
    if (!v.troca) return '';
    return `<div class="card mb" style="border-color:rgba(192,132,252,.45)"><b>${icon('repeat', 'sm')} Aparelho recebido na troca</b>
      <div class="kv"><span class="k">${esc(v.troca.nome)}${v.troca.imei ? ' · IMEI ' + esc(v.troca.imei) : ''}</span><span class="v red" style="white-space:nowrap">-${money(v.troca.valor)}</span></div>
      <div class="kv"><span class="k">${v.pago >= 0 ? 'Cliente pagou' : 'Loja devolveu'} (${FORMAS_PGTO[v.forma]})</span><span class="v gold">${money(Math.abs(v.pago))}</span></div></div>`;
  },

  // Recibo em PDF (com termos de garantia); no celular abre o compartilhar (WhatsApp)
  async reciboPdf(id, compartilhar) {
    const v = Store.db.vendas.find(x => x.id === id);
    toast('Gerando recibo...');
    const doc = await Pdf.recibo(v);
    const nome = `recibo-venda-${v.numero}.pdf`;
    if (compartilhar) await Pdf.compartilhar(doc, nome, `Recibo da venda #${v.numero} — ${Store.s.loja}`); else Pdf.baixar(doc, nome);
  },

  // Termos de garantia (PDF) dos aparelhos seminovos da venda
  garantiasHTML(v) {
    const semi = v.itens.map((it, i) => [it, i]).filter(([it]) => it.seminovo);
    if (!semi.length || v.cancelada) return '';
    return `<div class="card mb" style="border-color:rgba(212,175,55,.45)"><b>${icon('shieldCheck', 'sm')} Garantia de <span class="gold">6 meses</span></b>
      ${semi.map(([it, i]) => `<div class="cart-line"><div class="grow"><b>${esc(it.nome)}</b><div class="xs muted">${it.imei ? 'IMEI ' + esc(it.imei) + ' · ' : ''}até ${fmtDate(addDays(v.data, GARANTIA_SEMINOVO_DIAS))}</div></div>
        <button class="btn sm" onclick="VendasPage.pdf('${v.id}',${i})">${icon('download', 'sm')}</button><button class="btn sm primary" onclick="VendasPage.pdf('${v.id}',${i},true)">${icon('upload', 'sm')} PDF</button></div>`).join('')}</div>`;
  },
  async pdf(id, i, compartilhar) {
    const v = Store.db.vendas.find(x => x.id === id);
    toast('Gerando PDF da garantia...');
    const d = GarantiaDados.venda(v, v.itens[i]);
    const doc = await Pdf.garantia(d);
    if (compartilhar) await Pdf.compartilhar(doc, Pdf.nome(d), `Garantia do aparelho — ${Store.s.loja}`); else Pdf.baixar(doc, Pdf.nome(d));
  },

  historico(box) {
    const vendas = Store.db.vendas.slice().sort((a, b) => b.data.localeCompare(a.data));
    const hoje = vendas.filter(v => !v.cancelada && dayKey(v.data) === dayKey());
    box.innerHTML = `
      <div class="grid grid-2 mb">
        <div class="stat"><div class="label">Vendas hoje</div><div class="value">${hoje.length}</div></div>
        <div class="stat"><div class="label">Total hoje</div><div class="value gold">${money(hoje.reduce((s, v) => s + v.total, 0))}</div></div>
      </div>
      <div class="card pad-0">${vendas.slice(0, 200).map(v => `<div class="item" onclick="VendasPage.detalheVenda('${v.id}')"><div class="row between"><div class="grow">
        <div class="meta"><span class="num">#${v.numero}</span><span>${fmtDateTime(v.data)}</span><span class="pill">${FORMAS_PGTO[v.forma]}</span>${v.cancelada ? '<span class="pill red">Cancelada</span>' : ''}</div>
        <div class="small muted ellipsis" style="margin-top:6px">${v.itens.map(i => `${i.qtd}x ${esc(i.nome)}`).join(', ')}</div></div>
        <div class="price" style="${v.cancelada ? 'text-decoration:line-through;opacity:.5' : ''}">${money(v.total)}</div></div></div>`).join('') || `<div class="empty">${icon('history')}<div>Nenhuma venda ainda.</div></div>`}</div>`;
  },

  detalheVenda(id) {
    const v = Store.db.vendas.find(x => x.id === id);
    const c = v.clienteId && Store.cliente(v.clienteId);
    openModal({
      title: `Venda #${v.numero}`, subtitle: fmtDateTime(v.data), icon: 'bag',
      body: `${c ? `<p>Cliente: <b>${esc(c.nome)}</b></p>` : v.clienteNome ? `<p>Comprador: <b>${esc(v.clienteNome)}</b></p>` : ''}${this.trocaHTML(v)}${this.garantiasHTML(v)}<div class="card">${v.itens.map(i => `<div class="kv"><span class="k">${i.qtd}x ${esc(i.nome)}</span><span class="v">${money(i.preco * i.qtd)}</span></div>`).join('')}
        ${v.desconto ? `<div class="kv"><span class="k">Desconto</span><span class="v red">-${money(v.desconto)}</span></div>` : ''}
        <div class="kv"><span class="k bold">Total · ${FORMAS_PGTO[v.forma]}</span><span class="v gold" style="font-size:20px">${money(v.total)}</span></div></div>`,
      foot: `<button class="btn primary" onclick="VendasPage.reciboPdf('${v.id}', true)">${icon('upload')} Recibo (PDF)</button><button class="btn" onclick="VendasPage.reciboPdf('${v.id}')">${icon('download')}</button>
        ${v.cancelada ? '' : `<button class="btn danger" onclick="VendasPage.cancelar('${v.id}')">${icon('xCircle')} Cancelar venda</button>`}`,
    });
  },

  async cancelar(id) {
    const v = Store.db.vendas.find(x => x.id === id);
    if (!(await confirmDialog(`Cancelar a venda #${v.numero}? Os produtos voltam ao estoque e o valor sai do financeiro.`, { danger: true, ok: 'Cancelar venda' }))) return;
    v.cancelada = true;
    v.itens.forEach(i => { const p = !i.avulso && Store.produto(i.id); if (p) Store.movimentar('produto', p, i.qtd, `Cancelamento venda #${v.numero}`); });
    // aparelho recebido na troca sai do estoque (volta para o cliente)
    const tp = v.troca && Store.produto(v.troca.produtoId);
    if (tp && tp.qtd > 0) { Store.movimentar('produto', tp, -tp.qtd, `Troca desfeita · venda #${v.numero}`); tp.deleted = true; }
    Store.db.lancamentos = Store.db.lancamentos.filter(l => !(l.tipo === 'despesa' && l.desc === `Diferença devolvida na troca · Venda #${v.numero}`));
    Store.db.lancamentos = Store.db.lancamentos.filter(l => !(l.origem === 'venda' && l.refId === v.id));
    Store.log('Venda cancelada', `#${v.numero}`); Store.save(); closeAllModals(); App.refresh(); toast('Venda cancelada');
  },
};
Pages.vendas = VendasPage;
