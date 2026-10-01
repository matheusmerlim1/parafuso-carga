/* ---------- desenhos e animações (SVG) ----------
   Cada desenho é uma função (s) → SVG, com s de 0 a 1 = fração da carga aplicada.
   O laço de animação varre s com (1 − cos)/2: a carga sobe, segura e volta, sem trancos. */

const f1 = v => Math.round(v * 10) / 10;
function seta(x1, y1, x2, y2, cls, cab = 7) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 0.5) return '';
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, c = Math.min(cab, L * 0.6);
  const bx = x2 - ux * c, by = y2 - uy * c, w = c * 0.5;
  return `<line class="${cls}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(bx)}" y2="${f1(by)}"/>` +
    `<polygon class="${cls} hd" points="${f1(x2)},${f1(y2)} ${f1(bx - uy * w)},${f1(by + ux * w)} ${f1(bx + uy * w)},${f1(by - ux * w)}"/>`;
}
const txt = (x, y, s, cls = 'lb', anc = 'middle') => `<text class="${cls}" x="${f1(x)}" y="${f1(y)}" text-anchor="${anc}">${s}</text>`;
const kNt = N => kN(N, 2);

/* ---------- animador: um único laço para o desenho visível ---------- */
const ANIM = {
  fn: null, el: null, t0: 0, pausado: false, s: 1, per: 4200, raf: 0, onS: null,
  set(el, fn, onS) { this.el = el; this.fn = fn; this.onS = onS; this.desenha(); this.agenda(); },
  desenha(t = 0) { if (this.el && this.fn) { this.el.innerHTML = this.fn(this.s, t); if (this.onS) this.onS(this.s); } },
  agenda() {
    cancelAnimationFrame(this.raf);
    if (this.pausado || !this.fn) return;
    const loop = t => {
      if (!this.t0) this.t0 = t;
      const fase = ((t - this.t0) % this.per) / this.per;
      this.s = (1 - Math.cos(2 * Math.PI * fase)) / 2;
      this.desenha(t - this.t0);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  alterna() { this.pausado = !this.pausado; if (this.pausado) { cancelAnimationFrame(this.raf); } else { this.t0 = 0; this.agenda(); } return this.pausado; },
  fixa(s) { this.pausado = true; cancelAnimationFrame(this.raf); this.s = s; this.desenha(); }
};

/* ---------- junta axial: corte da junta + diagrama força × deformação ---------- */
function estadoJunta(a, e, s) {
  const Pmax = a.q.Pb, Pmin = e.variavel ? Math.min(a.q.Pbmin, Pmax) : 0;
  const P = Pmin + (Pmax - Pmin) * s;
  const separou = a.semPre ? P > 0 : P > a.P0;
  const Fb = separou ? P : a.Fi + a.C * P, Fm = separou ? 0 : a.Fi - (1 - a.C) * P;
  return {P, Fb, Fm, separou};
}
function desenhoJunta(a, e, s) {
  const st = estadoJunta(a, e, s);
  /* corte da junta (esquerda, 0..230) */
  const gap = st.separou ? Math.min(18, 4 + 14 * (st.P - a.P0) / Math.max(a.q.Pb - a.P0, 1)) : 0;
  const cx = 115, yJ = 150, h1 = 42, h2 = 42, wP = 170;
  const yTop = yJ - h1 - gap / 2, yBot = yJ + gap / 2;
  const uso = Math.min(st.Fb / a.Fprova, 1.2);
  const bw = 22, head = 16;
  let g = '';
  g += `<rect class="pl" x="${cx - wP / 2}" y="${f1(yTop)}" width="${wP}" height="${h1}" rx="2"/>`;
  g += `<rect class="pl pl2" x="${cx - wP / 2}" y="${f1(yBot)}" width="${wP}" height="${h2}" rx="2"/>`;
  g += `<rect class="bolt" style="--u:${f1(uso * 100)}%" x="${cx - bw / 2}" y="${f1(yTop - 4)}" width="${bw}" height="${f1(h1 + h2 + gap + 8)}"/>`;
  g += `<rect class="nut" x="${cx - 26}" y="${f1(yTop - head)}" width="52" height="${head}" rx="2"/>`;
  g += `<rect class="nut" x="${cx - 26}" y="${f1(yBot + h2)}" width="52" height="${head}" rx="2"/>`;
  for (let k = 0; k < 7; k++) g += `<line class="thr" x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${f1(yBot + h2 - 4 - k * 5)}" y2="${f1(yBot + h2 - 7 - k * 5)}"/>`;
  const aL = 18 + 26 * s;
  for (const x of [cx - 62, cx + 62]) {
    g += seta(x, yTop + 6, x, yTop + 6 - aL - 6, 'ar-load');
    g += seta(x, yBot + h2 - 6, x, yBot + h2 - 6 + aL + 6, 'ar-load');
  }
  g += txt(cx + 70, yTop - 34, `P = ${kNt(st.P)}`, 'lb lbA', 'end');
  g += txt(cx, yBot + h2 + head + 30, `F_b = ${kNt(st.Fb)}`.replace('F_b', 'F<tspan baseline-shift="sub" font-size="9">b</tspan>'), 'lb lbB');
  g += txt(cx, yBot + h2 + head + 46, st.separou ? 'junta separada' : `F_m = ${kNt(st.Fm)}`.replace('F_m', 'F<tspan baseline-shift="sub" font-size="9">m</tspan>'), st.separou ? 'lb lbBad' : 'lb');

  /* diagrama F × δ (direita, 250..600) */
  const X0 = 270, Y0 = 260, W = 310, Hh = 220;
  const kb = a.g.kb, km = a.km;
  const Fi = a.Fi, dB = Fi / kb, dM = Fi / km;
  const Pmax = a.q.Pb;
  const Fmax = Math.max(a.Fprova, Fi + a.C * Pmax, Pmax) * 1.08;
  const dMaxB = Math.max(Fmax / kb, dB + dM);
  const sx = W / (dMaxB * 1.05), sy = Hh / Fmax;
  const X = d => X0 + d * sx, Y = F => Y0 - F * sy;
  let d = `<line class="ax" x1="${X0}" y1="${Y0}" x2="${X0 + W}" y2="${Y0}"/><line class="ax" x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y0 - Hh - 8}"/>`;
  d += txt(X0 + W, Y0 + 16, 'δ', 'lb', 'end') + txt(X0 - 8, Y0 - Hh - 4, 'F', 'lb', 'end');
  d += `<line class="prova" x1="${X0}" y1="${f1(Y(a.Fprova))}" x2="${X0 + W}" y2="${f1(Y(a.Fprova))}"/>` + txt(X0 + W, Y(a.Fprova) - 5, 'S<tspan baseline-shift="sub" font-size="9">p</tspan>·A<tspan baseline-shift="sub" font-size="9">t</tspan>', 'lb lbS', 'end');
  const dBolt = st.Fb / kb;
  if (!a.semPre) {
    d += `<line class="ln-b" x1="${X(0)}" y1="${Y(0)}" x2="${f1(X(Math.max(dBolt, dB) * 1.02))}" y2="${f1(Y(Math.max(st.Fb, Fi) * 1.02))}"/>`;
    d += `<line class="ln-m" x1="${f1(X(dB + dM))}" y1="${Y(0)}" x2="${f1(X(dB))}" y2="${f1(Y(Fi))}"/>`;
    d += `<line class="ln-m dash" x1="${f1(X(dB))}" y1="${f1(Y(Fi))}" x2="${f1(X(Math.max(dB - dM * 0.3, 0)))}" y2="${f1(Y(Fi * 1.3))}"/>`;
    d += `<line class="guide" x1="${X0}" y1="${f1(Y(Fi))}" x2="${f1(X(dB))}" y2="${f1(Y(Fi))}"/>` + txt(X0 - 5, Y(Fi) + 4, 'F<tspan baseline-shift="sub" font-size="9">i</tspan>', 'lb', 'end');
    const yb = Y(st.Fb), ym = Y(st.Fm), xb = X(dBolt);
    d += `<line class="ln-P" x1="${f1(xb)}" y1="${f1(ym)}" x2="${f1(xb)}" y2="${f1(yb)}"/>`;
    d += `<circle class="pt-b" cx="${f1(xb)}" cy="${f1(yb)}" r="4.5"/><circle class="pt-m" cx="${f1(xb)}" cy="${f1(ym)}" r="4.5"/>`;
    if (st.P > Pmax * 0.12) d += txt(xb + 8, (yb + ym) / 2 + 4, 'P', 'lb lbA', 'start');
    d += txt(X(dB * 0.45) - 6, Y(Fi * 0.45) - 6, 'parafuso k<tspan baseline-shift="sub" font-size="9">b</tspan>', 'lb lbB', 'end');
    d += txt(X(dB + dM * 0.55) + 6, Y(Fi * 0.45) - 6, 'membros k<tspan baseline-shift="sub" font-size="9">m</tspan>', 'lb lbM', 'start');
  } else {
    d += `<line class="ln-b" x1="${X(0)}" y1="${Y(0)}" x2="${f1(X(Fmax / kb))}" y2="${f1(Y(Fmax))}"/>`;
    d += `<circle class="pt-b" cx="${f1(X(dBolt))}" cy="${f1(Y(st.Fb))}" r="4.5"/>`;
    d += txt(X0 + 10, Y0 - Hh + 10, 'sem pré-carga: o parafuso recebe toda a carga', 'lb', 'start');
  }
  return g + d;
}

/* ---------- grupo na chapa (vista de frente) ---------- */
function desenhoChapa(e, q, a, s) {
  const pf = q.parafusos, d = a.r.d;
  const xs = pf.map(b => b.x).concat(e.ax), ys = pf.map(b => b.y).concat(e.ay);
  const mg = Math.max(e.px, e.py, 3 * d) * 0.75;
  const x0 = Math.min(...xs) - mg, x1 = Math.max(...xs) + mg, y0 = Math.min(...ys) - mg, y1 = Math.max(...ys) + mg;
  const W = 600, H = 330, sc = Math.min((W - 40) / (x1 - x0), (H - 40) / (y1 - y0));
  const ox = W / 2 - (x0 + x1) / 2 * sc, oy = H / 2 + (y0 + y1) / 2 * sc;
  const X = x => ox + x * sc, Y = y => oy - y * sc;
  /* movimento exagerado da chapa: giro em torno do centroide + translação na direção de F */
  const th = (q.M === 0 ? 0 : Math.sign(q.M)) * 2.2 * s;
  const Fm = Math.hypot(e.Fx, e.Fy) || 1, tr = 6 * s;
  const tx = e.Fx / Fm * tr, ty = -e.Fy / Fm * tr;
  const bx = pf.map(b => b.x), by = pf.map(b => b.y);
  const pmg = Math.max(e.px, e.py, 3 * d) * 0.55;
  const px0 = Math.min(...bx) - pmg, px1 = Math.max(...bx) + pmg, py0 = Math.min(...by) - pmg, py1 = Math.max(...by) + pmg;
  let g = `<g transform="translate(${f1(tx)} ${f1(ty)}) rotate(${f1(-th)} ${f1(X(0))} ${f1(Y(0))})">`;
  /* chapa: retângulo dos furos + braço até o ponto de carga */
  g += `<rect class="pl" x="${f1(X(px0))}" y="${f1(Y(py1))}" width="${f1((px1 - px0) * sc)}" height="${f1((py1 - py0) * sc)}" rx="3"/>`;
  const fora = e.ax < px0 || e.ax > px1 || e.ay < py0 || e.ay > py1;
  if (fora) {
    const hb = Math.min(py1 - py0, px1 - px0) * 0.35;
    if (Math.abs(e.ax) >= Math.abs(e.ay)) {
      const xa = e.ax > 0 ? px1 : e.ax - pmg * 0.6, xb2 = e.ax > 0 ? e.ax + pmg * 0.6 : px0;
      g += `<rect class="pl" x="${f1(X(xa))}" y="${f1(Y(e.ay + hb))}" width="${f1((xb2 - xa) * sc)}" height="${f1(2 * hb * sc)}"/>`;
    } else {
      const ya = e.ay > 0 ? py1 : e.ay - pmg * 0.6, yb2 = e.ay > 0 ? e.ay + pmg * 0.6 : py0;
      g += `<rect class="pl" x="${f1(X(e.ax - hb))}" y="${f1(Y(yb2))}" width="${f1(2 * hb * sc)}" height="${f1((yb2 - ya) * sc)}"/>`;
    }
  }
  g += `<circle class="cg" cx="${f1(X(0))}" cy="${f1(Y(0))}" r="4"/>`;
  const aL = 70, ux = e.Fx / Fm, uy = -e.Fy / Fm;
  g += seta(X(e.ax) - ux * aL, Y(e.ay) - uy * aL, X(e.ax), Y(e.ay), 'ar-load', 10);
  g += txt(X(e.ax) - ux * aL + (ux >= 0 ? -6 : 6), Y(e.ay) - uy * aL - 8, `F = ${kNt(Math.hypot(e.Fx, e.Fy))}`, 'lb lbA', ux >= 0 ? 'end' : 'start');
  g += '</g>';
  /* parafusos (fixos na peça de base) e forças que a chapa aplica em cada um */
  const Vmax = Math.max(...pf.map(b => b.V), 1), esc = Math.min(e.px || 80, e.py || 80, 90) * sc * 0.9 / Vmax;
  const rr = Math.max(d / 2 * sc, 4);
  for (const b of pf) {
    const cx = X(b.x), cy = Y(b.y), crit = b === q.crit;
    g += `<circle class="${crit ? 'hole crit' : 'hole'}" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(rr)}"/>`;
    g += seta(cx, cy, cx + b.p1[0] * esc * s, cy - b.p1[1] * esc * s, 'ar-p1', 6);
    g += seta(cx, cy, cx + b.p2[0] * esc * s, cy - b.p2[1] * esc * s, 'ar-p2', 6);
    g += seta(cx, cy, cx + b.v[0] * esc * s, cy - b.v[1] * esc * s, crit ? 'ar-res crit' : 'ar-res', 8);
    g += txt(cx, cy + rr + 12, b.id, 'lb lbS');
  }
  return g;
}

/* ---------- poste na placa de base (vista lateral + planta) ---------- */
function desenhoPoste(e, q, a, s) {
  const pf = q.parafusos;
  const W = 380, H = 360, gy = 250;                        // gy = topo da base de concreto
  const sc = Math.min(260 / e.Lp, 1.2);
  const cx = W / 2, pl = e.Lp * sc, tp = Math.max(e.t * sc, 6);
  const px = cx + pl / 2, py = gy;                         // borda de giro
  const th = 1.6 * s;                                      // graus, exagerado
  const X = x => cx + x * sc;
  const hPix = 185, poleW = Math.max(pl * 0.28, 20);
  let g = `<rect class="conc" x="10" y="${gy}" width="${W - 20}" height="${H - gy - 10}"/>`;
  g += `<line class="gnd" x1="10" y1="${gy}" x2="${W - 10}" y2="${gy}"/>`;
  /* chumbadores: extremidade ancorada fixa; o topo acompanha a placa */
  const rad = th * Math.PI / 180, cols = [...new Set(pf.map(b => b.x))];
  const Pmax = Math.max(...pf.map(b => b.P), 1);
  const topo = x => {                                       // posição da porca após o giro da placa
    const x0 = X(x) - px, y0 = gy - tp - 6 - py;
    return [px + x0 * Math.cos(rad) - y0 * Math.sin(rad), py + x0 * Math.sin(rad) + y0 * Math.cos(rad)];
  };
  for (const x of cols) {
    const P = Math.max(...pf.filter(b => b.x === x).map(b => b.P));
    const [xt, yt] = topo(x), u = P / Pmax;
    g += `<line class="anchor" style="--u:${f1(u * 100 * s)}%" x1="${f1(X(x))}" y1="${H - 30}" x2="${f1(xt)}" y2="${f1(yt)}"/>`;
    g += `<rect class="hook" x="${f1(X(x) - 9)}" y="${H - 32}" width="18" height="5"/>`;
  }
  /* placa + poste giram juntos em torno da borda comprimida */
  g += `<g transform="rotate(${f1(th)} ${f1(px)} ${f1(py)})">`;
  g += `<rect class="pl" x="${f1(cx - pl / 2)}" y="${f1(gy - tp)}" width="${f1(pl)}" height="${f1(tp)}"/>`;
  g += `<rect class="pole" x="${f1(cx - poleW / 2)}" y="${f1(gy - tp - hPix)}" width="${f1(poleW)}" height="${hPix}"/>`;
  for (const x of cols) g += `<rect class="nut" x="${f1(X(x) - 9)}" y="${f1(gy - tp - 8)}" width="18" height="8" rx="1"/>`;
  const yH = gy - tp - hPix + 6;
  g += seta(cx - poleW / 2 - 70, yH, cx - poleW / 2 - 2, yH, 'ar-load', 10);
  g += txt(cx - poleW / 2 - 74, yH - 8, `H = ${kNt(e.H)}`, 'lb lbA', 'start');
  if (e.N) g += e.N > 0 ? seta(cx, yH - 52, cx, yH - 12, 'ar-load', 9) + txt(cx + 8, yH - 38, `N = ${kNt(e.N)}`, 'lb lbA', 'start')
    : seta(cx, yH - 12, cx, yH - 52, 'ar-load', 9) + txt(cx + 8, yH - 38, `N = ${kNt(e.N)}`, 'lb lbA', 'start');
  g += '</g>';
  /* cota de h e pivô */
  g += `<line class="dim" x1="${W - 34}" y1="${yH}" x2="${W - 34}" y2="${gy - tp}"/>` + txt(W - 28, (yH + gy) / 2, `h = ${fmt(e.h / 1000, 2)} m`, 'lb', 'start');
  g += `<circle class="cg" cx="${f1(px)}" cy="${f1(py)}" r="4"/>` + txt(px + 8, py + 16, 'giro', 'lb lbS', 'start');
  /* rótulos de força por coluna */
  for (const x of cols) {
    const P = Math.max(...pf.filter(b => b.x === x).map(b => b.P));
    g += txt(X(x) + 8, H - 44, kN(P * s, 1), 'lb lbB', 'start');
  }
  return g;
}
function plantaPoste(e, q, s, d) {
  const pf = q.parafusos, W = 220, H = 220;
  const sc = Math.min(170 / e.Lp, 170 / e.Bp), cx = W / 2, cy = H / 2 + 6;
  const Pmax = Math.max(...pf.map(b => b.P), 1);
  let g = `<rect class="pl" x="${f1(cx - e.Lp * sc / 2)}" y="${f1(cy - e.Bp * sc / 2)}" width="${f1(e.Lp * sc)}" height="${f1(e.Bp * sc)}" rx="2"/>`;
  g += `<line class="pivot" x1="${f1(cx + e.Lp * sc / 2)}" y1="${f1(cy - e.Bp * sc / 2 - 8)}" x2="${f1(cx + e.Lp * sc / 2)}" y2="${f1(cy + e.Bp * sc / 2 + 8)}"/>`;
  g += seta(cx - 30, 16, cx + 30, 16, 'ar-load', 8) + txt(cx - 36, 20, 'H', 'lb lbA', 'end');
  for (const b of pf) {
    const u = b.P / Pmax;
    g += `<circle class="bt" style="--u:${f1(u * 100 * s)}%" cx="${f1(cx + b.x * sc)}" cy="${f1(cy - b.y * sc)}" r="${f1(Math.max(d * sc / 2, 5))}"/>`;
    g += txt(cx + b.x * sc, cy - b.y * sc + 3.5, b.id, 'lb lbS lbIn');
  }
  return g;
}

/* ---------- parafuso de pressão / nivelamento (vista frontal) ----------
   A ponta fica apoiada no piso e a cabeça não muda de altura; ao girar o parafuso, a rosca
   fêmea presa à estrutura sobe ou desce ao longo dele. Primeira metade do ciclo: sobe. */
function desenhoMacaco(e, a, s, t) {
  const W = 860, H = 330, piso = 292, sobe = ((t || 0) % ANIM.per) / ANIM.per < 0.5;
  const ds = a.dist, Fmax = Math.max(ds.Fmax, 1);
  const dy = -16 * s;                                          // elevação exagerada da estrutura
  const yPl = 176 + dy, tPl = 18;                              // viga roscada (pé da estrutura)
  const yHead = 110, bw = Math.min(10 + a.r.d * 0.55, 30);
  const T = sobe ? a.TS : a.TD;

  /* ---- vista lateral (olhando na direção y): cada coluna de parafusos na sua posição x ---- */
  const X0 = 110, X1 = 540, sc = (X1 - X0) / e.A, cxS = (X0 + X1) / 2;
  const X = x => cxS + x * sc;
  const cols = [];
  for (const p of ds.pts) {
    const c = cols.find(c => Math.abs(c.x - p.x) < 1);
    if (c) { c.n++; c.F = Math.max(c.F, p.F); } else cols.push({x: p.x, n: 1, F: p.F});
  }
  cols.sort((a, b) => a.x - b.x);
  const pw = Math.max(bw * 1.3, 16), poucos = cols.length <= 3;
  let g = `<rect class="conc" x="20" y="${piso}" width="540" height="${H - piso - 6}"/><line class="gnd" x1="20" y1="${piso}" x2="560" y2="${piso}"/>`;
  /* corpo da estrutura, com rebaixos para as cabeças */
  const cortes = [X0, ...cols.flatMap(c => [X(c.x) - pw, X(c.x) + pw]), X1];
  for (let i = 0; i < cortes.length; i += 2) {
    const w = cortes[i + 1] - cortes[i];
    if (w > 4) g += `<rect class="pole" x="${f1(cortes[i])}" y="${f1(112 + dy)}" width="${f1(w)}" height="${f1(yPl - 112 - dy)}" rx="2"/>`;
  }
  const xW = X(e.ex);
  g += seta(xW, 58 + dy, xW, 108 + dy, 'ar-load', 11) + txt(xW + 10, 70 + dy, `W = ${kNt(e.W)}`, 'lb lbA', 'start');
  const fase = (((t || 0) / (sobe ? 90 : -90)) % 6 + 6) % 6;   // filetes "correndo" = parafuso girando
  for (const [k, c] of cols.entries()) {
    const x = X(c.x), u = Math.max(c.F, 0) / Fmax * Math.min(1 / a.gov.razao, 1.2);
    g += `<rect class="bolt" style="--u:${f1(u * 100 * s)}%" x="${f1(x - bw / 2)}" y="${yHead}" width="${f1(bw)}" height="${piso - yHead}"/>`;
    for (let yy = yHead + 16 + fase; yy < piso - 2; yy += 6)
      g += `<line class="thr" x1="${f1(x - bw / 2)}" x2="${f1(x + bw / 2)}" y1="${f1(yy)}" y2="${f1(yy - 3)}"/>`;
    g += `<rect class="nut" x="${f1(x - bw * 0.95)}" y="${yHead - 14}" width="${f1(bw * 1.9)}" height="14" rx="2"/>`;
    g += pontaMacaco(e, a, x, bw, piso, yPl + tPl, s);
    const rx = bw * 1.6, ry = 8, yc = yHead - 7;
    const d = sobe ? `M${f1(x - rx)} ${f1(yc)} A${f1(rx)} ${ry} 0 0 0 ${f1(x + rx)} ${f1(yc)}` : `M${f1(x + rx)} ${f1(yc)} A${f1(rx)} ${ry} 0 0 1 ${f1(x - rx)} ${f1(yc)}`;
    g += `<path class="ar-load" d="${d}"/>` + seta(sobe ? x + rx - 1 : x - rx + 1, yc + 5, sobe ? x + rx : x - rx, yc - 3, 'ar-load', 8);
    if (poucos || k === 0) g += txt(x, yHead - 26, `T = ${fmt(T / 1000, 1)} N·m`, 'lb lbA');
    if (c.n > 1) g += txt(x + bw / 2 + 4, yHead + 12, `${c.n}×`, 'lb lbS', 'start');
    g += seta(x + bw / 2 + 9, piso + 26, x + bw / 2 + 9, piso - 4, 'ar-p2', 8);
    if (poucos || k === 0 || c.F === ds.Fmax) g += txt(x + bw / 2 + 15, piso + 20, kNt(e.kd * c.F), 'lb lbM', 'start');
  }
  g += `<rect class="pl" x="${X0}" y="${f1(yPl)}" width="${X1 - X0}" height="${tPl}"/>`;
  const yM = (yPl + tPl + piso) / 2;
  g += `<line class="dim" x1="${X0 - 8}" y1="${f1(yPl + tPl)}" x2="${X0 - 8}" y2="${piso}"/>` + txt(X0 - 12, yM - 8, `L = ${fmt(e.L, 0)} mm`, 'lb', 'end');
  g += txt(X0 - 12, yM + 8, `K = ${fmt(e.Kf, 1)}`, 'lb lbS', 'end') + txt(X0 - 12, yM + 22, `L_e = ${fmt(a.Le, 0)} mm`.replace('L_e', 'L<tspan baseline-shift="sub" font-size="8">e</tspan>'), 'lb lbS', 'end');
  g += txt(430, 344, `${a.sapata ? 'sapata articulada (não gira)' : 'ponta plana (gira sobre a base)'} · ${(K_FLAMB.find(k => k[0] === e.Kf) || [0, ''])[1].toLowerCase()} · tracejado: forma de flambagem`, 'lb lbS');
  g += txt(325, 22, (sobe ? '▲ subindo a carga' : '▼ descendo a carga') + ` — torque ${fmt(T / 1000, 1)} N·m por parafuso`, 'lb lbB');
  g += a.ok ? txt(325, 40, 'vista lateral', 'lb lbS') : txt(325, 40, `vista lateral — não atende: ${a.gov.nome.toLowerCase()}`, 'lb lbBad');

  /* ---- vista de cima: posições e carga de cada parafuso ---- */
  const PX = 595, PY = 60, PW = 245, PH = 215;
  const s2 = Math.min(PW / e.A, (PH - 30) / e.B), ox = PX + PW / 2, oy = PY + (PH - 30) / 2 + 8;
  const PXm = x => ox + x * s2, PYm = y => oy - y * s2;
  g += txt(PX + PW / 2, 22, 'vista de cima', 'lb lbB') + txt(PX + PW / 2, 40, `${ds.n} ${ds.n === 1 ? 'parafuso' : 'parafusos'} · carga em cada um`, 'lb lbS');
  g += `<rect class="pole" x="${f1(PXm(-e.A / 2))}" y="${f1(PYm(e.B / 2))}" width="${f1(e.A * s2)}" height="${f1(e.B * s2)}" rx="3"/>`;
  g += seta(PX, PY + PH - 2, PX + 34, PY + PH - 2, 'ar-p1', 6) + txt(PX + 38, PY + PH + 2, 'x', 'lb lbS', 'start');
  for (const p of ds.pts) {
    const u = Math.max(p.F, 0) / Fmax, crit = p === ds.crit, sol = p.F < 0;
    g += `<circle class="bt${crit ? ' crit' : ''}${sol ? ' off' : ''}" style="--u:${f1(u * 100 * s)}%" cx="${f1(PXm(p.x))}" cy="${f1(PYm(p.y))}" r="9"/>`;
    g += txt(PXm(p.x), PYm(p.y) + 3.5, p.id, 'lb lbIn');
    g += txt(PXm(p.x), PYm(p.y) + (p.y > 0 ? 24 : -14), sol ? 'descola' : fF(e.kd * p.F, 1), sol ? 'lb lbBad' : 'lb lbS');
  }
  /* centro de gravidade */
  const gx = PXm(e.ex), gy = PYm(e.ey);
  g += `<circle class="cgp" cx="${f1(gx)}" cy="${f1(gy)}" r="6"/><line class="cgx" x1="${f1(gx - 6)}" y1="${f1(gy)}" x2="${f1(gx + 6)}" y2="${f1(gy)}"/><line class="cgx" x1="${f1(gx)}" y1="${f1(gy - 6)}" x2="${f1(gx)}" y2="${f1(gy + 6)}"/>`;
  g += txt(gx + 9, gy - 7, 'CG', 'lb lbA', 'start');
  g += txt(PX + PW / 2, PY + PH + 22, `${fmt(e.A, 0)} × ${fmt(e.B, 0)} mm · valores em ${UN.f}` + (e.kd > 1 ? ` × k_d` : ''), 'lb lbS');
  return g;
}

/* ponta do parafuso de pressão: condição de extremidade (K), contato com a base e a forma de
   flambagem correspondente, tracejada ao longo do trecho livre (amplitude exagerada) */
function pontaMacaco(e, a, x, bw, piso, yTopo, s) {
  let g = '';
  const Lp = piso - yTopo, A = 16 * s;
  /* ζ = 0 na rosca fêmea (engaste), ζ = 1 na ponta */
  const forma = e.Kf >= 2 ? z => 1 - Math.cos(Math.PI * z / 2)      // engastado-livre
    : e.Kf >= 1 ? z => Math.sin(Math.PI * z)                          // rotulado-rotulado
    : z => 6.75 * z * z * (1 - z);                                    // engastado-rotulado
  let d = '';
  for (let i = 0; i <= 24; i++) { const z = i / 24; d += (i ? ' L' : 'M') + f1(x + A * forma(z)) + ' ' + f1(yTopo + z * Lp); }
  g += `<path class="flamb" d="${d}"/>`;
  /* contato com a base */
  if (a.sapata) {
    g += `<circle class="nut" cx="${f1(x)}" cy="${piso - 12}" r="${f1(bw * 0.45)}"/>`;
    g += `<rect class="nut" x="${f1(x - bw * 1.4)}" y="${piso - 8}" width="${f1(bw * 2.8)}" height="8" rx="2"/>`;
  } else {
    for (let k = -2; k <= 2; k++) g += `<line class="thr" x1="${f1(x + k * bw / 5 - 3)}" y1="${piso + 5}" x2="${f1(x + k * bw / 5 + 2)}" y2="${piso}"/>`;
  }
  /* condição de extremidade da ponta */
  const yK = piso - 20;
  if (e.Kf >= 2) {
    g += seta(x - bw / 2 - 4, yK, x - bw / 2 - 16, yK, 'ar-p1', 5) + seta(x + bw / 2 + 4, yK, x + bw / 2 + 16, yK, 'ar-p1', 5);
  } else if (e.Kf >= 1) {
    for (const sx of [-1, 1]) g += `<rect class="guia" x="${f1(x + sx * (bw / 2 + 2) - (sx < 0 ? 4 : 0))}" y="${piso - 22}" width="4" height="22"/>`;
  } else {
    g += `<path class="guia" d="M${f1(x - bw / 2 - 6)} ${piso - 16} V${piso} H${f1(x + bw / 2 + 6)} V${piso - 16}" fill="none"/>`;
  }
  return g;
}
