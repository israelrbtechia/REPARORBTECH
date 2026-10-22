/* Visão Geral */
Pages.dashboard = {
  render(main) {
    const db = Store.db;
    const hoje = Store.resumoDia();
    const meta = Store.metaDiaria();
    const pct = meta ? Math.min(100, (hoje.receita / meta) * 100) : 0;
    const falta = Math.max(0, meta - hoje.receita);
    const os = db.os.filter(o => !o.deleted);
    const cnt = st => os.filter(o => o.status === st).length;
    const mes = Store.resumoMes();
    const baixo = db.pecas.filter(p => !p.deleted && p.qtd <= (p.minimo || 0)).length + db.produtos.filter(p => !p.deleted && p.qtd <= (p.minimo || 0)).length;
    const atrasadas = os.filter(o => OS_ATIVOS.includes(o.status) && o.status !== 'concluido' && o.previsao && dayKey(o.previsao) < dayKey()).length;
    const prontas = os.filter(o => o.status === 'concluido');
    const recentes = os.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 5);

    // últimos 7 dias
    const dias = [...Array(7)].map((_, i) => { const d = addDays(new Date(), i - 6); return { d, r: Store.resumoDia(d).receita }; });
    const maxR = Math.max(1, ...dias.map(x => x.r));

    main.innerHTML = `
      ${pageHead('dash', 'Visão Geral', `Resumo operacional de ${esc(longToday())}.`)}
      <div class="page-actions">
        <button class="btn primary" onclick="OSPage.novaOS()">${icon('plus')} Nova OS</button>
        <button class="btn outline-gold" onclick="App.go('vendas')">${icon('bag')} Nova Venda</button>
        <button class="btn" onclick="OrcPage.novo()">${icon('card')} Orçamento</button>
      </div>

      <div class="hero mb">
        <div class="row between" style="align-items:flex-start">
          <div>
            <div class="stat label" style="padding:0;border:0;background:none">Faturamento hoje</div>
            <div class="big">${money(hoje.receita)}</div>
          </div>
          <div class="right">
            <div class="small muted">Meta diária</div>
            <div class="bold gold" style="font-size:20px">${money(meta)}</div>
          </div>
        </div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <div class="small muted">${falta > 0 ? `Faltam <b class="gold">${money(falta)}</b> para a meta.` : `<b class="gold">Meta do dia batida! 🏆</b>`}</div>
        <div class="divider"></div>
        <div class="row between">
          <div class="stat label" style="padding:0;border:0;background:none">Lucro líquido hoje ${icon('trending', 'sm')}</div>
          <span class="pill green">Margem ${hoje.margem.toFixed(1)}%</span>
        </div>
        <div class="big ${hoje.lucro >= 0 ? 'green' : 'red'}" style="font-size:30px;margin-top:4px">${money(hoje.lucro)}</div>
        <div class="row wrap small muted" style="margin-top:8px">Custos considerados <span class="pill red">-${money(hoje.custos)}</span></div>
        <div class="xs muted" style="margin-top:6px">Inclui peças usadas em OS, custo dos produtos vendidos, taxas de cartão e despesas do dia.</div>
      </div>

      <div class="grid grid-4 mb">
        ${[['analise', 'Em análise'], ['peca', 'Aguard. peça'], ['servico', 'Em serviço'], ['concluido', 'Prontas']].map(([st, l]) => `
          <div class="card status-tile" onclick="App.go('os',{status:'${st}'})">
            <div class="ic" style="color:${OS_STATUS[st].color}">${icon(OS_STATUS[st].icon)}</div>
            <div class="n">${cnt(st)}</div><div class="l">${l}</div>
          </div>`).join('')}
      </div>

      <div class="grid grid-2 mb">
        <div class="stat"><div class="label">${icon('calendar', 'sm')} Faturamento do mês</div><div class="value gold">${money(mes.receita)}</div><div class="sub">Meta ${money(Store.s.metaMensal)} · ${Store.s.metaMensal ? Math.round(mes.receita / Store.s.metaMensal * 100) : 0}%</div></div>
        <div class="stat"><div class="label">${icon('trending', 'sm')} Lucro do mês</div><div class="value ${mes.lucro >= 0 ? 'green' : 'red'}">${money(mes.lucro)}</div><div class="sub">OS ${money(mes.os)} · Vendas ${money(mes.vendas)}</div></div>
        <div class="stat" style="cursor:pointer" onclick="App.go('os',{status:'atrasadas'})"><div class="label">${icon('clock', 'sm')} OS atrasadas</div><div class="value ${atrasadas ? 'red' : ''}">${atrasadas}</div><div class="sub">Passaram da previsão de entrega</div></div>
        <div class="stat" style="cursor:pointer" onclick="App.go('pecas')"><div class="label">${icon('alert', 'sm')} Estoque baixo</div><div class="value ${baixo ? 'gold' : ''}">${baixo}</div><div class="sub">Peças e produtos no mínimo</div></div>
      </div>

      <div class="card mb">
        <h3>Faturamento <span class="gold">últimos 7 dias</span></h3>
        <div class="bar-chart">
          ${dias.map(x => `<div class="b" title="${fmtDate(x.d)}: ${money(x.r)}"><span class="gold">${x.r ? (x.r >= 1000 ? (x.r / 1000).toFixed(1) + 'k' : Math.round(x.r)) : ''}</span><div style="height:${(x.r / maxR) * 100}%"></div><span>${x.d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span></div>`).join('')}
        </div>
      </div>

      <div class="grid grid-auto">
        <div class="card pad-0">
          <div class="list-head"><b>Prontas para <span class="gold">retirada</span></b><span class="pill gold">${prontas.length}</span></div>
          ${prontas.length ? prontas.slice(0, 6).map(o => this.osMini(o)).join('') : `<div class="empty">Nenhuma OS aguardando retirada.</div>`}
        </div>
        <div class="card pad-0">
          <div class="list-head"><b>Últimas <span class="gold">OS</span></b><a href="#/os" class="small">Ver todas</a></div>
          ${recentes.length ? recentes.map(o => this.osMini(o)).join('') : `<div class="empty">${icon('file')}<div>Nenhuma OS ainda.</div><button class="btn primary mt" onclick="OSPage.novaOS()">${icon('plus')} Criar primeira OS</button></div>`}
        </div>
      </div>`;
  },
  osMini(o) {
    const c = Store.cliente(o.clienteId);
    return `<div class="item bar" style="--bar:${OS_STATUS[o.status].color};padding:12px 18px" onclick="OSPage.detalhe('${o.id}')">
      <div class="row between"><div class="grow"><div class="row"><span class="num">#${o.numero}</span><b class="ellipsis">${esc(c?.nome || '—')}</b></div>
      <div class="small muted ellipsis" style="margin-top:4px">${esc(o.aparelho?.modelo || '')} · ${esc(o.defeito || '')}</div></div>
      <div class="right"><div class="bold gold">${money(Store.osTotal(o))}</div>${statusPill(o.status)}</div></div></div>`;
  },
};
