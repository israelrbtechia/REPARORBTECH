/* Pós-Venda, Serviços, Relatórios e Configurações */

/* Pós-Venda: feedback após 7 dias e oferta de capa/película após 30 dias,
   para reparos entregues (OS pagas) e vendas de aparelhos */
// Modelos de mensagem do pós-venda (cada um pode ser personalizado em Pós-Venda)
const MSG_MODELOS = {
  feedbackReparo: {
    campo: 'msgFeedbackReparo', titulo: 'Feedback de reparo (7 dias)', icone: 'wrench',
    exemplo: { tipo: 'os', cliente: { nome: 'Maria Souza' }, aparelho: 'Samsung A51', dias: 7, motivo: 'o reparo do seu' },
    padrao: 'Olá {nome}! Aqui é da {loja} 😊\n\nJá faz {dias} dias que consertamos seu *{aparelho}*. Está tudo funcionando direitinho depois do reparo?\n\nLembrando que o serviço tem *garantia de 3 meses*: qualquer coisa, é só chamar! 💛{avaliacao}',
  },
  feedbackCompra: {
    campo: 'msgFeedbackCompra', titulo: 'Feedback de compra de celular (7 dias)', icone: 'phone',
    exemplo: { tipo: 'venda', cliente: { nome: 'Maria Souza' }, aparelho: 'iPhone 13', dias: 7, motivo: 'a compra do seu' },
    padrao: 'Olá {nome}! Aqui é da {loja} 😊\n\nJá faz {dias} dias que você está com seu *{aparelho}*. Está gostando? Bateria, câmera e tudo mais funcionando certinho?\n\nSeu aparelho tem *garantia de 6 meses* com a gente. Qualquer dúvida, é só chamar! 💛{avaliacao}',
  },
  oferta: {
    campo: 'msgOferta', titulo: 'Oferta de capa e película (30 dias)', icone: 'tag',
    exemplo: { tipo: 'venda', cliente: { nome: 'Maria Souza' }, aparelho: 'iPhone 13', dias: 30, motivo: 'a compra do seu' },
    padrao: 'Olá {nome}! Aqui é da {loja} 📱\n\nPara manter seu *{aparelho}* sempre protegido, separamos uma condição especial pra você: *capa + película com {desconto} de desconto* 🛡️\n\nQuer que eu separe? É só responder aqui!',
  },
};

const PosVenda = {
  // Reparos entregues e vendas de aparelhos, com a data de referência
  compras() {
    const out = [], hoje = new Date();
    for (const o of Store.db.os) {
      if (o.deleted || o.status !== 'pago') continue;
      const data = o.entregueEm || o.pagoEm; if (!data) continue;
      out.push({ key: 'os:' + o.id, tipo: 'os', ref: o, cliente: Store.cliente(o.clienteId), aparelho: o.aparelho?.modelo || 'aparelho', data, dias: daysBetween(data, hoje), titulo: `Reparo · OS #${o.numero}`, motivo: 'o reparo do seu' });
    }
    for (const v of Store.db.vendas) {
      if (v.cancelada) continue;
      const aps = v.itens.filter(i => i.seminovo || i.aparelho); if (!aps.length) continue;
      const c = v.clienteId ? Store.cliente(v.clienteId) : null;
      out.push({ key: 'venda:' + v.id, tipo: 'venda', ref: v, cliente: c, nomeAvulso: v.clienteNome, aparelho: aps.map(i => i.nome).join(' e '), data: v.data, dias: daysBetween(v.data, hoje), titulo: `Compra · Venda #${v.numero}`, motivo: 'a compra do seu' });
    }
    return out.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  },
  estado(ref) {
    if (typeof ref.posVenda === 'string') ref.posVenda = { feedback: ref.posVenda }; // formato antigo
    return ref.posVenda || {};
  },
  feedback() { return this.compras().filter(x => x.dias >= 7 && x.dias <= 60 && !this.estado(x.ref).feedback); },
  oferta() { return this.compras().filter(x => x.dias >= 30 && x.dias <= 120 && !this.estado(x.ref).oferta); },
  pendentes() { return this.feedback().length + this.oferta().length; },

  // Reparo e compra de celular têm mensagens de feedback diferentes
  modelo(tipo, x) { return tipo === 'oferta' ? 'oferta' : x.tipo === 'os' ? 'feedbackReparo' : 'feedbackCompra'; },
  mensagem(tipo, x) {
    const s = Store.s, md = MSG_MODELOS[this.modelo(tipo, x)];
    const nome = String(x.cliente?.nome || x.nomeAvulso || '').split(' ')[0];
    const tpl = s[md.campo] || md.padrao;
    return tpl.replace(/\{nome\}/g, nome).replace(/\{loja\}/g, s.loja).replace(/\{aparelho\}/g, x.aparelho).replace(/\{dias\}/g, x.dias)
      .replace(/\{motivo\}/g, x.motivo).replace(/\{desconto\}/g, s.descontoOferta || '10%')
      .replace(/\{avaliacao\}/g, s.googleReview ? `\n\nSe puder, deixe sua avaliação no Google, ajuda muito: ${s.googleReview}` : '')
      .replace(/Olá !/g, 'Olá!').replace(/\n{3,}/g, '\n\n').trim();
  },
};

Pages.posvenda = {
  tab: 'feedback',
  render(main) {
    const s = Store.s;
    const os = Store.db.os.filter(o => !o.deleted);
    const hoje = new Date();
    const feedback = PosVenda.feedback(), oferta = PosVenda.oferta();
    const garantias = [
      ...os.filter(o => ['concluido', 'pago'].includes(o.status) && Store.garantiaFim(o)).map(o => ({ c: Store.cliente(o.clienteId), fim: Store.garantiaFim(o), ap: o.aparelho?.modelo, ref: `OS #${o.numero}`, tipo: 'serviço' })),
      ...Store.db.vendas.filter(v => !v.cancelada).flatMap(v => v.itens.filter(i => i.seminovo).map(i => ({ c: v.clienteId ? Store.cliente(v.clienteId) : null, fim: addDays(v.data, GARANTIA_SEMINOVO_DIAS), ap: i.nome, ref: `Venda #${v.numero}`, tipo: 'aparelho' }))),
    ].filter(g => { const d = daysBetween(hoje, g.fim); return d >= 0 && d <= 10; });
    const paradas = os.filter(o => o.status === 'concluido' && daysBetween(o.concluidoEm || o.criadoEm, hoje) >= 3);
    const mes = pad(hoje.getMonth() + 1);
    const aniver = Store.clientesAtivos().filter(c => c.nascimento && c.nascimento.slice(5, 7) === mes).sort((a, b) => a.nascimento.slice(8).localeCompare(b.nascimento.slice(8)));
    const tabs = [['feedback', 'Feedback · 7 dias', feedback.length], ['oferta', 'Capa/película · 30 dias', oferta.length], ['retirada', 'Não retirados', paradas.length], ['garantia', 'Garantia acabando', garantias.length], ['aniver', 'Aniversariantes', aniver.length]];
    const nome = c => (c?.nome || '').split(' ')[0];
    const row = (c, title, sub, msg) => `<div class="item" style="cursor:default"><div class="row"><div class="avatar">${esc((c?.nome || '?')[0].toUpperCase())}</div>
      <div class="grow"><b>${esc(title)}</b><div class="small muted">${sub}</div></div>
      ${c?.telefone ? `<a class="btn sm success" target="_blank" href="${waLink(c.telefone, msg)}">${icon('whatsapp', 'sm')}</a>` : '<span class="xs muted">sem tel.</span>'}</div></div>`;

    let body = '';
    if (this.tab === 'feedback' || this.tab === 'oferta') body = this.campanha(this.tab, this.tab === 'feedback' ? feedback : oferta);
    else {
      let list = '';
      if (this.tab === 'retirada') list = paradas.map(o => { const c = Store.cliente(o.clienteId); return row(c, c?.nome, `OS #${o.numero} · ${esc(o.aparelho?.modelo)} · pronto há ${daysBetween(o.concluidoEm || o.criadoEm, hoje)} dias · ${money(Store.osTotal(o))}`, OSPage.msgPronto(o, c)); }).join('');
      if (this.tab === 'garantia') list = garantias.map(g => row(g.c, g.c?.nome || 'Consumidor', `${g.ref} · ${esc(g.ap)} · garantia do ${g.tipo} até ${fmtDate(g.fim)}`, `Olá ${nome(g.c)}! Aqui é da ${s.loja}.\n\nA garantia do seu *${g.ap}* vence em ${fmtDate(g.fim)}. Está tudo funcionando bem? Se notar algo, traga para avaliarmos sem custo antes do vencimento!`)).join('');
      if (this.tab === 'aniver') list = aniver.map(c => row(c, c.nome, `🎂 ${c.nascimento.slice(8)}/${mes}`, `Feliz aniversário, ${nome(c)}! 🎉🎂\n\nA equipe ${s.loja} deseja muitas felicidades! Como presente, você tem *10% de desconto* em qualquer serviço ou acessório este mês.`)).join('');
      body = `<div class="card pad-0">${list || `<div class="empty">${icon('checkCircle')}<div>Nada pendente aqui. 👌</div></div>`}</div>`;
    }

    main.innerHTML = `
      ${pageHead('chat', 'Pós-Venda', 'Fidelize clientes de reparos e de vendas de aparelhos com a mensagem certa, na hora certa.')}
      <div class="tabs mb" id="pv-tabs">${tabs.map(([k, l, n]) => `<button data-k="${k}" class="${this.tab === k ? 'on' : ''}">${l} ${n ? `<span class="pill gold xs" style="padding:1px 7px">${n}</span>` : ''}</button>`).join('')}</div>
      ${body}`;
    $$('#pv-tabs button').forEach(b => b.onclick = () => { this.tab = b.dataset.k; App.refresh(); });
  },

  campanha(tipo, lista) {
    const fb = tipo === 'feedback';
    const enviados = PosVenda.compras().filter(x => PosVenda.estado(x.ref)[tipo] && PosVenda.estado(x.ref)[tipo] !== 'pulado')
      .sort((a, b) => String(PosVenda.estado(b.ref)[tipo]).localeCompare(String(PosVenda.estado(a.ref)[tipo]))).slice(0, 15);
    return `
      <div class="card mb">
        <div class="row" style="align-items:flex-start"><div class="stat-icon"><div class="ic">${icon(fb ? 'star' : 'tag')}</div></div>
          <div class="grow"><b>${fb ? 'Como está indo o aparelho?' : 'Oferta de capa e película'}</b>
          <div class="small muted">${fb ? 'Clientes com <b>7 dias ou mais</b> desde o reparo entregue ou a compra do aparelho.' : 'Clientes com <b>30 dias ou mais</b> desde o reparo ou a compra: ofereça proteção para o aparelho.'} Toque em <b class="green">Enviar</b>: o WhatsApp abre com a mensagem pronta e o cliente sai da lista.</div></div></div>
        ${Cloud.ehDono() ? `<div class="row wrap mt">${(fb ? [['feedbackReparo', 'Mensagem p/ reparo'], ['feedbackCompra', 'Mensagem p/ compra de celular']] : [['oferta', 'Personalizar mensagem']])
          .map(([k, l]) => `<button class="btn sm outline-gold" onclick="Pages.posvenda.editarMsg('${k}')">${icon(MSG_MODELOS[k].icone, 'sm')} ${l}</button>`).join('')}</div>` : ''}
      </div>
      <div class="card pad-0 mb"><div class="list-head"><b>${lista.length} cliente(s) para ${fb ? 'pedir feedback' : 'oferecer capa/película'}</b>${(() => { const n = PosVenda.compras().filter(x => { const v = PosVenda.estado(x.ref)[tipo]; return v && v !== 'pulado' && dayKey(v) === dayKey(); }).length; return n ? `<span class="pill green">✓ ${n} enviado${n > 1 ? 's' : ''} hoje</span>` : ''; })()}</div>
      ${lista.map(x => {
        const c = x.cliente, n = c?.nome || x.nomeAvulso || 'Cliente sem cadastro';
        return `<div class="item" style="cursor:default"><div class="row">
          <div class="avatar">${esc(n[0].toUpperCase())}</div>
          <div class="grow" style="min-width:0"><b class="ellipsis" style="display:block">${esc(n)}</b>
            <div class="small gold ellipsis">${esc(x.aparelho)}</div>
            <span class="pill xs ${x.tipo === 'os' ? 'purple' : 'gold'}" style="margin:3px 0">${x.tipo === 'os' ? 'Reparo' : 'Compra de celular'}</span>
            <div class="xs muted">${x.titulo} · há ${x.dias} dias (${fmtDate(x.data)})</div></div>
          <div class="col" style="gap:6px;align-items:flex-end">
            ${c?.telefone ? `<a class="btn sm success" target="_blank" rel="noopener" href="${esc(waLink(c.telefone, PosVenda.mensagem(tipo, x)))}" onclick="Pages.posvenda.enviado('${tipo}','${x.key}')">${icon('whatsapp', 'sm')} Enviar</a>`
              : c ? `<button class="btn sm outline-gold" onclick="Pages.posvenda.addTelefone('${c.id}')">${icon('plus', 'sm')} WhatsApp</button>` : '<span class="xs muted">sem cadastro</span>'}
            <button class="btn sm ghost" style="min-height:28px;padding:2px 8px" onclick="Pages.posvenda.marcar('${tipo}','${x.key}','pulado')">Pular</button>
          </div></div></div>`;
      }).join('') || `<div class="empty">${icon('checkCircle')}<div>Ninguém pendente. Volte amanhã! 👌</div></div>`}</div>
      ${enviados.length ? `<details class="card"><summary class="bold" style="cursor:pointer">${icon('history', 'sm')} Enviados recentemente</summary>
        ${enviados.map(x => `<div class="cart-line"><div class="grow"><b>${esc(x.cliente?.nome || x.nomeAvulso || '')}</b><div class="xs muted">${esc(x.aparelho)} · enviado ${fmtDateTime(PosVenda.estado(x.ref)[tipo])}</div></div>
          <button class="btn sm ghost" onclick="Pages.posvenda.marcar('${tipo}','${x.key}',null)">${icon('undo', 'sm')} Desfazer</button></div>`).join('')}</details>` : ''}`;
  },

  achar(key) { return PosVenda.compras().find(x => x.key === key); },

  // Um clique: o link abre o WhatsApp com a mensagem e o cliente já conta como enviado
  // (marca e salva na nuvem na hora, antes do celular trocar para o WhatsApp)
  enviado(tipo, key) {
    const x = this.achar(key); if (!x) return;
    const st = PosVenda.estado(x.ref); st[tipo] = nowISO(); x.ref.posVenda = st;
    Store.save(true); Cloud.schedule?.(0);
    toast(`${tipo === 'feedback' ? 'Feedback' : 'Oferta'} enviado para ${(x.cliente?.nome || '').split(' ')[0]} ✓`);
    setTimeout(() => App.refresh(), 400); // deixa o link abrir antes de redesenhar a lista
  },
  enviar(tipo, key) {
    const x = this.achar(key); if (!x) return;
    this.enviado(tipo, key);
    window.open(waLink(x.cliente.telefone, PosVenda.mensagem(tipo, x)), '_blank');
  },
  marcar(tipo, key, valor, silencioso) {
    const x = this.achar(key); if (!x) return;
    const st = PosVenda.estado(x.ref);
    if (valor) st[tipo] = valor; else delete st[tipo];
    x.ref.posVenda = st;
    Store.save(); App.refresh();
    if (!silencioso) toast(valor === 'pulado' ? 'Cliente pulado' : valor ? 'Marcado como enviado' : 'Voltou para a lista');
  },
  addTelefone(clienteId) {
    const c = Store.cliente(clienteId);
    openModal({
      title: 'WhatsApp do cliente', icon: 'phone', subtitle: c.nome,
      body: field('WhatsApp / Telefone', '<input class="input" id="pt-tel" type="tel" inputmode="tel" placeholder="(47) 99999-9999">'),
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="pt-ok">Salvar</button>`,
      onMount: (el, m) => { $('#pt-tel', el).focus(); $('#pt-ok', el).onclick = () => { const d = onlyDigits($('#pt-tel', el).value); if (d.length < 10) return toast('Telefone inválido', true); c.telefone = d; Store.saveCliente(c); m.close(); App.refresh(); toast('Telefone salvo'); }; },
    });
  },
  editarMsg(chave) {
    if (!Cloud.ehDono()) return toast('Somente o dono altera as mensagens', true);
    const s = Store.s, md = MSG_MODELOS[chave], oferta = chave === 'oferta';
    const tipo = oferta ? 'oferta' : 'feedback';
    openModal({
      title: md.titulo, icon: 'edit',
      body: `<p class="small muted" style="margin-top:0">Variáveis: <b class="gold">{nome}</b> primeiro nome · <b class="gold">{aparelho}</b> · <b class="gold">{dias}</b> · <b class="gold">{loja}</b>${oferta ? ' · <b class="gold">{desconto}</b>' : ' · <b class="gold">{avaliacao}</b> link do Google'}. Use *texto* para negrito no WhatsApp.</p>
        ${field('Mensagem', `<textarea class="input" id="pm-txt" style="min-height:190px">${esc(s[md.campo] || md.padrao)}</textarea>`)}
        ${oferta ? field('Desconto oferecido', `<input class="input" id="pm-desc" value="${esc(s.descontoOferta || '10%')}" placeholder="Ex: 10%, R$ 15">`) : ''}
        <div class="lbl mb">Prévia</div><div class="card" id="pm-prev" style="white-space:pre-wrap;background:#0b1a12;border-color:#1f3d2b"></div>`,
      foot: `<button class="btn" id="pm-reset">Restaurar padrão</button><button class="btn primary" id="pm-ok">${icon('check')} Salvar</button>`,
      onMount: (el, m) => {
        const prev = () => {
          const old = s[md.campo], oldD = s.descontoOferta;
          s[md.campo] = $('#pm-txt', el).value; if ($('#pm-desc', el)) s.descontoOferta = $('#pm-desc', el).value;
          $('#pm-prev', el).textContent = PosVenda.mensagem(tipo, md.exemplo);
          s[md.campo] = old; s.descontoOferta = oldD;
        };
        $('#pm-txt', el).oninput = prev; if ($('#pm-desc', el)) $('#pm-desc', el).oninput = prev; prev();
        $('#pm-reset', el).onclick = () => { $('#pm-txt', el).value = md.padrao; prev(); };
        $('#pm-ok', el).onclick = () => { s[md.campo] = $('#pm-txt', el).value.trim(); if ($('#pm-desc', el)) s.descontoOferta = $('#pm-desc', el).value.trim(); Store.save(); m.close(); App.refresh(); toast('Mensagem salva'); };
      },
    });
  },
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
        return `<div class="item" onclick="Pages.servicos.editar('${s.id}')"><div class="row"><div class="grow"><b>${esc(s.nome)}</b><div class="small muted">${esc(s.categoria || '')} · garantia 3 meses · ${n} OS</div></div><div class="price">${money(s.preco)}</div></div></div>`;
      }).join('') || `<div class="empty">${icon('wrench')}<div>Nenhum serviço cadastrado.</div></div>`}</div>`;
    const q = $('#sv-q'); q.oninput = e => { this.q = e.target.value; App.refresh(); setTimeout(() => { const n = $('#sv-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); };
  },
  editar(id) {
    const s = id ? { ...Store.db.servicos.find(x => x.id === id) } : {};
    openModal({
      title: id ? 'Editar serviço' : 'Novo serviço', icon: 'wrench',
      body: `${field('Nome', `<input class="input" id="s-n" placeholder="Ex: Troca de tela iPhone 11" value="${esc(s.nome || '')}">`, { req: true })}
        <div class="form-row">${field('Preço (R$)', `<input class="input" id="s-p" inputmode="decimal" value="${s.preco ? moneyInput(s.preco) : ''}">`)}<div class="field"><label>Garantia</label><div class="input" style="display:flex;align-items:center;color:var(--gold);font-weight:700">3 meses</div></div></div>
        ${field('Categoria', `<input class="input" id="s-c" placeholder="Ex: Tela, Bateria, Software" value="${esc(s.categoria || '')}">`, { opt: true })}`,
      foot: `${id ? `<button class="btn danger" id="s-del">${icon('trash')}</button>` : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="s-ok">${icon('check')} Salvar</button>`,
      onMount: (el, m) => {
        $('#s-ok', el).onclick = () => {
          const nome = $('#s-n', el).value.trim(); if (!nome) return toast('Informe o nome', true);
          Object.assign(s, { nome, preco: parseMoney($('#s-p', el).value), categoria: $('#s-c', el).value.trim() });
          if (!id) { s.id = uid(); Store.db.servicos.push(s); } else Store.db.servicos[Store.db.servicos.findIndex(x => x.id === id)] = s;
          Store.save(); m.close(); App.refresh(); toast('Serviço salvo');
        };
        const d = $('#s-del', el); if (d) d.onclick = () => { Store.db.servicos.find(x => x.id === id).deleted = true; Store.save(); m.close(); App.refresh(); };
      },
    });
  },
  exemplos() {
    [['Troca de tela', 350, 'Tela'], ['Troca de bateria', 180, 'Bateria'], ['Troca de conector de carga', 150, 'Carga'], ['Reparo flex de carga', 150, 'Carga'], ['Troca de vidro traseiro', 250, 'Carcaça'], ['Troca de câmera traseira', 280, 'Câmera'], ['Limpeza de oxidação', 120, 'Placa'], ['Reparo de placa', 400, 'Placa'], ['Atualização / formatação', 80, 'Software'], ['Desbloqueio de conta', 150, 'Software'], ['Troca de alto-falante', 120, 'Áudio'], ['Troca de botão power/volume', 130, 'Botões']]
      .forEach(([nome, preco, categoria]) => Store.db.servicos.push({ id: uid(), nome, preco, categoria }));
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
    const s = Store.s, dono = Cloud.ehDono();
    main.innerHTML = `
      ${pageHead('settings', 'Configurações', 'Dados da loja, metas, garantia, técnicos e backup.')}
${dono ? `      <div class="card mb" id="cf-loja">
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
        <div class="grid grid-2 mb"><div class="stat"><div class="label">Reparos</div><div class="value gold">3 meses</div><div class="sub">sempre, a partir da conclusão</div></div>
          <div class="stat"><div class="label">Seminovos</div><div class="value gold">6 meses</div><div class="sub">sempre, a partir da venda</div></div></div>
        ${field('Termos da garantia de reparos', `<textarea class="input" name="termosGarantia">${esc(s.termosGarantia)}</textarea>`)}
        ${field('Termos da garantia de aparelhos seminovos', `<textarea class="input" name="termosGarantiaSeminovo">${esc(s.termosGarantiaSeminovo || '')}</textarea>`)}
        ${field('Termos da garantia de celulares novos e acessórios (recibo)', `<textarea class="input" name="termosGarantiaProduto">${esc(s.termosGarantiaProduto || '')}</textarea>`)}
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
        <h3>${icon('upload', 'sm')} Importar do <span class="gold">sistema antigo</span></h3>
        <p class="small muted" style="margin-top:0">Arquivos exportados do Reparo Pro. Nada é duplicado: pode importar de novo quando quiser.</p>
        <label class="btn primary block mb">${icon('users')} Lista de clientes (PDF) — com telefones<input type="file" accept=".pdf,application/pdf" id="cf-clipdf" hidden></label>
        <label class="btn outline-gold block">${icon('upload')} Dossiê de auditoria (CSV) — OS, vendas, estoque<input type="file" accept=".csv,text/csv" id="cf-dossie" hidden></label>
      </div>
` : `
      <div class="card mb" style="border-color:rgba(212,175,55,.45)">
        <h3>${icon('lock', 'sm')} Dados da <span class="gold">loja</span></h3>
        <p class="small muted" style="margin-top:0">Somente o dono altera as informações da loja, metas, garantias e técnicos.</p>
        <div class="kv"><span class="k">Loja</span><span class="v">${esc(s.loja || '—')}</span></div>
        <div class="kv"><span class="k">Telefone</span><span class="v">${esc(s.telefone || '—')}</span></div>
        <div class="kv"><span class="k">Endereço</span><span class="v">${esc(s.endereco || '—')}</span></div>
        <div class="kv"><span class="k">Instagram</span><span class="v">${esc(s.instagram || '—')}</span></div>
      </div>

`}

      <div class="card mb">
        <h3>${icon('download', 'sm')} Backup dos <span class="gold">dados</span></h3>
        <p class="small muted" style="margin-top:0">Os dados ficam salvos neste aparelho/navegador. <b class="gold">Faça backup com frequência</b> e guarde o arquivo no Google Drive ou WhatsApp. Para usar em outro aparelho, restaure o backup lá.</p>
        <div class="grid grid-2"><button class="btn primary" onclick="Pages.config.backup()">${icon('download')} Baixar backup</button>
        ${dono ? `<label class="btn">${icon('upload')} Restaurar<input type="file" accept=".json,application/json" id="cf-restore" hidden></label>` : ''}</div>
        <p class="xs muted">Último backup: ${s.ultimoBackup ? fmtDateTime(s.ultimoBackup) : 'nunca'}</p>
      </div>

      ${Pedidos.link() ? `<div class="card mb">
        <h3>${icon('chat', 'sm')} Link de <span class="gold">pedido de orçamento</span></h3>
        <p class="small muted" style="margin-top:0">Coloque na bio do Instagram, no status e no WhatsApp. O cliente preenche nome, WhatsApp, marca, modelo, defeito e urgência, e o pedido aparece na hora em <b>OS → Pedidos</b>.</p>
        <div class="input" style="display:flex;align-items:center;font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(Pedidos.link())}</div>
        <div class="grid grid-2 mt"><button class="btn" onclick="Pedidos.copiarLink()">${icon('repeat')} Copiar link</button><a class="btn" target="_blank" href="${esc(Pedidos.link())}">${icon('eye')} Abrir</a></div>
      </div>` : ''}

      ${Cloud.enabled && Cloud.loja ? `<div class="card mb" id="cf-equipe">
        <h3>${icon('users', 'sm')} Equipe e <span class="gold">nuvem</span></h3>
        <p class="small muted" style="margin-top:0">Os dados ficam salvos no Supabase e sincronizam em tempo real entre todos os aparelhos da equipe.</p>
        <div class="kv"><span class="k">Loja</span><span class="v">${esc(Cloud.loja.nome)} <span class="muted xs">#${esc(String(Cloud.loja.id).slice(0, 6))}</span></span></div>
        <div class="kv"><span class="k">Seu acesso</span><span class="v">${Cloud.loja.papel === 'dono' ? '<span class="gold">Dono</span>' : 'Funcionário'}</span></div>
        <div class="kv"><span class="k">Sincronização</span><span class="v">${{ ok: '<span class="green">Em dia</span>', sync: 'Sincronizando...', offline: '<span class="red">Sem internet</span>', erro: '<span class="red">Erro</span>' }[Cloud.status] || '—'}</span></div>
        <div class="lbl mt mb">Quem tem acesso</div><div id="cf-membros"><p class="small muted">Carregando...</p></div>
        ${Cloud.loja.papel === 'dono' ? `<form class="card mt" id="cf-func" style="background:#0a0a0a">
          <div class="section-title">${icon('userPlus', 'sm')} Adicionar funcionário</div>
          <p class="xs muted" style="margin-top:-6px">Crie o login dele aqui. Ele entra no app com este e-mail e senha e vê as mesmas telas que você.</p>
          ${field('Nome', '<input class="input" name="fnome" placeholder="Ex: João" required>')}
          ${field('E-mail (login)', '<input class="input" name="femail" type="email" placeholder="joao@email.com" required autocomplete="off">')}
          ${field('Senha', `<div class="input-icon">${icon('lock')}<input class="input" name="fsenha" type="text" minlength="6" placeholder="Mínimo 6 caracteres" required autocomplete="new-password"></div>`)}
          <button class="btn primary block">${icon('plus')} Criar acesso do funcionário</button>
        </form>
        <details class="mt"><summary class="small muted" style="cursor:pointer">Outra forma: código de convite</summary>
          <div class="card mt" style="background:var(--gold-soft);border-color:rgba(212,175,55,.4)">
            <div class="row between"><b class="gold" style="font-size:24px;letter-spacing:.2em">${esc(Cloud.loja.codigo_convite || '—')}</b>
            <button type="button" class="btn sm" onclick="navigator.clipboard?.writeText('${esc(Cloud.loja.codigo_convite)}');toast('Código copiado')">Copiar</button></div>
            <div class="xs muted">O funcionário cria a própria conta no app e digita este código.</div>
            <button type="button" class="btn sm ghost mt" onclick="Pages.config.novoCodigo()">${icon('repeat', 'sm')} Gerar novo código</button>
          </div></details>` : ''}
        <button class="btn block mt" onclick="App.syncAgora()">${icon('repeat')} Sincronizar agora</button>
      </div>` : ''}

      ${Cloud.enabled && Cloud.loja ? `<div class="card mb" id="cf-email">
        <h3>${icon('bell', 'sm')} Aviso de pedidos por <span class="gold">e-mail</span></h3>
        <p class="small muted" style="margin-top:0">Quando um cliente envia um pedido de orçamento pelo link, o pedido aparece no app de todos da equipe e também chega no <b>e-mail de cada um</b> que estiver com o sino ligado na lista acima.</p>
        <div id="cf-email-st" class="small muted">Carregando...</div>
        ${Cloud.loja.papel === 'dono' ? `<form id="cf-email-f" class="mt">
          ${field('E-mail remetente (o mesmo cadastrado no Brevo)', `<input class="input" name="remetente" type="email" value="${esc(App.userEmail())}" required>`)}
          ${field('Chave de API do Brevo', '<input class="input" name="chave" type="password" autocomplete="off" placeholder="xkeysib-...">')}
          <label class="check" style="padding:4px 0 10px"><input type="checkbox" name="ativo" checked> Enviar avisos por e-mail</label>
          <div class="grid grid-2"><button class="btn primary">${icon('check')} Salvar</button><button type="button" class="btn" id="cf-email-teste">${icon('send')} Enviar teste</button></div>
          <details class="mt"><summary class="small muted" style="cursor:pointer">Como pegar a chave (grátis, 2 minutos)</summary>
            <ol class="small" style="padding-left:18px;line-height:1.6">
              <li>Crie uma conta grátis em <a href="https://www.brevo.com" target="_blank" class="gold">brevo.com</a> com o e-mail da loja.</li>
              <li>Menu do perfil → <b>SMTP & API</b> → aba <b>API Keys</b> → <b>Generate a new API key</b>.</li>
              <li>Copie a chave (começa com <b>xkeysib-</b>), cole aqui e toque em Salvar.</li>
              <li>Toque em <b>Enviar teste</b> e veja se chegou (confira o spam na primeira vez).</li>
            </ol>
            <p class="xs muted">A chave fica guardada só no banco do Supabase: o app não mostra ela de volta. Grátis até 300 e-mails por dia.</p>
          </details>
        </form>` : ''}
      </div>` : ''}

      ${!Cloud.enabled ? `<div class="card mb" style="border-color:rgba(251,146,60,.45)">
        <h3>${icon('alert', 'sm')} Nuvem <span class="red">desligada</span></h3>
        <p class="small" style="margin:0">Os dados estão salvos <b>só neste aparelho e navegador</b>. Funcionários, outros celulares e outros navegadores <b>não</b> veem estas informações.</p>
        <p class="small muted">Para salvar na nuvem, ter login de funcionários e acessar de qualquer aparelho, configure o Supabase (passo a passo no README do projeto). Até lá, use <b>Baixar backup</b> com frequência.</p>
      </div>` : ''}

      <div class="card mb">
        <h3>${icon('lock', 'sm')} Acesso</h3>
        <div class="kv"><span class="k">E-mail</span><span class="v">${esc(App.userEmail())}</span></div>
        <div class="grid grid-2 mt"><button class="btn" onclick="Pages.config.senha()">${icon('lock')} Alterar senha</button><button class="btn" onclick="Pages.config.auditoria()">${icon('shield')} Auditoria</button></div>
        <div class="kv mt"><span class="k">Versão do app</span><span class="v">v${APP_VERSAO}</span></div>
        <button class="btn block mt" onclick="Pages.config.atualizarApp()">${icon('repeat')} Atualizar app agora</button>
        <button class="btn block mt" onclick="App.logout()">${icon('logout')} Sair</button>
      </div>

      ${dono ? `<div class="card" style="border-color:rgba(248,113,113,.35)">
        <h3 class="red">Zona de perigo</h3>
        <button class="btn danger block" onclick="Pages.config.zerar()">${icon('trash')} Apagar todos os dados</button>
      </div>` : ''}`;
    if ($('#cf-membros')) this.renderMembros();
    if ($('#cf-email')) this.emailInit();
    if (!dono) return;

    $('#cf-save').onclick = () => {
      const f = readForm($('#cf-loja'));
      Object.assign(s, f, { metaMensal: parseMoney(f.metaMensal), diasTrabalho: parseInt(f.diasTrabalho) || 26, taxaDebito: parseMoney(f.taxaDebito), taxaCredito: parseMoney(f.taxaCredito) });
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
    $('#cf-dossie').onchange = e => { this.importarDossie(e.target.files[0]); e.target.value = ''; };
    $('#cf-clipdf').onchange = e => { this.importarClientesPdf(e.target.files[0]); e.target.value = ''; };
    const ff = $('#cf-func');
    if (ff) ff.onsubmit = async e => {
      e.preventDefault();
      const f = readForm(ff), btn = $('button.primary', ff);
      if (f.fsenha.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres', true);
      btn.disabled = true;
      try {
        const r = await Cloud.criarFuncionario(f.fnome, f.femail.toLowerCase(), f.fsenha);
        ff.reset(); this.renderMembros();
        openModal({
          title: r.jaExistia ? 'Funcionário adicionado' : 'Acesso criado!', icon: 'checkCircle',
          body: r.jaExistia
            ? `<p style="margin-top:0">Este e-mail já tinha conta. <b class="gold">${esc(f.fnome)}</b> agora faz parte da loja e entra com a <b>senha que já usava</b>.</p>`
            : `<p style="margin-top:0">Passe estes dados para <b class="gold">${esc(f.fnome)}</b>:</p>
               <div class="card"><div class="kv"><span class="k">Site</span><span class="v">${esc(location.origin)}</span></div><div class="kv"><span class="k">E-mail</span><span class="v">${esc(f.femail.toLowerCase())}</span></div><div class="kv"><span class="k">Senha</span><span class="v gold">${esc(f.fsenha)}</span></div></div>
               ${r.confirmado ? '' : `<div class="info-box mt">${icon('alert')}<span>O Supabase está pedindo <b>confirmação de e-mail</b>: o funcionário precisa clicar no link enviado antes de entrar. Para não precisar, desligue em Supabase → Authentication → Sign In / Providers → Email → <b>Confirm email</b>.</span></div>`}`,
          foot: r.jaExistia ? '<button class="btn primary" data-close>OK</button>' : `<button class="btn" data-close>Fechar</button><a class="btn success" target="_blank" href="https://wa.me/?text=${encodeURIComponent(`Seu acesso ao sistema da ${Store.s.loja}:\n\nSite: ${location.origin}\nE-mail: ${f.femail.toLowerCase()}\nSenha: ${f.fsenha}`)}">${icon('whatsapp')} Enviar dados</a>`,
        });
      } catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
    };
  },

  async importarClientesPdf(file) {
    if (!file) return;
    toast('Lendo o PDF...');
    let lista;
    try { lista = await ClientesPDF.ler(file); } catch (e) { return toast('Não foi possível ler o PDF: ' + e.message, true); }
    if (!lista.length) return toast('Nenhum cliente encontrado neste PDF', true);
    const comTel = lista.filter(c => c.telefone).length;
    openModal({
      title: 'Importar clientes', icon: 'users', subtitle: file.name,
      body: `<div class="grid grid-2 mb"><div class="stat"><div class="label">Clientes</div><div class="value gold">${lista.length}</div></div><div class="stat"><div class="label">Com telefone</div><div class="value green">${comTel}</div></div></div>
        <p class="small muted" style="margin-top:0">Quem já está no app (mesmo nome) recebe o telefone e o e-mail; quem falta é cadastrado. Também guarda o total gasto e a última visita do sistema antigo.</p>
        <div class="card pad-0">${lista.slice(0, 6).map(c => `<div class="cart-line" style="padding:8px 14px"><div class="grow"><b>${esc(c.nome)}</b><div class="xs muted">${esc(fmtPhone(c.telefone) || 'sem telefone')}${c.totalGasto ? ' · ' + money(c.totalGasto) : ''}</div></div></div>`).join('')}
        <div class="xs muted center" style="padding:8px">e mais ${Math.max(0, lista.length - 6)}...</div></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ic-ok">${icon('check')} Importar ${lista.length} clientes</button>`,
      onMount: (el, m) => $('#ic-ok', el).onclick = () => {
        const r = ClientesPDF.importar(lista);
        m.close(); App.refresh();
        openModal({ title: 'Clientes importados!', icon: 'checkCircle', body: `<p style="margin-top:0"><b class="gold">${r.atualizados}</b> clientes que já existiam receberam telefone/e-mail e <b class="gold">${r.novos}</b> novos foram cadastrados.</p>${Cloud.loja ? '<p class="small muted">Os dados estão sendo enviados para a nuvem e aparecem nos outros aparelhos em instantes.</p>' : ''}`, foot: '<button class="btn primary" data-close>OK</button>' });
      },
    });
  },

  importarDossie(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      let r;
      try { r = Dossie.analisar(rd.result); } catch (e) { return toast('Não foi possível ler o dossiê: ' + e.message, true); }
      const vendasTotal = r.vendas.reduce((s, v) => s + v.total, 0);
      const maxOS = Math.max(0, ...r.os.map(o => o.numero), ...Store.db.os.map(o => o.numero));
      const linha = (k, l, n, sub) => `<label class="check" style="border-bottom:1px dashed var(--line)"><input type="checkbox" name="${k}" ${n ? 'checked' : 'disabled'}> <span class="grow"><b>${l}</b> <span class="gold">${n}</span>${sub ? `<br><span class="xs muted">${sub}</span>` : ''}</span></label>`;
      openModal({
        title: 'Importar dossiê', icon: 'upload', subtitle: file.name,
        body: `<div class="info-box">${icon('info')}<span>O dossiê é um relatório: não traz telefones, CPF nem o histórico completo de OS. Os clientes entram só com o nome — complete os dados quando eles voltarem.</span></div>
          <div id="im-opts">
          ${linha('clientes', 'Clientes', r.clientes.size, 'Nomes encontrados no relatório')}
          ${linha('os', 'OS em aberto', r.os.length, r.os.map(o => '#' + o.numero).join(', '))}
          ${linha('vendas', 'Vendas do período', r.vendas.length, `${money(vendasTotal)} · ${r.vendas.filter(v => v.seminovo).length} aparelho(s) com garantia de 6 meses`)}
          <label class="check" style="padding-left:30px"><input type="checkbox" name="financeiro" checked> <span class="small">Lançar essas vendas no financeiro</span></label>
          ${linha('estoque', 'Estoque', r.produtos.length + r.pecas.length, `${r.produtos.length} produtos e ${r.pecas.length} peças (custo calculado; confira os preços de venda)`)}
          ${linha('servicos', 'Serviços', r.servicos.length, 'Preço = média cobrada no período')}
          </div>
          ${field('Próximo número de OS', `<input class="input" type="number" id="im-prox" value="${Math.max(maxOS + 1, Store.db.seq.os || 1)}">`)}
          <p class="xs muted" style="margin-top:-6px">Se a última OS do sistema antigo foi a #355, coloque 356.</p>`,
        foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="im-ok">${icon('check')} Importar</button>`,
        onMount: (el, m) => $('#im-ok', el).onclick = () => {
          const opt = readForm($('#im-opts', el)); opt.proximaOS = parseInt($('#im-prox', el).value) || 0;
          const n = Dossie.importar(r, opt);
          m.close(); App.refresh();
          toast(`Importado: ${n.clientes} clientes, ${n.os} OS, ${n.vendas} vendas, ${n.produtos + n.pecas} itens de estoque, ${n.servicos} serviços`);
        },
      });
    };
    rd.readAsText(file, 'utf-8');
  },

  async renderMembros() {
    const box = $('#cf-membros');
    try {
      const ms = await Cloud.membros();
      const dono = Cloud.loja.papel === 'dono';
      box.innerHTML = ms.map(m => `<div class="cart-line"><div class="avatar">${esc((m.nome || m.email || '?')[0].toUpperCase())}</div>
        <div class="grow" style="min-width:0"><b class="ellipsis" style="display:block">${esc(m.nome || m.email || 'Sem e-mail')}${m.user_id === Cloud.user.id ? ' <span class="muted xs">(você)</span>' : ''}</b><div class="xs muted ellipsis">${m.nome ? esc(m.email) + ' · ' : ''}<span class="${m.papel === 'dono' ? 'gold' : ''}">${m.papel === 'dono' ? 'Dono' : 'Funcionário'}</span> · desde ${fmtDate(m.criado_em)}</div></div>
        ${'notificar_pedidos' in m && (dono || m.user_id === Cloud.user.id) && m.email ? `<button class="icon-btn" title="${m.notificar_pedidos ? 'Recebe' : 'Não recebe'} pedidos por e-mail (toque para mudar)" data-av="${m.user_id}" data-on="${m.notificar_pedidos ? 1 : 0}" style="${m.notificar_pedidos ? 'color:var(--gold)' : 'opacity:.35'}">${icon('bell', 'sm')}</button>` : ''}
        ${dono && m.papel !== 'dono' ? `<button class="icon-btn" title="Remover da equipe" data-rm="${m.user_id}">${icon('trash', 'sm')}</button>` : ''}</div>`).join('');
      $$('[data-av]', box).forEach(b => b.onclick = async () => {
        const on = b.dataset.on !== '1';
        try { await Cloud.avisoEmail(b.dataset.av, on); toast(on ? 'Vai receber os pedidos por e-mail' : 'Não vai mais receber por e-mail'); this.renderMembros(); } catch (e) { toast(e.message, true); }
      });
      $$('[data-rm]', box).forEach(b => b.onclick = async () => {
        if (!(await confirmDialog('Remover este funcionário da equipe? Ele perde o acesso aos dados da loja.', { danger: true, ok: 'Remover' }))) return;
        try { await Cloud.removerMembro(b.dataset.rm); toast('Removido da equipe'); this.renderMembros(); } catch (e) { toast(e.message, true); }
      });
    } catch (e) { box.innerHTML = `<p class="small red">Não foi possível carregar (sem internet?).</p>`; }
  },
  async emailInit() {
    const st = $('#cf-email-st'), f = $('#cf-email-f');
    const mostrar = d => {
      if (!d || !d.configurado) st.innerHTML = `<span class="pill red">Desligado</span> ${Cloud.loja.papel === 'dono' ? 'Cole a chave do Brevo abaixo para ativar.' : 'O dono da loja precisa configurar.'}`;
      else st.innerHTML = d.ativo ? `<span class="pill green">Ativo</span> Enviando de <b>${esc(d.remetente || '')}</b> · chave ${esc(d.chave || '')}` : `<span class="pill">Pausado</span> Chave salva, envio desligado.`;
      if (f && d) { if (d.remetente) f.remetente.value = d.remetente; if (d.configurado) { f.ativo.checked = !!d.ativo; f.chave.placeholder = `Salva (${d.chave}) · cole outra para trocar`; } }
    };
    try { mostrar(await Cloud.statusEmail()); } catch (e) { st.innerHTML = `<span class="red">${esc(e.message)}</span>`; }
    if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault();
      const chave = f.chave.value.trim();
      if (chave && !/^xkeysib-/.test(chave)) return toast('A chave do Brevo começa com xkeysib-', true);
      try { mostrar(await Cloud.configurarEmail(chave, f.remetente.value.trim().toLowerCase(), f.ativo.checked)); f.chave.value = ''; toast('Aviso por e-mail salvo'); }
      catch (err) { toast(err.message, true); }
    };
    $('#cf-email-teste').onclick = async ev => {
      const b = ev.currentTarget; b.disabled = true;
      try {
        const id = await Cloud.testarEmail();
        if (!id) return toast('Salve a chave e ative o envio primeiro', true);
        toast('Enviando teste...');
        let r = null;
        for (let i = 0; i < 6 && !r?.status && !r?.erro; i++) { await new Promise(ok => setTimeout(ok, 1500)); r = await Cloud.resultadoEmail(id); }
        if (r?.status >= 200 && r.status < 300) toast('E-mail de teste enviado para a equipe! Confira a caixa de entrada (e o spam).');
        else if (r?.status) toast(`O Brevo recusou (${r.status}): ${/key|unauthori/i.test(r.resposta || '') ? 'chave inválida' : /sender/i.test(r.resposta || '') ? 'remetente não confirmado no Brevo' : (r.resposta || '').slice(0, 120)}`, true);
        else if (r?.erro) toast('Falha ao enviar: ' + r.erro, true);
        else toast('Teste enviado. Confira a caixa de entrada em instantes.');
      } catch (err) { toast(err.message, true); } finally { b.disabled = false; }
    };
  },
  // Apaga o cache do app e baixa a versão mais nova (os dados continuam salvos)
  async atualizarApp() {
    try {
      await Cloud.push?.().catch(() => {});
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
      if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch {}
    location.reload();
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
    if (!Cloud.ehDono()) return toast('Somente o dono pode restaurar backup', true);
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
    if (!Cloud.ehDono()) return toast('Somente o dono pode apagar os dados', true);
    if (!(await confirmDialog(`Apagar TODOS os dados (OS, clientes, estoque, financeiro)${Cloud.loja ? ' da loja, inclusive na nuvem e nos aparelhos da equipe' : ''}? Faça um backup antes. Esta ação não pode ser desfeita.`, { danger: true, ok: 'Apagar tudo' }))) return;
    if (!(await confirmDialog('Tem certeza absoluta?', { danger: true, ok: 'Sim, apagar' }))) return;
    const { auth, lojaId } = Store.db; Store.db = defaultDB(); Store.db.auth = auth; Store.db.lojaId = lojaId; Store.save();
    toast('Dados apagados'); $('.shell')?.remove(); App.render();
  },
};
