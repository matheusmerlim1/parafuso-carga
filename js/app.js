/* ---------- estado ---------- */
const store = {get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const $ = id => document.getElementById(id);
const S = {modo:'simples', tipo:'ambos', classes:['4.6','5.8','8.8','10.9'], mtipo:'parafuso', sel:null};
const CHAVE = 'parafuso-carga-v1';
const CAMPOS = [...document.querySelectorAll('#form input, #form select')].filter(el => el.id);

const MODO_INFO = {
  simples: {crumb:'Shigley §8-7 a §8-11', t:'Junta axial pré-carregada',
    d:'Tração que separa as chapas e cisalhamento no plano de contato, repartidos igualmente entre os parafusos. Mostra como a pré-carga divide a carga externa entre parafuso e membros pela constante de rigidez C — e o que acontece quando a junta separa.',
    anim:'Carga P subindo de zero ao máximo: corte da junta e diagrama força × deformação'},
  chapa: {crumb:'Shigley §8-12 — carga de cisalhamento excêntrica', t:'Grupo de parafusos na chapa',
    d:'Chapa presa por vários parafusos e carregada fora do centroide do grupo. A força se decompõe em corte primário (F/n, translação) e secundário (M·r/Σr², rotação em torno do centroide); o parafuso crítico é aquele em que as duas parcelas mais se alinham.',
    anim:'A chapa gira em torno do centroide (deslocamento exagerado) e cada parafuso recebe a sua parcela'},
  poste: {crumb:'Placa de base com chumbadores', t:'Poste parafusado no chão',
    d:'Força horizontal no topo do poste gera momento na base; a placa tende a girar sobre a borda comprimida e os chumbadores do lado oposto são tracionados na proporção da distância a essa borda. O cisalhamento H se divide entre todos.',
    anim:'O poste tomba sobre a borda comprimida (giro exagerado): chumbadores mais afastados esticam mais'},
  pressao: {crumb:'Shigley §8-2 — parafusos de potência', t:'Parafuso de pressão (nivelamento)',
    d:'Estrutura apoiada em n parafusos que empurram a base, como pés niveladores ou parafusos de levantamento. Cada parafuso leva W/n em compressão: verifica se ele segura a carga (compressão + torção, flambagem, espanamento dos filetes, esmagamento da base) e calcula o torque solicitado para subir e para descer.',
    anim:'A estrutura sobe e desce girando os parafusos — vista lateral e vista de cima com a carga de cada um'}
};

const COMO = {
  bolt: `<ul>
    <li><b>Área de tração:</b> <code>A<sub>t</sub> = π/4·(d − 0,9382·p)²</code> (ISO 898-1).</li>
    <li><b>Rigidez:</b> parafuso <code>k<sub>b</sub> = A<sub>d</sub>A<sub>t</sub>E/(A<sub>d</sub>l<sub>t</sub> + A<sub>t</sub>l<sub>d</sub>)</code> (barra roscada: <code>A<sub>t</sub>E/l</code>); membros por Wileman <code>k<sub>m</sub> = E·d·A·e<sup>B·d/l</sup></code>; <code>C = k<sub>b</sub>/(k<sub>b</sub>+k<sub>m</sub>)</code>.</li>
    <li><b>Pré-carga e torque:</b> <code>F<sub>i</sub> = 0,75·S<sub>p</sub>A<sub>t</sub></code> (reutilizável) ou 0,90 (permanente); <code>T = K·F<sub>i</sub>·d</code>.</li>
    <li><b>Tração:</b> <code>F<sub>b</sub> = F<sub>i</sub> + C·P</code>; fator de carga <code>n<sub>L</sub> = (S<sub>p</sub>A<sub>t</sub> − F<sub>i</sub>)/(C·P)</code>; separação <code>n<sub>0</sub> = F<sub>i</sub>/[P(1 − C)]</code>.</li>
    <li><b>Corte:</b> <code>n = m·A<sub>s</sub>·0,577·S<sub>p</sub>/V</code>; esmagamento <code>d·t·min(S<sub>y</sub>, S<sub>p</sub>)/V</code>; interação elíptica tração + corte; atrito <code>μ·m·[F<sub>i</sub> − (1 − C)P]/V</code>.</li>
    <li><b>Fadiga:</b> Goodman com a reta de carga partindo da pré-carga (Shigley, eq. 8-38).</li>
    <li><b>Grupo na chapa:</b> <code>F' = F/n</code>, <code>F'' = M·r/Σr²</code>, resultante vetorial.</li>
    <li><b>Poste:</b> <code>M = H·h</code>; <code>F<sub>i</sub> = M·d<sub>i</sub>/Σd²</code> com d medido até a borda comprimida.</li>
    <li><b>Mais adequado:</b> o menor diâmetro que atende a todas as verificações; no empate, a classe mais simples.</li></ul>`,
  pressao: `<ul>
    <li><b>Carga:</b> <code>F = k<sub>d</sub>·W/n</code> por parafuso.</li>
    <li><b>Torque para subir:</b> <code>T = F·d<sub>m</sub>/2·(l + π·f·d<sub>m</sub>·sec α)/(π·d<sub>m</sub> − f·l·sec α) + F·f<sub>c</sub>·d<sub>c</sub>/2</code>; para descer, com os sinais trocados (Shigley, eq. 8-5 e 8-6). Autotravante se <code>π·f·d<sub>m</sub>·sec α &gt; l</code>.</li>
    <li><b>Núcleo:</b> <code>σ = F/A<sub>t</sub></code>, <code>τ = 16·T/(π·d<sub>r</sub>³)</code>, <code>n = S<sub>y</sub>/√(σ² + 3τ²)</code>.</li>
    <li><b>Flambagem:</b> Johnson ou Euler no núcleo d<sub>r</sub> com L<sub>e</sub> = K·L.</li>
    <li><b>Espanamento:</b> <code>A<sub>s</sub> = π·d<sub>r</sub>·0,80·L<sub>e</sub></code> (parafuso) e <code>A<sub>n</sub> = π·d·0,88·L<sub>e</sub></code> (rosca fêmea), com 0,577·S<sub>y</sub>.</li>
    <li><b>Base:</b> <code>n = A<sub>apoio</sub>·S<sub>y</sub>/F</code>; desgaste opcional <code>p<sub>b</sub> = F/(π·d<sub>m</sub>·h·n<sub>t</sub>)</code>.</li>
    <li><b>Mais adequado:</b> o menor diâmetro que atende; no empate, a classe mais simples.</li></ul>`
};

/* ---------- leitura das entradas ---------- */
const num = id => { const v = parseFloat(String($(id).value).replace(/\s/g, '').replace(',', '.')); return isFinite(v) ? v : NaN; };
const chk = id => $(id).checked;
function marcaInvalidos(ids, cond) {
  let ok = true;
  for (const id of ids) { const bad = !cond(num(id), id); $(id).classList.toggle('bad', bad); if (bad) ok = false; }
  return ok;
}
function lerComum() {
  const ok = marcaInvalidos(['l', 't', 'SyM'], v => v > 0) & marcaInvalidos(['mu'], v => v >= 0);
  return {ok: !!ok, e: {
    l: num('l'), membro: $('membro').value, t: num('t'), SyM: num('SyM'), planos: +$('planos').value,
    roscaNoCorte: $('rosca').value === '1', preFator: +$('pre').value, K: +$('K').value, modo: $('modo').value, mu: num('mu'),
    nReq: {carga: 1, sep: 1, atrito: 1, fad: 1}          // critério único: atende se n ≥ 1
  }};
}
function lerModo(modo) {
  const c = lerComum(); let ok = c.ok; const e = c.e;
  if (modo === 'simples') {
    ok &= marcaInvalidos(['s_n'], v => v >= 1 && Number.isInteger(v)) & marcaInvalidos(['s_P', 's_V', 's_Pmin'], v => v >= 0);
    Object.assign(e, {n: num('s_n'), P: num('s_P') * uF(), V: num('s_V') * uF(), variavel: chk('s_var'), Pmin: num('s_Pmin') * uF()});
  } else if (modo === 'chapa') {
    ok &= marcaInvalidos(['c_nx', 'c_ny'], v => v >= 1 && v <= 12 && Number.isInteger(v)) & marcaInvalidos(['c_px', 'c_py'], v => v > 0)
      & marcaInvalidos(['c_Fx', 'c_Fy', 'c_ax', 'c_ay'], v => isFinite(v));
    Object.assign(e, {nx: num('c_nx'), ny: num('c_ny'), px: num('c_px'), py: num('c_py'), Fx: num('c_Fx') * uF(), Fy: num('c_Fy') * uF(),
      ax: num('c_ax'), ay: num('c_ay'), variavel: false});
  } else {
    ok &= marcaInvalidos(['p_nx', 'p_ny'], v => v >= 1 && v <= 12 && Number.isInteger(v)) & marcaInvalidos(['p_px', 'p_py', 'p_Lp', 'p_Bp', 'p_h'], v => v > 0)
      & marcaInvalidos(['p_H', 'p_Hmin'], v => v >= 0) & marcaInvalidos(['p_N', 'p_Mt'], v => isFinite(v));
    Object.assign(e, {nx: num('p_nx'), ny: num('p_ny'), px: num('p_px'), py: num('p_py'), Lp: num('p_Lp'), Bp: num('p_Bp'),
      H: num('p_H') * uF(), h: num('p_h') * 1000, N: num('p_N') * uF(), Mt: num('p_Mt') * uF() * 1000, aliviarN: chk('p_alivia'),
      variavel: chk('p_var'), Hmin: num('p_Hmin') * uF()});
  }
  return {ok: !!ok, e};
}
function lerPressao() {
  const ok = marcaInvalidos(['z_W', 'z_L', 'z_Le', 'z_Ds', 'z_padm', 'z_A', 'z_B'], v => v > 0) & marcaInvalidos(['z_ex', 'z_ey'], v => isFinite(v)) & marcaInvalidos(['z_kd'], v => v >= 1)
    & marcaInvalidos(['z_f', 'z_fc'], v => v >= 0 && v < 1) & marcaInvalidos(['z_n'], v => v >= 1 && v <= 50 && Number.isInteger(v));
  return {ok: !!ok, e: {W: num('z_W') * uF(), n: num('z_n'), kd: num('z_kd'), nReq: 1, L: num('z_L'), Kf: +$('z_Kf').value,
    Le: num('z_Le'), femea: $('z_femea').value, f: num('z_f'), ponta: $('z_ponta').value, base: $('z_base').value, fc: num('z_fc'),
    Ds: num('z_Ds'), desgaste: chk('z_desg'), padm: num('z_padm'), A: num('z_A'), B: num('z_B'), ex: num('z_ex'), ey: num('z_ey')}};
}

/* ---------- montagem inicial dos controles ---------- */
$('membro').innerHTML = MEMBROS.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
$('K').innerHTML = FATOR_K.map(([k, n]) => `<option value="${k}"${k === 0.2 ? ' selected' : ''}>${fmt(k, 2)} — ${n}</option>`).join('');
$('z_ponta').innerHTML = PONTAS.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
$('z_Kf').innerHTML = K_FLAMB.map(([k, n]) => `<option value="${k}">K = ${fmt(k, 1)} — ${n}</option>`).join('');
$('z_femea').innerHTML = FEMEAS.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
$('z_base').innerHTML = MEMBROS.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
function renderClasses() {
  $('classes').innerHTML = CLASSES.map(c => `<label class="tg" title="${c.uso}"><input type="checkbox" value="${c.id}"${S.classes.includes(c.id) ? ' checked' : ''}> ${c.id}</label>`).join('');
}

/* restaura o que o usuário digitou na última visita */
try {
  const sv = JSON.parse(store.get(CHAVE) || '{}');
  for (const el of CAMPOS) if (sv.f && sv.f[el.id] != null) { if (el.type === 'checkbox') el.checked = sv.f[el.id]; else el.value = sv.f[el.id]; }
  if (MODO_INFO[sv.modo]) S.modo = sv.modo;
  if (['parafuso', 'barra', 'ambos'].includes(sv.tipo)) S.tipo = sv.tipo;
  if (Array.isArray(sv.classes) && sv.classes.length) S.classes = sv.classes.filter(id => CLASSES.some(c => c.id === id));
} catch (err) {}
function salvar() {
  const f = {};
  for (const el of CAMPOS) f[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  store.set(CHAVE, JSON.stringify({f, modo: S.modo, tipo: S.tipo, classes: S.classes}));
}
renderClasses();

/* ---------- render ---------- */
const nomeCurto = a => `${a.r.nome} · ${a.classe.id}`;
const descEl = a => a.tipo === 'parafuso'
  ? `${TIPOS.parafuso.nome} ${a.r.nome} × ${a.g.L} — ${a.g.ld > 0 ? 'ISO 4014 (rosca parcial)' : 'ISO 4017 (rosca total)'}`
  : `${TIPOS.barra.nome} ${a.r.nome} — corte ≈ ${fmt(a.g.L, 0)} mm`;

function renderModoUI() {
  const info = MODO_INFO[S.modo], bolt = S.modo !== 'pressao';
  document.querySelectorAll('#modos .gbtn').forEach(b => b.setAttribute('aria-pressed', b.dataset.modo === S.modo));
  $('mcrumb').textContent = info.crumb; $('mtitulo').textContent = info.t; $('mdesc').textContent = info.d;
  $('atitulo').textContent = info.anim;
  document.querySelectorAll('#form [data-modos]').forEach(s => { s.hidden = !s.dataset.modos.split(' ').includes(S.modo); });
  document.querySelectorAll('#tipo button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.tipo));
  $('matCard').querySelector('.help').textContent = bolt
    ? 'Cada célula mostra o coeficiente de segurança n da verificação que governa (a mais crítica) e, abaixo, qual é ela; n ≥ 1 atende. Clique para ver o memorial.'
    : 'Cada célula mostra o coeficiente de segurança n da verificação que governa (a mais crítica) e, abaixo, qual é ela; n ≥ 1 atende. Clique para ver o memorial.';
  $('tipo').hidden = !bolt; $('el_h').textContent = bolt ? 'Elemento' : 'Classe do parafuso';
  $('l_lbl').textContent = S.modo === 'poste' ? 'Comprimento tracionado l' : 'Comprimento de aperto l';
  $('como').innerHTML = bolt ? COMO.bolt : COMO.pressao;
}
function renderCondicionais() {
  document.querySelectorAll('[data-se]').forEach(el => { el.hidden = !chk(el.dataset.se); });
  const atr = $('modo').value === 'atrito';
  $('mu_fld').hidden = !atr;
  $('rosca_fld').hidden = S.tipo === 'barra';
  const sap = $('z_ponta').value === 'sapata';
  $('z_fc_fld').hidden = sap; $('z_Ds_fld').hidden = !sap;
}

function chipsDe(a) {
  const c = [];
  if (!a.semPre) c.push(`<span class="chip">F<sub>i</sub> <strong>${kN(a.Fi, 1)}</strong></span>`, `<span class="chip">aperto <strong>${fmt(a.torque, 0)} N·m</strong></span>`);
  c.push(`<span class="chip">C <strong>${fmt(a.C, 3)}</strong></span>`);
  if (a.gov) c.push(`<span class="chip">governa: ${a.gov.nome.toLowerCase()} <strong>n = ${fatorTxt(a.gov.n)}</strong></span>`);
  return c.join('');
}
function renderRec(listas, tipos) {
  $('rec').innerHTML = `<div class="recs">${tipos.map(t => {
    const best = recomendar(listas[t]), por = melhorPorClasse(listas[t]);
    if (!best) return `<div class="rec none"><div class="k">${TIPOS[t].nome}</div><div class="nm">Nenhum atende</div>
      <div class="sb">Nenhuma rosca até M48 nas classes marcadas passa em todas as verificações. Aumente o número de parafusos, marque classes mais resistentes ou revise as cargas.</div></div>`;
    const alt = S.classes.filter(id => por[id] && por[id] !== best).map(id => `<button type="button" data-t="${t}" data-d="${por[id].r.d}" data-c="${id}">${por[id].r.nome} · ${id}</button>`).join('');
    return `<div class="rec"><div class="k">${TIPOS[t].nome}</div><div class="nm">${best.r.nome} × ${fmt(best.r.p, 2)} — classe ${best.classe.id}</div>
      <div class="sb">${descEl(best)}</div><div class="chips">${chipsDe(best)}</div>
      ${blocoComercial(listas[t], best, t)}
      ${alt ? `<div class="alt">Menor por classe: ${alt}</div>` : ''}
      <button type="button" class="ver" data-t="${t}" data-d="${best.r.d}" data-c="${best.classe.id}">Ver memorial de cálculo</button></div>`;
  }).join('')}</div>`;
}
/* sugestão de uso frequente quando o menor aprovado é difícil de comprar */
function blocoComercial(lista, best, t) {
  if (usoFrequente(best)) return `<div class="com"><i class="dot"></i> Rosca e classe de uso frequente — fáceis de encontrar no mercado.</div>`;
  const c = recomendarComercial(lista);
  if (!c) return `<div class="com"><i class="dot"></i> Nenhuma combinação de uso frequente atende: marque outras classes ou revise as cargas.</div>`;
  return `<div class="com"><i class="dot"></i> Opção de uso frequente:
    <button type="button" data-t="${t}" data-d="${c.r.d}" data-c="${c.classe.id}">${c.r.nome} · ${c.classe.id}</button> n = ${fatorTxt(c.gov.n)}</div>`;
}
function renderMatriz(lista, tipo, best) {
  const soFreq = $('soFreq').checked;
  const cls = CLASSES.filter(c => S.classes.includes(c.id) && (!soFreq || classeFreq(tipo, c.id)));
  const roscas = ROSCAS.filter(r => !soFreq || roscaFreq(r.d));
  const com = recomendarComercial(lista);
  if (!cls.length) { $('matriz').innerHTML = '<div class="empty">Nenhuma das classes marcadas é de uso frequente para este elemento.</div>'; return; }
  const by = {}; for (const a of lista) by[a.r.d + '|' + a.classe.id] = a;
  let h = `<table class="mx"><thead><tr><th>Rosca</th>${cls.map(c => classeFreq(tipo, c.id)
    ? `<th class="cf" title="classe de uso frequente"><i class="dot"></i>${c.id}</th>` : `<th class="cn">${c.id}</th>`).join('')}</tr></thead><tbody>`;
  for (const r of roscas) {
    const freq = roscaFreq(r.d), seg = ROSCAS_2A.includes(r.d);
    h += `<tr class="${freq ? '' : 'r2'}"><td>${freq ? '<i class="dot"></i>' : ''}${r.nome}${freq ? '' : `<small>${seg ? '2ª escolha' : 'encomenda'}</small>`}</td>`;
    for (const c of cls) {
      const a = by[r.d + '|' + c.id], sel = S.sel && S.sel.t === tipo && S.sel.d === r.d && S.sel.c === c.id;
      const rz = a.gov ? a.gov.razao : Infinity;
      h += `<td class="c${a.ok ? ' ok' : ''}${sel ? ' sel' : ''}${a === best ? ' best' : ''}${a === com ? ' com' : ''}" data-t="${tipo}" data-d="${r.d}" data-c="${c.id}" title="${a.gov ? a.gov.nome + ': n = ' + fatorTxt(a.gov.n) : ''}">${fatorTxt(rz)}<small>${a.gov ? a.gov.nome.split(' (')[0].replace('Fator de carga', 'tração').replace('Resistência de prova', 'prova').toLowerCase() : ''}</small></td>`;
    }
    h += '</tr>';
  }
  $('matriz').innerHTML = h + '</tbody></table>';
}
function renderChecks(ver) {
  $('checks').innerHTML = `<div class="checks">${ver.map(v => {
    const st = v.ok == null ? 'info' : v.ok ? '' : 'fail';
    const uso = Math.min(1 / v.n, 1);
    return `<div class="ck ${st}"><span>${v.nome}</span><span class="bar" title="aproveitamento ${fmt(uso * 100, 0)} %"><i style="width:${fmt(uso * 100, 1).replace(',', '.')}%"></i></span>
      <span class="v">${fatorTxt(v.n)}</span><span class="st">${v.ok == null ? 'reserva' : v.ok ? 'atende ✓' : 'não atende ✗'}</span></div>`;
  }).join('')}</div>`;
}
function legenda(modo) {
  const L = {
    simples: [['var(--accent)', 'parafuso (k<sub>b</sub>)'], ['var(--good)', 'membros (k<sub>m</sub>)'], ['var(--load)', 'carga externa P'], ['var(--bad)', 'carga de prova S<sub>p</sub>·A<sub>t</sub>']],
    chapa: [['var(--p1)', "corte primário F'"], ['var(--good)', "corte secundário F''"], ['var(--accent)', 'resultante'], ['var(--bad)', 'parafuso crítico'], ['var(--load)', 'carga']],
    poste: [['var(--load)', 'cargas no poste'], ['var(--bad)', 'chumbador mais tracionado'], ['var(--steel)', 'chumbador pouco solicitado'], ['var(--ink)', 'borda de giro (planta)']],
    pressao: [['var(--load)', 'carga W e torque solicitado'], ['var(--good)', 'reação do piso em cada parafuso'], ['var(--load)', 'CG (vista de cima)'], ['var(--bad)', 'parafuso mais solicitado']]
  }[modo];
  $('leg').innerHTML = L.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('');
}

let ATUAL = null;               // último modelo de memorial e desenho, para o relatório
function calcular() {
  renderCondicionais(); salvar();
  if (S.modo === 'pressao') return calcularPressao();
  const {ok, e} = lerModo(S.modo);
  const tipos = S.tipo === 'ambos' ? ['parafuso', 'barra'] : [S.tipo];
  $('aviso').innerHTML = '';
  if (!ok || !S.classes.length) {
    $('rec').innerHTML = `<div class="warn bad">${!S.classes.length ? 'Marque ao menos uma classe de resistência.' : 'Há campos com valor inválido (destacados em vermelho).'}</div>`;
    $('matriz').innerHTML = $('memorial').innerHTML = $('checks').innerHTML = '';
    return;
  }
  const q = CARGAS[S.modo](e);
  const avisos = [];
  if (q.Pb <= 0 && q.Vb <= 0) avisos.push('Sem carga nos parafusos: informe tração, cisalhamento ou momento.');
  if (S.modo === 'chapa' && q.n === 1 && q.M) avisos.push('Um parafuso isolado não resiste a momento no plano — use ao menos dois.');
  if (S.modo === 'poste') {
    if ((e.nx - 1) * e.px >= e.Lp || (e.ny - 1) * e.py >= e.Bp) avisos.push('Os chumbadores caem fora da placa: aumente a placa ou reduza o passo.');
    if (e.nx < 2) avisos.push('Com uma única coluna de chumbadores o braço até a borda de giro é curto; o momento vai quase todo para eles.');
  }
  if (e.modo === 'atrito' && e.preFator === 0) avisos.push('Ligação por atrito exige pré-carga: o corte foi verificado por contato.');
  $('aviso').innerHTML = avisos.map(a => `<div class="warn">${a}</div>`).join('');

  const listas = {}; for (const t of tipos) listas[t] = varrer(e, q, t, S.classes);
  renderRec(listas, tipos);
  if (!tipos.includes(S.mtipo)) S.mtipo = tipos[0];
  $('mtipo').innerHTML = tipos.length > 1 ? tipos.map(t => `<button type="button" data-v="${t}" aria-pressed="${t === S.mtipo}">${TIPOS[t].curto}</button>`).join('') : '';

  /* seleção: a que o usuário clicou, se ainda existir; senão, a recomendada */
  const acha = s => s && listas[s.t] && listas[s.t].find(a => a.r.d === s.d && a.classe.id === s.c);
  let a = acha(S.sel);
  if (!a) {
    const t0 = tipos.find(t => recomendar(listas[t])) || tipos[0];
    a = recomendar(listas[t0]) || listas[t0].find(x => x.r.d === 12 && x.classe.id === S.classes[0]) || listas[t0][0];
    S.sel = {t: a.tipo, d: a.r.d, c: a.classe.id, auto: true};
  }
  renderMatriz(listas[S.mtipo], S.mtipo, recomendar(listas[S.mtipo]));
  $('dtitulo').textContent = `${TIPOS[a.tipo].nome} ${a.r.nome} × ${fmt(a.r.p, 2)} — classe ${a.classe.id}`;
  renderChecks(a.ver);
  const m = modeloParafuso(S.modo, e, a);
  $('memorial').innerHTML = renderModelo(m);

  /* animação */
  legenda(S.modo);
  const svg = $('svg');
  let fn;
  if (S.modo === 'simples') { svg.setAttribute('viewBox', '0 0 600 300'); fn = s => desenhoJunta(a, e, s); }
  else if (S.modo === 'chapa') { svg.setAttribute('viewBox', '0 0 600 330'); fn = s => desenhoChapa(e, q, a, s); }
  else { svg.setAttribute('viewBox', '0 0 620 360'); fn = s => desenhoPoste(e, q, a, s) + `<g transform="translate(395 70)">${plantaPoste(e, q, s, a.r.d)}</g>` + txt(505, 64, 'planta — tração por chumbador', 'lb lbS'); }
  ANIM.set(svg, fn, s => { $('sl').value = s; $('slo').textContent = fmt(s * 100, 0) + ' %'; });
  const legendas = {simples: 'corte da junta e diagrama força × deformação sob a carga máxima',
    chapa: 'grupo de parafusos na chapa: corte primário, secundário e resultante em cada parafuso',
    poste: 'poste na placa de base: tração nos chumbadores, vista lateral e planta'};
  ATUAL = {m, fn, viewBox: svg.getAttribute('viewBox'), legenda: legendas[S.modo], modo: S.modo,
    slug: `${a.tipo}-${a.r.nome}-${a.classe.id}`, alternativas: alternativas(tipos.map(t => [TIPOS[t].nome, listas[t]]))};
}

/* menor rosca aprovada em cada classe, para a tabela de alternativas do relatório */
function alternativas(grupos) {
  const out = [];
  for (const [nome, lista] of grupos) {
    const por = melhorPorClasse(lista);
    for (const id of S.classes) {
      const a = por[id];
      out.push([nome, id, a ? `${a.r.nome} × ${fmt(a.r.p, 2)}` : 'nenhuma até M48', a ? fatorTxt(a.gov.n) : '—', a ? a.gov.nome : '—',
        a ? (usoFrequente(a) ? 'sim' : roscaFreq(a.r.d) ? 'classe menos comum' : 'rosca menos comum') : '—']);
    }
  }
  return out;
}

function calcularPressao() {
  const {ok, e} = lerPressao();
  $('aviso').innerHTML = ''; $('mtipo').innerHTML = '';
  if (!ok || !S.classes.length) {
    $('rec').innerHTML = `<div class="warn bad">${!S.classes.length ? 'Marque ao menos uma classe de resistência.' : 'Há campos com valor inválido (destacados em vermelho).'}</div>`;
    $('matriz').innerHTML = $('memorial').innerHTML = $('checks').innerHTML = '';
    return;
  }
  const lista = varrerMacaco(e, S.classes), best = recomendar(lista), por = melhorPorClasse(lista);
  const Nm = x => fmt(x / 1000, 1) + ' N·m';
  if (best) {
    const alt = S.classes.filter(id => por[id] && por[id] !== best).map(id => `<button type="button" data-t="pressao" data-d="${por[id].r.d}" data-c="${id}">${por[id].r.nome} · ${id}</button>`).join('');
    $('rec').innerHTML = `<div class="recs"><div class="rec"><div class="k">Parafuso de pressão — ${e.n} unidades</div>
      <div class="nm">${best.r.nome} × ${fmt(best.r.p, 2)} — classe ${best.classe.id}</div>
      <div class="sb">O mais carregado segura ${kN(best.F)} (nº ${best.dist.crit.id}${e.kd > 1 ? `, com k<sub>d</sub> = ${fmt(e.kd, 2)}` : ''}) · ${best.trava ? 'autotravante' : 'não autotravante'}</div>
      <div class="chips"><span class="chip">torque p/ subir <strong>${Nm(best.TS)}</strong></span><span class="chip">p/ descer <strong>${Nm(best.TD)}</strong></span>
      <span class="chip">governa: ${best.gov.nome.toLowerCase()} <strong>n = ${fatorTxt(best.gov.n)}</strong></span></div>
      ${blocoComercial(lista, best, 'pressao')}
      ${alt ? `<div class="alt">Menor por classe: ${alt}</div>` : ''}
      <button type="button" class="ver" data-t="pressao" data-d="${best.r.d}" data-c="${best.classe.id}">Ver memorial de cálculo</button></div></div>`;
  } else {
    $('rec').innerHTML = `<div class="recs"><div class="rec none"><div class="k">Parafuso de pressão</div><div class="nm">Nenhum atende</div>
      <div class="sb">Nenhuma rosca até M48 nas classes marcadas segura a carga do parafuso mais carregado. Aumente o número de parafusos, reduza o comprimento livre ou aumente a rosca engajada.</div></div></div>`;
  }
  const avisos = [], ds = lista[0] && lista[0].dist;
  if (ds && !ds.estavel) avisos.push('O centro de gravidade está fora da área de apoio dos parafusos: algum parafuso descola e a estrutura tomba. Mude o CG ou a disposição.');
  if (e.n >= 4 && e.kd === 1) avisos.push('Com 4 ou mais apoios a carga só se divide por igual se a estrutura for bem nivelada. Na dúvida, use k<sub>d</sub> = 1,5 a 2.');
  $('aviso').innerHTML = avisos.map(a => `<div class="warn">${a}</div>`).join('');

  let a = S.sel && S.sel.t === 'pressao' && lista.find(x => x.r.d === S.sel.d && x.classe.id === S.sel.c);
  if (!a) {
    a = best || lista.find(x => x.r.d === 12) || lista[0];
    S.sel = {t: 'pressao', d: a.r.d, c: a.classe.id, auto: true};
  }
  renderMatriz(lista, 'pressao', best);
  $('dtitulo').textContent = `Parafuso de pressão ${a.r.nome} × ${fmt(a.r.p, 2)} — classe ${a.classe.id}`;
  renderChecks(a.ver);
  const m = modeloMacaco(e, a);
  $('memorial').innerHTML = renderModelo(m);
  legenda('pressao');
  const svg = $('svg'); svg.setAttribute('viewBox', '0 0 860 352');
  const fn = (s, t) => desenhoMacaco(e, a, s, t || 0);
  ANIM.set(svg, fn, s => { $('sl').value = s; $('slo').textContent = fmt(s * 100, 0) + ' %'; });
  ATUAL = {m, fn, viewBox: '0 0 860 352', modo: 'pressao', slug: `${a.r.nome}-${a.classe.id}`,
    legenda: `estrutura sobre ${e.n} parafusos de pressão: vista lateral e vista de cima com a carga em cada parafuso`,
    alternativas: alternativas([['Parafuso de pressão', lista]])};
}

/* ---------- unidade de força (kN ↔ tf) ---------- */
function aplicaUnidade(u, converter) {
  if (converter && u !== UN.f) {
    const k = FATOR_F[UN.f] / FATOR_F[u];
    document.querySelectorAll('#form .un').forEach(w => {
      const sp = w.querySelector('.uF, .uM'), inp = w.querySelector('input');
      if (!sp || !inp) return;
      const v = num(inp.id);
      if (isFinite(v)) inp.value = fmt(v * k, Math.abs(v * k) >= 100 ? 1 : 3).replace(/\./g, '').replace(/,?0+$/, '');
    });
  }
  UN.f = u;
  document.querySelectorAll('.uF').forEach(el => { el.textContent = u; });
  document.querySelectorAll('.uM').forEach(el => { el.textContent = u + '·m'; });
  document.querySelectorAll('#unid button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === u));
  store.set('parafuso-unidade', u);
}
aplicaUnidade(store.get('parafuso-unidade') === 'tf' ? 'tf' : 'kN', false);
$('unid').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; aplicaUnidade(b.dataset.v, true); calcular(); });

/* ---------- eventos ---------- */
$('modos').addEventListener('click', ev => {
  const b = ev.target.closest('.gbtn'); if (!b) return;
  S.modo = b.dataset.modo; S.sel = null;
  history.replaceState(null, '', '#' + S.modo);
  if (S.modo === 'poste' && S.tipo === 'parafuso') S.tipo = 'barra';
  renderModoUI(); calcular();
});
$('tipo').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  S.tipo = b.dataset.v; S.sel = null; renderModoUI(); calcular();
});
$('soFreq').checked = store.get('parafuso-sofreq') === '1';
$('soFreq').addEventListener('change', () => { store.set('parafuso-sofreq', $('soFreq').checked ? '1' : '0'); calcular(); });
$('mtipo').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; S.mtipo = b.dataset.v; calcular(); });
$('classes').addEventListener('change', () => {
  S.classes = [...$('classes').querySelectorAll('input:checked')].map(i => i.value); calcular();
});
$('membro').addEventListener('change', () => { $('SyM').value = MEMBROS.find(m => m.id === $('membro').value).Sy; });
$('form').addEventListener('input', ev => { if (ev.target.closest('#classes')) return; if (S.sel && S.sel.auto) S.sel = null; calcular(); });
$('form').addEventListener('change', ev => { if (ev.target.tagName === 'SELECT' || ev.target.type === 'checkbox') { if (!ev.target.closest('#classes')) { if (S.sel && S.sel.auto) S.sel = null; calcular(); } } });
function selecionar(ev) {
  const el = ev.target.closest('[data-d]'); if (!el) return;
  S.sel = {t: el.dataset.t, d: +el.dataset.d, c: el.dataset.c};
  if (el.dataset.t !== 'pressao') S.mtipo = el.dataset.t;
  calcular();
  if (el.classList.contains('ver')) $('detCard').scrollIntoView({behavior: 'smooth', block: 'start'});
}
$('rec').addEventListener('click', selecionar);
$('matriz').addEventListener('click', selecionar);
$('play').addEventListener('click', () => { const p = ANIM.alterna(); $('play').textContent = p ? '▶' : '⏸'; $('play').setAttribute('aria-label', p ? 'Continuar animação' : 'Pausar animação'); });
$('sl').addEventListener('input', () => { ANIM.fixa(+$('sl').value); $('play').textContent = '▶'; });

/* relatórios: PDF pela impressão do navegador e Word (.docx) editável */
/* identificação do documento (faixa do topo) */
const IDENT = ['id_proj', 'id_tag', 'id_rev', 'id_resp', 'id_data'];
const hojeISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
for (const id of IDENT) {
  /* versões anteriores guardavam projeto e responsável em r_proj / r_resp */
  const antigo = {id_proj: 'parafuso-r_proj', id_resp: 'parafuso-r_resp'}[id];
  const v = store.get('parafuso-' + id) ?? (antigo && store.get(antigo));
  if (v != null) $(id).value = v;
  $(id).addEventListener('input', () => store.set('parafuso-' + id, $(id).value));
}
if (!$('id_data').value) $('id_data').value = hojeISO();
function identificacao() {
  const v = id => $(id).value.trim(), d = v('id_data');
  return {projeto: v('id_proj'), tag: v('id_tag'), rev: v('id_rev'), resp: v('id_resp'),
    data: d ? d.split('-').reverse().join('/') : ''};
}
const dadosRelatorio = () => ATUAL && {...ATUAL, ...identificacao()};
$('printBtn').addEventListener('click', () => { const R = dadosRelatorio(); if (R) relatorioPdf(R); });
$('wordBtn').addEventListener('click', async () => {
  const R = dadosRelatorio(); if (!R) return;
  $('rstat').textContent = 'Gerando documento…';
  try { await relatorioWord(R); $('rstat').textContent = 'Documento Word baixado.'; }
  catch (err) { $('rstat').textContent = 'Não foi possível gerar o documento.'; }
});
$('smathBtn').addEventListener('click', () => {
  const R = dadosRelatorio(); if (!R) return;
  try { relatorioSmath(R); $('rstat').textContent = 'Arquivo SMath baixado.'; }
  catch (err) { console.error(err); $('rstat').textContent = 'Não foi possível gerar o arquivo SMath.'; }
});

/* tema */
const themeBtn = $('themeBtn');
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('themeIcon').textContent = t === 'dark' ? '☾' : '☀'; $('themeText').textContent = t === 'dark' ? 'Tela escura' : 'Tela clara';
}
applyTheme(store.get('parafuso-tema') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeBtn.addEventListener('click', () => {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(t); store.set('parafuso-tema', t);
});

const hashModo = () => { const h = location.hash.slice(1); return MODO_INFO[h] ? h : null; };
if (hashModo()) S.modo = hashModo();
addEventListener('hashchange', () => { const h = hashModo(); if (h && h !== S.modo) { S.modo = h; S.sel = null; renderModoUI(); calcular(); } });

renderModoUI();
calcular();
