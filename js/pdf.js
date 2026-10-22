/* PDF de garantia (jsPDF). Usado pelo app e pela página pública de acompanhamento.
   Recebe um objeto simples para funcionar com dados locais ou vindos do Supabase. */
const Pdf = {
  logo: null,
  async carregarLogo() {
    if (this.logo) return this.logo;
    try {
      const b = await (await fetch('/assets/icon-192.png')).blob();
      this.logo = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
    } catch { this.logo = null; }
    return this.logo;
  },

  /* d = { tipo: 'reparo'|'venda', numero, loja:{nome,cnpj,telefone,endereco,instagram}, cliente:{nome,doc,docTipo,telefone},
          aparelho:{modelo,imei,idTipo,cor}, itens:[{desc,valor,qtd}], total, desconto, forma, inicio, dias, termos,
          defeito, assinaturaTecnico, tecnico, assinaturaCliente } */
  async garantia(d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14;
    const GOLD = [212, 175, 55], GOLD_D = [154, 122, 16], BLACK = [0, 0, 0], GRAY = [90, 90, 90];
    const logo = await this.carregarLogo();
    const L = d.loja || {};

    this.cabecalho(doc, logo, L, 'TERMO DE GARANTIA', d.tipo === 'venda' ? `VENDA #${d.numero}` : `OS #${d.numero}`);

    let y = 52;
    // Selo da garantia
    const meses = Math.round(d.dias / 30);
    const selo = `GARANTIA DE ${meses} ${meses === 1 ? 'MÊS' : 'MESES'} (${d.dias} DIAS)`;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.setFillColor(253, 248, 230);
    doc.roundedRect(W / 2 - 50, y - 7, 100, 12, 2, 2, 'FD');
    doc.setTextColor(...GOLD_D); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(selo, W / 2, y + 0.8, { align: 'center' });
    y += 8;
    doc.setTextColor(...GRAY); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(d.tipo === 'venda' ? 'Aparelho seminovo' : 'Serviço de reparo', W / 2, y + 2, { align: 'center' });
    y += 8;

    const titulo = t => {
      y += 4; doc.setTextColor(...BLACK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(t.toUpperCase(), M, y);
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y + 1.8, W - M, y + 1.8); y += 7;
    };
    const kv = (pares) => {
      doc.setFontSize(9.5);
      for (let i = 0; i < pares.length; i += 2) {
        [pares[i], pares[i + 1]].forEach((p, j) => {
          if (!p) return; const x = M + j * 92;
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK); doc.text(p[0] + ':', x, y);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40); doc.text(doc.splitTextToSize(String(p[1] || '—'), 62), x + 26, y);
        });
        y += 6;
      }
    };

    titulo('Cliente');
    kv([['Nome', d.cliente?.nome], d.cliente?.doc ? [d.cliente.docTipo || 'Documento', d.cliente.doc] : null, d.cliente?.telefone ? ['Telefone', d.cliente.telefone] : null].filter(Boolean));
    titulo('Aparelho');
    kv([['Modelo', d.aparelho?.modelo], [d.aparelho?.idTipo === 'serial' ? 'Serial' : 'IMEI', d.aparelho?.imei], ['Cor', d.aparelho?.cor]]);
    if (d.defeito) kv([['Defeito', d.defeito]]);

    titulo(d.tipo === 'venda' ? 'Compra' : 'Serviço executado');
    // tabela
    doc.setFillColor(243, 243, 243); doc.rect(M, y - 4.5, W - 2 * M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
    doc.text('DESCRIÇÃO', M + 2, y); doc.text('VALOR', W - M - 2, y, { align: 'right' }); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(30, 30, 30);
    for (const it of d.itens || []) {
      const linhas = doc.splitTextToSize((it.qtd > 1 ? `${it.qtd}x ` : '') + it.desc, 140);
      doc.text(linhas, M + 2, y); doc.text(it.valor == null ? 'incluso' : money(it.valor), W - M - 2, y, { align: 'right' });
      y += linhas.length * 5; doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.2); doc.line(M, y - 3, W - M, y - 3); y += 1.5;
    }
    if (d.desconto) { doc.text('Desconto', M + 2, y); doc.text('-' + money(d.desconto), W - M - 2, y, { align: 'right' }); y += 6; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BLACK);
    doc.text('TOTAL', M + 2, y + 1); doc.text(money(d.total), W - M - 2, y + 1, { align: 'right' }); y += 8;
    if (d.forma) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY); doc.text('Forma de pagamento: ' + d.forma, M + 2, y); y += 5; }

    // Validade
    y += 3;
    const ini = d.inicio ? new Date(d.inicio) : new Date();
    const fim = addDays(ini, d.dias);
    doc.setFillColor(...BLACK); doc.roundedRect(M, y, W - 2 * M, 16, 2, 2, 'F');
    doc.setTextColor(200, 200, 200); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('INÍCIO DA GARANTIA', M + 8, y + 6); doc.text('VÁLIDA ATÉ', W / 2 + 8, y + 6);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(fmtDate(ini), M + 8, y + 12.5);
    doc.setTextColor(...GOLD); doc.text(fmtDate(fim), W / 2 + 8, y + 12.5);
    y += 24;

    titulo('Condições da garantia');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 50, 50);
    const termos = doc.splitTextToSize(d.termos || '', W - 2 * M);
    doc.text(termos, M, y, { lineHeightFactor: 1.35 }); y += termos.length * 4.1 + 4;
    doc.text(doc.splitTextToSize('Para acionar a garantia, apresente este termo (impresso ou no celular) junto com o aparelho na loja.', W - 2 * M), M, y); y += 8;

    // Assinaturas
    if (y > 245) { doc.addPage(); y = 30; }
    y = Math.max(y + 18, 250);
    const sig = (img, label, x) => {
      if (img) try { doc.addImage(img, 'PNG', x + 15, y - 17, 50, 16); } catch {}
      doc.setDrawColor(...BLACK); doc.setLineWidth(0.3); doc.line(x, y, x + 80, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY); doc.text(label, x + 40, y + 4.5, { align: 'center' });
    };
    sig(d.assinaturaCliente, 'Cliente — ' + (d.cliente?.nome || ''), M);
    sig(d.assinaturaTecnico, d.tipo === 'venda' ? (L.nome || 'Loja') : 'Técnico responsável' + (d.tecnico ? ' — ' + d.tecnico : ''), W - M - 80);

    // Rodapé
    doc.setFillColor(...BLACK); doc.rect(0, 285, W, 12, 'F');
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text(`Obrigado pela preferência! ${L.nome || ''}`, W / 2, 292, { align: 'center' });
    return doc;
  },

  // Cabeçalho preto com logo, dados da loja e número do documento
  cabecalho(doc, logo, L, titulo, numero) {
    const W = 210, M = 14, GOLD = [212, 175, 55];
    doc.setFillColor(0, 0, 0); doc.rect(0, 0, W, 40, 'F');
    doc.setFillColor(...GOLD); doc.rect(0, 40, W, 1.6, 'F');
    if (logo) doc.addImage(logo, 'PNG', M, 6, 28, 28);
    const xT = logo ? M + 33 : M;
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(L.nome || 'RB Tech Celulares', xT, 16);
    doc.setTextColor(225, 225, 225); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    const info = [L.cnpj && 'CNPJ ' + L.cnpj, L.telefone, L.instagram].filter(Boolean).join('  ·  ');
    if (info) doc.text(info, xT, 23);
    if (L.endereco) doc.text(doc.splitTextToSize(L.endereco, 105), xT, 28);
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.text(titulo, W - M, 14, { align: 'right' });
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(numero, W - M, 22, { align: 'right' });
    doc.setTextColor(200, 200, 200); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Emitido em ' + fmtDateTime(new Date()), W - M, 28, { align: 'right' });
  },

  /* Ordem de serviço de entrada (1 via) */
  async ordem(o) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14, GOLD = [212, 175, 55], BLACK = [0, 0, 0], GRAY = [90, 90, 90];
    const s = Store.s, c = Store.cliente(o.clienteId) || {}, a = o.aparelho || {};
    const tec = s.tecnicos.find(t => t.id === o.tecnicoId);
    const L = { nome: s.loja, cnpj: s.cnpj, telefone: s.telefone, endereco: s.endereco, instagram: s.instagram };
    this.cabecalho(doc, await this.carregarLogo(), L, 'ORDEM DE SERVIÇO', `OS #${o.numero}`);
    let y = 52;
    const titulo = t => { y += 3; doc.setTextColor(...BLACK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(t.toUpperCase(), M, y); doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y + 1.8, W - M, y + 1.8); y += 7; };
    const kv = pares => {
      doc.setFontSize(9.5);
      for (let i = 0; i < pares.length; i += 2) {
        let h = 1;
        [pares[i], pares[i + 1]].forEach((p, j) => {
          if (!p) return; const x = M + j * 92;
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK); doc.text(p[0] + ':', x, y);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
          const t = doc.splitTextToSize(String(p[1] || '—'), 62); doc.text(t, x + 26, y); h = Math.max(h, t.length);
        });
        y += 5 * h + 1;
      }
    };
    const linha = (k, v) => { doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK); doc.setFontSize(9.5); doc.text(k + ':', M, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40); const t = doc.splitTextToSize(String(v || '—'), W - 2 * M - 28); doc.text(t, M + 28, y); y += 5 * t.length + 1; };

    titulo('Cliente');
    kv([['Nome', c.nome], [c.docTipo || 'Documento', c.doc], ['Telefone', fmtPhone(c.telefone)], ['E-mail', c.email]]);
    titulo('Aparelho');
    const tipo = (TIPOS_APARELHO.find(t => t[0] === a.tipo) || [])[1];
    kv([['Modelo', (a.modelo || '—') + (tipo ? ` (${tipo})` : '')], [a.idTipo === 'serial' ? 'Serial' : 'IMEI', a.imei], ['Cor', a.cor], ['Senha', o.senha], ['Acessórios', o.acessorios || 'Nenhum']]);
    titulo('Serviço');
    linha('Defeito', o.defeito); linha('Serviço', o.servico); if (o.obs) linha('Obs.', o.obs);
    kv([['Entrada', fmtDateTime(o.criadoEm)], ['Previsão', fmtDate(o.previsao)], ['Técnico', tec?.nome], ['Status', OS_STATUS[o.status]?.label], ['Garantia', '3 meses após a conclusão']]);
    if (o.checklist && Object.keys(o.checklist).length) {
      titulo('Checklist de entrada');
      doc.setFontSize(8.5);
      CHECKLIST_ITENS.forEach((it, i) => {
        const v = o.checklist[it]; const x = M + (i % 3) * 62, yy = y + Math.floor(i / 3) * 5;
        doc.setTextColor(...(v === 'nok' ? [200, 40, 40] : v === 'ok' ? [20, 130, 60] : GRAY));
        doc.text(`${v === 'ok' ? '[OK]' : v === 'nok' ? '[X]' : '[ ]'} ${it}`, x, yy);
      });
      y += Math.ceil(CHECKLIST_ITENS.length / 3) * 5 + 2;
    }
    y += 2;
    doc.setFillColor(0, 0, 0); doc.roundedRect(M, y, W - 2 * M, 13, 2, 2, 'F');
    doc.setTextColor(200, 200, 200); doc.setFontSize(9); doc.text('VALOR DO SERVIÇO', M + 6, y + 8.3);
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(money(Store.osTotal(o)), W - M - 6, y + 8.8, { align: 'right' });
    y += 20;
    titulo('Termos');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 50, 50);
    const termos = doc.splitTextToSize(s.termosEntrada || '', W - 2 * M); doc.text(termos, M, y, { lineHeightFactor: 1.35 }); y += termos.length * 4.1 + 4;
    if (Cloud.loja && o.token) { doc.setTextColor(...BLACK); doc.setFont('helvetica', 'bold'); doc.text('Acompanhe em tempo real: ', M, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 80, 200); doc.textWithLink(Store.linkOS(o), M + 42, y, { url: Store.linkOS(o) }); y += 6; }
    y = Math.max(y + 22, 255);
    const sig = (img, label, x) => {
      if (img) try { doc.addImage(img, 'PNG', x + 15, y - 17, 50, 16); } catch {}
      doc.setDrawColor(...BLACK); doc.setLineWidth(0.3); doc.line(x, y, x + 80, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY); doc.text(label, x + 40, y + 4.5, { align: 'center' });
    };
    sig(o.assinaturaCliente, 'Assinatura do cliente', M);
    sig(tec?.assinatura || s.assinaturaDono, s.loja, W - M - 80);
    doc.setFillColor(0, 0, 0); doc.rect(0, 285, W, 12, 'F');
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(`Obrigado pela preferência! ${s.loja}`, W / 2, 292, { align: 'center' });
    return doc;
  },

  /* Recibo de venda com os termos de garantia. Cabe em 1 página; só quebra se não couber. */
  async recibo(v) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14, FIM = 280, GOLD = [212, 175, 55], BLACK = [0, 0, 0], GRAY = [90, 90, 90];
    const s = Store.s, c = v.clienteId ? Store.cliente(v.clienteId) || {} : {};
    const L = { nome: s.loja, cnpj: s.cnpj, telefone: s.telefone, endereco: s.endereco, instagram: s.instagram };
    const logo = await this.carregarLogo();
    this.cabecalho(doc, logo, L, 'RECIBO DE VENDA', `VENDA #${v.numero}`);
    let y = 51;
    const espaco = h => { if (y + h > FIM) { doc.addPage(); y = 18; doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GRAY); doc.text(`${s.loja} · Recibo da venda #${v.numero} (continuação)`, M, 12); } };
    const titulo = t => { espaco(12); y += 2; doc.setTextColor(...BLACK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(t.toUpperCase(), M, y); doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y + 1.8, W - M, y + 1.8); y += 7; };
    const kv = (k, val, x) => { doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK); doc.setFontSize(9.5); doc.text(k + ':', x, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40); doc.text(String(val || '—'), x + 24, y); };

    titulo('Cliente');
    kv('Nome', c.nome || v.clienteNome || 'Consumidor final', M); kv('Telefone', fmtPhone(c.telefone), M + 100); y += 5.5;
    if (c.doc) { kv(c.docTipo || 'CPF', c.doc, M); y += 5.5; }

    titulo('Produtos');
    doc.setFillColor(243, 243, 243); doc.rect(M, y - 4.5, W - 2 * M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
    doc.text('PRODUTO', M + 2, y); doc.text('QTD', 128, y, { align: 'right' }); doc.text('UNIT.', 158, y, { align: 'right' }); doc.text('TOTAL', W - M - 2, y, { align: 'right' }); y += 6;
    for (const i of v.itens) {
      const desc = doc.splitTextToSize(i.nome + (i.imei ? ` — IMEI ${i.imei}` : ''), 100);
      espaco(desc.length * 4.6 + 3);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(30, 30, 30);
      doc.text(desc, M + 2, y); doc.text(String(i.qtd), 128, y, { align: 'right' }); doc.text(money(i.preco), 158, y, { align: 'right' }); doc.text(money(i.preco * i.qtd), W - M - 2, y, { align: 'right' });
      y += desc.length * 4.6; doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.2); doc.line(M, y - 2.5, W - M, y - 2.5); y += 1.5;
    }
    espaco(22);
    doc.setFontSize(9.5); doc.setTextColor(...GRAY);
    if (v.desconto) { doc.text('Subtotal ' + money(v.subtotal || v.total + v.desconto) + '   ·   Desconto -' + money(v.desconto), W - M - 2, y, { align: 'right' }); y += 6; }
    if (v.troca) {
      espaco(12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
      doc.text(doc.splitTextToSize(`Aparelho recebido na troca: ${v.troca.nome}${v.troca.imei ? ' (IMEI ' + v.troca.imei + ')' : ''}`, 130), M + 2, y);
      doc.text('-' + money(v.troca.valor), W - M - 2, y, { align: 'right' }); y += 5.5;
      doc.setFont('helvetica', 'bold'); doc.text(v.pago >= 0 ? 'Valor pago pelo cliente' : 'Valor devolvido ao cliente', M + 2, y); doc.text(money(Math.abs(v.pago)), W - M - 2, y, { align: 'right' }); y += 6;
    }
    doc.setFillColor(0, 0, 0); doc.roundedRect(M, y - 1, W - 2 * M, 11, 2, 2, 'F');
    doc.setTextColor(200, 200, 200); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${v.troca ? 'Troca + ' : ''}${FORMAS_PGTO[v.forma] || v.forma || ''} · ${fmtDateTime(v.data)}`, M + 5, y + 6);
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('TOTAL ' + money(v.total), W - M - 5, y + 6.3, { align: 'right' });
    y += 16;

    // Garantia agrupada por prazo (ex.: "iPhone 13 — 6 meses" e "28 acessórios — 3 meses")
    const grupos = {};
    for (const i of v.itens.filter(i => i.seminovo || i.garantiaDias)) {
      const dias = i.seminovo ? GARANTIA_SEMINOVO_DIAS : i.garantiaDias;
      (grupos[dias] ||= []).push(i);
    }
    const prazoTxt = d => d >= 365 && d % 365 === 0 ? `${d / 365} ano${d > 365 ? 's' : ''}` : d % 30 === 0 && d >= 60 ? `${d / 30} meses` : `${d} dias`;
    if (Object.keys(grupos).length) {
      titulo('Garantia');
      doc.setFontSize(9.5);
      for (const [dias, its] of Object.entries(grupos).sort((a, b) => b[0] - a[0])) {
        const nomes = its.length <= 3 ? its.map(i => i.nome).join(', ') : `${its.length} itens (${its.slice(0, 2).map(i => i.nome).join(', ')}...)`;
        const linhas = doc.splitTextToSize(nomes, 120);
        espaco(linhas.length * 4.6 + 2);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK); doc.text(linhas, M, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40); doc.text(`${prazoTxt(+dias)} · até ${fmtDate(addDays(v.data, +dias))}`, W - M, y, { align: 'right' });
        y += linhas.length * 4.6 + 1.2;
      }
      y += 1;
    }
    const termos = [];
    if (v.itens.some(i => i.seminovo)) termos.push(['Celulares seminovos', s.termosGarantiaSeminovo]);
    if (v.itens.some(i => !i.seminovo)) termos.push(['Celulares novos e acessórios', s.termosGarantiaProduto]);
    if (termos.some(t => t[1])) {
      titulo('Termos de garantia');
      for (const [t, txt] of termos.filter(t => t[1])) {
        const linhas = doc.splitTextToSize(txt, W - 2 * M);
        espaco(6 + linhas.length * 3.7);
        if (termos.length > 1) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BLACK); doc.text(t, M, y); y += 4.2; }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); doc.setTextColor(50, 50, 50);
        doc.text(linhas, M, y, { lineHeightFactor: 1.3 }); y += linhas.length * 3.7 + 3;
      }
    }

    // Assinaturas e rodapé
    espaco(22);
    y = Math.min(Math.max(y + 16, 262), FIM - 4);
    const sig = (label, x) => { doc.setDrawColor(...BLACK); doc.setLineWidth(0.3); doc.line(x, y, x + 80, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY); doc.text(label, x + 40, y + 4.5, { align: 'center' }); };
    if (s.assinaturaDono) try { doc.addImage(s.assinaturaDono, 'PNG', W - M - 65, y - 17, 50, 16); } catch {}
    sig('Cliente — ' + (c.nome || v.clienteNome || ''), M); sig(s.loja, W - M - 80);
    const pages = doc.getNumberOfPages();
    for (let n = 1; n <= pages; n++) {
      doc.setPage(n);
      doc.setFillColor(0, 0, 0); doc.rect(0, 287, W, 10, 'F');
      doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(`Obrigado pela preferência! ${s.loja}${pages > 1 ? `   ·   página ${n} de ${pages}` : ''}`, W / 2, 293, { align: 'center' });
    }
    return doc;
  },

  nome(d) { return `garantia-${d.tipo === 'venda' ? 'venda' : 'os'}-${d.numero}.pdf`; },

  baixar(doc, nome) { doc.save(nome); },

  // No celular abre o menu de compartilhar (WhatsApp etc.) com o PDF anexado
  async compartilhar(doc, nome, texto) {
    const file = new File([doc.output('blob')], nome, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nome, text: texto }); return true; }
      catch (e) { if (e.name === 'AbortError') return true; }
    }
    doc.save(nome);
    return false;
  },
};

/* Monta os dados do PDF a partir do banco local */
const GarantiaDados = {
  os(o) {
    const s = Store.s, c = Store.cliente(o.clienteId) || {};
    const tec = s.tecnicos.find(t => t.id === o.tecnicoId);
    return {
      tipo: 'reparo', numero: o.numero, loja: { nome: s.loja, cnpj: s.cnpj, telefone: s.telefone, endereco: s.endereco, instagram: s.instagram },
      cliente: { nome: c.nome, doc: c.doc, docTipo: c.docTipo, telefone: fmtPhone(c.telefone) },
      aparelho: o.aparelho || {}, defeito: o.defeito,
      itens: [{ desc: o.servico || o.defeito || 'Serviço', valor: Store.osTotal(o) + (Number(o.desconto) || 0) }, ...(o.pecas || []).map(p => ({ desc: 'Peça: ' + p.nome, qtd: p.qtd, valor: null }))],
      desconto: Number(o.desconto) || 0, total: Store.osTotal(o), forma: FORMAS_PGTO[o.pagamento?.forma] || '',
      inicio: Store.garantiaInicio(o) || nowISO(), dias: GARANTIA_REPARO_DIAS, termos: s.termosGarantia,
      tecnico: tec?.nome, assinaturaTecnico: tec?.assinatura || s.assinaturaDono, assinaturaCliente: o.assinaturaCliente,
    };
  },
  // Um termo por aparelho seminovo vendido
  venda(v, item) {
    const s = Store.s, c = v.clienteId ? Store.cliente(v.clienteId) || {} : {};
    return {
      tipo: 'venda', numero: v.numero, loja: { nome: s.loja, cnpj: s.cnpj, telefone: s.telefone, endereco: s.endereco, instagram: s.instagram },
      cliente: { nome: c.nome || v.clienteNome || 'Consumidor', doc: c.doc, docTipo: c.docTipo, telefone: fmtPhone(c.telefone) },
      aparelho: { modelo: item.nome, imei: item.imei, cor: item.cor },
      itens: [{ desc: item.nome + (item.imei ? ` (IMEI ${item.imei})` : ''), qtd: item.qtd, valor: item.preco * item.qtd }],
      desconto: 0, total: item.preco * item.qtd, forma: FORMAS_PGTO[v.forma] || '',
      inicio: v.data, dias: GARANTIA_SEMINOVO_DIAS, termos: s.termosGarantiaSeminovo || s.termosGarantia,
      assinaturaTecnico: s.assinaturaDono,
    };
  },
};
