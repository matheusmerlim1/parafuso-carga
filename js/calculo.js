/* ---------- cálculo (Shigley, cap. 8 e §7-7) ----------
   Unidades internas: N, mm, MPa (N/mm²), N·mm. Nenhuma função aqui toca no DOM. */

const TIPOS = {
  parafuso: {nome:'Parafuso sextavado', curto:'Parafuso', norma:'ISO 4014 / ISO 4017'},
  barra:    {nome:'Barra roscada',      curto:'Barra roscada', norma:'DIN 975 / DIN 976'}
};

/* comprimento de rosca do parafuso sextavado (ISO 4014; Shigley, eq. 8-14) */
const compRosca = (d, L) => L <= 125 ? 2 * d + 6 : L <= 200 ? 2 * d + 12 : 2 * d + 25;
/* menor comprimento comercial que atravessa a junta, a porca e deixa 2 fios para fora */
function compParafuso(r, l) {
  const min = l + r.m + 2 * r.p;
  return COMPRIMENTOS.find(L => L >= min) || Math.ceil(min / 20) * 20;
}

/* ---------- distribuição da carga entre os parafusos ---------- */

/* malha nx × ny de parafusos centrada na origem (a origem é o centroide do grupo) */
function malha(nx, ny, px, py) {
  const out = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    out.push({x: (i - (nx - 1) / 2) * px, y: ((ny - 1) / 2 - j) * py});
  return out.map((b, k) => ({...b, id: k + 1}));
}

/* junta axial: n parafusos dividem igualmente a tração P e o cisalhamento V */
function cargasSimples(e) {
  return {
    Pb: e.P / e.n, Pbmin: e.variavel ? e.Pmin / e.n : e.P / e.n, Vb: e.V / e.n,
    n: e.n, parafusos: null
  };
}

/* grupo na chapa (Shigley §8-12): carga F = (Fx, Fy) aplicada no ponto (ax, ay) em relação
   ao centroide. Corte primário F/n igual em todos; corte secundário M·r/Σr², perpendicular
   ao raio, no sentido em que a chapa gira. A resultante é a soma vetorial das duas. */
function cargasChapa(e) {
  const pf = malha(e.nx, e.ny, e.px, e.py), n = pf.length;
  const M = e.ax * e.Fy - e.ay * e.Fx;                // N·mm, anti-horário positivo
  const Sr2 = pf.reduce((s, b) => s + b.x * b.x + b.y * b.y, 0);
  for (const b of pf) {
    b.r = Math.hypot(b.x, b.y);
    b.p1 = [e.Fx / n, e.Fy / n];
    b.p2 = Sr2 > 0 ? [-M * b.y / Sr2, M * b.x / Sr2] : [0, 0];
    b.v = [b.p1[0] + b.p2[0], b.p1[1] + b.p2[1]];
    b.V = Math.hypot(b.v[0], b.v[1]);
    b.P = 0;
  }
  const crit = pf.reduce((a, b) => b.V > a.V ? b : a, pf[0]);
  return {Pb: 0, Pbmin: 0, Vb: crit.V, n, parafusos: pf, crit, M, Sr2,
    F: Math.hypot(e.Fx, e.Fy), p1: Math.hypot(e.Fx, e.Fy) / n,
    p2max: Sr2 > 0 ? Math.abs(M) * Math.max(...pf.map(b => b.r)) / Sr2 : 0};
}

/* poste na placa de base: H horizontal (+x) a uma altura h, N normal (compressão positiva),
   torção Mt no eixo do poste. A placa gira em torno da borda comprimida (x = +Lp/2);
   cada chumbador a uma distância d_i dessa borda recebe F_i = M·d_i / Σd² (Shigley,
   suporte fixado por parafusos sob momento). Arrancamento (N < 0) soma |N|/n a todos.
   A compressão só alivia os chumbadores se o usuário pedir. */
function tracaoPoste(e, H, pf) {
  const n = pf.length;
  const Mh = H * e.h;
  const alivio = e.aliviarN && e.N > 0 ? e.N * e.Lp / 2 : 0;
  const M = Math.max(Mh - alivio, 0);
  const Sd2 = pf.reduce((s, b) => s + b.d * b.d, 0);
  const arr = e.N < 0 ? -e.N / n : 0;
  return {M, Mh, alivio, Sd2, arr, F: pf.map(b => (Sd2 > 0 ? M * b.d / Sd2 : 0) + arr)};
}
function cargasPoste(e) {
  const pf = malha(e.nx, e.ny, e.px, e.py), n = pf.length;
  for (const b of pf) { b.d = e.Lp / 2 - b.x; b.r = Math.hypot(b.x, b.y); }
  const t = tracaoPoste(e, e.H, pf);
  const Sr2 = pf.reduce((s, b) => s + b.r * b.r, 0);
  pf.forEach((b, k) => {
    b.P = t.F[k];
    b.p1 = [e.H / n, 0];
    b.p2 = Sr2 > 0 ? [-e.Mt * b.y / Sr2, e.Mt * b.x / Sr2] : [0, 0];
    b.v = [b.p1[0] + b.p2[0], b.p1[1] + b.p2[1]];
    b.V = Math.hypot(b.v[0], b.v[1]);
  });
  const crit = pf.reduce((a, b) => b.P > a.P ? b : a, pf[0]);
  const ic = pf.indexOf(crit);
  const tmin = e.variavel ? tracaoPoste(e, e.Hmin, pf) : t;
  return {
    Pb: crit.P, Pbmin: tmin.F[ic], Vb: Math.max(...pf.map(b => b.V)),
    n, parafusos: pf, crit, ...t, Sr2, dmax: crit.d,
    critV: pf.reduce((a, b) => b.V > a.V ? b : a, pf[0])
  };
}

const CARGAS = {simples: cargasSimples, chapa: cargasChapa, poste: cargasPoste};

/* ---------- verificação de um parafuso ---------- */

/* rigidez do elemento e comprimento sob tração */
function geometria(tipo, r, c, l) {
  if (tipo === 'barra') {
    return {kb: r.At * c.E / l, ld: 0, lt: l, L: l + 2 * r.m + 4 * r.p, LT: null};
  }
  const L = compParafuso(r, l), LT = compRosca(r.d, L);
  const ld = Math.min(Math.max(L - LT, 0), l), lt = l - ld;
  const kb = lt <= 0 ? r.Ad * c.E / ld : r.Ad * r.At * c.E / (r.Ad * lt + r.At * ld);
  return {kb, ld, lt, L, LT};
}

/* verificação completa de uma combinação tipo × rosca × classe sob as cargas q por parafuso */
function analisar(e, q, tipo, r, classe) {
  const c = propsClasse(classe, r.d), mb = MEMBROS.find(m => m.id === e.membro) || MEMBROS[0];
  const g = geometria(tipo, r, c, e.l);
  const km = mb.E * r.d * mb.A * Math.exp(mb.B * r.d / e.l);
  const C = g.kb / (g.kb + km);
  const Fi = e.preFator * r.At * c.Sp;
  const semPre = Fi <= 0;
  const Ce = semPre ? 1 : C;                            // sem pré-carga a junta abre: o parafuso leva tudo
  const torque = e.K * Fi * r.d / 1000;                 // N·m
  const Fb = Fi + Ce * q.Pb, Fm = Fi - (1 - Ce) * q.Pb;
  const P0 = semPre ? 0 : Fi / (1 - C);
  const Fprova = c.Sp * r.At;
  const roscaNoCorte = tipo === 'barra' || e.roscaNoCorte;
  const As = roscaNoCorte ? r.At : r.Ad;
  const Ssp = 0.577 * c.Sp;                             // von Mises em cisalhamento puro
  const atrito = e.modo === 'atrito' && !semPre;

  const ver = [];
  const add = (id, nome, n, req, sol, res, extra) => ver.push({id, nome, n, req, sol, res, ...extra});

  if (q.Pb > 0) {
    add('carga', 'Fator de carga (tração)', (Fprova - Fi) / (Ce * q.Pb), e.nReq.carga,
      ['C·P', Ce * q.Pb], ['S_p·A_t − F_i', Fprova - Fi]);
    if (!semPre) add('sep', 'Separação da junta', Fi / (q.Pb * (1 - C)), e.nReq.sep,
      ['(1 − C)·P', q.Pb * (1 - C)], ['F_i', Fi]);
  }
  if (!semPre) add('prova', 'Resistência de prova', Fprova / Fb, 1, ['F_b', Fb], ['S_p·A_t', Fprova],
    {nota: 'Com Fi = 0,75·Sp·At o teto é 1,33: basta não escoar (n_p ≥ 1).', soVerifica: true});

  if (q.Vb > 0) {
    const Rcorte = e.planos * As * Ssp, Resm = r.d * e.t * Math.min(e.SyM, c.Sp);
    if (atrito) {
      const aperto = Math.max(Fi - (1 - C) * q.Pb, 0), Ratr = e.mu * e.planos * aperto;
      add('atrito', 'Escorregamento (atrito)', Ratr / q.Vb, e.nReq.atrito, ['V', q.Vb], ['μ·m·[F_i − (1 − C)·P]', Ratr]);
    }
    const reserva = atrito ? {nota: 'Reserva caso a junta escorregue: não governa a ligação por atrito.'} : {};
    add('corte', 'Corte no ' + (roscaNoCorte ? 'núcleo da rosca' : 'corpo liso'), Rcorte / q.Vb,
      atrito ? null : e.nReq.carga, ['V', q.Vb], ['m·A_s·0,577·S_p', Rcorte], reserva);
    add('esm', 'Esmagamento (chapa / parafuso)', Resm / q.Vb, atrito ? null : e.nReq.carga,
      ['V', q.Vb], ['d·t·min(S_y,ch; S_p)', Resm], reserva);
    if (!atrito && q.Pb > 0) {
      const ni = 1 / Math.hypot(q.Pb / Fprova, q.Vb / Rcorte);
      add('inter', 'Interação tração + corte', ni, e.nReq.carga,
        ['(P/S_p·A_t)² + (V/R_corte)²', (q.Pb / Fprova) ** 2 + (q.Vb / Rcorte) ** 2], ['1', 1]);
    }
  }

  let fad = null;
  if (e.variavel && q.Pbmin !== q.Pb) {
    const si = Fi / r.At;
    const sa = Ce * Math.abs(q.Pb - q.Pbmin) / (2 * r.At);
    const sm = Ce * (q.Pb + q.Pbmin) / (2 * r.At) + si;
    const nf = c.Se * (c.Sut - si) / (c.Sut * sa + c.Se * (sm - si));
    fad = {si, sa, sm, nf};
    add('fad', 'Fadiga (Goodman)', nf, e.nReq.fad, ['σ_a', sa], ['S_a (Goodman)', sa * nf],
      c.seEst ? {nota: 'S_e estimado por 0,155·S_ut: a Tab. 8-17 do Shigley não traz esta classe.'} : {});
  }

  /* razão n/n_req da verificação que governa; só entram as que têm requisito */
  let gov = null;
  for (const v of ver) {
    v.ok = v.req == null ? null : v.n >= v.req;
    if (v.req == null) continue;
    v.razao = v.n / v.req;
    if (v.soVerifica) continue;
    v.razao = v.n / v.req;
    if (!gov || v.razao < gov.razao) gov = v;
  }
  return {
    tipo, r, c, classe, mb, q, g, km, C, Ce, Fi, semPre, torque, Fb, Fm, P0, Fprova, As, Ssp,
    roscaNoCorte, atrito, fad, ver, gov, ok: ver.length > 0 && ver.every(v => v.ok !== false)
  };
}

/* todas as combinações, da menor rosca para a maior e, no mesmo diâmetro, da classe mais
   simples para a mais resistente (carbono antes de inox) */
function varrer(e, q, tipo, classes) {
  const out = [];
  for (const r of ROSCAS) for (const c of CLASSES) if (classes.includes(c.id)) out.push(analisar(e, q, tipo, r, c));
  return out;
}
/* mais adequado = menor diâmetro que passa em tudo; empate vai para a classe mais simples */
const recomendar = lista => lista.find(a => a.ok) || null;
/* a primeira aprovada entre as de uso frequente (rosca e classe fáceis de comprar) */
const recomendarComercial = lista => lista.find(a => a.ok && usoFrequente(a)) || null;
/* menor diâmetro aprovado em cada classe */
function melhorPorClasse(lista) {
  const m = {};
  for (const a of lista) if (a.ok && !m[a.classe.id]) m[a.classe.id] = a;
  return m;
}

/* ---------- parafuso de pressão / nivelamento (Shigley §8-2 e §4-11) ----------
   A estrutura apoia numa rosca fêmea (porca ou chapa roscada) e a ponta do parafuso empurra a base.
   Cada parafuso leva F = k_d·W/n em compressão; para subir ou descer a carga gira-se o parafuso. */
const SEC30 = 1 / Math.cos(Math.PI / 6);                // rosca de 60°: semiângulo α = 30°

/* posições dos parafusos na planta A × B (A em x), recuadas das bordas.
   1: centro · 2: nas pontas · 3: triângulo · 4 ou mais: pares ao longo dos lados maiores
   (quantidade ímpar a partir de 5: o que sobra vai para o centro) */
function posicoesApoios(n, A, B) {
  const m = Math.min(80, 0.1 * Math.min(A, B)), ax = A / 2 - m, by = B / 2 - m;
  let p;
  if (n === 1) p = [[0, 0]];
  else if (n === 2) p = [[-ax, 0], [ax, 0]];
  else if (n === 3) p = [[-ax, -by], [-ax, by], [ax, 0]];
  else {
    const k = Math.floor(n / 2);
    p = [];
    for (const y of [by, -by]) for (let i = 0; i < k; i++) p.push([-ax + 2 * ax * i / (k - 1), y]);
    if (n % 2) p.push([0, 0]);
  }
  return p.map(([x, y], i) => ({id: i + 1, x, y}));
}

/* distribuição de W entre apoios rígidos (estrutura rígida, parafusos iguais):
   F_i = W/n + W·e_x·x_i/Σx² + W·e_y·y_i/Σy², com x, y e e medidos a partir do centroide
   dos parafusos — a mesma conta de um grupo de estacas. F_i < 0 = o apoio descola. */
function distribuirApoios(e) {
  const pts = posicoesApoios(e.n, e.A, e.B), n = pts.length;
  const xc = pts.reduce((s, p) => s + p.x, 0) / n, yc = pts.reduce((s, p) => s + p.y, 0) / n;
  const ex = e.ex - xc, ey = e.ey - yc;
  const Sx2 = pts.reduce((s, p) => s + (p.x - xc) ** 2, 0), Sy2 = pts.reduce((s, p) => s + (p.y - yc) ** 2, 0);
  /* excentricidade numa direção em que todos os apoios estão alinhados: a estrutura tomba */
  const tomba = (Math.abs(ex) > 0.5 && Sx2 < 1e-6) || (Math.abs(ey) > 0.5 && Sy2 < 1e-6);
  for (const p of pts) {
    p.F = e.W / n + (Sx2 > 0 ? e.W * ex * (p.x - xc) / Sx2 : 0) + (Sy2 > 0 ? e.W * ey * (p.y - yc) / Sy2 : 0);
  }
  const crit = pts.reduce((a, b) => b.F > a.F ? b : a, pts[0]);
  const Fmin = Math.min(...pts.map(p => p.F));
  return {pts, n, xc, yc, ex, ey, Sx2, Sy2, crit, Fmax: crit.F, Fmin, estavel: !tomba && Fmin >= 0};
}

function analisarMacaco(e, r, classe, dist = distribuirApoios(e)) {
  const c = propsClasse(classe, r.d), fem = FEMEAS.find(f => f.id === e.femea) || FEMEAS[0];
  const base = MEMBROS.find(m => m.id === e.base) || MEMBROS[0];
  const F = e.kd * dist.Fmax;
  const dm = r.d - 0.649519 * r.p;                      // diâmetro efetivo d2 (ISO 724)
  const l = r.p;                                        // avanço (rosca de uma entrada)
  const lam = Math.atan(l / (Math.PI * dm));            // ângulo de avanço
  const f = e.f, fs = f * SEC30;
  /* torque na rosca para subir e para descer (Shigley, eq. 8-5 e 8-6 com sec α) */
  const TthS = F * dm / 2 * (l + Math.PI * fs * dm) / (Math.PI * dm - fs * l);
  const TthD = F * dm / 2 * (Math.PI * fs * dm - l) / (Math.PI * dm + fs * l);
  const sapata = e.ponta === 'sapata';
  const dc = sapata ? 0 : 2 / 3 * r.dr;                 // diâmetro efetivo de atrito na ponta
  const Tc = F * e.fc * dc / 2;
  const TS = TthS + Tc, TD = TthD + Tc;                  // N·mm
  const trava = Math.PI * fs * dm > l;                  // autotravante: não desce sozinho
  const ef = F * l / (2 * Math.PI * TS);

  const ver = [];
  const add = (id, nome, n, req, sol, res, extra) => ver.push({id, nome, n, req, sol, res, ...extra});

  /* compressão + torção no núcleo (a favor da segurança: torque total com a carga total) */
  const sig = F / r.At, tau = 16 * TS / (Math.PI * r.dr ** 3);
  const svm = Math.hypot(sig, Math.sqrt(3) * tau);
  add('vm', 'Compressão + torção ao girar', c.Sy / svm, e.nReq, ['σ_vm', svm], ['S_y', c.Sy], {un: 'MPa'});

  /* flambagem: coluna de diâmetro d_r (Euler ou Johnson) */
  const A = Math.PI * r.dr ** 2 / 4, k = r.dr / 4, Le = e.Kf * e.L;
  const esb = Le / k, esb1 = Math.sqrt(2 * Math.PI ** 2 * c.E / c.Sy);
  const johnson = esb < esb1;
  const Pcr = johnson ? A * (c.Sy - (c.Sy * esb / (2 * Math.PI)) ** 2 / c.E) : Math.PI ** 2 * c.E * A / esb ** 2;
  add('flamb', 'Flambagem (' + (johnson ? 'Johnson' : 'Euler') + ')', Pcr / F, e.nReq, ['F', F], ['P_cr', Pcr]);

  /* espanamento dos filetes no comprimento de engajamento Le */
  const Asp = Math.PI * r.dr * W_EXT * e.Le, Asf = Math.PI * r.d * W_INT * e.Le;
  const Rp = Asp * 0.577 * c.Sy, Rf = Asf * 0.577 * fem.Sy;
  add('espP', 'Espanamento dos filetes do parafuso', Rp / F, e.nReq, ['F', F], ['A_s·0,577·S_y', Rp]);
  add('espF', 'Espanamento da rosca fêmea', Rf / F, e.nReq, ['F', F], ['A_n·0,577·S_y,f', Rf]);

  /* esmagamento da base sob a ponta (ou sob a sapata) */
  const Dap = sapata ? e.Ds : r.dr, Aap = Math.PI * Dap ** 2 / 4;
  add('base', 'Esmagamento da base', Aap * base.Sy / F, e.nReq, ['F', F], ['A_apoio·S_y,base', Aap * base.Sy]);

  /* pressão de contato nos filetes — desgaste quando se gira sob carga (Shigley, Tab. 8-4) */
  const nt = e.Le / r.p, h = 0.541266 * r.p;
  const pb = F / (Math.PI * dm * h * nt);
  if (e.desgaste) add('pb', 'Pressão nos filetes (desgaste)', e.padm / pb, 1, ['p_b', pb], ['p_adm', e.padm], {un: 'MPa'});

  if (!dist.estavel) add('estab', 'Estabilidade (todos os apoios comprimidos)', 0, 1, ['F_min', dist.Fmin], ['0', 0],
    {nota: 'O centro de gravidade cai fora dos apoios: um parafuso descola e a estrutura tomba.'});

  let gov = null;
  for (const v of ver) {
    v.ok = v.n >= v.req; v.razao = v.n / v.req;
    if (!gov || v.razao < gov.razao) gov = v;
  }
  return {
    tipo: 'pressao', r, c, classe, fem, base, F, dist, dm, l, lam, TthS, TthD, dc, Tc, TS, TD, trava, ef, sapata,
    sig, tau, svm, A, k, Le, esb, esb1, johnson, Pcr, Asp, Asf, Rp, Rf, Dap, Aap, nt, h, pb,
    ver, gov, ok: ver.every(v => v.ok)
  };
}
function varrerMacaco(e, classes) {
  const out = [], dist = distribuirApoios(e);
  for (const r of ROSCAS) for (const c of CLASSES) if (classes.includes(c.id)) out.push(analisarMacaco(e, r, c, dist));
  return out;
}
