/* Banco de dados local (localStorage) */
const DB_KEY = 'rbtech_db_v1';

const OS_STATUS = {
  analise:   { label: 'Em Análise',       icon: 'alertCircle', color: '#60a5fa', pill: 'blue' },
  peca:      { label: 'Aguardando Peça',  icon: 'box',         color: '#fb923c', pill: 'orange' },
  servico:   { label: 'Em Serviço',       icon: 'wrench',      color: '#c084fc', pill: 'purple' },
  concluido: { label: 'Concluído',        icon: 'checkCircle', color: '#4ade80', pill: 'green' },
  pago:      { label: 'Pago',             icon: 'dollar',      color: '#d4af37', pill: 'gold' },
  interrompido: { label: 'Interrompido',  icon: 'xCircle',     color: '#f87171', pill: 'red' },
};
const OS_ATIVOS = ['analise', 'peca', 'servico', 'concluido'];
// Garantias fixas da loja
const GARANTIA_REPARO_DIAS = 90;    // reparos: sempre 3 meses
const GARANTIA_SEMINOVO_DIAS = 180; // aparelhos seminovos: sempre 6 meses
// Tipo do produto à venda: celular seminovo, celular novo ou acessório
const tipoProduto = p => p.seminovo ? 'seminovo' : p.tipoProduto === 'novo' ? 'novo' : 'acessorio';
const ehCelular = p => tipoProduto(p) !== 'acessorio';
const FORMAS_PGTO = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Cartão de Débito', credito: 'Cartão de Crédito', transferencia: 'Transferência', outro: 'Outro' };
const TIPOS_APARELHO = [
  ['celular', 'Celular', 'phone'], ['tablet', 'Tablet', 'tablet'], ['notebook', 'Notebook', 'laptop'], ['computador', 'Computador', 'monitor'],
  ['videogame', 'Video Game', 'gamepad'], ['smartwatch', 'Smartwatch', 'watch'], ['outro', 'Outro', 'cpu'],
];
const CHECKLIST_ITENS = ['Liga', 'Tela', 'Touch', 'Câmera traseira', 'Câmera frontal', 'Microfone', 'Alto-falante', 'Auricular', 'Carregamento', 'Wi-Fi', 'Bluetooth', 'Biometria / Face ID', 'Botões', 'Sinal / Chip', 'Vibração'];

function defaultDB() {
  return {
    version: 1,
    auth: null,
    settings: {
      loja: 'RB Tech Celulares',
      responsavel: '',
      cnpj: '',
      telefone: '',
      endereco: '',
      instagram: '',
      metaMensal: 50000,
      diasTrabalho: 26,
      garantiaDias: 90,
      termosGarantia: 'A garantia cobre exclusivamente o serviço executado e as peças substituídas descritas nesta ordem. Não cobre: danos por queda, contato com líquidos, mau uso, aparelho aberto por terceiros, lacre de garantia violado ou danos na tela causados após a entrega.',
      termosGarantiaSeminovo: 'Garantia de 6 meses contra defeitos de funcionamento do aparelho (placa, tela, bateria, câmeras, áudio e conectores), contados a partir da data da compra. Não cobre: quedas, trincas, contato com líquidos, mau uso, desgaste natural de bateria acima do esperado por uso intenso, aparelho aberto por terceiros, bloqueios por conta (iCloud/Google) feitos pelo comprador ou danos causados por acessórios não originais.',
      termosGarantiaProduto: 'Celulares novos: garantia do fabricante a partir da data da compra. Acessórios: garantia contra defeito de fabricação pelo prazo indicado. A garantia não cobre mau uso, quedas, contato com líquidos, cabos rompidos ou dobrados, desgaste natural nem produto aberto ou violado. Guarde este recibo: ele é necessário para acionar a garantia.',
      termosEntrada: 'Aparelhos não retirados em até 90 dias após a comunicação de conclusão serão considerados abandonados. A loja não se responsabiliza por dados, chips e cartões de memória deixados no aparelho.',
      taxaDebito: 1.5,
      taxaCredito: 3.5,
      exigirCaixa: false,
      origens: ['Instagram', 'Indicação', 'Google', 'Passou na frente', 'WhatsApp', 'Facebook'],
      tecnicos: [],
    },
    seq: { os: 1, orc: 1, venda: 1 },
    clientes: [],
    os: [],
    orcamentos: [],
    pecas: [],
    fornecedores: [],
    movEstoque: [],
    produtos: [],
    vendas: [],
    servicos: [],
    lancamentos: [],
    caixas: [],
    auditoria: [],
    pedidos: [],
  };
}

const Store = {
  db: null,
  load() {
    try { this.db = JSON.parse(localStorage.getItem(DB_KEY)); } catch { this.db = null; }
    const def = defaultDB();
    if (!this.db) this.db = def;
    for (const k in def) if (this.db[k] === undefined) this.db[k] = def[k];
    for (const k in def.settings) if (this.db.settings[k] === undefined) this.db.settings[k] = def.settings[k];
  },
  // noSync = true quando a alteração veio da nuvem (não precisa reenviar)
  save(noSync) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(this.db)); }
    catch (e) { toast('Erro ao salvar: armazenamento cheio. Faça um backup.', true); }
    if (!noSync && typeof Cloud !== 'undefined') Cloud.schedule();
  },
  get s() { return this.db.settings; },

  log(acao, detalhe) {
    this.db.auditoria.unshift({ id: uid(), data: nowISO(), acao, detalhe });
    if (this.db.auditoria.length > 1000) this.db.auditoria.length = 1000;
  },

  // Próximo número considerando também registros criados em outros aparelhos
  next(kind) {
    const col = { os: 'os', orc: 'orcamentos', venda: 'vendas' }[kind];
    const max = Math.max(0, ...this.db[col].map(x => Number(x.numero) || 0));
    const n = Math.max(this.db.seq[kind] || 1, max + 1);
    this.db.seq[kind] = n + 1;
    return n;
  },

  /* ----- Clientes ----- */
  cliente(id) { return this.db.clientes.find(c => c.id === id); },
  clientesAtivos() { return this.db.clientes.filter(c => !c.deleted).sort((a, b) => a.nome.localeCompare(b.nome)); },
  saveCliente(c) {
    if (!c.id) { c.id = uid(); c.criadoEm = nowISO(); this.db.clientes.push(c); this.log('Cliente criado', c.nome); }
    else { const i = this.db.clientes.findIndex(x => x.id === c.id); this.db.clientes[i] = c; }
    this.save(); return c;
  },

  /* ----- OS ----- */
  osById(id) { return this.db.os.find(o => o.id === id); },
  osTotal(o) { return (Number(o.valor) || 0) - (Number(o.desconto) || 0); },
  osCustoPecas(o) { return (o.pecas || []).reduce((s, p) => s + (p.custo || 0) * (p.qtd || 1), 0); },
  saveOS(o) {
    if (!o.id) {
      o.id = uid(); o.numero = this.next('os'); o.criadoEm = nowISO();
      o.historico = [{ data: nowISO(), status: o.status, nota: 'OS aberta' }];
      this.db.os.push(o); this.log('OS criada', `#${o.numero}`);
    } else { const i = this.db.os.findIndex(x => x.id === o.id); this.db.os[i] = o; }
    this.save(); return o;
  },
  // Mantém o lançamento financeiro de uma OS paga em sincronia após edição
  syncReceitaOS(o) {
    const l = this.db.lancamentos.find(l => l.origem === 'os' && l.refId === o.id);
    if (!l) return;
    l.valor = this.osTotal(o); l.custo = this.osCustoPecas(o);
    l.forma = o.pagamento?.forma || l.forma; l.taxa = this.taxa(l.forma, l.valor);
  },
  setOSStatus(o, status, pagamento) {
    if (o.status === status) return;
    const antes = o.status;
    o.status = status;
    o.historico = o.historico || [];
    o.historico.push({ data: nowISO(), status });
    if (status === 'concluido' && !o.concluidoEm) o.concluidoEm = nowISO();
    if (status === 'pago') {
      o.pagamento = Object.assign({ forma: 'pix', data: nowISO() }, pagamento || {});
      o.pagoEm = o.pagamento.data;
      if (!o.concluidoEm) o.concluidoEm = o.pagoEm;
      o.entregueEm = o.entregueEm || nowISO();
      this.addReceita({ origem: 'os', refId: o.id, desc: `OS #${o.numero}`, valor: this.osTotal(o), custo: this.osCustoPecas(o), forma: o.pagamento.forma, data: o.pagoEm });
    } else if (antes === 'pago') {
      this.db.lancamentos = this.db.lancamentos.filter(l => !(l.origem === 'os' && l.refId === o.id));
      o.pagamento = null; o.pagoEm = null;
    }
    this.log('Status OS', `#${o.numero}: ${OS_STATUS[antes]?.label} → ${OS_STATUS[status].label}`);
    this.save();
  },

  /* ----- Garantia e acompanhamento ----- */
  garantiaInicio(o) { return o.concluidoEm || o.pagoEm || o.entregueEm || null; },
  garantiaFim(o) { const i = this.garantiaInicio(o); return i ? addDays(i, GARANTIA_REPARO_DIAS) : null; },
  // Token secreto do link público da OS (gerado na primeira vez que o link é usado)
  tokenOS(o) {
    if (!o.token) {
      const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      const r = crypto.getRandomValues(new Uint8Array(22));
      o.token = Array.from(r, b => abc[b % abc.length]).join('');
      this.saveOS(o);
    }
    return o.token;
  },
  linkOS(o) { return `${location.origin}/acompanhar/${this.tokenOS(o)}`; },

  /* ----- Financeiro ----- */
  taxa(forma, valor) {
    if (forma === 'debito') return valor * (this.s.taxaDebito || 0) / 100;
    if (forma === 'credito') return valor * (this.s.taxaCredito || 0) / 100;
    return 0;
  },
  caixaAberto() { return this.db.caixas.find(c => !c.fechadoEm); },
  addReceita({ origem, refId, desc, valor, custo = 0, forma = 'dinheiro', data = nowISO(), categoria }) {
    const cx = this.caixaAberto();
    const l = { id: uid(), tipo: 'receita', origem, refId, desc, valor, custo, taxa: this.taxa(forma, valor), forma, data, categoria: categoria || (origem === 'os' ? 'Serviços' : origem === 'venda' ? 'Vendas' : 'Outros'), caixaId: cx ? cx.id : null };
    this.db.lancamentos.push(l); return l;
  },
  addDespesa({ desc, valor, forma = 'dinheiro', data = nowISO(), categoria = 'Despesas gerais' }) {
    const cx = this.caixaAberto();
    const l = { id: uid(), tipo: 'despesa', origem: 'manual', desc, valor, custo: 0, taxa: 0, forma, data, categoria, caixaId: cx ? cx.id : null };
    this.db.lancamentos.push(l); this.log('Despesa', `${desc} ${money(valor)}`); this.save(); return l;
  },
  resumo(filtro) {
    const ls = this.db.lancamentos.filter(filtro);
    const r = { receita: 0, custo: 0, taxa: 0, despesa: 0, os: 0, vendas: 0, qtd: ls.length };
    for (const l of ls) {
      if (l.tipo === 'receita') {
        r.receita += l.valor; r.custo += l.custo || 0; r.taxa += l.taxa || 0;
        if (l.origem === 'os') r.os += l.valor; else if (l.origem === 'venda') r.vendas += l.valor;
      } else r.despesa += l.valor;
    }
    r.custos = r.custo + r.taxa + r.despesa;
    r.lucro = r.receita - r.custos;
    r.margem = r.receita ? (r.lucro / r.receita) * 100 : 0;
    return r;
  },
  resumoDia(d = new Date()) { const k = dayKey(d); return this.resumo(l => dayKey(l.data) === k); },
  resumoMes(d = new Date()) { const k = monthKey(d); return this.resumo(l => monthKey(l.data) === k); },
  metaDiaria() { return (Number(this.s.metaMensal) || 0) / (Number(this.s.diasTrabalho) || 26); },

  /* ----- Estoque ----- */
  peca(id) { return this.db.pecas.find(p => p.id === id); },
  produto(id) { return this.db.produtos.find(p => p.id === id); },
  movimentar(tipoItem, item, qtd, motivo) {
    item.qtd = (Number(item.qtd) || 0) + qtd;
    this.db.movEstoque.unshift({ id: uid(), data: nowISO(), tipoItem, itemId: item.id, nome: item.nome, qtd, motivo, saldo: item.qtd });
    if (this.db.movEstoque.length > 3000) this.db.movEstoque.length = 3000;
  },
};

Store.load();
