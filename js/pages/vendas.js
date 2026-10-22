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
        <button class="btn primary" onclick="EstoquePage.editar('produto', null, { tipoProduto: 'seminovo' })">${icon('plus')} Novo celular</button>
        <button class="btn" onclick="EstoquePage.editar('produto', null, { tipoProduto: 'acessorio' })">${icon('tag')} Novo acessório</button>
        <button class="btn" title="Venda avulsa" onclick="VendasPage.avulso()">${icon('repeat')} Avulso</button>
        <button class="btn" title="Entrada em lote" onclick="EstoquePage.lote('produto')">${icon('layers')}</button>
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
      return `<div class="prod-card" onclick="VendasPage.add('${p.id}')" style="${inCart ? 'border-color:var(--gold)' : ''}">
        <div class="row between"><span class="xs muted ellipsis">${esc(p.categoria || '')}</span><button class="icon-btn" style="width:30px;height:30px" onclick="event.stopPropagation();EstoquePage.editar('produto','${p.id}')">${icon('edit', 'sm')}</button></div>
        <b style="line-height:1.25">${esc(p.nome)}</b>
        ${ehCelular(p) ? `<div class="row wrap" style="gap:4px">${p.seminovo ? '<span class="pill gold xs">Seminovo · 6 meses</span>' : '<span class="pill green xs">Novo</span>'}${p.armazenamento ? `<span class="pill xs">${esc(p.armazenamento)}</span>` : ''}${p.bateria ? `<span class="pill xs">🔋 ${esc(p.bateria)}</span>` : ''}</div>${p.imei || p.cor ? `<div class="xs muted ellipsis">${[p.cor, p.imei && 'IMEI ' + p.imei].filter(Boolean).map(esc).join(' · ')}</div>` : ''}` : '<span class="pill xs" style="align-self:flex-start">Acessório</span>'}
        <div class="gold bold" style="font-size:18px">${money(p.preco)}</div>
        <div class="row between xs"><span class="${p.qtd <= (p.minimo || 0) ? 'red' : 'muted'}">Estoque: ${p.qtd}</span>${inCart ? `<span class="pill gold xs">${inCart} no carrinho</span>` : ''}</div>
      </div>`;
    }).join('') || `<div class="empty" style="grid-column:1/-1">${icon(q ? 'search' : 'phone')}<div>${q ? 'Nada encontrado.' : 'Nenhum celular em estoque.<br>Toque em <b class="gold">Novo celular</b> para cadastrar. Acessórios aparecem pela busca.'}</div></div>`;
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

  avulso() {
    openModal({
      title: 'Item avulso', icon: 'repeat', subtitle: 'Venda de algo que não está no cadastro',
      body: `${field('Descrição', '<input class="input" id="av-n" placeholder="Ex: Película genérica">', { req: true })}<div class="form-row">${field('Preço', '<input class="input" id="av-p" inputmode="decimal" placeholder="0,00">')}${field('Custo', '<input class="input" id="av-c" inputmode="decimal" placeholder="0,00">', { opt: true })}</div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="av-ok">Adicionar ao carrinho</button>`,
      onMount: (el, m) => $('#av-ok', el).onclick = () => {
        const nome = $('#av-n', el).value.trim(); const preco = parseMoney($('#av-p', el).value);
        if (!nome || !preco) return toast('Informe descrição e preço', true);
        this.cart.push({ id: 'av-' + uid(), avulso: true, nome, preco, custo: parseMoney($('#av-c', el).value), qtd: 1 });
        m.close(); this.renderProdutos(); this.checkout();
      },
    });
  },

  checkout() {
    if (!this.cart.length) return toast('Carrinho vazio', true);
    const clientes = Store.clientesAtivos();
    openModal({
      title: 'Finalizar venda', icon: 'cart',
      body: `<div id="ck-items"></div>
        <div class="form-row mt">${field('Desconto (R$)', '<input class="input" id="ck-desc" inputmode="decimal" placeholder="0,00">')}${field('Forma de pagamento', `<select class="input" id="ck-forma">${selectOpts(FORMAS_PGTO, 'pix')}</select>`)}</div>
        ${field('Cliente', `<select class="input" id="ck-cli"><option value="">Consumidor final</option>${clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>`, { opt: true })}
        <div id="ck-semi"></div>
        <div class="card center" style="background:var(--gold-soft);border-color:rgba(212,175,55,.4)"><div class="small muted">Total</div><div class="gold bold" style="font-size:32px" id="ck-total"></div><div class="xs muted" id="ck-lucro"></div></div>`,
      foot: `<button class="btn danger" id="ck-clear">${icon('trash')} Limpar</button><button class="btn primary" id="ck-ok" style="flex:2">${icon('check')} Confirmar venda</button>`,
      onMount: (el, m) => {
        const calc = () => {
          const sub = this.cart.reduce((s, c) => s + c.preco * c.qtd, 0);
          const desc = parseMoney($('#ck-desc', el).value);
          const custo = this.cart.reduce((s, c) => s + c.custo * c.qtd, 0);
          $('#ck-total', el).textContent = money(sub - desc);
          $('#ck-lucro', el).textContent = `Subtotal ${money(sub)} · lucro estimado ${money(sub - desc - custo)}`;
          return { sub, desc, custo };
        };
        const items = () => {
          const semi = this.cart.some(c => c.seminovo);
          $('#ck-semi', el).innerHTML = semi ? `<div class="info-box">${icon('shieldCheck')}<span>Aparelho seminovo: <b>garantia de 6 meses</b>. O termo em PDF é gerado ao confirmar a venda.</span></div>
            ${field('Nome do comprador (se não cadastrado)', '<input class="input" id="ck-nome" placeholder="Nome completo">', { opt: true })}` : '';
          $('#ck-items', el).innerHTML = this.cart.map((c, i) => `<div class="cart-line" style="flex-wrap:wrap"><div class="grow"><b>${esc(c.nome)}</b><div class="xs muted">${money(c.preco)} un.${c.seminovo ? ' · <span class="gold">garantia 6 meses</span>' : ''}</div></div>
            <div class="qty"><button data-d="-1" data-i="${i}">−</button><span>${c.qtd}</span><button data-d="1" data-i="${i}">+</button></div><b style="min-width:80px;text-align:right">${money(c.preco * c.qtd)}</b>
            ${c.aparelho || c.seminovo ? `<input class="input" data-imei="${i}" placeholder="IMEI do aparelho" value="${esc(c.imei)}" style="flex-basis:100%;min-height:40px;padding:8px 12px;font-family:ui-monospace,monospace">` : ''}</div>`).join('');
          $$('[data-imei]', el).forEach(inp => inp.oninput = () => { this.cart[+inp.dataset.imei].imei = inp.value.trim(); });
          $$('[data-d]', el).forEach(b => b.onclick = () => { const c = this.cart[+b.dataset.i]; c.qtd += +b.dataset.d; if (c.qtd <= 0) this.cart.splice(+b.dataset.i, 1); if (!this.cart.length) { m.close(); this.renderProdutos(); return; } items(); this.renderProdutos(); });
          calc();
        };
        items();
        $('#ck-desc', el).oninput = calc;
        $('#ck-clear', el).onclick = () => { this.cart = []; m.close(); this.renderProdutos(); };
        $('#ck-ok', el).onclick = () => {
          if (Store.s.exigirCaixa && !Store.caixaAberto()) return toast('Abra o caixa antes de vender', true);
          const { sub, desc, custo } = calc();
          if (desc > sub) return toast('Desconto maior que o total', true);
          const v = { id: uid(), numero: Store.next('venda'), data: nowISO(), itens: this.cart.map(c => ({ ...c })), subtotal: sub, desconto: desc, total: sub - desc, custo, forma: $('#ck-forma', el).value, clienteId: $('#ck-cli', el).value || null, clienteNome: $('#ck-nome', el)?.value.trim() || '' };
          v.itens.forEach(i => { if (!i.avulso) { const p = Store.produto(i.id); if (p) Store.movimentar('produto', p, -i.qtd, `Venda #${v.numero}`); } });
          Store.db.vendas.push(v);
          Store.addReceita({ origem: 'venda', refId: v.id, desc: `Venda #${v.numero}`, valor: v.total, custo, forma: v.forma, data: v.data });
          Store.log('Venda', `#${v.numero} ${money(v.total)}`);
          Store.save(); this.cart = []; m.close(); App.refresh();
          this.recibo(v);
        };
      },
    });
  },

  recibo(v) {
    const c = v.clienteId && Store.cliente(v.clienteId);
    openModal({
      title: 'Venda concluída!', icon: 'checkCircle', subtitle: `Venda #${v.numero} · ${money(v.total)}`,
      body: `<div class="center"><div class="gold bold" style="font-size:34px">${money(v.total)}</div><p class="muted">${FORMAS_PGTO[v.forma]} · ${v.itens.length} item(ns)</p></div>${this.garantiasHTML(v)}`,
      foot: `<button class="btn primary" onclick="VendasPage.reciboPdf('${v.id}', true)">${icon('upload')} Recibo (PDF)</button><button class="btn" onclick="VendasPage.reciboPdf('${v.id}')">${icon('download')}</button>
        ${c?.telefone ? `<a class="btn success" target="_blank" href="${waLink(c.telefone, `Olá ${c.nome.split(' ')[0]}! Obrigado pela compra na ${Store.s.loja}! 🛍️\n\n${v.itens.map(i => `• ${i.nome} x${i.qtd}: ${money(i.preco * i.qtd)}`).join('\n')}\n\n*Total: ${money(v.total)}*`)}">${icon('whatsapp')} WhatsApp</a>` : ''}
        <button class="btn" data-close>Fechar</button>`,
    });
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
      body: `${c ? `<p>Cliente: <b>${esc(c.nome)}</b></p>` : v.clienteNome ? `<p>Comprador: <b>${esc(v.clienteNome)}</b></p>` : ''}${this.garantiasHTML(v)}<div class="card">${v.itens.map(i => `<div class="kv"><span class="k">${i.qtd}x ${esc(i.nome)}</span><span class="v">${money(i.preco * i.qtd)}</span></div>`).join('')}
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
    Store.db.lancamentos = Store.db.lancamentos.filter(l => !(l.origem === 'venda' && l.refId === v.id));
    Store.log('Venda cancelada', `#${v.numero}`); Store.save(); closeAllModals(); App.refresh(); toast('Venda cancelada');
  },
};
Pages.vendas = VendasPage;
