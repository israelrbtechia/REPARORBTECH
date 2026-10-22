/* Orçamentos */
const ORC_STATUS = { pendente: ['Pendente', 'orange'], aprovado: ['Aprovado', 'green'], recusado: ['Recusado', 'red'] };

const OrcPage = {
  st: { tab: 'pendente', q: '' },
  total: o => o.itens.reduce((s, i) => s + i.valor * (i.qtd || 1), 0),

  render(main) {
    const all = Store.db.orcamentos.filter(o => !o.deleted);
    const pend = all.filter(o => o.status === 'pendente');
    const aprov = all.filter(o => o.status === 'aprovado').length;
    main.innerHTML = `
      ${pageHead('card', 'Orçamentos', 'Crie, envie e converta orçamentos em ordens de serviço.')}
      <div class="page-actions"><button class="btn primary" onclick="OrcPage.novo()">${icon('plus')} Novo Orçamento</button></div>
      <div class="grid grid-3 mb">
        <div class="stat"><div class="label">Pendentes</div><div class="value">${pend.length}</div><div class="sub gold">${money(pend.reduce((s, o) => s + this.total(o), 0))}</div></div>
        <div class="stat"><div class="label">Aprovados</div><div class="value green">${aprov}</div></div>
        <div class="stat"><div class="label">Conversão</div><div class="value gold">${all.length ? Math.round(aprov / all.length * 100) : 0}%</div></div>
      </div>
      <div class="card mb" style="padding:12px">
        <div class="tabs" id="orc-tabs">${[['pendente', 'Pendentes'], ['aprovado', 'Aprovados'], ['recusado', 'Recusados'], ['todos', 'Todos'], ['lixeira', 'Lixeira']].map(([k, l]) => `<button data-k="${k}" class="${this.st.tab === k ? 'on' : ''}">${k === 'lixeira' ? icon('trash', 'sm') : ''}${l}</button>`).join('')}</div>
        <div class="toolbar"><div class="input-icon">${icon('search')}<input class="input" id="orc-q" placeholder="Buscar cliente, aparelho, nº..." value="${esc(this.st.q)}"></div></div>
      </div>
      <div class="card pad-0" id="orc-list"></div>`;
    $$('#orc-tabs button').forEach(b => b.onclick = () => { this.st.tab = b.dataset.k; $$('#orc-tabs button').forEach(x => x.classList.toggle('on', x === b)); this.list(); });
    $('#orc-q').oninput = e => { this.st.q = e.target.value; this.list(); };
    this.list();
  },

  list() {
    const t = this.st.tab;
    const list = Store.db.orcamentos.filter(o => t === 'lixeira' ? o.deleted : !o.deleted && (t === 'todos' || o.status === t))
      .filter(o => { const c = Store.cliente(o.clienteId); return matches(this.st.q, String(o.numero), c?.nome, o.aparelho?.modelo, o.defeito); })
      .sort((a, b) => b.numero - a.numero);
    $('#orc-list').innerHTML = `<div class="list-head"><b>${list.length} orçamento(s)</b></div>` + (list.map(o => {
      const c = Store.cliente(o.clienteId); const [l, cls] = ORC_STATUS[o.status];
      const vencido = o.status === 'pendente' && o.validade && dayKey(o.validade) < dayKey();
      return `<div class="item" onclick="OrcPage.detalhe('${o.id}')"><div class="row between" style="align-items:flex-start"><div class="grow">
        <div class="meta"><span class="num">ORC ${o.numero}</span><span>${fmtDate(o.criadoEm)}</span><span class="pill ${cls}">${l}</span>${vencido ? '<span class="pill red">Vencido</span>' : ''}</div>
        <div class="title" style="margin-top:8px">${esc(c?.nome || '—')}</div><div class="device">${icon('phone', 'sm')} ${esc(o.aparelho?.modelo || '—')}</div></div>
        <div class="price">${money(this.total(o))}</div></div></div>`;
    }).join('') || `<div class="empty">${icon('card')}<div>Nenhum orçamento.</div></div>`);
  },

  // pre: dados vindos de um pedido do cliente (pedidoId, clienteId, nome, telefone, aparelho, defeito)
  novo(id, pre = {}) {
    const orc = id ? JSON.parse(JSON.stringify(Store.db.orcamentos.find(o => o.id === id))) : { itens: [{ desc: '', qtd: 1, valor: 0 }], validade: dayKey(addDays(new Date(), 7)), aparelho: { modelo: pre.aparelho || '' }, defeito: pre.defeito || '', clienteId: pre.clienteId || null, pedidoId: pre.pedidoId || null };
    const clientes = Store.clientesAtivos();
    openModal({
      title: id ? `Editar orçamento ${orc.numero}` : 'Novo Orçamento', icon: 'card', wide: true,
      subtitle: pre.pedidoId ? `A partir do pedido de ${pre.nome}` : '',
      body: `
        <div class="section-title">Cliente</div>
        <div class="form-row r-1-2 collapse">
          ${field('Cliente cadastrado', `<select class="input" id="orc-cli"><option value="">— Novo cliente —</option>${clientes.map(c => `<option value="${c.id}" ${c.id === orc.clienteId ? 'selected' : ''}>${esc(c.nome)}${c.telefone ? ' · ' + esc(fmtPhone(c.telefone)) : ''}</option>`).join('')}</select>`)}
          <div id="orc-newcli" class="${orc.clienteId ? 'hidden' : ''}"><div class="form-row">${field('Nome', `<input class="input" id="orc-nome" placeholder="Nome do cliente" value="${esc(pre.nome || '')}">`, { req: true })}${field('Telefone', `<input class="input" id="orc-tel" type="tel" placeholder="(11) 99999-9999" value="${esc(fmtPhone(pre.telefone || ''))}">`)}</div></div>
        </div>
        <div class="section-title">Aparelho e problema</div>
        <div class="form-row">${field('Aparelho', `<input class="input" id="orc-ap" placeholder="Ex: iPhone 11" value="${esc(orc.aparelho?.modelo || '')}">`, { req: true })}${field('IMEI', `<input class="input" id="orc-imei" value="${esc(orc.aparelho?.imei || '')}">`, { opt: true })}</div>
        ${field('Defeito', `<textarea class="input" id="orc-def" style="min-height:60px">${esc(orc.defeito || '')}</textarea>`)}
        <div class="section-title">Itens</div>
        <div id="orc-itens"></div>
        <div class="row wrap mb"><button class="btn sm outline-gold" id="orc-add">${icon('plus', 'sm')} Item</button>
          ${Store.db.servicos.length ? `<select class="input" id="orc-sv" style="width:auto;min-height:36px;padding:6px 40px 6px 12px"><option value="">+ Do catálogo</option>${Store.db.servicos.filter(s => !s.deleted).map(s => `<option value="${s.id}">${esc(s.nome)} · ${money(s.preco)}</option>`).join('')}</select>` : ''}
          <span class="grow right bold">Total: <span class="gold" id="orc-total" style="font-size:20px"></span></span></div>
        <div class="form-row">${field('Validade', `<input class="input" type="date" id="orc-val" value="${esc(orc.validade || '')}">`)}${field('Prazo de execução', `<input class="input" id="orc-prazo" placeholder="Ex: 2 dias úteis" value="${esc(orc.prazo || '')}">`)}</div>
        ${field('Observações', `<textarea class="input" id="orc-obs" style="min-height:60px">${esc(orc.obs || '')}</textarea>`, { opt: true })}`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="orc-save">${icon('check')} Salvar</button>`,
      onMount: (el, m) => {
        const cli = $('#orc-cli', el);
        cli.onchange = () => $('#orc-newcli', el).classList.toggle('hidden', !!cli.value);
        const renderItens = () => {
          $('#orc-itens', el).innerHTML = orc.itens.map((it, i) => `<div class="row mb" style="align-items:flex-end">
            <div class="grow"><input class="input" data-f="desc" data-i="${i}" placeholder="Descrição (peça/serviço)" value="${esc(it.desc)}"></div>
            <input class="input" style="width:64px" type="number" min="1" data-f="qtd" data-i="${i}" value="${it.qtd || 1}">
            <input class="input" style="width:110px" inputmode="decimal" data-f="valor" data-i="${i}" placeholder="0,00" value="${it.valor ? moneyInput(it.valor) : ''}">
            <button class="icon-btn" data-rm="${i}">${icon('trash', 'sm')}</button></div>`).join('');
          $$('[data-f]', el).forEach(inp => inp.oninput = () => { const it = orc.itens[+inp.dataset.i]; it[inp.dataset.f] = inp.dataset.f === 'valor' ? parseMoney(inp.value) : inp.dataset.f === 'qtd' ? +inp.value || 1 : inp.value; tot(); });
          $$('[data-rm]', el).forEach(b => b.onclick = () => { orc.itens.splice(+b.dataset.rm, 1); renderItens(); });
          tot();
        };
        const tot = () => $('#orc-total', el).textContent = money(this.total(orc));
        renderItens();
        $('#orc-add', el).onclick = () => { orc.itens.push({ desc: '', qtd: 1, valor: 0 }); renderItens(); };
        const sv = $('#orc-sv', el); if (sv) sv.onchange = () => { const s = Store.db.servicos.find(x => x.id === sv.value); if (s) { orc.itens = orc.itens.filter(i => i.desc || i.valor); orc.itens.push({ desc: s.nome, qtd: 1, valor: s.preco }); renderItens(); } sv.value = ''; };
        $('#orc-save', el).onclick = () => {
          let clienteId = cli.value;
          if (!clienteId) {
            const nome = $('#orc-nome', el).value.trim(); if (!nome) return toast('Informe o cliente', true);
            clienteId = Store.saveCliente({ nome, telefone: onlyDigits($('#orc-tel', el).value), docTipo: 'CPF', aparelhos: [] }).id;
          }
          const modelo = $('#orc-ap', el).value.trim(); if (!modelo) return toast('Informe o aparelho', true);
          orc.itens = orc.itens.filter(i => i.desc || i.valor);
          if (!orc.itens.length) return toast('Adicione pelo menos um item', true);
          Object.assign(orc, { clienteId, aparelho: { ...orc.aparelho, modelo, imei: $('#orc-imei', el).value.trim(), tipo: orc.aparelho?.tipo || 'celular' }, defeito: $('#orc-def', el).value.trim(), validade: $('#orc-val', el).value, prazo: $('#orc-prazo', el).value.trim(), obs: $('#orc-obs', el).value.trim() });
          if (!orc.id) { orc.id = uid(); orc.numero = Store.next('orc'); orc.criadoEm = nowISO(); orc.status = 'pendente'; Store.db.orcamentos.push(orc); Store.log('Orçamento criado', `#${orc.numero}`); }
          else { const i = Store.db.orcamentos.findIndex(x => x.id === orc.id); Store.db.orcamentos[i] = orc; }
          if (orc.pedidoId) { const p = Pedidos.get(orc.pedidoId); if (p) { p.status = 'orcado'; p.orcamentoId = orc.id; p.lido = true; } }
          Store.save(); m.close();
          if (App.route === 'orcamentos' || App.route === 'os') App.refresh();
          toast('Orçamento salvo'); this.detalhe(orc.id);
        };
      },
    });
  },

  detalhe(id) {
    const o = Store.db.orcamentos.find(x => x.id === id);
    const c = Store.cliente(o.clienteId) || {};
    const [l, cls] = ORC_STATUS[o.status];
    const msg = `Olá ${(c.nome || '').split(' ')[0]}! Segue o orçamento da ${Store.s.loja}:\n\n📱 *${o.aparelho?.modelo || ''}*\n${o.defeito ? `Defeito: ${o.defeito}\n` : ''}\n${o.itens.map(i => `• ${i.desc}${i.qtd > 1 ? ` (x${i.qtd})` : ''}: ${money(i.valor * (i.qtd || 1))}`).join('\n')}\n\n*Total: ${money(this.total(o))}*\n${o.prazo ? `Prazo: ${o.prazo}\n` : ''}Válido até ${fmtDate(o.validade)}.\n\nPodemos seguir com o serviço?`;
    openModal({
      title: `Orçamento ${o.numero}`, subtitle: `${c.nome || ''} · ${o.aparelho?.modelo || ''}`, icon: 'card',
      body: `<div class="row wrap mb"><span class="pill ${cls}">${l}</span><span class="pill">Criado ${fmtDate(o.criadoEm)}</span><span class="pill">Válido até ${fmtDate(o.validade)}</span></div>
        ${o.defeito ? `<div class="card mb"><div class="lbl">Defeito</div>${esc(o.defeito)}</div>` : ''}
        <div class="card mb">${o.itens.map(i => `<div class="kv"><span class="k">${esc(i.desc)}${i.qtd > 1 ? ` x${i.qtd}` : ''}</span><span class="v">${money(i.valor * (i.qtd || 1))}</span></div>`).join('')}
        <div class="kv"><span class="k bold">Total</span><span class="v gold" style="font-size:20px">${money(this.total(o))}</span></div></div>
        ${o.obs ? `<p class="small muted">${esc(o.obs)}</p>` : ''}
        ${o.osId ? `<button class="btn outline-gold block" onclick="closeAllModals();OSPage.detalhe('${o.osId}')">Ver OS gerada</button>` : ''}`,
      foot: o.deleted ? `<button class="btn outline-gold" onclick="OrcPage.set('${o.id}','deleted',false)">${icon('undo')} Restaurar</button>` : `
        ${o.status === 'pendente' ? `<button class="btn primary" onclick="OrcPage.aprovar('${o.id}')">${icon('check')} Aprovar → OS</button><button class="btn" onclick="OrcPage.set('${o.id}','status','recusado')">${icon('xCircle')} Recusado</button>` : ''}
        ${o.status === 'recusado' ? `<button class="btn" onclick="OrcPage.set('${o.id}','status','pendente')">Reabrir</button>` : ''}
        ${c.telefone ? `<a class="btn success" target="_blank" href="${waLink(c.telefone, msg)}">${icon('whatsapp')} Enviar</a>` : ''}
        <button class="btn" onclick="Print.orcamento(Store.db.orcamentos.find(x=>x.id==='${o.id}'))">${icon('printer')} Imprimir</button>
        ${o.status === 'pendente' ? `<button class="btn" onclick="closeAllModals();OrcPage.novo('${o.id}')">${icon('edit')}</button>` : ''}
        <button class="btn danger" onclick="OrcPage.set('${o.id}','deleted',true)">${icon('trash')}</button>`,
    });
  },

  set(id, k, v) {
    const o = Store.db.orcamentos.find(x => x.id === id); o[k] = v; Store.save(); closeAllModals();
    if (App.route === 'orcamentos') App.refresh();
    toast('Orçamento atualizado');
  },

  aprovar(id) {
    const o = Store.db.orcamentos.find(x => x.id === id);
    const c = Store.cliente(o.clienteId);
    // garante que o aparelho exista no cadastro do cliente
    let ap = (c.aparelhos || []).find(a => a.modelo === o.aparelho.modelo && (a.imei || '') === (o.aparelho.imei || ''));
    if (!ap) { ap = { id: uid(), tipo: 'celular', idTipo: 'imei', ...o.aparelho }; c.aparelhos = [...(c.aparelhos || []), ap]; Store.saveCliente(c); }
    closeAllModals();
    OSPage.novaOS({ clienteId: c.id, aparelho: ap, fromOrc: { id: o.id, defeito: o.defeito, servico: o.itens.map(i => i.desc).join(' + '), valor: this.total(o) } });
  },
};
Pages.orcamentos = OrcPage;
