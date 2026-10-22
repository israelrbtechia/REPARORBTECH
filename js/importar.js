/* Importação do "Dossiê de auditoria" (CSV) do sistema antigo.
   O dossiê é um relatório: traz OS em aberto, vendas do período, nomes de clientes,
   estoque e serviços — sem telefones nem o histórico completo. */
const Dossie = {
  parse(texto) {
    const rows = [];
    for (let line of texto.replace(/^﻿/, '').split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('#')) continue;
      const p = line.split(';');
      if (p.length < 4 || p[0] === 'Grupo') continue;
      rows.push({ grupo: p[0], secao: p[1], campo: p.slice(2, -1).join(';'), valor: p[p.length - 1] });
    }
    return rows;
  },
  num(v) { return parseMoney(v); },
  // "324 — Cliente" -> ["324", "Cliente"]
  split(campo) { const i = campo.lastIndexOf(' — '); return i < 0 ? [campo, ''] : [campo.slice(0, i), campo.slice(i + 3)]; },
  // agrupa registros: uma chave repetida (ou o campo inicial) começa um novo registro
  registros(rows, secao, campoInicial) {
    const out = []; let cur = null;
    for (const r of rows.filter(r => r.secao === secao)) {
      const [k, f] = this.split(r.campo);
      if (!cur || f === campoInicial || (campoInicial == null && cur._k !== k)) { cur = { _k: k }; out.push(cur); }
      cur[f] = r.valor;
    }
    return out;
  },
  data(br) { const m = String(br).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`).toISOString() : null; },
  status(s) {
    s = norm(s);
    if (/analys|analis/.test(s)) return 'analise';
    if (/part|peca/.test(s)) return 'peca';
    if (/progress|repair|servic|bench/.test(s)) return 'servico';
    if (/paid|pago|deliver|entreg/.test(s)) return 'pago';
    if (/complet|conclu|ready|done|pront/.test(s)) return 'concluido';
    if (/interr|cancel/.test(s)) return 'interrompido';
    return 'analise';
  },
  forma(s) { s = norm(s); return /pix/.test(s) ? 'pix' : /dinh/.test(s) ? 'dinheiro' : /cred/.test(s) ? 'credito' : /deb/.test(s) ? 'debito' : /transf/.test(s) ? 'transferencia' : 'outro'; },
  ehPeca(nome) {
    nome = nome.trim();
    return /^(tela|bateria|flex|conector|alto.?falante|auricular|tampa traseira|vidro|lente|placa|display|touch|carcaca|carcaça|dock)\b/i.test(nome)
      || /^c[aâ]mera (traseira|frontal|iphone|samsung|moto|xiaomi|redmi)/i.test(nome);
  },
  ehAparelho(nome, cat) { return /smartphone|aparelho|celular/i.test(cat || '') || /^(iphone|galaxy|samsung|redmi|xiaomi|poco|moto(rola)? |realme|ipad)/i.test(nome.trim()); },

  // Monta o que será importado (sem gravar)
  analisar(texto) {
    const rows = this.parse(texto);
    if (!rows.length) throw new Error('Arquivo vazio ou fora do formato do dossiê');
    const r = { clientes: new Map(), os: [], vendas: [], produtos: [], pecas: [], servicos: [] };
    const addCli = nome => { nome = String(nome || '').trim(); if (!nome || nome === '-') return null; const k = norm(nome); if (!r.clientes.has(k)) r.clientes.set(k, nome); return k; };

    for (const x of this.registros(rows, 'Clientes inativos')) addCli(x._k);
    for (const x of this.registros(rows, 'Principais clientes')) addCli(x._k);

    for (const x of this.registros(rows, 'OS em atraso')) {
      const numero = parseInt(x._k); if (!numero) continue;
      r.os.push({ numero, cliente: addCli(x.Cliente), clienteNome: x.Cliente, modelo: x.Aparelho, status: this.status(x['Situação']), entrada: x.Entrada, prazo: x.Prazo, valor: this.num(x.Valor) });
    }

    const cats = {};
    for (const x of this.registros(rows, 'Itens vendidos', 'Produto')) cats[norm(x.Produto)] = { cat: x.Categoria, custo: this.num(x.Custo) };
    for (const x of this.registros(rows, 'Vendas do período', 'Cliente')) {
      if (/cancel/i.test(x['Situação'] || '')) continue;
      const nome = (x.Itens || 'Item').trim(); const qtd = parseInt(x.Qtd) || 1; const total = this.num(x.Total);
      const info = cats[norm(nome)] || {};
      r.vendas.push({ data: this.data(x._k), cliente: addCli(x.Cliente), clienteNome: x.Cliente, nome, qtd, total, subtotal: this.num(x.Subtotal) || total, desconto: this.num(x.Desconto), forma: this.forma(x['Forma de pagamento']), custo: info.custo || 0, seminovo: this.ehAparelho(nome, info.cat) });
    }

    const vistos = new Set();
    for (const x of this.registros(rows, 'Produtos sem giro')) {
      const nome = x._k.trim(); const qtd = parseInt(x['Em estoque']) || 0; const parado = this.num(x['Custo parado']);
      if (vistos.has(norm(nome))) continue; vistos.add(norm(nome));
      const item = { nome, qtd, custo: qtd ? Math.round(parado / qtd * 100) / 100 : 0 };
      (this.ehPeca(nome) ? r.pecas : r.produtos).push(item);
    }
    for (const x of this.registros(rows, 'Lista de reposição')) {
      const nome = x._k.trim(); if (vistos.has(norm(nome))) continue; vistos.add(norm(nome));
      const item = { nome, qtd: parseInt(x.Atual) || 0, custo: 0, minimo: parseInt(x['Mínimo']) || 0 };
      (/pe[çc]a/i.test(x.Tipo || '') ? r.pecas : r.produtos).push(item);
    }

    const sv = new Map();
    for (const x of this.registros(rows, 'Serviços mais realizados')) {
      const nome = x._k.trim().replace(/\s+/g, ' '); const k = norm(nome);
      const q = parseInt(x.Quantidade) || 0, rec = this.num(x.Receita);
      const a = sv.get(k) || { nome: nome[0].toUpperCase() + nome.slice(1).toLowerCase(), q: 0, rec: 0 };
      a.q += q; a.rec += rec; sv.set(k, a);
    }
    r.servicos = [...sv.values()].map(a => ({ nome: a.nome, preco: a.q ? Math.round(a.rec / a.q) : 0 }));
    return r;
  },

  // Grava no banco do app. Não duplica o que já existe (por nome / número).
  importar(r, opt) {
    const db = Store.db; const n = { clientes: 0, os: 0, vendas: 0, produtos: 0, pecas: 0, servicos: 0 };
    const cliId = {};
    for (const c of db.clientes) cliId[norm(c.nome)] = c.id;
    const garanteCliente = k => {
      if (!k) return null;
      if (!cliId[k]) { const c = { id: uid(), nome: r.clientes.get(k), docTipo: 'CPF', aparelhos: [], criadoEm: nowISO(), importado: true }; db.clientes.push(c); cliId[k] = c.id; n.clientes++; }
      return cliId[k];
    };
    if (opt.clientes) for (const k of r.clientes.keys()) garanteCliente(k);

    if (opt.os) for (const o of r.os) {
      if (db.os.some(x => x.numero === o.numero)) continue;
      const clienteId = garanteCliente(o.cliente);
      const c = Store.cliente(clienteId);
      let ap = (c.aparelhos || []).find(a => norm(a.modelo) === norm(o.modelo));
      if (!ap && o.modelo) { ap = { id: uid(), tipo: 'celular', modelo: o.modelo, idTipo: 'imei' }; c.aparelhos = [...(c.aparelhos || []), ap]; }
      const criado = o.entrada ? new Date(o.entrada + 'T12:00:00').toISOString() : nowISO();
      db.os.push({ id: uid(), numero: o.numero, clienteId, aparelho: { ...(ap || { modelo: o.modelo }) }, defeito: 'Importada do sistema antigo', servico: '', valor: o.valor, status: o.status, previsao: o.prazo || null, pecas: [], criadoEm: criado, historico: [{ data: criado, status: o.status, nota: 'Importada do sistema antigo' }], importado: true, ...(o.status === 'concluido' ? { concluidoEm: criado } : {}) });
      n.os++;
    }

    if (opt.vendas) for (const v of r.vendas) {
      const key = `${v.data}|${norm(v.clienteNome)}|${norm(v.nome)}|${v.total}`;
      if (db.vendas.some(x => x.importKey === key)) continue;
      const venda = { id: uid(), numero: Store.next('venda'), data: v.data || nowISO(), importKey: key, importado: true,
        itens: [{ id: 'imp-' + uid(), avulso: true, nome: v.nome, preco: v.qtd ? v.subtotal / v.qtd : v.subtotal, custo: v.custo / (v.qtd || 1), qtd: v.qtd, seminovo: v.seminovo, imei: '', garantiaDias: v.seminovo ? GARANTIA_SEMINOVO_DIAS : 0 }],
        subtotal: v.subtotal, desconto: v.desconto, total: v.total, custo: v.custo, forma: v.forma, clienteId: garanteCliente(v.cliente), clienteNome: v.clienteNome };
      db.vendas.push(venda);
      if (opt.financeiro) Store.addReceita({ origem: 'venda', refId: venda.id, desc: `Venda #${venda.numero} (importada)`, valor: venda.total, custo: venda.custo, forma: venda.forma, data: venda.data }).caixaId = null;
      n.vendas++;
    }

    const addItem = (col, tipo, it, extra = {}) => {
      if (col.some(p => !p.deleted && norm(p.nome) === norm(it.nome))) return false;
      const p = { id: uid(), nome: it.nome, custo: it.custo, preco: 0, qtd: 0, minimo: it.minimo || 0, criadoEm: nowISO(), importado: true, ...extra };
      col.push(p); if (it.qtd) Store.movimentar(tipo, p, it.qtd, 'Importado do sistema antigo');
      return true;
    };
    if (opt.estoque) {
      for (const it of r.produtos) if (addItem(db.produtos, 'produto', it, { garantiaDias: 90 })) n.produtos++;
      for (const it of r.pecas) if (addItem(db.pecas, 'peca', it)) n.pecas++;
    }
    if (opt.servicos) for (const s of r.servicos) {
      if (db.servicos.some(x => !x.deleted && norm(x.nome) === norm(s.nome))) continue;
      db.servicos.push({ id: uid(), nome: s.nome, preco: s.preco, categoria: 'Importado' }); n.servicos++;
    }
    if (opt.proximaOS) db.seq.os = Math.max(db.seq.os || 1, opt.proximaOS);
    Store.log('Importação do sistema antigo', Object.entries(n).map(([k, v]) => `${v} ${k}`).join(', '));
    Store.save();
    return n;
  },
};
