/* ================= RELATÓRIOS: PDF (impressão) e Word (.docx) =================
   Os dois saem do mesmo modelo de memorial usado na tela (modeloParafuso / modeloMacaco).
   O .docx é montado aqui mesmo, sem bibliotecas: XML do WordprocessingML num ZIP sem
   compressão. A figura é o desenho da animação com a carga total, rasterizado em PNG. */

const mathTxt = s => String(s).replace(/<[^>]+>/g, '').replace(RE_SUB, '$1$2');
const xmlEscape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/* ---------- ZIP (método "store") ---------- */
function crc32(bytes) {
  if (!crc32.t) {
    crc32.t = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc32.t[n] = c >>> 0; }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = crc32.t[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files, tipo) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lo = new Uint8Array(30 + nm.length), lv = new DataView(lo.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, sz, true); lv.setUint32(22, sz, true); lv.setUint16(26, nm.length, true);
    lo.set(nm, 30); parts.push(lo, f.data);
    const ce = new Uint8Array(46 + nm.length), cv = new DataView(ce.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, sz, true); cv.setUint32(24, sz, true); cv.setUint16(28, nm.length, true);
    cv.setUint32(42, off, true); ce.set(nm, 46); central.push(ce);
    off += lo.length + sz;
  }
  const csz = central.reduce((s, c) => s + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, csz, true); ev.setUint32(16, off, true);
  return new Blob([...parts, ...central, end], {type: tipo});
}

/* ---------- blocos do WordprocessingML ---------- */
function wPara(text, o = {}) {
  const {bold = false, italic = false, size = 20, align = null, antes = 0, depois = 100, cor = null, mono = false} = o;
  let pPr = `<w:spacing w:before="${antes}" w:after="${depois}"/>` + (align ? `<w:jc w:val="${align}"/>` : '');
  let rPr = (mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '') +
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` + (bold ? '<w:b/>' : '') + (italic ? '<w:i/>' : '') + (cor ? `<w:color w:val="${cor}"/>` : '');
  return `<w:p><w:pPr>${pPr}<w:rPr>${rPr}</w:rPr></w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xmlEscape(mathTxt(text))}</w:t></w:r></w:p>`;
}
const W_UTIL = 9638;                                   // A4 com margens de 20 mm, em twips
function wTabela(linhas, larg) {
  const total = larg.reduce((a, b) => a + b, 0), k = W_UTIL / total, L = larg.map(x => Math.round(x * k));
  const bordas = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`).join('')}</w:tblBorders>`;
  const corpo = linhas.map((cs, ri) => `<w:tr>${ri === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cs.map((c, ci) =>
    `<w:tc><w:tcPr><w:tcW w:w="${L[ci]}" w:type="dxa"/>${ri === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="EDF1F4"/>' : ''}</w:tcPr>` +
    wPara(c, {bold: ri === 0, size: ri === 0 ? 15 : 16, antes: 20, depois: 20}) + '</w:tc>').join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${W_UTIL}" w:type="dxa"/>${bordas}<w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${L.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${corpo}</w:tbl>` + wPara('', {size: 8, depois: 0});
}
const wTitulo = t => wPara(t, {bold: true, size: 24, antes: 280, depois: 120, cor: '1A5C8C'});
function wFigura(fig, num) {
  const id = 100 + num;
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="160" w:after="40"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${fig.cx}" cy="${fig.cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="Figura ${num}" descr="${xmlEscape(mathTxt(fig.legenda))}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${fig.nome}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${fig.relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${fig.cx}" cy="${fig.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>` +
    wPara(`Figura ${num} — ${fig.legenda}`, {italic: true, size: 16, align: 'center', cor: '555555', depois: 200});
}

/* ---------- conteúdo do relatório (comum a PDF e Word) ---------- */
/* bloco de identificação do documento, igual no PDF e no Word */
function identLinhas(R) {
  const v = x => x || '—';
  return [['Projeto', v(R.projeto)], ['Tag do documento', v(R.tag)], ['Revisão', v(R.rev)], ['Responsável', v(R.resp)],
    ['Data', v(R.data)], ['Elemento analisado', mathTxt(R.m.subtitulo)], ['Gerado em', `${dataHora()} · forças em ${UN.f}`]];
}
const rotuloDoc = R => R.tag ? `${R.tag}${R.rev ? ' rev. ' + R.rev : ''}` : '';
const dataHora = () => { const d = new Date(); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}); };
/* endereço da análise no rodapé: o da própria página quando publicada; aberto do disco
   (file://), usa o endereço publicado no GitHub Pages */
const SITE_PADRAO = 'https://matheusmerlim1.github.io/parafuso-carga/';
const siteAnalise = modo => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : SITE_PADRAO) + (modo ? '#' + modo : '');
const AVISO = 'Ferramenta de pré-dimensionamento — não substitui a verificação e a ART de um engenheiro responsável. Não são verificados: ancoragem de chumbadores no concreto, rasgamento de borda, flexão da placa de base e efeitos de temperatura. Base: Shigley, Elementos de Máquinas, 10ª ed. (cap. 8, §4-11), ISO 898-1, ISO 3506-1, ISO 261/262; espanamento de roscas conforme Norton, cap. 15.';

function buildWordParas(R, figs) {
  const m = R.m, P = [];
  P.push(wPara('Parafuso & Carga — memorial de cálculo', {bold: true, size: 34, align: 'center', depois: 60}));
  P.push(wPara(m.titulo, {size: 24, align: 'center', depois: 60}));
  P.push(wPara(m.subtitulo, {bold: true, size: 22, align: 'center', depois: 100}));
  P.push(wTitulo('Identificação do documento'));
  P.push(wTabela([['Campo', 'Valor'], ...identLinhas(R)], [2600, 7038]));
  P.push(wTitulo('Resumo da verificação'));
  P.push(wTabela([['Verificação', 'Solicitante', 'Resistente', 'n', 'Situação'], ...m.resumo], [2600, 2300, 2700, 800, 1238]));
  if (figs[0]) P.push(wFigura(figs[0], 1));
  P.push(wTitulo('A. Variáveis de entrada'));
  P.push(wTabela([['Símbolo', 'Descrição', 'Valor', 'Origem'], ...m.entradas], [1200, 3700, 2700, 2038]));
  P.push(wTitulo('B. Constantes e critérios adotados'));
  P.push(wTabela([['Símbolo', 'Descrição', 'Valor', 'Fonte'], ...m.constantes], [1200, 3500, 2500, 2438]));
  P.push(wTitulo(mathTxt(m.propsTitulo).replace(/^C · /, 'C. ')));
  P.push(wTabela([['Símbolo', 'Descrição', 'Valor', 'Fonte'], ...m.props], [1200, 3700, 2400, 2338]));
  for (const sec of m.secoes) {
    P.push(wTitulo(`${sec.num}. ${sec.titulo}`));
    for (const ps of sec.passos) {
      P.push(wPara(`Passo ${ps.num} — ${ps.t}`, {bold: true, size: 19, antes: 140, depois: 40}));
      P.push(wPara(`Fórmula:      ${ps.f}`, {size: 17, depois: 20, mono: true}));
      P.push(wPara(`Substituindo: ${ps.s}`, {size: 17, depois: 20, mono: true}));
      const marca = ps.ok === undefined || ps.ok === null ? '' : ps.ok ? '   [ATENDE]' : '   [NÃO ATENDE]';
      P.push(wPara(`Resultado:    ${ps.r}${marca}`, {bold: true, size: 17, mono: true, depois: 30, cor: ps.ok == null ? null : ps.ok ? '256B4D' : 'A1332C'}));
      if (ps.n) P.push(wPara(ps.n, {italic: true, size: 15, cor: '666666', depois: 60}));
    }
    if (sec.tabela) P.push(wTabela([sec.tabela.cab, ...sec.tabela.linhas], sec.tabela.cab.map(() => 1000)));
  }
  P.push(wTitulo('D. Resumo das variáveis de saída'));
  P.push(wTabela([['Símbolo', 'Descrição', 'Valor'], ...m.saidas], [1400, 5000, 3238]));
  if (R.alternativas && R.alternativas.length) {
    P.push(wTitulo('E. Alternativas avaliadas — menor rosca que atende em cada classe'));
    P.push(wTabela([['Elemento', 'Classe', 'Menor rosca', 'n (governa)', 'Verificação que governa', 'Uso frequente'], ...R.alternativas], [2000, 900, 1500, 1100, 2800, 1338]));
  }
  P.push(wPara(m.conclusao, {bold: true, size: 20, cor: m.ok ? '256B4D' : 'A1332C', antes: 160, depois: 120}));
  P.push(wPara(AVISO, {italic: true, size: 15, cor: '777777', antes: 320}));
  P.push(wPara(`Análise disponível em: ${siteAnalise(R.modo)}`, {size: 15, cor: '1A5C8C', antes: 60}));
  return P;
}
const NS_DOC = ['xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"', 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"', 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'].join(' ');
function wRodape(url, doc = '') {
  const r = '<w:rPr><w:sz w:val="15"/><w:szCs w:val="15"/><w:color w:val="777777"/></w:rPr>';
  const rl = '<w:rPr><w:sz w:val="15"/><w:szCs w:val="15"/><w:color w:val="1A5C8C"/><w:u w:val="single"/></w:rPr>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS_DOC}><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="BFBFBF"/></w:pBdr><w:jc w:val="center"/></w:pPr>` +
    `<w:r>${r}<w:t xml:space="preserve">${doc ? xmlEscape(doc) + ' · ' : ''}Análise gerada em Parafuso &amp; Carga — </w:t></w:r>` +
    `<w:hyperlink r:id="rIdSite"><w:r>${rl}<w:t>${xmlEscape(url)}</w:t></w:r></w:hyperlink>` +
    `<w:r>${r}<w:t xml:space="preserve"> · página </w:t></w:r><w:r>${r}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${r}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r>${r}<w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
}
function buildDocx(paras, figs, url = siteAnalise(), rotulo = '') {
  const body = paras.join('') + '<w:sectPr><w:footerReference w:type="default" r:id="rIdRodape"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567"/></w:sectPr>';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS_DOC}><w:body>${body}</w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${figs.length ? '<Default Extension="png" ContentType="image/png"/>' : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const drels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${figs.map(f => `<Relationship Id="${f.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${f.nome}"/>`).join('')}<Relationship Id="rIdRodape" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
  const frels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSite" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(url)}" TargetMode="External"/></Relationships>`;
  const enc = new TextEncoder();
  return makeZip([
    {name: '[Content_Types].xml', data: enc.encode(ct)}, {name: '_rels/.rels', data: enc.encode(rels)},
    {name: 'word/document.xml', data: enc.encode(doc)}, {name: 'word/_rels/document.xml.rels', data: enc.encode(drels)},
    {name: 'word/footer1.xml', data: enc.encode(wRodape(url, rotulo))}, {name: 'word/_rels/footer1.xml.rels', data: enc.encode(frels)},
    ...figs.map(f => ({name: `word/media/${f.nome}`, data: f.bytes}))
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/* ---------- figura: SVG da animação com carga total, estilos embutidos, em PNG ---------- */
const PROPS_SVG = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight'];
function svgAutonomo(R) {
  /* desenha num SVG temporário com o tema claro, copia os estilos calculados para cada elemento */
  const raiz = document.documentElement, tema = raiz.getAttribute('data-theme');
  raiz.setAttribute('data-theme', 'light');
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmp.setAttribute('class', 'fig'); tmp.setAttribute('data-mr-ignore', '');
  tmp.setAttribute('viewBox', R.viewBox);
  tmp.style.cssText = 'position:absolute;left:-9999px;top:0;width:1200px';
  tmp.innerHTML = `<rect x="0" y="0" width="100%" height="100%" fill="#F5F7F6"/>` + R.fn(1, 0);
  document.body.appendChild(tmp);
  for (const el of tmp.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    el.setAttribute('style', PROPS_SVG.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';'));
    el.removeAttribute('class');
  }
  tmp.removeAttribute('style'); tmp.removeAttribute('class'); tmp.removeAttribute('data-mr-ignore');
  const [, , vw, vh] = R.viewBox.split(/\s+/);
  tmp.setAttribute('width', vw); tmp.setAttribute('height', vh);
  const xml = new XMLSerializer().serializeToString(tmp);
  tmp.remove();
  if (tema) raiz.setAttribute('data-theme', tema); else raiz.removeAttribute('data-theme');
  return xml.includes('xmlns=') ? xml : xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}
async function svgParaPng(xml, w, h) {
  const url = URL.createObjectURL(new Blob([xml], {type: 'image/svg+xml;charset=utf-8'}));
  try {
    const img = new Image();
    await new Promise((ok, falha) => {
      const t = setTimeout(() => falha(new Error('tempo esgotado')), 8000);
      img.onload = () => { clearTimeout(t); ok(); }; img.onerror = () => { clearTimeout(t); falha(new Error('SVG inválido')); };
      img.src = url;
    });
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    return await new Promise(r => cv.toBlob(r, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
async function figuraRelatorio(R) {
  const [, , vw, vh] = R.viewBox.split(/\s+/).map(Number), w = 1600, h = Math.round(1600 * vh / vw);
  const png = await svgParaPng(svgAutonomo(R), w, h);
  const bytes = new Uint8Array(await png.arrayBuffer());
  const cx = 6120000, cy = Math.round(cx * vh / vw);          // 17 cm de largura
  return {bytes, cx, cy, nome: 'figura1.png', relId: 'rIdImg1', legenda: R.legenda};
}

/* ---------- saídas ---------- */
function baixar(nome, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const limpaNome = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
const nomeArquivo = (R, ext) => R.tag
  ? `${limpaNome(R.tag)}${R.rev ? '_rev' + limpaNome(R.rev) : ''}_${R.modo}_${limpaNome(R.slug)}.${ext}`
  : `parafuso-carga_${R.modo}_${limpaNome(R.slug)}_${new Date().toISOString().slice(0, 10)}.${ext}`;
async function relatorioWord(R) {
  let figs = [];
  try { figs = [await figuraRelatorio(R)]; } catch (err) { figs = []; }   // sem figura, o memorial sai igual
  baixar(nomeArquivo(R, 'docx'), buildDocx(buildWordParas(R, figs), figs, siteAnalise(R.modo), rotuloDoc(R)));
}
function relatorioPdf(R) {
  const m = R.m;
  $('printReport').innerHTML = `<div class="pr-h"><h1>Parafuso &amp; Carga</h1>
      <div class="pr-meta">${mathHtml(m.titulo)} · ${mathHtml(m.subtitulo)}</div>
      ${mtabela(['Identificação do documento', ''], identLinhas(R).map(([k, v]) => [k, xmlEscape(v)]), ['', '']).replace('class="mtable"', 'class="mtable pr-id"')}</div>
    <div class="pr-fig"><svg class="fig" data-mr-ignore viewBox="${R.viewBox}">${R.fn(1, 0)}</svg><p class="pr-leg">Figura 1 — ${mathHtml(R.legenda)}</p></div>
    <div class="memorial">${renderModelo(m)}
      ${R.alternativas && R.alternativas.length ? `<div class="msection"><h4>E · Alternativas avaliadas — menor rosca que atende em cada classe</h4>
        ${mtabela(['Elemento', 'Classe', 'Menor rosca', 'n (governa)', 'Verificação que governa', 'Uso frequente'], R.alternativas, ['', 'val', 'val', 'val', '', ''])}</div>` : ''}</div>
    <div class="pr-f">${AVISO}<br>Análise disponível em: <a href="${xmlEscape(siteAnalise(R.modo))}">${xmlEscape(siteAnalise(R.modo))}</a></div>
    <div class="pr-rod">${rotuloDoc(R) ? xmlEscape(rotuloDoc(R)) + ' · ' : ''}Análise gerada em Parafuso &amp; Carga — <a href="${xmlEscape(siteAnalise(R.modo))}">${xmlEscape(siteAnalise(R.modo))}</a></div>`;
  window.print();
}

/* ---------- SMath Studio (.sm) ----------
   Mesmo modelo do PDF e do Word. Cada seção do memorial vai para uma área recolhida do
   SMath com todas as contas; fora da área o resultado é chamado de novo. Detalhes (conta viva
   x valor, áreas, layout) em js/smath-export.js. */
function relatorioSmath(R) {
  const S = window.SMathExport, m = R.m;
  const doc = new S.Documento({autor: R.resp || '', casas: 3});
  const mem = new S.Memorial(doc);
  doc.titulo('Parafuso & Carga — memorial de cálculo', 1);
  doc.texto(S.limpar(m.titulo), {negrito: true, alinhamento: 'center'});
  doc.texto(S.limpar(m.subtitulo), {alinhamento: 'center'});
  doc.titulo('Identificação do documento', 2);
  doc.texto(identLinhas(R).map(([k, v]) => `${k}: ${S.limpar(v)}`).join('\n'));
  doc.titulo('A. Variáveis de entrada', 2);
  m.entradas.forEach(([s, d, v, o]) => mem.dado(s, d, v, o));
  doc.titulo('B. Constantes e critérios adotados', 2);
  m.constantes.forEach(([s, d, v, o]) => mem.dado(s, d, v, o));
  doc.titulo(S.limpar(m.propsTitulo).replace(/^C · /, 'C. '), 2);
  m.props.forEach(([s, d, v, o]) => mem.dado(s, d, v, o));
  for (const sec of m.secoes) {
    mem.secao(`${sec.num}. ${sec.titulo}`, sec.passos, {
      depois: sec.tabela ? () => mem.tabela(sec.tabela.cab, sec.tabela.linhas) : null
    });
  }
  doc.titulo('D. Resumo das variáveis de saída', 2);
  m.saidas.forEach(([s, d, v]) => { if (!mem.mostrarSeDefinido(s, d)) doc.texto(`${S.limpar(s)} — ${S.limpar(d)}: ${S.limpar(v)}`); });
  doc.titulo('Resumo da verificação', 2);
  mem.tabela(['Verificação', 'Solicitante', 'Resistente', 'n', 'Situação'], m.resumo);
  if (R.alternativas && R.alternativas.length) {
    doc.titulo('E. Alternativas avaliadas', 2);
    mem.tabela(ALT_CAB, R.alternativas);
  }
  doc.espaco(9);
  doc.texto(S.limpar(m.conclusao), {negrito: true, cor: m.ok ? '#256B4D' : '#A1332C'});
  doc.texto(AVISO, {italico: true});
  doc.texto(`Análise disponível em: ${siteAnalise(R.modo)}`);
  S.baixar(nomeArquivo(R, 'sm'), doc);
  return mem.stats;
}
const ALT_CAB = ['Elemento', 'Classe', 'Menor rosca', 'n (governa)', 'Verificação que governa', 'Uso frequente'];
