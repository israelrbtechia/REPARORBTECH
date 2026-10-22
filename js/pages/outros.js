/* Pós-Venda, Serviços, Relatórios e Configurações */

Pages.posvenda = {
  tab: 'followup',
  render(main) {
    const s = Store.s;
    const os = Store.db.os.filter(o => !o.deleted);
    const hoje = new Date();
    const follow = os.filter(o => o.status === 'pago' && !o.posVenda && o.pagoEm && daysBetween(o.pagoEm, hoje) >= 2 && daysBetween(o.pagoEm, hoje) <= 30);
    const garantias = os.filter(o => o.status === 'pago' && o.pagoEm && (() => { const fim = addDays(o.pagoEm, o.garantiaDias ?? s.garantiaDias); const d = daysBetween(hoje, fim); return d >= 0 && d <= 10; })());
    const paradas = os.filter(o => o.status === 'concluido' && daysBetween(o.concluidoEm || o.criadoEm, hoje) >= 3);
    const mes = pad(hoje.getMonth() + 1);
    const aniver = Store.clientesAtivos().filter(c => c.nascimento && c.nascimento.slice(5, 7) === mes).sort((a, b) => a.nascimento.slice(8).localeCompare(b.nascimento.slice(8)));
    const tabs = [['followup', 'Acompanhamento', follow.length], ['retirada', 'Não retirados', paradas.length], ['garantia', 'Garantia acabando', garantias.length], ['aniver', 'Aniversariantes', aniver.length]];
    const nome = c => (c?.nome || '').split(' ')[0];
    const row = (c, title, sub, msg, extra = '') => `<div class="item" style="cursor:default"><div class="row"><div class="avatar">${esc((c?.nome || '?')[0].toUpperCase())}</div>
      <div class="grow"><b>${esc(title)}</b><div class="small muted">${sub}</div></div>
      ${c?.telefone ? `<a class="btn sm success" target="_blank" href="${waLink(c.telefone, msg)}">${icon('whatsapp', 'sm')}</a>` : '<span class="xs muted">sem tel.</span>'}${extra}</div></div>`;
    let list = '';
    if (this.tab === 'followup') list = follow.map(o => { const c = Store.cliente(o.clienteId); return row(c, c?.nome, `OS #${o.numero} · ${esc(o.aparelho?.modelo)} · pago há ${daysBetween(o.pagoEm, hoje)} dias`, `Olá ${nome(c)}! Aqui é da ${s.loja} 😊\n\nPassando para saber como está seu *${o.aparelho?.modelo}* depois do serviço. Ficou tudo certinho?\n\n${s.googleReview ? `Se puder, deixe sua avaliação, ajuda muito a gente: ${s.googleReview}` : 'Qualquer coisa estamos à disposição!'}`, `<button class="btn sm" onclick="Pages.posvenda.feito('${o.id}')">${icon('check', 'sm')}</button>`); }).join('');
    if (this.tab === 'retirada') list = paradas.map(o => { const c = Store.cliente(o.clienteId); return row(c, c?.nome, `OS #${o.numero} · ${esc(o.aparelho?.modelo)} · pronto há ${daysBetween(o.concluidoEm || o.criadoEm, hoje)} dias · ${money(Store.osTotal(o))}`, OSPage.msgPronto(o, c)); }).join('');
    if (this.tab === 'garantia') list = garantias.map(o => { const c = Store.cliente(o.clienteId); const fim = addDays(o.pagoEm, o.garantiaDias ?? s.garantiaDias); return row(c, c?.nome, `OS #${o.numero} · garantia até ${fmtDate(fim)}`, `Olá ${nome(c)}! Aqui é da ${s.loja}.\n\nA garantia do serviço no seu *${o.aparelho?.modelo}* vence em ${fmtDate(fim)}. Está tudo funcionando bem? Se notar algo, traga para avaliarmos sem custo antes do vencimento!`); }).join('');
    if (this.tab === 'aniver') list = aniver.map(c => row(c, c.nome, `🎂 ${c.nascimento.slice(8)}/${mes}`, `Feliz aniversário, ${nome(c)}! 🎉🎂\n\nA equipe ${s.loja} deseja muitas felicidades! Como presente, você tem *10% de desconto* em qualquer serviço ou acessório este mês.`)).join('');

    main.innerHTML = `
      ${pageHead('chat', 'Pós-Venda', 'Fidelize clientes com mensagens no momento certo.')}
      ${!s.googleReview ? `<div class="info-box">${icon('star')}<span>Adicione o link de avaliação do Google em <a href="#/config">Configurações</a> para pedir avaliações automaticamente.</span></div>` : ''}
      <div class="tabs mb" id="pv-tabs">${tabs.map(([k, l, n]) => `<button data-k="${k}" class="${this.tab === k ? 'on' : ''}">${l} ${n ? `<span class="pill gold xs" style="padding:1px 7px">${n}</span>` : ''}</button>`).join('')}</div>
      <div class="card pad-0">${list || `<div class="empty">${icon('checkCircle')}<div>Nada pendente aqui. 👌</div></div>`}</div>`;
    $$('#pv-tabs button').forEach(b => b.onclick = () => { this.tab = b.dataset.k; App.refresh(); });
  },
  feito(id) { const o = Store.osById(id); o.posVenda = nowISO(); Store.save(); App.refresh(); toast('Marcado como contatado'); },
};

Pages.servicos = {
  q: '',
  render(main) {
    const list = Store.db.servicos.filter(s => !s.deleted && matches(this.q, s.nome, s.categoria)).sort((a, b) => a.nome.localeCompare(b.nome));
    main.innerHTML = `
      ${pageHead('wrench', 'Serviços', 'Catálogo de serviços com preço e garantia padrão — agiliza OS e orçamentos.')}
      <div class="page-actions"><button class="btn primary" onclick="Pages.servicos.editar()">${icon('plus')} Novo serviço</button>
        ${Store.db.servicos.length ? '' : `<button class="btn outline-gold" onclick="Pages.servicos.exemplos()">${icon('layers')} Carregar exemplos</button>`}</div>
      <div class="card mb" style="padding:12px"><div class="input-icon">${icon('search')}<input class="input" id="sv-q" placeholder="Buscar serviço..." value="${esc(this.q)}"></div></div>
      <div class="card pad-0">${list.map(s => {
        const n = Store.db.os.filter(o => !o.deleted && o.servico === s.nome).length;
        return `<div class="item" onclick="Pages.servicos.editar('${s.id}')"><div class="row"><div class="grow"><b>${esc(s.nome)}</b><div class="small muted">${esc(s.categoria || '')} · garantia ${s.garantiaDias ?? Store.s.garantiaDias} dias · ${n} OS</div></div><div class="price">${money(s.preco)}</div></div></div>`;
      }).join('') || `<div class="empty">${icon('wrench')}<div>Nenhum serviço cadastrado.</div></div>`}</div>`;
    const q = $('#sv-q'); q.oninput = e => { this.q = e.target.value; App.refresh(); setTimeout(() => { const n = $('#sv-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); };
  },
  editar(id) {
    const s = id ? { ...Store.db.servicos.find(x => x.id === id) } : { garantiaDias: Store.s.garantiaDias };
    openModal({
      title: id ? 'Editar serviço' : 'Novo serviço', icon: 'wrench',
      body: `${field('Nome', `<input class="input" id="s-n" placeholder="Ex: Troca de tela iPhone 11" value="${esc(s.nome || '')}">`, { req: true })}
        <div class="form-row">${field('Preço (R$)', `<input class="input" id="s-p" inputmode="decimal" value="${s.preco ? moneyInput(s.preco) : ''}">`)}${field('Garantia (dias)', `<input class="input" type="number" id="s-g" value="${s.garantiaDias ?? ''}">`)}</div>
        ${field('Categoria', `<input class="input" id="s-c" placeholder="Ex: Tela, Bateria, Software" value="${esc(s.categoria || '')}">`, { opt: true })}`,
      foot: `${id ? `<button class="btn danger" id="s-del">${icon('trash')}</button>` : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="s-ok">${icon('check')} Salvar</button>`,
      onMount: (el, m) => {
        $('#s-ok', el).onclick = () => {
          const nome = $('#s-n', el).value.trim(); if (!nome) return toast('Informe o nome', true);
          Object.assign(s, { nome, preco: parseMoney($('#s-p', el).value), garantiaDias: parseInt($('#s-g', el).value) || 0, categoria: $('#s-c', el).value.trim() });
          if (!id) { s.id = uid(); Store.db.servicos.push(s); } else Store.db.servicos[Store.db.servicos.findIndex(x => x.id === id)] = s;
          Store.save(); m.close(); App.refresh(); toast('Serviço salvo');
        };
        const d = $('#s-del', el); if (d) d.onclick = () => { Store.db.servicos.find(x => x.id === id).deleted = true; Store.save(); m.close(); App.refresh(); };
      },
    });
  },
  exemplos() {
    [['Troca de tela', 350, 'Tela'], ['Troca de bateria', 180, 'Bateria'], ['Troca de conector de carga', 150, 'Carga'], ['Reparo flex de carga', 150, 'Carga'], ['Troca de vidro traseiro', 250, 'Carcaça'], ['Troca de câmera traseira', 280, 'Câmera'], ['Limpeza de oxidação', 120, 'Placa'], ['Reparo de placa', 400, 'Placa'], ['Atualização / formatação', 80, 'Software'], ['Desbloqueio de conta', 150, 'Software'], ['Troca de alto-falante', 120, 'Áudio'], ['Troca de botão power/volume', 130, 'Botões']]
      .forEach(([nome, preco, categoria]) => Store.db.servicos.push({ id: uid(), nome, preco, categoria, garantiaDias: Store.s.garantiaDias }));
    Store.save(); App.refresh(); toast('Exemplos carregados — ajuste os preços!');
  },
};

Pages.relatorios = {
  render(main) {
    const [de, ate] = FinPage.range();
    const inR = d => { const k = dayKey(d); return k >= de && k <= ate; };
    const os = Store.db.os.filter(o => !o.deleted && inR(o.criadoEm));
    const pagas = Store.db.os.filter(o => !o.deleted && o.status === 'pago' && inR(o.pagoEm));
    const vendas = Store.db.vendas.filter(v => !v.cancelada && inR(v.data));
    const ticket = pagas.length ? pagas.reduce((s, o) => s + Store.osTotal(o), 0) / pagas.length : 0;
    const count = (arr, key) => { const m = {}; arr.forEach(x => { const k = key(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8); };
    const sum = (arr, key, val) => { const m = {}; arr.forEach(x => { const k = key(x); if (k) m[k] = (m[k] || 0) + val(x); }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8); };
    const bars = (rows, fmt = v => v) => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.map(([k, v]) => `<div style="margin-bottom:10px"><div class="row between small"><span class="ellipsis">${esc(k)}</span><b class="gold">${fmt(v)}</b></div><div class="progress" style="height:8px;margin:4px 0 0"><div style="width:${v / mx * 100}%"></div></div></div>`).join('') || '<p class="small muted">Sem dados no período.</p>'; };
    const tecs = Store.s.tecnicos;

    main.innerHTML = `
      ${pageHead('report', 'Relatórios', 'Desempenho da assistência no período.')}
      <div class="card mb" style="padding:12px">
        <div class="tabs" id="rl-per">${[['hoje', 'Hoje'], ['7d', '7 dias'], ['mes', 'Este mês'], ['mesant', 'Mês anterior'], ['ano', 'Ano']].map(([k, l]) => `<button data-k="${k}" class="${FinPage.st.periodo === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="grid grid-4 mb">
        <div class="stat"><div class="label">OS abertas</div><div class="value">${os.length}</div></div>
        <div class="stat"><div class="label">OS pagas</div><div class="value gold">${pagas.length}</div></div>
        <div class="stat"><div class="label">Ticket médio</div><div class="value" style="font-size:20px">${money(ticket)}</div></div>
        <div class="stat"><div class="label">Vendas</div><div class="value">${vendas.length}</div></div>
      </div>
      <div class="grid grid-auto mb">
        <div class="card"><h3>Serviços mais <span class="gold">realizados</span></h3>${bars(count(os, o => o.servico || o.defeito))}</div>
        <div class="card"><h3>Aparelhos mais <span class="gold">atendidos</span></h3>${bars(count(os, o => o.aparelho?.modelo?.trim()))}</div>
        <div class="card"><h3>Produtos mais <span class="gold">vendidos</span></h3>${bars(sum(vendas.flatMap(v => v.itens), i => i.nome, i => i.qtd))}</div>
        <div class="card"><h3>Como os clientes <span class="gold">conheceram</span></h3>${bars(count(Store.clientesAtivos().filter(c => inR(c.criadoEm)), c => c.origem || 'Não informado'))}</div>
        <div class="card"><h3>OS por <span class="gold">status</span></h3>${bars(count(os, o => OS_STATUS[o.status].label))}</div>
        ${tecs.length ? `<div class="card"><h3>Faturamento por <span class="gold">técnico</span></h3>${bars(sum(pagas, o => tecs.find(t => t.id === o.tecnicoId)?.nome || 'Sem técnico', o => Store.osTotal(o)), money)}</div>` : ''}
      </div>
      <div class="card"><h3>Exportar</h3><div class="row wrap">
        <button class="btn" onclick="Pages.relatorios.exportOS()">${icon('download')} OS do período (CSV)</button>
        <button class="btn" onclick="FinPage.exportar()">${icon('download')} Financeiro (CSV)</button>
        <button class="btn" onclick="ClientesPage.exportar()">${icon('download')} Clientes (CSV)</button>
        <button class="btn outline-gold" onclick="Pages.config.backup()">${icon('download')} Backup completo</button></div></div>`;
    $$('#rl-per button').forEach(b => b.onclick = () => { FinPage.st.periodo = b.dataset.k; App.refresh(); });
  },
  exportOS() {
    const [de, ate] = FinPage.range();
    const rows = [['Nº', 'Entrada', 'Cliente', 'Telefone', 'Aparelho', 'IMEI', 'Defeito', 'Serviço', 'Status', 'Valor', 'Custo peças', 'Pago em', 'Forma']];
    Store.db.os.filter(o => !o.deleted && dayKey(o.criadoEm) >= de && dayKey(o.criadoEm) <= ate).sort((a, b) => a.numero - b.numero).forEach(o => {
      const c = Store.cliente(o.clienteId) || {};
      rows.push([o.numero, fmtDate(o.criadoEm), c.nome, c.telefone, o.aparelho?.modelo, o.aparelho?.imei, o.defeito, o.servico, OS_STATUS[o.status].label, moneyInput(Store.osTotal(o)), moneyInput(Store.osCustoPecas(o)), fmtDate(o.pagoEm), FORMAS_PGTO[o.pagamento?.forma] || '']);
    });
    download(`os-${de}-a-${ate}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
  },
};

Pages.config = {
  render(main) {
    const s = Store.s;
    main.innerHTML = `
      ${pageHead('settings', 'Configurações', 'Dados da loja, metas, garantia, técnicos e backup.')}
      <div class="card mb" id="cf-loja">
        <h3>${icon('bag', 'sm')} Dados da <span class="gold">loja</span></h3>
        <p class="small muted" style="margin-top:0">Aparecem no cabeçalho da OS, garantia, orçamento e recibo.</p>
        ${field('Nome da loja', `<input class="input" name="loja" value="${esc(s.loja)}">`)}
        <div class="form-row collapse">${field('Seu nome (responsável)', `<input class="input" name="responsavel" value="${esc(s.responsavel)}">`)}${field('CNPJ / CPF', `<input class="input" name="cnpj" value="${esc(s.cnpj)}">`)}</div>
        <div class="form-row collapse">${field('Telefone / WhatsApp', `<input class="input" name="telefone" value="${esc(s.telefone)}">`)}${field('Instagram', `<input class="input" name="instagram" placeholder="@rbtechcelulares" value="${esc(s.instagram)}">`)}</div>
        ${field('Endereço', `<input class="input" name="endereco" value="${esc(s.endereco)}">`)}
        ${field('Link de avaliação no Google', `<input class="input" name="googleReview" placeholder="https://g.page/r/..." value="${esc(s.googleReview || '')}">`, { opt: true })}
        <h3 class="mt">${icon('trending', 'sm')} Metas e <span class="gold">taxas</span></h3>
        <div class="form-row">${field('Meta mensal (R$)', `<input class="input" name="metaMensal" inputmode="decimal" value="${moneyInput(s.metaMensal)}">`)}${field('Dias trabalhados/mês', `<input class="input" type="number" name="diasTrabalho" value="${s.diasTrabalho}">`)}</div>
        <p class="small muted" style="margin-top:-6px">Meta diária calculada: <b class="gold">${money(Store.metaDiaria())}</b></p>
        <div class="form-row">${field('Taxa débito (%)', `<input class="input" name="taxaDebito" inputmode="decimal" value="${String(s.taxaDebito).replace('.', ',')}">`)}${field('Taxa crédito (%)', `<input class="input" name="taxaCredito" inputmode="decimal" value="${String(s.taxaCredito).replace('.', ',')}">`)}</div>
        <h3 class="mt">${icon('shieldCheck', 'sm')} Garantia e <span class="gold">termos</span></h3>
        ${field('Garantia padrão (dias)', `<input class="input" type="number" name="garantiaDias" value="${s.garantiaDias}">`)}
        ${field('Termos da garantia', `<textarea class="input" name="termosGarantia">${esc(s.termosGarantia)}</textarea>`)}
        ${field('Termos da OS de entrada', `<textarea class="input" name="termosEntrada">${esc(s.termosEntrada)}</textarea>`)}
        <button class="btn primary block" id="cf-save">${icon('check')} Salvar configurações</button>
      </div>

      <div class="card mb">
        <h3>${icon('pen', 'sm')} Técnicos e <span class="gold">assinaturas</span></h3>
        <div class="row between mb"><div><b>Assinatura do dono</b><div class="xs muted">Usada quando o técnico não tem assinatura.</div></div>
          ${s.assinaturaDono ? `<img src="${s.assinaturaDono}" style="height:40px;background:#fff;border-radius:6px;padding:2px">` : ''}
          <button class="btn sm outline-gold" onclick="Pages.config.assinar(null)">${s.assinaturaDono ? 'Refazer' : 'Assinar'}</button></div>
        <div id="cf-tecs"></div>
        <div class="row mt"><input class="input" id="cf-tnome" placeholder="Nome do técnico"><button class="btn outline-gold" id="cf-tadd">${icon('plus')}</button></div>
      </div>

      <div class="card mb">
        <h3>${icon('users', 'sm')} Como o cliente <span class="gold">conheceu a loja</span></h3>
        <div class="row wrap mb" id="cf-orig">${s.origens.map((o, i) => `<span class="pill">${esc(o)} <button class="icon-btn" style="width:20px;height:20px" data-ro="${i}">${icon('x', 'sm')}</button></span>`).join('')}</div>
        <div class="row"><input class="input" id="cf-onome" placeholder="Nova opção"><button class="btn outline-gold" id="cf-oadd">${icon('plus')}</button></div>
      </div>

      <div class="card mb">
        <h3>${icon('download', 'sm')} Backup dos <span class="gold">dados</span></h3>
        <p class="small muted" style="margin-top:0">Os dados ficam salvos neste aparelho/navegador. <b class="gold">Faça backup com frequência</b> e guarde o arquivo no Google Drive ou WhatsApp. Para usar em outro aparelho, restaure o backup lá.</p>
        <div class="grid grid-2"><button class="btn primary" onclick="Pages.config.backup()">${icon('download')} Baixar backup</button>
        <label class="btn">${icon('upload')} Restaurar<input type="file" accept=".json,application/json" id="cf-restore" hidden></label></div>
        <p class="xs muted">Último backup: ${s.ultimoBackup ? fmtDateTime(s.ultimoBackup) : 'nunca'}</p>
      </div>

      ${Cloud.enabled && Cloud.loja ? `<div class="card mb" id="cf-equipe">
        <h3>${icon('users', 'sm')} Equipe e <span class="gold">nuvem</span></h3>
        <p class="small muted" style="margin-top:0">Os dados ficam salvos no Supabase e sincronizam em tempo real entre todos os aparelhos da equipe.</p>
        <div class="kv"><span class="k">Loja</span><span class="v">${esc(Cloud.loja.nome)}</span></div>
        <div class="kv"><span class="k">Seu acesso</span><span class="v">${Cloud.loja.papel === 'dono' ? '<span class="gold">Dono</span>' : 'Funcionário'}</span></div>
        <div class="kv"><span class="k">Sincronização</span><span class="v">${{ ok: '<span class="green">Em dia</span>', sync: 'Sincronizando...', offline: '<span class="red">Sem internet</span>', erro: '<span class="red">Erro</span>' }[Cloud.status] || '—'}</span></div>
        <div class="card mt" style="background:var(--gold-soft);border-color:rgba(212,175,55,.4)">
          <div class="lbl">Código de convite</div>
          <div class="row between"><b class="gold" style="font-size:26px;letter-spacing:.2em">${esc(Cloud.loja.codigo_convite || '—')}</b>
          <button class="btn sm" onclick="navigator.clipboard?.writeText('${esc(Cloud.loja.codigo_convite)}');toast('Código copiado')">Copiar</button></div>
          <div class="xs muted">O funcionário cria a conta dele no app e digita este código para entrar na equipe.</div>
          ${Cloud.loja.papel === 'dono' ? `<button class="btn sm ghost mt" onclick="Pages.config.novoCodigo()">${icon('repeat', 'sm')} Gerar novo código</button>` : ''}
        </div>
        <div class="lbl mt mb">Membros</div><div id="cf-membros"><p class="small muted">Carregando...</p></div>
        <button class="btn block mt" onclick="App.syncAgora()">${icon('repeat')} Sincronizar agora</button>
      </div>` : ''}

      <div class="card mb">
        <h3>${icon('lock', 'sm')} Acesso</h3>
        <div class="kv"><span class="k">E-mail</span><span class="v">${esc(App.userEmail())}</span></div>
        <div class="grid grid-2 mt"><button class="btn" onclick="Pages.config.senha()">${icon('lock')} Alterar senha</button><button class="btn" onclick="Pages.config.auditoria()">${icon('shield')} Auditoria</button></div>
        <button class="btn block mt" onclick="App.logout()">${icon('logout')} Sair</button>
      </div>

      <div class="card" style="border-color:rgba(248,113,113,.35)">
        <h3 class="red">Zona de perigo</h3>
        <button class="btn danger block" onclick="Pages.config.zerar()">${icon('trash')} Apagar todos os dados</button>
      </div>`;

    $('#cf-save').onclick = () => {
      const f = readForm($('#cf-loja'));
      Object.assign(s, f, { metaMensal: parseMoney(f.metaMensal), diasTrabalho: parseInt(f.diasTrabalho) || 26, taxaDebito: parseMoney(f.taxaDebito), taxaCredito: parseMoney(f.taxaCredito), garantiaDias: parseInt(f.garantiaDias) || 0 });
      Store.save(); toast('Configurações salvas'); $('.shell')?.remove(); App.render();
    };
    const renderTecs = () => {
      $('#cf-tecs').innerHTML = s.tecnicos.map(t => `<div class="cart-line"><div class="avatar">${esc(t.nome[0].toUpperCase())}</div><div class="grow"><b>${esc(t.nome)}</b><div class="xs ${t.assinatura ? 'gold' : 'muted'}">${t.assinatura ? '✓ Assinatura cadastrada' : 'Sem assinatura'}</div></div>
        <button class="btn sm" data-sig="${t.id}">${icon('pen', 'sm')}</button><button class="icon-btn" data-rt="${t.id}">${icon('trash', 'sm')}</button></div>`).join('') || '<p class="small muted">Nenhum técnico. Cadastre para identificar quem fez cada serviço.</p>';
      $$('[data-sig]').forEach(b => b.onclick = () => this.assinar(s.tecnicos.find(t => t.id === b.dataset.sig), renderTecs));
      $$('[data-rt]').forEach(b => b.onclick = () => { s.tecnicos = s.tecnicos.filter(t => t.id !== b.dataset.rt); Store.save(); renderTecs(); });
    };
    renderTecs();
    $('#cf-tadd').onclick = () => { const n = $('#cf-tnome').value.trim(); if (!n) return; s.tecnicos.push({ id: uid(), nome: n }); Store.save(); $('#cf-tnome').value = ''; renderTecs(); };
    $$('[data-ro]').forEach(b => b.onclick = () => { s.origens.splice(+b.dataset.ro, 1); Store.save(); App.refresh(); });
    $('#cf-oadd').onclick = () => { const n = $('#cf-onome').value.trim(); if (!n) return; s.origens.push(n); Store.save(); App.refresh(); };
    $('#cf-restore').onchange = e => this.restaurar(e.target.files[0]);
    if ($('#cf-membros')) this.renderMembros();
  },

  async renderMembros() {
    const box = $('#cf-membros');
    try {
      const ms = await Cloud.membros();
      const dono = Cloud.loja.papel === 'dono';
      box.innerHTML = ms.map(m => `<div class="cart-line"><div class="avatar">${esc((m.email || '?')[0].toUpperCase())}</div>
        <div class="grow"><b class="ellipsis" style="display:block">${esc(m.email || 'Sem e-mail')}${m.user_id === Cloud.user.id ? ' <span class="muted xs">(você)</span>' : ''}</b><div class="xs ${m.papel === 'dono' ? 'gold' : 'muted'}">${m.papel === 'dono' ? 'Dono' : 'Funcionário'} · desde ${fmtDate(m.criado_em)}</div></div>
        ${dono && m.papel !== 'dono' ? `<button class="icon-btn" title="Remover da equipe" data-rm="${m.user_id}">${icon('trash', 'sm')}</button>` : ''}</div>`).join('');
      $$('[data-rm]', box).forEach(b => b.onclick = async () => {
        if (!(await confirmDialog('Remover este funcionário da equipe? Ele perde o acesso aos dados da loja.', { danger: true, ok: 'Remover' }))) return;
        try { await Cloud.removerMembro(b.dataset.rm); toast('Removido da equipe'); this.renderMembros(); } catch (e) { toast(e.message, true); }
      });
    } catch (e) { box.innerHTML = `<p class="small red">Não foi possível carregar (sem internet?).</p>`; }
  },
  async novoCodigo() {
    if (!(await confirmDialog('Gerar um novo código? O código atual deixa de funcionar (quem já está na equipe continua).', { ok: 'Gerar' }))) return;
    try { await Cloud.novoCodigo(); App.cacheLoja(); App.refresh(); } catch (e) { toast(e.message, true); }
  },

  assinar(tec, done) {
    openModal({
      title: tec ? `Assinatura de ${tec.nome}` : 'Assinatura do dono', icon: 'pen',
      body: `<p class="small muted" style="margin-top:0">Assine com o dedo no quadro abaixo.</p><canvas class="sig-pad" id="as-pad"></canvas>`,
      foot: `<button class="btn" id="as-clear">Limpar</button><button class="btn primary" id="as-ok">${icon('check')} Salvar assinatura</button>`,
      onMount: (el, m) => {
        const pad = signaturePad($('#as-pad', el));
        $('#as-clear', el).onclick = () => pad.clear();
        $('#as-ok', el).onclick = () => {
          if (pad.isEmpty()) return toast('Assinatura vazia', true);
          if (tec) tec.assinatura = pad.toDataURL(); else Store.s.assinaturaDono = pad.toDataURL();
          Store.save(); m.close(); toast('Assinatura salva');
          if (done) done(); else if (App.route === 'config') App.refresh();
        };
      },
    });
  },

  backup() {
    const data = JSON.parse(JSON.stringify(Store.db)); delete data.auth;
    Store.s.ultimoBackup = nowISO(); Store.save();
    download(`backup-rbtech-${dayKey()}.json`, JSON.stringify(data));
    toast('Backup gerado');
  },
  restaurar(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d.os || !d.clientes || !d.settings) throw new Error('arquivo inválido');
        if (!(await confirmDialog(`Restaurar backup com ${d.os.length} OS e ${d.clientes.length} clientes? Os dados atuais ${Cloud.loja ? 'da loja (em todos os aparelhos da equipe)' : 'deste aparelho'} serão substituídos.`, { danger: true, ok: 'Restaurar' }))) return;
        d.auth = Store.db.auth; d.lojaId = Store.db.lojaId;
        localStorage.setItem(DB_KEY, JSON.stringify(d)); Store.load(); Store.save();
        toast('Backup restaurado'); $('.shell')?.remove(); App.render();
      } catch (e) { toast('Não foi possível ler o backup: ' + e.message, true); }
    };
    rd.readAsText(file);
  },
  // recovery = veio do link "esqueci a senha" do e-mail
  senha(recovery = false) {
    const nuvem = Cloud.enabled;
    openModal({
      title: recovery ? 'Defina sua nova senha' : 'Alterar senha', icon: 'lock',
      body: `${nuvem ? '' : field('Senha atual', '<input class="input" type="password" id="pw-a">')}${field('Nova senha', '<input class="input" type="password" id="pw-n">')}${field('Confirmar nova senha', '<input class="input" type="password" id="pw-c">')}`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="pw-ok">Salvar</button>`,
      onMount: (el, m) => $('#pw-ok', el).onclick = async () => {
        const n = $('#pw-n', el).value, min = nuvem ? 6 : 4;
        if (n.length < min) return toast(`Mínimo de ${min} caracteres`, true);
        if (n !== $('#pw-c', el).value) return toast('As senhas não conferem', true);
        if (nuvem) {
          try { await Cloud.novaSenha(n); } catch (e) { return toast(e.message, true); }
        } else {
          if ((await sha256($('#pw-a', el).value)) !== Store.db.auth.hash) return toast('Senha atual incorreta', true);
          Store.db.auth.hash = await sha256(n); Store.save();
        }
        m.close(); toast('Senha alterada');
        if (recovery && Cloud.user && !Cloud.loja) { await App.bootCloud(); App.render(); }
      },
    });
  },
  auditoria() {
    openModal({
      title: 'Auditoria', icon: 'shield', subtitle: 'Últimas ações registradas no sistema', wide: true,
      body: Store.db.auditoria.length ? `<div class="timeline">${Store.db.auditoria.slice(0, 300).map(a => `<div class="ev"><b>${esc(a.acao)}</b> <span class="muted">· ${fmtDateTime(a.data)}</span><div class="xs muted">${esc(a.detalhe || '')}</div></div>`).join('')}</div>` : '<div class="empty">Nenhuma ação registrada.</div>',
    });
  },
  async zerar() {
    if (!(await confirmDialog(`Apagar TODOS os dados (OS, clientes, estoque, financeiro)${Cloud.loja ? ' da loja, inclusive na nuvem e nos aparelhos da equipe' : ''}? Faça um backup antes. Esta ação não pode ser desfeita.`, { danger: true, ok: 'Apagar tudo' }))) return;
    if (!(await confirmDialog('Tem certeza absoluta?', { danger: true, ok: 'Sim, apagar' }))) return;
    const { auth, lojaId } = Store.db; Store.db = defaultDB(); Store.db.auth = auth; Store.db.lojaId = lojaId; Store.save();
    toast('Dados apagados'); $('.shell')?.remove(); App.render();
  },
};
