/* ================= MEMORIAL DE CÁLCULO =================
   O passo a passo é descrito uma única vez, como dados, por modeloParafuso()/modeloMacaco().
   renderModelo() transforma essa estrutura no memorial da tela e do relatório impresso.
   Notação: "F_b", "S_p" viram subscrito no HTML (mathHtml). Unicode direto para ², √, ·, Σ, μ. */

const RE_SUB = /([A-Za-zΔλχδπσμτ'″])_([A-Za-z0-9,]+)/g;
const mathHtml = s => String(s).replace(RE_SUB, '$1<sub>$2</sub>');
const fmt = (v, d = 2) => !isFinite(v) ? (v > 0 ? '∞' : '—')
  : Number(v).toLocaleString('pt-BR', {minimumFractionDigits: d, maximumFractionDigits: d});
/* unidade de força escolhida pelo usuário: kN ou tf (1 tf = 9,80665 kN) */
const UN = {f: 'kN'};
const FATOR_F = {kN: 1000, tf: 9806.65};
const uF = () => FATOR_F[UN.f];                          // N por unidade de força
const fF = (N, d = 3) => fmt(N / uF(), d);               // só o número, na unidade escolhida
const fM = (Nmm, d = 3) => fmt(Nmm / uF() / 1000, d);    // momento: N·mm → kN·m ou tf·m
const kN = (N, d = 2) => fF(N, d) + ' ' + UN.f;
const kNm = (Nmm, d = 2) => fM(Nmm, d) + ' ' + UN.f + '·m';
const fatorTxt = n => !isFinite(n) ? '∞' : n > 99 ? '> 99' : fmt(n, 2);
const MODOS = {
  simples: 'Junta axial (tração e cisalhamento repartidos)',
  chapa:   'Grupo de parafusos na chapa — carga excêntrica',
  poste:   'Poste parafusado na placa de base'
};

function numerarPassos(secoes) {
  let n = 0;
  secoes.forEach((sec, si) => { sec.num = si + 1; sec.passos.forEach(ps => { ps.num = ++n; }); });
}

/* ---------------- modelo: parafuso / barra roscada ---------------- */
function modeloParafuso(modo, e, a) {
  const {r, c, q, g, mb} = a, T = TIPOS[a.tipo];
  const nomeEl = `${T.nome} ${r.nome} × ${fmt(r.p, 2)} classe ${c.id}` +
    (a.tipo === 'parafuso' ? ` × ${g.L} mm` : '');

  /* A · entradas */
  const entradas = [['—', 'Modelo de carregamento', MODOS[modo], 'selecionado pelo usuário']];
  if (modo === 'simples') {
    entradas.push(['n', 'Número de parafusos da junta', String(e.n), 'informado']);
    entradas.push(['P', 'Força de tração externa total (separa a junta)', kN(e.P), 'informado']);
    entradas.push(['V', 'Força cortante total no plano da junta', kN(e.V), 'informado']);
    if (e.variavel) entradas.push(['P_min', 'Tração mínima do ciclo (P é o máximo)', kN(e.Pmin), 'informado']);
  } else if (modo === 'chapa') {
    entradas.push(['n_x × n_y', 'Malha de parafusos', `${e.nx} × ${e.ny} = ${q.n} parafusos`, 'informado']);
    entradas.push(['p_x, p_y', 'Espaçamento entre furos', `${fmt(e.px, 0)} mm, ${fmt(e.py, 0)} mm`, 'informado']);
    entradas.push(['F_x, F_y', 'Componentes da força aplicada na chapa', `${kN(e.Fx)}, ${kN(e.Fy)}`, 'informado']);
    entradas.push(['a_x, a_y', 'Ponto de aplicação em relação ao centroide', `${fmt(e.ax, 0)} mm, ${fmt(e.ay, 0)} mm`, 'informado']);
  } else {
    entradas.push(['n_x × n_y', 'Malha de chumbadores', `${e.nx} × ${e.ny} = ${q.n} chumbadores`, 'informado']);
    entradas.push(['p_x, p_y', 'Espaçamento entre chumbadores', `${fmt(e.px, 0)} mm, ${fmt(e.py, 0)} mm`, 'informado']);
    entradas.push(['L_p × B_p', 'Placa de base (L_p na direção de H)', `${fmt(e.Lp, 0)} × ${fmt(e.Bp, 0)} mm`, 'informado']);
    entradas.push(['H', 'Força horizontal no poste', kN(e.H), 'informado']);
    entradas.push(['h', 'Altura de aplicação de H acima da placa', `${fmt(e.h / 1000, 2)} m`, 'informado']);
    entradas.push(['N', 'Força normal (+ compressão, − arrancamento)', kN(e.N), 'informado']);
    entradas.push(['M_t', 'Momento de torção no eixo do poste', kNm(e.Mt), 'informado']);
    if (e.variavel) entradas.push(['H_min', 'Força horizontal mínima do ciclo', kN(e.Hmin), 'informado']);
  }
  entradas.push(
    ['—', 'Elemento verificado', nomeEl, T.norma],
    ['l', modo === 'poste' ? 'Comprimento tracionado do chumbador (placa + graute)' : 'Comprimento de aperto (espessura dos membros)', `${fmt(e.l, 1)} mm`, 'informado'],
    ['—', 'Material dos membros', mb.nome, 'selecionado'],
    ['t', 'Espessura da chapa mais fina que transmite o corte', `${fmt(e.t, 1)} mm`, 'informado'],
    ['S_y,ch', 'Escoamento do material da chapa', `${fmt(e.SyM, 0)} MPa`, 'informado'],
    ['m', 'Planos de corte por parafuso', String(e.planos), 'informado'],
    ['—', 'Pré-carga', e.preFator ? `${fmt(e.preFator, 2)}·S_p·A_t` : 'sem pré-carga controlada (aperto de encosto)', 'selecionado'],
    ['K', 'Fator de torque', fmt(e.K, 2), 'Shigley, Tab. 8-15'],
    ['—', 'Transmissão do corte', a.atrito ? `por atrito (μ = ${fmt(e.mu, 2)})` : 'por contato (corte no parafuso)', 'selecionado']
  );

  /* B · constantes */
  const constantes = [
    ['E_b', 'Módulo de elasticidade do parafuso', `${fmt(c.E / 1000, 0)} GPa`, c.tipo === 'inox' ? 'inox austenítico' : 'aço'],
    ['E_m', 'Módulo de elasticidade dos membros', `${fmt(mb.E / 1000, 1)} GPa`, 'Shigley, Tab. 8-8'],
    ['A, B', 'Constantes de Wileman do material dos membros', `${fmt(mb.A, 5)}; ${fmt(mb.B, 5)}`, 'Shigley, Tab. 8-8'],
    ['0,577', 'Razão de von Mises em cisalhamento puro: S_s = 0,577·S', '1/√3', 'critério da energia de distorção'],
    ['n ≥ 1', 'Critério de verificação: cada coeficiente de segurança deve ser pelo menos 1', '1,00', 'margem adicional a critério do projetista']
  ];

  /* C · propriedades */
  const props = [
    ['d', 'Diâmetro nominal', `${fmt(r.d, 0)} mm`, 'ISO 261'],
    ['p', 'Passo (rosca grossa)', `${fmt(r.p, 2)} mm`, 'ISO 261'],
    ['S_p', 'Resistência de prova' + (c.tipo === 'inox' ? ' (R_p0,2)' : ''), `${fmt(c.Sp, 0)} MPa`, c.tipo === 'inox' ? 'ISO 3506-1' : 'ISO 898-1'],
    ['S_y', 'Resistência ao escoamento', `${fmt(c.Sy, 0)} MPa`, c.tipo === 'inox' ? 'ISO 3506-1' : 'ISO 898-1'],
    ['S_ut', 'Resistência à tração', `${fmt(c.Sut, 0)} MPa`, c.tipo === 'inox' ? 'ISO 3506-1' : 'ISO 898-1'],
    ['S_e', 'Limite de fadiga da rosca laminada', `${fmt(c.Se, 0)} MPa`, c.seEst ? 'estimado 0,155·S_ut' : 'Shigley, Tab. 8-17'],
    ['m_porca', 'Altura da porca', `${fmt(r.m, 1)} mm`, 'ISO 4032']
  ];

  const secoes = [];

  /* 1 · cargas por parafuso (depende do modelo) */
  if (modo === 'simples') {
    const ps = [
      {t: 'Tração externa por parafuso', f: 'P = P_total / n', s: `P = ${kN(e.P)} / ${e.n}`, r: `P = ${kN(q.Pb, 3)}`,
        n: 'Parafusos iguais, simétricos em relação à linha de ação da carga: a tração se divide igualmente.'},
      {t: 'Força cortante por parafuso', f: 'V = V_total / n', s: `V = ${kN(e.V)} / ${e.n}`, r: `V = ${kN(q.Vb, 3)}`}
    ];
    if (e.variavel) ps.push({t: 'Tração mínima por parafuso', f: 'P_min = P_min,total / n', s: `P_min = ${kN(e.Pmin)} / ${e.n}`, r: `P_min = ${kN(q.Pbmin, 3)}`});
    secoes.push({titulo: 'Cargas externas por parafuso', passos: ps});
  } else if (modo === 'chapa') {
    const b = q.crit;
    secoes.push({titulo: 'Distribuição da carga no grupo (Shigley §8-12)', passos: [
      {t: 'Centroide do grupo de parafusos', f: 'x̄ = Σx_i / n     ȳ = Σy_i / n',
        s: `malha ${e.nx} × ${e.ny} simétrica, coordenadas medidas a partir do centro`, r: 'x̄ = 0     ȳ = 0',
        n: 'Com parafusos de mesmo diâmetro, o grupo gira em torno do centroide das áreas, que numa malha regular coincide com o centro geométrico.'},
      {t: 'Momento da carga em relação ao centroide', f: 'M = a_x·F_y − a_y·F_x',
        s: `M = ${fmt(e.ax / 1000, 3)} m × ${fF(e.Fy)} − ${fmt(e.ay / 1000, 3)} m × ${fF(e.Fx)}`,
        r: `M = ${kNm(q.M, 3)} ${q.M >= 0 ? '(anti-horário)' : '(horário)'}`},
      {t: 'Soma dos quadrados das distâncias ao centroide', f: 'Σr² = Σ(x_i² + y_i²)',
        s: `Σr² = ${q.parafusos.map(p => `${fmt(p.r * p.r, 0)}`).join(' + ')}`, r: `Σr² = ${fmt(q.Sr2, 0)} mm²`},
      {t: 'Corte primário (igual em todos os parafusos)', f: "F' = F / n",
        s: `F' = ${kN(q.F, 3)} / ${q.n}`, r: `F' = ${kN(q.p1, 3)}`,
        n: 'Parcela da força que translada a chapa; tem a direção da própria carga.'},
      {t: 'Corte secundário no parafuso mais afastado', f: "F'' = M·r_max / Σr²",
        s: `F'' = ${fmt(Math.abs(q.M), 0)} × ${fmt(Math.max(...q.parafusos.map(p => p.r)), 1)} / ${fmt(q.Sr2, 0)}`,
        r: `F'' = ${kN(q.p2max, 3)}`,
        n: 'Parcela que resiste à rotação: proporcional à distância ao centroide e perpendicular ao raio.'},
      {t: `Resultante no parafuso crítico (nº ${b.id}, x = ${fmt(b.x, 0)}, y = ${fmt(b.y, 0)} mm)`,
        f: "V = |F' + F''| = √[(F'_x + F''_x)² + (F'_y + F''_y)²]",
        s: `V = √[(${fF(b.p1[0])} + ${fF(b.p2[0])})² + (${fF(b.p1[1])} + ${fF(b.p2[1])})²]`,
        r: `V = ${kN(q.Vb, 3)}`,
        n: 'Soma vetorial: o parafuso crítico é aquele em que as duas parcelas mais se alinham. A tabela abaixo mostra todos.'}
    ], tabela: {cab: ['Nº', 'x (mm)', 'y (mm)', 'r (mm)', `F' (${UN.f})`, `F'' (${UN.f})`, `V (${UN.f})`],
      linhas: q.parafusos.map(p => [p.id, fmt(p.x, 0), fmt(p.y, 0), fmt(p.r, 1), fF(Math.hypot(...p.p1)),
        fF(Math.hypot(...p.p2)), (p === b ? '▶ ' : '') + fF(p.V)])}});
  } else {
    const b = q.crit, ps = [
      {t: 'Momento na base devido a H', f: 'M_H = H·h', s: `M_H = ${kN(e.H, 3)} × ${fmt(e.h / 1000, 3)} m`, r: `M_H = ${kNm(q.Mh, 3)}`}
    ];
    if (q.alivio > 0) ps.push({t: 'Momento líquido em torno da borda comprimida', f: 'M = M_H − N·L_p / 2',
      s: `M = ${fM(q.Mh)} − ${fF(e.N)} × ${fmt(e.Lp / 2000, 3)}`, r: `M = ${kNm(q.M, 3)}`,
      n: 'A compressão aplicada no centro da placa tem braço L_p/2 em relação à borda e se opõe ao tombamento.'});
    ps.push(
      {t: 'Braço de cada chumbador até a borda de giro', f: 'd_i = L_p / 2 − x_i',
        s: `borda comprimida em x = +${fmt(e.Lp / 2, 0)} mm; d = ${[...new Set(q.parafusos.map(p => fmt(p.d, 0)))].join(', ')} mm`,
        r: `d_max = ${fmt(q.dmax, 0)} mm`,
        n: 'H empurra o topo do poste no sentido +x: a placa tende a girar sobre a borda do lado +x, que fica comprimida contra a base; os chumbadores do lado oposto são tracionados.'},
      {t: 'Soma dos quadrados dos braços', f: 'Σd² = Σd_i²', s: `Σd² = ${q.parafusos.map(p => fmt(p.d * p.d, 0)).join(' + ')}`, r: `Σd² = ${fmt(q.Sd2, 0)} mm²`},
      {t: `Tração no chumbador crítico (nº ${b.id})`, f: 'P = M·d_max / Σd²' + (q.arr ? ' + |N| / n' : ''),
        s: `P = ${fmt(q.M, 0)} × ${fmt(q.dmax, 0)} / ${fmt(q.Sd2, 0)}` + (q.arr ? ` + ${kN(-e.N, 3)} / ${q.n}` : ''),
        r: `P = ${kN(q.Pb, 3)}`,
        n: 'Placa rígida girando sobre a borda: o alongamento de cada chumbador — e portanto sua força — cresce linearmente com a distância à borda de giro.' +
          (e.N > 0 && !e.aliviarN ? ' A compressão N foi desprezada (a favor da segurança).' : '')},
      {t: 'Cisalhamento direto por chumbador', f: "V' = H / n", s: `V' = ${kN(e.H, 3)} / ${q.n}`, r: `V' = ${kN(e.H / q.n, 3)}`}
    );
    if (e.Mt) ps.push({t: 'Cisalhamento por torção no chumbador mais afastado', f: "V'' = M_t·r_max / Σr²",
      s: `V'' = ${fmt(Math.abs(e.Mt), 0)} × ${fmt(Math.max(...q.parafusos.map(p => p.r)), 1)} / ${fmt(q.Sr2, 0)}`,
      r: `V'' = ${kN(Math.abs(e.Mt) * Math.max(...q.parafusos.map(p => p.r)) / q.Sr2, 3)}`});
    ps.push({t: 'Cisalhamento máximo (soma vetorial)', f: "V = |V' + V''|", s: `chumbador nº ${q.critV.id}`, r: `V = ${kN(q.Vb, 3)}`,
      n: 'Por simplicidade a verificação combina a maior tração com o maior cisalhamento, mesmo que ocorram em chumbadores diferentes (a favor da segurança).'});
    if (e.variavel) ps.push({t: 'Tração mínima no chumbador crítico (com H_min)', f: 'P_min = M(H_min)·d_max / Σd²' + (q.arr ? ' + |N| / n' : ''),
      s: `H_min = ${kN(e.Hmin, 3)}`, r: `P_min = ${kN(q.Pbmin, 3)}`});
    secoes.push({titulo: 'Distribuição da carga nos chumbadores', passos: ps,
      tabela: {cab: ['Nº', 'x (mm)', 'y (mm)', 'd (mm)', `P (${UN.f})`, `V (${UN.f})`],
        linhas: q.parafusos.map(p => [p.id, fmt(p.x, 0), fmt(p.y, 0), fmt(p.d, 0), (p === b ? '▶ ' : '') + fF(p.P), fF(p.V)])}});
  }

  /* 2 · geometria da rosca */
  secoes.push({titulo: 'Geometria da rosca', passos: [
    {t: 'Área de tração da rosca', f: 'A_t = π/4·(d − 0,9382·p)²', s: `A_t = π/4 × (${fmt(r.d, 0)} − 0,9382 × ${fmt(r.p, 2)})²`,
      r: `A_t = ${fmt(r.At, 1)} mm²`, n: 'Área de um cilindro com a média dos diâmetros efetivo e menor — é ela que resiste à tração (ISO 898-1).'},
    {t: 'Área do corpo liso', f: 'A_d = π·d² / 4', s: `A_d = π × ${fmt(r.d, 0)}² / 4`, r: `A_d = ${fmt(r.Ad, 1)} mm²`},
    {t: 'Diâmetro menor da rosca', f: 'd_r = d − 1,2269·p', s: `d_r = ${fmt(r.d, 0)} − 1,2269 × ${fmt(r.p, 2)}`, r: `d_r = ${fmt(r.dr, 2)} mm`}
  ]});

  /* 3 · rigidez */
  const pr = [];
  if (a.tipo === 'parafuso') {
    pr.push(
      {t: 'Comprimento do parafuso', f: 'L ≥ l + m_porca + 2·p  → comercial', s: `L ≥ ${fmt(e.l, 1)} + ${fmt(r.m, 1)} + 2 × ${fmt(r.p, 2)} = ${fmt(e.l + r.m + 2 * r.p, 1)} mm`,
        r: `L = ${g.L} mm`, n: 'Menor comprimento da série ISO 4014/4017 que deixa ao menos dois fios para fora da porca.'},
      {t: 'Comprimento roscado', f: g.L <= 125 ? 'L_T = 2·d + 6  (L ≤ 125)' : g.L <= 200 ? 'L_T = 2·d + 12  (125 < L ≤ 200)' : 'L_T = 2·d + 25  (L > 200)',
        s: `L_T = 2 × ${fmt(r.d, 0)} + ${g.L <= 125 ? 6 : g.L <= 200 ? 12 : 25}`, r: `L_T = ${fmt(g.LT, 0)} mm`},
      {t: 'Trechos liso e roscado dentro da junta', f: 'l_d = L − L_T (0 ≤ l_d ≤ l)     l_t = l − l_d',
        s: `l_d = ${g.L} − ${fmt(g.LT, 0)}     l_t = ${fmt(e.l, 1)} − ${fmt(g.ld, 1)}`, r: `l_d = ${fmt(g.ld, 1)} mm     l_t = ${fmt(g.lt, 1)} mm`},
      {t: 'Rigidez do parafuso (molas em série)', f: 'k_b = A_d·A_t·E / (A_d·l_t + A_t·l_d)',
        s: `k_b = ${fmt(r.Ad, 1)} × ${fmt(r.At, 1)} × ${fmt(c.E, 0)} / (${fmt(r.Ad, 1)} × ${fmt(g.lt, 1)} + ${fmt(r.At, 1)} × ${fmt(g.ld, 1)})`,
        r: `k_b = ${fmt(a.g.kb / 1000, 1)} kN/mm`});
  } else {
    pr.push({t: 'Rigidez da barra roscada (inteiramente roscada)', f: 'k_b = A_t·E / l',
      s: `k_b = ${fmt(r.At, 1)} × ${fmt(c.E, 0)} / ${fmt(e.l, 1)}`, r: `k_b = ${fmt(g.kb / 1000, 1)} kN/mm`,
      n: `Sem corpo liso: todo o comprimento tracionado trabalha com a área A_t. Corte da barra ≈ l + 2·m_porca + 4·p = ${fmt(g.L, 0)} mm.`});
  }
  pr.push(
    {t: 'Rigidez dos membros (Wileman)', f: 'k_m = E_m·d·A·exp(B·d / l)',
      s: `k_m = ${fmt(mb.E, 0)} × ${fmt(r.d, 0)} × ${fmt(mb.A, 5)} × exp(${fmt(mb.B, 5)} × ${fmt(r.d, 0)} / ${fmt(e.l, 1)})`,
      r: `k_m = ${fmt(a.km / 1000, 1)} kN/mm`, n: 'Ajuste de elementos finitos do tronco de cone comprimido sob a cabeça e a porca (Shigley, eq. 8-23).'},
    {t: 'Constante de rigidez da junta', f: 'C = k_b / (k_b + k_m)',
      s: `C = ${fmt(g.kb / 1000, 1)} / (${fmt(g.kb / 1000, 1)} + ${fmt(a.km / 1000, 1)})`, r: `C = ${fmt(a.C, 4)}`,
      n: 'Fração da carga externa que chega ao parafuso; o restante (1 − C) apenas alivia a compressão dos membros.' +
        (a.semPre ? ' Sem pré-carga controlada a junta abre sob carga e o parafuso passa a receber 100 % dela (C efetivo = 1).' : '')}
  );
  secoes.push({titulo: 'Rigidez do parafuso e dos membros', passos: pr});

  /* 4 · pré-carga */
  if (!a.semPre) secoes.push({titulo: 'Pré-carga e torque de aperto', passos: [
    {t: 'Força de prova', f: 'F_p = S_p·A_t', s: `F_p = ${fmt(c.Sp, 0)} × ${fmt(r.At, 1)}`, r: `F_p = ${kN(a.Fprova)}`},
    {t: 'Pré-carga', f: `F_i = ${fmt(e.preFator, 2)}·F_p`, s: `F_i = ${fmt(e.preFator, 2)} × ${kN(a.Fprova)}`, r: `F_i = ${kN(a.Fi)}`,
      n: e.preFator >= 0.9 ? 'Junta permanente: 0,90·F_p (Shigley, eq. 8-31).' : 'Junta reutilizável: 0,75·F_p (Shigley, eq. 8-31).'},
    {t: 'Torque de aperto', f: 'T = K·F_i·d', s: `T = ${fmt(e.K, 2)} × ${fmt(a.Fi, 0)} × ${fmt(r.d, 0)} / 1000`, r: `T = ${fmt(a.torque, 1)} N·m`,
      n: 'K depende do acabamento e da lubrificação; a dispersão real da pré-carga com torquímetro é de ±25 % a ±30 %.'}
  ]});

  /* 5 · tração */
  if (q.Pb > 0 || !a.semPre) {
    const pt = [];
    pt.push({t: 'Força no parafuso', f: a.semPre ? 'F_b = P' : 'F_b = F_i + C·P',
      s: a.semPre ? `F_b = ${kN(q.Pb, 3)}` : `F_b = ${kN(a.Fi, 3)} + ${fmt(a.C, 4)} × ${kN(q.Pb, 3)}`, r: `F_b = ${kN(a.Fb, 3)}`});
    if (!a.semPre) pt.push({t: 'Força nos membros (compressão)', f: 'F_m = F_i − (1 − C)·P',
      s: `F_m = ${kN(a.Fi, 3)} − ${fmt(1 - a.C, 4)} × ${kN(q.Pb, 3)}`, r: `F_m = ${kN(a.Fm, 3)}`,
      n: a.Fm < 0 ? 'F_m negativo: a junta já separou sob esta carga.' : 'Enquanto F_m > 0 os membros continuam em contato.'});
    const v = id => a.ver.find(x => x.id === id);
    if (v('prova')) pt.push({t: 'Fator de segurança à resistência de prova', f: 'n_p = S_p·A_t / F_b',
      s: `n_p = ${kN(a.Fprova, 3)} / ${kN(a.Fb, 3)}`, r: `n_p = ${fatorTxt(v('prova').n)}`, ok: v('prova').ok, n: v('prova').nota});
    if (v('carga')) pt.push({t: 'Fator de carga', f: a.semPre ? 'n_L = S_p·A_t / P' : 'n_L = (S_p·A_t − F_i) / (C·P)',
      s: a.semPre ? `n_L = ${kN(a.Fprova, 3)} / ${kN(q.Pb, 3)}` : `n_L = (${kN(a.Fprova, 3)} − ${kN(a.Fi, 3)}) / (${fmt(a.C, 4)} × ${kN(q.Pb, 3)})`,
      r: `n_L = ${fatorTxt(v('carga').n)}`, ok: v('carga').ok,
      n: 'Quantas vezes a carga externa pode crescer até o parafuso atingir a carga de prova (Shigley, eq. 8-28).'});
    if (v('sep')) pt.push(
      {t: 'Carga externa que separa a junta', f: 'P_0 = F_i / (1 − C)', s: `P_0 = ${kN(a.Fi, 3)} / ${fmt(1 - a.C, 4)}`, r: `P_0 = ${kN(a.P0, 3)}`},
      {t: 'Fator de segurança contra a separação', f: 'n_0 = F_i / [P·(1 − C)]', s: `n_0 = ${kN(a.Fi, 3)} / (${kN(q.Pb, 3)} × ${fmt(1 - a.C, 4)})`,
        r: `n_0 = ${fatorTxt(v('sep').n)}`, ok: v('sep').ok,
        n: 'Acima de P_0 o parafuso passa a receber 100 % da carga externa e a junta perde a vantagem em fadiga.'});
    secoes.push({titulo: 'Tração no parafuso e separação da junta', passos: pt});
  }

  /* 6 · cisalhamento */
  if (q.Vb > 0) {
    const v = id => a.ver.find(x => x.id === id), pc = [];
    pc.push({t: 'Área resistente ao corte', f: a.roscaNoCorte ? 'A_s = A_t  (rosca no plano de corte)' : 'A_s = A_d  (corpo liso no plano de corte)',
      s: `A_s = ${fmt(a.As, 1)} mm²`, r: `A_s = ${fmt(a.As, 1)} mm²`});
    pc.push({t: 'Tensão de cisalhamento média', f: 'τ = V / (m·A_s)', s: `τ = ${fmt(q.Vb, 0)} / (${e.planos} × ${fmt(a.As, 1)})`, r: `τ = ${fmt(q.Vb / (e.planos * a.As), 1)} MPa`});
    pc.push({t: 'Resistência ao cisalhamento', f: 'S_sp = 0,577·S_p', s: `S_sp = 0,577 × ${fmt(c.Sp, 0)}`, r: `S_sp = ${fmt(a.Ssp, 1)} MPa`});
    const vc = v('corte');
    pc.push({t: vc.nome, f: 'n = m·A_s·S_sp / V', s: `n = ${e.planos} × ${fmt(a.As, 1)} × ${fmt(a.Ssp, 1)} / ${fmt(q.Vb, 0)}`,
      r: `n = ${fatorTxt(vc.n)}` + (vc.req ? '' : '  (reserva)'), ok: vc.ok ?? undefined, n: vc.nota});
    const ve = v('esm');
    pc.push({t: 'Esmagamento da parede do furo', f: 'n = d·t·min(S_y,ch; S_p) / V',
      s: `n = ${fmt(r.d, 0)} × ${fmt(e.t, 1)} × ${fmt(Math.min(e.SyM, c.Sp), 0)} / ${fmt(q.Vb, 0)}`,
      r: `n = ${fatorTxt(ve.n)}` + (ve.req ? `` : '  (reserva)'), ok: ve.ok ?? undefined,
      n: 'Pressão de contato média na área projetada d·t, comparada ao escoamento do material mais fraco (chapa ou parafuso).'});
    const vi = v('inter');
    if (vi) pc.push({t: 'Interação tração + cisalhamento', f: 'n = 1 / √[(P / S_p·A_t)² + (V / m·A_s·S_sp)²]',
      s: `n = 1 / √[(${kN(q.Pb, 3)} / ${kN(a.Fprova, 3)})² + (${kN(q.Vb, 3)} / ${kN(e.planos * a.As * a.Ssp, 3)})²]`,
      r: `n = ${fatorTxt(vi.n)}`, ok: vi.ok, n: 'Curva elíptica de interação usada nas normas de estruturas para parafusos sob tração e corte simultâneos.'});
    const va = v('atrito');
    if (va) pc.push({t: 'Resistência ao escorregamento', f: 'n_s = μ·m·[F_i − (1 − C)·P] / V',
      s: `n_s = ${fmt(e.mu, 2)} × ${e.planos} × [${kN(a.Fi, 3)} − ${fmt(1 - a.C, 4)} × ${kN(q.Pb, 3)}] / ${kN(q.Vb, 3)}`,
      r: `n_s = ${fatorTxt(va.n)}`, ok: va.ok,
      n: 'A força de aperto que sobra entre as chapas, vezes o atrito, transmite o corte sem que o parafuso encoste na parede do furo.'});
    secoes.push({titulo: 'Cisalhamento, esmagamento e atrito', passos: pc});
  }

  /* 7 · fadiga */
  if (a.fad) {
    const f = a.fad, vf = a.ver.find(x => x.id === 'fad');
    secoes.push({titulo: 'Fadiga — critério de Goodman (Shigley, eq. 8-38)', passos: [
      {t: 'Tensão de pré-carga', f: 'σ_i = F_i / A_t', s: `σ_i = ${fmt(a.Fi, 0)} / ${fmt(r.At, 1)}`, r: `σ_i = ${fmt(f.si, 1)} MPa`},
      {t: 'Tensão alternada', f: 'σ_a = C·(P_max − P_min) / (2·A_t)', s: `σ_a = ${fmt(a.Ce, 4)} × (${fmt(q.Pb, 0)} − ${fmt(q.Pbmin, 0)}) / (2 × ${fmt(r.At, 1)})`, r: `σ_a = ${fmt(f.sa, 2)} MPa`},
      {t: 'Tensão média', f: 'σ_m = C·(P_max + P_min) / (2·A_t) + σ_i', s: `σ_m = ${fmt(a.Ce, 4)} × (${fmt(q.Pb, 0)} + ${fmt(q.Pbmin, 0)}) / (2 × ${fmt(r.At, 1)}) + ${fmt(f.si, 1)}`, r: `σ_m = ${fmt(f.sm, 1)} MPa`},
      {t: 'Fator de segurança à fadiga', f: 'n_f = S_e·(S_ut − σ_i) / [S_ut·σ_a + S_e·(σ_m − σ_i)]',
        s: `n_f = ${fmt(c.Se, 0)} × (${fmt(c.Sut, 0)} − ${fmt(f.si, 1)}) / [${fmt(c.Sut, 0)} × ${fmt(f.sa, 2)} + ${fmt(c.Se, 0)} × (${fmt(f.sm, 1)} − ${fmt(f.si, 1)})]`,
        r: `n_f = ${fatorTxt(f.nf)}`, ok: vf.ok,
        n: 'A reta de carga parte do ponto (σ_i, 0): a pré-carga é constante e só a parcela C·P oscila. ' + (vf.nota || '')}
    ]});
  }

  numerarPassos(secoes);

  const un = v => v.id === 'fad' ? (x => fmt(x, 1) + ' MPa') : v.id === 'inter' ? (x => fmt(x, 3)) : (x => kN(x));
  const resumo = a.ver.map(v => [v.nome, `${v.sol[0]} = ${un(v)(v.sol[1])}`, `${v.res[0]} = ${un(v)(v.res[1])}`,
    fatorTxt(v.n), v.ok == null ? '<span class="na">reserva</span>' : v.ok ? '<span class="ok">ATENDE</span>' : '<span class="fail">NÃO ATENDE</span>']);

  const saidas = [];
  if (!a.semPre) saidas.push(['F_i', 'Pré-carga de montagem', kN(a.Fi)], ['T', 'Torque de aperto', `${fmt(a.torque, 1)} N·m`]);
  saidas.push(['C', 'Constante de rigidez da junta', fmt(a.C, 4)], ['F_b', 'Força máxima no parafuso', kN(a.Fb)]);
  if (!a.semPre) saidas.push(['P_0', 'Carga externa de separação (por parafuso)', kN(a.P0)]);
  saidas.push([a.tipo === 'parafuso' ? 'L' : 'L_corte', a.tipo === 'parafuso' ? 'Comprimento comercial do parafuso' : 'Comprimento de corte da barra', `${fmt(g.L, 0)} mm`]);
  if (a.gov) saidas.push(['n_gov', `Verificação que governa: ${a.gov.nome.toLowerCase()}`, `${fatorTxt(a.gov.n)}`]);

  const conclusao = a.ok
    ? `${nomeEl} ATENDE a todas as verificações para as cargas informadas` + (a.gov ? `; governa ${a.gov.nome.toLowerCase()} (n = ${fatorTxt(a.gov.n)}).` : '.')
    : `${nomeEl} NÃO ATENDE: ${a.ver.filter(v => v.ok === false).map(v => v.nome.toLowerCase()).join(', ')}.`;

  return {
    titulo: `Memorial de cálculo — ${MODOS[modo].split(' —')[0].toLowerCase()}`,
    subtitulo: `${nomeEl} · ${MODOS[modo]}`, entradas, constantes, props, propsTitulo: `C · Propriedades — ${r.nome} classe ${c.id}`,
    secoes, resumo, saidas, conclusao, ok: a.ok
  };
}

/* ---------------- modelo: parafuso de pressão / nivelamento ---------------- */
function modeloMacaco(e, a) {
  const {r, c, fem, base} = a, v = id => a.ver.find(x => x.id === id);
  const nome = `Parafuso de pressão ${r.nome} × ${fmt(r.p, 2)} classe ${c.id}`;
  const Nm = x => fmt(x / 1000, 2) + ' N·m';
  const kfTxt = (K_FLAMB.find(k => k[0] === e.Kf) || [e.Kf, 'informado'])[1];
  const entradas = [
    ['W', 'Carga total sobre os parafusos', kN(e.W), 'informado'],
    ['n', 'Número de parafusos de pressão', String(e.n), 'informado'],
    ['A × B', 'Dimensões da estrutura em planta', `${fmt(e.A, 0)} × ${fmt(e.B, 0)} mm`, 'informado'],
    ['x_CG, y_CG', 'Centro de gravidade em relação ao centro da planta', `${fmt(e.ex, 0)} mm, ${fmt(e.ey, 0)} mm`, 'informado'],
    ['k_d', 'Fator de desigualdade da distribuição', fmt(e.kd, 2), e.kd > 1 ? 'informado — apoios não se dividem por igual' : 'carga dividida por igual'],
    ['L', 'Comprimento livre (da rosca fêmea até a ponta)', `${fmt(e.L, 0)} mm`, 'informado'],
    ['K', 'Condição de extremidade', `${fmt(e.Kf, 1)} — ${kfTxt}`, 'selecionado'],
    ['L_e', 'Comprimento de rosca engajada (espessura da rosca fêmea)', `${fmt(e.Le, 1)} mm`, 'informado'],
    ['—', 'Rosca fêmea', `${fem.nome} (S_y = ${fmt(fem.Sy, 0)} MPa)`, 'selecionado'],
    ['—', 'Base sob a ponta', `${base.nome} (S_y = ${fmt(base.Sy, 0)} MPa)`, 'selecionado'],
    ['—', 'Contato da ponta', (PONTAS.find(p => p.id === e.ponta) || PONTAS[0]).nome + (a.sapata ? `, D_s = ${fmt(e.Ds, 0)} mm` : ''), 'selecionado'],
    ['f', 'Atrito na rosca', fmt(e.f, 2), 'Shigley, Tab. 8-5'],
    ['f_c', 'Atrito da ponta na base', a.sapata ? 'não se aplica (sapata não gira)' : fmt(e.fc, 2), 'Shigley, Tab. 8-6'],
    ['—', 'Elemento verificado', nome, 'ISO 261 / ISO 898-1']
  ];
  const constantes = [
    ['α', 'Semiângulo do filete da rosca métrica', '30° (sec α = 1,1547)', 'ISO 68-1'],
    ['E', 'Módulo de elasticidade do parafuso', `${fmt(c.E / 1000, 0)} GPa`, c.tipo === 'inox' ? 'inox austenítico' : 'aço'],
    ['w_i, w_o', 'Largura do filete na raiz — externa, interna', `${fmt(W_EXT, 2)}; ${fmt(W_INT, 2)}`, 'Norton, cap. 15 (rosca ISO)'],
    ['0,577', 'Razão de von Mises em cisalhamento puro', '1/√3', 'energia de distorção'],
    ['n ≥ 1', 'Critério de verificação: cada coeficiente de segurança deve ser pelo menos 1', '1,00', 'margem adicional a critério do projetista']
  ];
  if (e.desgaste) constantes.push(['p_adm', 'Pressão admissível nos filetes', `${fmt(e.padm, 1)} MPa`, 'Shigley, Tab. 8-4']);
  const props = [
    ['d', 'Diâmetro nominal', `${fmt(r.d, 0)} mm`, 'ISO 261'],
    ['p', 'Passo', `${fmt(r.p, 2)} mm`, 'ISO 261'],
    ['S_y', 'Resistência ao escoamento', `${fmt(c.Sy, 0)} MPa`, c.tipo === 'inox' ? 'ISO 3506-1' : 'ISO 898-1']
  ];
  const secoes = [];
  const ds = a.dist, cr = ds.crit, pd = [
    {t: 'Centroide dos parafusos', f: 'x_c = Σx_i / n     y_c = Σy_i / n', s: `posições na planta ${fmt(e.A, 0)} × ${fmt(e.B, 0)} mm (tabela abaixo)`,
      r: `x_c = ${fmt(ds.xc, 1)} mm     y_c = ${fmt(ds.yc, 1)} mm`},
    {t: 'Excentricidade do centro de gravidade', f: 'e_x = x_CG − x_c     e_y = y_CG − y_c', s: `e_x = ${fmt(e.ex, 0)} − ${fmt(ds.xc, 1)}     e_y = ${fmt(e.ey, 0)} − ${fmt(ds.yc, 1)}`,
      r: `e_x = ${fmt(ds.ex, 1)} mm     e_y = ${fmt(ds.ey, 1)} mm`},
    {t: 'Somas dos quadrados das distâncias ao centroide', f: 'Σx² = Σ(x_i − x_c)²     Σy² = Σ(y_i − y_c)²', s: `${ds.n} parafusos`,
      r: `Σx² = ${fmt(ds.Sx2, 0)} mm²     Σy² = ${fmt(ds.Sy2, 0)} mm²`},
    {t: `Carga no parafuso mais carregado (nº ${cr.id})`, f: 'F_i = W/n + W·e_x·(x_i − x_c)/Σx² + W·e_y·(y_i − y_c)/Σy²',
      s: `F = ${fF(e.W)}/${ds.n}` + (ds.Sx2 > 0 ? ` + ${fF(e.W)} × ${fmt(ds.ex, 1)} × ${fmt(cr.x - ds.xc, 1)} / ${fmt(ds.Sx2, 0)}` : '') +
        (ds.Sy2 > 0 ? ` + ${fF(e.W)} × ${fmt(ds.ey, 1)} × ${fmt(cr.y - ds.yc, 1)} / ${fmt(ds.Sy2, 0)}` : ''),
      r: `F_max = ${kN(ds.Fmax, 3)}` + (ds.Fmin < 0 ? `     F_min = ${kN(ds.Fmin, 3)} (descola!)` : ''), ok: ds.estavel ? undefined : false,
      n: 'Estrutura rígida sobre apoios iguais: a carga se divide por igual e o momento da excentricidade soma nos parafusos de um lado e alivia os do outro — a mesma conta de um grupo de estacas.'},
    {t: 'Carga de cálculo por parafuso', f: 'F = k_d·F_max', s: `F = ${fmt(e.kd, 2)} × ${kN(ds.Fmax, 3)}`, r: `F = ${kN(a.F, 3)}`,
      n: 'Com quatro ou mais apoios a estrutura é hiperestática: um parafuso mais alto que os outros recebe mais carga. Se o nivelamento não for controlado, use k_d > 1 (com k_d = 2, metade dos apoios leva tudo).'}
  ];
  secoes.push({titulo: 'Distribuição da carga nos parafusos', passos: pd,
    tabela: {cab: ['Nº', 'x (mm)', 'y (mm)', `F_i (${UN.f})`], linhas: ds.pts.map(p => [p.id, fmt(p.x, 0), fmt(p.y, 0), (p === cr ? '▶ ' : '') + fF(p.F)])}});
  secoes.push({titulo: 'Geometria da rosca', passos: [
    {t: 'Área de tração', f: 'A_t = π/4·(d − 0,9382·p)²', s: `A_t = π/4 × (${fmt(r.d, 0)} − 0,9382 × ${fmt(r.p, 2)})²`, r: `A_t = ${fmt(r.At, 1)} mm²`},
    {t: 'Diâmetro efetivo (primitivo)', f: 'd_m = d − 0,6495·p', s: `d_m = ${fmt(r.d, 0)} − 0,6495 × ${fmt(r.p, 2)}`, r: `d_m = ${fmt(a.dm, 3)} mm`},
    {t: 'Diâmetro menor', f: 'd_r = d − 1,2269·p', s: `d_r = ${fmt(r.d, 0)} − 1,2269 × ${fmt(r.p, 2)}`, r: `d_r = ${fmt(r.dr, 3)} mm`},
    {t: 'Ângulo de avanço', f: 'λ = atan[l / (π·d_m)]   (l = p, uma entrada)', s: `λ = atan[${fmt(a.l, 2)} / (π × ${fmt(a.dm, 3)})]`, r: `λ = ${fmt(a.lam * 180 / Math.PI, 2)}°`}
  ]});
  const tp = [
    {t: 'Torque na rosca para subir a carga', f: 'T_s = F·d_m/2 · (l + π·f·d_m·sec α) / (π·d_m − f·l·sec α)',
      s: `T_s = ${fmt(a.F, 0)} × ${fmt(a.dm, 3)}/2 × (${fmt(a.l, 2)} + π × ${fmt(e.f, 2)} × ${fmt(a.dm, 3)} × 1,1547) / (π × ${fmt(a.dm, 3)} − ${fmt(e.f, 2)} × ${fmt(a.l, 2)} × 1,1547)`,
      r: `T_s = ${Nm(a.TthS)}`, n: 'Shigley, eq. 8-5, com o atrito aumentado por sec α porque o flanco do filete de 60° é inclinado em relação ao eixo.'},
    {t: 'Torque na rosca para descer a carga', f: 'T_d = F·d_m/2 · (π·f·d_m·sec α − l) / (π·d_m + f·l·sec α)',
      s: `T_d = ${fmt(a.F, 0)} × ${fmt(a.dm, 3)}/2 × (π × ${fmt(e.f, 2)} × ${fmt(a.dm, 3)} × 1,1547 − ${fmt(a.l, 2)}) / (π × ${fmt(a.dm, 3)} + ${fmt(e.f, 2)} × ${fmt(a.l, 2)} × 1,1547)`,
      r: `T_d = ${Nm(a.TthD)}`}
  ];
  if (!a.sapata) tp.push({t: 'Torque de atrito na ponta', f: 'T_c = F·f_c·d_c / 2   com d_c = 2/3·d_r',
    s: `T_c = ${fmt(a.F, 0)} × ${fmt(e.fc, 2)} × ${fmt(a.dc, 3)} / 2`, r: `T_c = ${Nm(a.Tc)}`,
    n: 'A ponta plana gira apoiada na base e funciona como um colar de atrito. Com pressão uniforme, o raio médio de atrito é 1/3 do diâmetro de contato.'});
  tp.push(
    {t: 'Torque solicitado para SUBIR a carga', f: a.sapata ? 'T_sub = T_s' : 'T_sub = T_s + T_c', s: a.sapata ? `T_sub = ${Nm(a.TthS)}` : `T_sub = ${Nm(a.TthS)} + ${Nm(a.Tc)}`, r: `T_sub = ${Nm(a.TS)}`},
    {t: 'Torque solicitado para DESCER a carga', f: a.sapata ? 'T_desc = T_d' : 'T_desc = T_d + T_c', s: a.sapata ? `T_desc = ${Nm(a.TthD)}` : `T_desc = ${Nm(a.TthD)} + ${Nm(a.Tc)}`, r: `T_desc = ${Nm(a.TD)}`},
    {t: 'Autotravamento', f: 'π·f·d_m·sec α > l', s: `${fmt(Math.PI * e.f * a.dm * SEC30, 3)} > ${fmt(a.l, 2)}`,
      r: a.trava ? 'autotravante — a carga não desce sozinha' : 'NÃO autotravante — a carga desce sozinha', ok: a.trava},
    {t: 'Rendimento ao subir', f: 'e = F·l / (2π·T_sub)', s: `e = ${fmt(a.F, 0)} × ${fmt(a.l, 2)} / (2π × ${fmt(a.TS, 0)})`, r: `e = ${fmt(a.ef * 100, 1)} %`}
  );
  secoes.push({titulo: 'Torque para subir e descer a carga (Shigley §8-2)', passos: tp});
  const vv = v('vm');
  secoes.push({titulo: 'Tensões no núcleo ao girar sob carga', passos: [
    {t: 'Tensão de compressão', f: 'σ = F / A_t', s: `σ = ${fmt(a.F, 0)} / ${fmt(r.At, 1)}`, r: `σ = ${fmt(a.sig, 1)} MPa`},
    {t: 'Tensão de torção na raiz', f: 'τ = 16·T_sub / (π·d_r³)', s: `τ = 16 × ${fmt(a.TS, 0)} / (π × ${fmt(r.dr, 3)}³)`, r: `τ = ${fmt(a.tau, 1)} MPa`,
      n: 'A favor da segurança, o torque total de subida é combinado com a carga total na mesma seção.'},
    {t: 'Tensão equivalente de von Mises', f: 'σ_vm = √(σ² + 3·τ²)', s: `σ_vm = √(${fmt(a.sig, 1)}² + 3 × ${fmt(a.tau, 1)}²)`, r: `σ_vm = ${fmt(a.svm, 1)} MPa`},
    {t: 'Coeficiente de segurança', f: 'n = S_y / σ_vm', s: `n = ${fmt(c.Sy, 0)} / ${fmt(a.svm, 1)}`, r: `n = ${fatorTxt(vv.n)}`, ok: vv.ok}
  ]});
  const vf = v('flamb');
  secoes.push({titulo: 'Flambagem do trecho livre (Shigley §4-11)', passos: [
    {t: 'Área e raio de giração do núcleo', f: 'A = π·d_r²/4     k = d_r / 4', s: `A = π × ${fmt(r.dr, 3)}² / 4     k = ${fmt(r.dr, 3)} / 4`, r: `A = ${fmt(a.A, 1)} mm²     k = ${fmt(a.k, 3)} mm`},
    {t: 'Índice de esbeltez', f: 'L_e / k = K·L / k', s: `L_e / k = ${fmt(e.Kf, 1)} × ${fmt(e.L, 0)} / ${fmt(a.k, 3)}`, r: `L_e / k = ${fmt(a.esb, 1)}`},
    {t: 'Esbeltez de transição Euler × Johnson', f: '(L_e/k)_1 = √(2π²·E / S_y)', s: `(L_e/k)_1 = √(2π² × ${fmt(c.E, 0)} / ${fmt(c.Sy, 0)})`, r: `(L_e/k)_1 = ${fmt(a.esb1, 1)} → ${a.johnson ? 'coluna curta: Johnson' : 'coluna longa: Euler'}`},
    a.johnson
      ? {t: 'Carga crítica (Johnson)', f: 'P_cr = A·[S_y − (S_y·L_e/(2π·k))² / E]', s: `P_cr = ${fmt(a.A, 1)} × [${fmt(c.Sy, 0)} − (${fmt(c.Sy, 0)} × ${fmt(a.esb, 1)} / 2π)² / ${fmt(c.E, 0)}]`, r: `P_cr = ${kN(a.Pcr)}`}
      : {t: 'Carga crítica (Euler)', f: 'P_cr = π²·E·A / (L_e/k)²', s: `P_cr = π² × ${fmt(c.E, 0)} × ${fmt(a.A, 1)} / ${fmt(a.esb, 1)}²`, r: `P_cr = ${kN(a.Pcr)}`},
    {t: 'Coeficiente de segurança à flambagem', f: 'n = P_cr / F', s: `n = ${kN(a.Pcr, 3)} / ${kN(a.F, 3)}`, r: `n = ${fatorTxt(vf.n)}`, ok: vf.ok}
  ]});
  const vp = v('espP'), vn = v('espF');
  secoes.push({titulo: 'Espanamento dos filetes', passos: [
    {t: 'Área de cisalhamento dos filetes do parafuso', f: 'A_s = π·d_r·w_i·L_e', s: `A_s = π × ${fmt(r.dr, 3)} × ${fmt(W_EXT, 2)} × ${fmt(e.Le, 1)}`, r: `A_s = ${fmt(a.Asp, 1)} mm²`},
    {t: 'Espanamento do parafuso', f: 'n = A_s·0,577·S_y / F', s: `n = ${fmt(a.Asp, 1)} × 0,577 × ${fmt(c.Sy, 0)} / ${fmt(a.F, 0)}`, r: `n = ${fatorTxt(vp.n)}`, ok: vp.ok},
    {t: 'Área de cisalhamento da rosca fêmea', f: 'A_n = π·d·w_o·L_e', s: `A_n = π × ${fmt(r.d, 0)} × ${fmt(W_INT, 2)} × ${fmt(e.Le, 1)}`, r: `A_n = ${fmt(a.Asf, 1)} mm²`},
    {t: 'Espanamento da rosca fêmea', f: 'n = A_n·0,577·S_y,f / F', s: `n = ${fmt(a.Asf, 1)} × 0,577 × ${fmt(fem.Sy, 0)} / ${fmt(a.F, 0)}`, r: `n = ${fatorTxt(vn.n)}`, ok: vn.ok,
      n: 'Em chapa fina ou material mole, é a rosca fêmea que espana primeiro: aumente L_e (chapa mais grossa ou porca soldada).'}
  ]});
  const vb = v('base'), ps = [
    {t: a.sapata ? 'Área de apoio da sapata' : 'Área de apoio da ponta plana', f: a.sapata ? 'A_apoio = π·D_s² / 4' : 'A_apoio = π·d_r² / 4',
      s: `A_apoio = π × ${fmt(a.Dap, 1)}² / 4`, r: `A_apoio = ${fmt(a.Aap, 1)} mm²`},
    {t: 'Esmagamento da base', f: 'n = A_apoio·S_y,base / F', s: `n = ${fmt(a.Aap, 1)} × ${fmt(base.Sy, 0)} / ${fmt(a.F, 0)}`, r: `n = ${fatorTxt(vb.n)}`, ok: vb.ok,
      n: a.sapata ? '' : 'Em piso de concreto ou chapa fina, use uma sapata ou uma chapa de apoio sob a ponta.'}
  ];
  const vpb = v('pb');
  if (vpb) ps.push(
    {t: 'Número de filetes engajados', f: 'n_t = L_e / p', s: `n_t = ${fmt(e.Le, 1)} / ${fmt(r.p, 2)}`, r: `n_t = ${fmt(a.nt, 2)}`},
    {t: 'Pressão de contato nos filetes', f: 'p_b = F / (π·d_m·h·n_t)   com h = 0,5413·p', s: `p_b = ${fmt(a.F, 0)} / (π × ${fmt(a.dm, 3)} × ${fmt(a.h, 3)} × ${fmt(a.nt, 2)})`, r: `p_b = ${fmt(a.pb, 1)} MPa`},
    {t: 'Desgaste dos filetes', f: 'n = p_adm / p_b', s: `n = ${fmt(e.padm, 1)} / ${fmt(a.pb, 1)}`, r: `n = ${fatorTxt(vpb.n)}`, ok: vpb.ok,
      n: 'Só importa se o parafuso é girado com frequência com a carga em cima; num ajuste ocasional de nível, pode ser dispensado.'});
  secoes.push({titulo: 'Apoio na base' + (vpb ? ' e desgaste dos filetes' : ''), passos: ps});
  numerarPassos(secoes);
  const un = x => x.un === 'MPa' ? (y => fmt(y, 1) + ' MPa') : (y => kN(y));
  const resumo = a.ver.map(x => [x.nome, `${x.sol[0]} = ${un(x)(x.sol[1])}`, `${x.res[0]} = ${un(x)(x.res[1])}`, fatorTxt(x.n),
    x.ok ? '<span class="ok">ATENDE</span>' : '<span class="fail">NÃO ATENDE</span>']);
  const saidas = [
    ['F', 'Carga em cada parafuso', kN(a.F)],
    ['T_sub', 'Torque solicitado para subir a carga', Nm(a.TS)],
    ['T_desc', 'Torque solicitado para descer a carga', Nm(a.TD)],
    ['—', 'Autotravamento', a.trava ? 'sim' : 'não'],
    ['P_cr', 'Carga crítica de flambagem', kN(a.Pcr)]
  ];
  if (a.gov) saidas.push(['n_gov', `Verificação que governa: ${a.gov.nome.toLowerCase()}`, `${fatorTxt(a.gov.n)}`]);
  return {
    titulo: 'Memorial de cálculo — parafuso de pressão (nivelamento)',
    subtitulo: `${nome} · W = ${kN(e.W)} em ${e.n} parafusos · L = ${fmt(e.L, 0)} mm`,
    entradas, constantes, props, propsTitulo: `C · Propriedades — ${r.nome} classe ${c.id}`, secoes, resumo, saidas,
    conclusao: a.ok ? `${e.n} × ${nome} ATENDEM: cada um segura e levanta ${kN(a.F)}; torque para subir ${Nm(a.TS)}, para descer ${Nm(a.TD)}.`
      : `${nome} NÃO ATENDE: ${a.ver.filter(x => !x.ok).map(x => x.nome.toLowerCase()).join(', ')}.`,
    ok: a.ok
  };
}

/* ---------------- render ---------------- */
function mtabela(cab, linhas, classes) {
  const th = cab.map(c => `<th>${mathHtml(c)}</th>`).join('');
  const tr = linhas.map(l => `<tr>${l.map((c, i) => `<td class="${classes[i] || ''}">${mathHtml(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="mtable-wrap"><table class="mtable"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
const okBadge = ok => `<span class="cmp ${ok ? 'ok' : 'fail'}">${ok ? '✓ atende' : '✗ não atende'}</span>`;
function renderModelo(m) {
  const secoes = m.secoes.map(sec => `<div class="msection"><h4>${sec.num} · ${mathHtml(sec.titulo)}</h4>
    ${sec.passos.map(ps => `<div class="mstep">
      <div class="mtitle">Passo ${ps.num} · ${mathHtml(ps.t)}</div>
      <div class="mformula">${mathHtml(ps.f)}</div>
      <div class="msub">${mathHtml(ps.s)}</div>
      <div class="mres">${mathHtml(ps.r)}${ps.ok === undefined || ps.ok === null ? '' : ' ' + okBadge(ps.ok)}</div>
      ${ps.n ? `<div class="mnote">${mathHtml(ps.n)}</div>` : ''}</div>`).join('')}
    ${sec.tabela ? mtabela(sec.tabela.cab, sec.tabela.linhas, sec.tabela.cab.map(() => 'val')) : ''}</div>`).join('');
  return `
    <div class="msection"><h4>Resumo da verificação</h4>
      ${mtabela(['Verificação', 'Solicitante', 'Resistente', 'n', 'Situação'], m.resumo, ['', 'val', 'val', 'val', 'sit'])}</div>
    <div class="msection"><h4>A · Variáveis de entrada</h4>${mtabela(['Símbolo', 'Descrição', 'Valor', 'Origem'], m.entradas, ['sym', '', 'val', 'src'])}</div>
    <div class="msection"><h4>B · Constantes e critérios adotados</h4>${mtabela(['Símbolo', 'Descrição', 'Valor', 'Fonte'], m.constantes, ['sym', '', 'val', 'src'])}</div>
    <div class="msection"><h4>${mathHtml(m.propsTitulo)}</h4>${mtabela(['Símbolo', 'Descrição', 'Valor', 'Fonte'], m.props, ['sym', '', 'val', 'src'])}</div>
    ${secoes}
    <div class="msection"><h4>D · Resumo das variáveis de saída</h4>${mtabela(['Símbolo', 'Descrição', 'Valor'], m.saidas, ['sym', '', 'val'])}
      <div class="mconclusao ${m.ok ? 'ok' : 'fail'}">${mathHtml(m.conclusao)}</div></div>`;
}
