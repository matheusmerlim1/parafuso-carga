/* ================= EXPORTAÇÃO PARA SMATH STUDIO (.sm) =================
   Módulo único, sem dependências, copiado igual nos projetos (fonte: "SMATH melhorias/
   compartilhado/smath-export.js"). Expõe window.SMathExport.

   Três camadas:
   1. Expressões: texto infixo -> árvore -> notação pós-fixa (RPN) que o SMath grava.
   2. Documento: posiciona as regiões de cima para baixo (sem sobrepor) e escreve o XML com a
      indentação que o SMath exige — sem ela a folha abre VAZIA. Áreas recolhíveis são UMA
      região que contém o cabeçalho <area>, o conteúdo e o <area terminator>.
   3. Memorial: recebe os passos do memorial da página ({t, f, s, r, ok, n}) e escreve cada
      seção numa área recolhida; fora dela, chama de novo o resultado da área.
      Uma fórmula só vira conta "viva" do SMath quando todos os símbolos dela já estão
      definidos E, avaliada aqui com unidades, reproduz o resultado da página. Senão o passo
      entra como texto (fórmula e substituição) e o resultado como valor — nunca um número
      diferente do memorial em PDF/Word. */
(function () {
  'use strict';

  /* =========================================================== 1. expressões */
  const OP_NORM = {'<=': '≤', '>=': '≥', '==': '≡', '!=': '≠'};
  const BIN = {'≡': [1, 'L'], '≠': [1, 'L'], '<': [1, 'L'], '>': [1, 'L'], '≤': [1, 'L'], '≥': [1, 'L'],
    '+': [2, 'L'], '-': [2, 'L'], '*': [3, 'L'], '/': [3, 'L'], '^': [5, 'R']};
  const PREC_UN = 4;
  const TOKS = [
    ['ws', /\s+/y],
    ['num', /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
    ['unit', /'(?:%|[\p{L}_°][\p{L}\p{N}_°]*)/uy],
    ['str', /"[^"]*"/y],
    ['name', /[\p{L}_][\p{L}\p{N}_.]*'*/uy],
    ['op', /<=|>=|==|!=|[-+*/^<>≤≥≡≠,()]/y]
  ];

  function tokenizar(txt) {
    const out = []; let pos = 0;
    while (pos < txt.length) {
      let hit = null;
      for (const [tipo, re] of TOKS) {
        re.lastIndex = pos; const m = re.exec(txt);
        if (m) { hit = [tipo, m[0]]; pos = re.lastIndex; break; }
      }
      if (!hit) throw new Error(`caractere inesperado "${txt[pos]}" em "${txt}"`);
      let [tipo, v] = hit;
      if (tipo === 'ws') continue;
      if (tipo === 'unit') {
        v = v.slice(1);
        const ant = out[out.length - 1];
        if (ant && (['num', 'name', 'unit'].includes(ant.tipo) || ant.v === ')')) out.push({tipo: 'op', v: '*'});
      } else if (tipo === 'str') v = v.slice(1, -1);
      else if (tipo === 'op') v = OP_NORM[v] || v;
      out.push({tipo, v});
    }
    return out;
  }

  function analisar(txt) {
    const toks = tokenizar(txt); let i = 0;
    const espiar = () => toks[i];
    const consumir = v => {
      const t = toks[i];
      if (!t || (v !== undefined && t.v !== v)) throw new Error(`esperava ${v ? '"' + v + '"' : 'mais conteúdo'} em "${txt}"`);
      i++; return t;
    };
    function expr(pmin) {
      let esq = unario();
      for (;;) {
        const t = espiar();
        if (!t || t.tipo !== 'op' || !(t.v in BIN)) return esq;
        const [p, a] = BIN[t.v];
        if (p < pmin) return esq;
        consumir();
        esq = {tipo: 'bin', v: t.v, f: [esq, expr(a === 'L' ? p + 1 : p)]};
      }
    }
    function unario() {
      const t = espiar();
      if (t && t.tipo === 'op' && (t.v === '-' || t.v === '+')) {
        consumir(); const o = expr(PREC_UN);
        return t.v === '+' ? o : {tipo: 'un', v: '-', f: [o]};
      }
      return primario();
    }
    function primario() {
      const t = consumir();
      if (['num', 'unit', 'str'].includes(t.tipo)) return {tipo: t.tipo, v: t.v};
      if (t.tipo === 'name') {
        if (espiar() && espiar().v === '(') {
          consumir('('); const args = [];
          if (espiar() && espiar().v !== ')') {
            args.push(expr(0));
            while (espiar() && espiar().v === ',') { consumir(','); args.push(expr(0)); }
          }
          consumir(')');
          return {tipo: 'func', v: t.v, f: args};
        }
        return {tipo: 'name', v: t.v};
      }
      if (t.v === '(') { const d = expr(0); consumir(')'); return {tipo: 'paren', v: '(', f: [d]}; }
      throw new Error(`"${t.v}" inesperado em "${txt}"`);
    }
    if (!toks.length) throw new Error('expressão vazia');
    const no = expr(0);
    if (i < toks.length) throw new Error(`sobrou "${toks[i].v}" em "${txt}"`);
    return no;
  }

  const semPar = n => { while (n.tipo === 'paren') n = n.f[0]; return n; };

  function rpn(n) {
    switch (n.tipo) {
      case 'num': case 'name': return [E('e', {type: 'operand'}, n.v)];
      case 'unit': return [E('e', {type: 'operand', style: 'unit'}, n.v)];
      case 'str': return [E('e', {type: 'operand', style: 'string'}, n.v)];
      case 'bin': {
        let [a, b] = n.f;
        // fração e expoente já agrupam no desenho: dispensa parênteses
        if (n.v === '/' || n.v === '^') { b = semPar(b); if (n.v === '/') a = semPar(a); }
        return [...rpn(a), ...rpn(b), E('e', {type: 'operator', args: '2'}, n.v)];
      }
      case 'un': return [...rpn(n.f[0]), E('e', {type: 'operator', args: '1'}, n.v)];
      case 'func': return [...n.f.flatMap(x => rpn(semPar(x))), E('e', {type: 'function', args: String(n.f.length)}, n.v)];
      case 'paren': return [...rpn(n.f[0]), E('e', {type: 'bracket'}, '(')];
    }
    throw new Error(n.tipo);
  }

  /* altura estimada [ascendente, descendente] em px, fonte 10 */
  function caixa(n) {
    const mx = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    const soma = c => c[0] + c[1];
    switch (n.tipo) {
      case 'num': case 'unit': case 'str': return [11, 6];
      case 'name': return [11, n.v.includes('.') ? 9 : 6];
      case 'bin': {
        const [a, b] = n.f;
        if (n.v === '/') return [soma(caixa(semPar(a))) + 4, soma(caixa(semPar(b))) + 4];
        if (n.v === '^') { const [as, ds] = caixa(a); const he = soma(caixa(semPar(b))); return [Math.max(as, Math.floor(as * .4) + he), ds]; }
        return mx(caixa(a), caixa(b));
      }
      case 'un': return caixa(n.f[0]);
      case 'func': {
        let c = [11, 6]; for (const x of n.f) c = mx(c, caixa(semPar(x)));
        return [c[0] + 2 + (n.v === 'sqrt' ? 4 : 0), c[1] + 2];
      }
      case 'paren': { const c = caixa(n.f[0]); return [c[0] + 2, c[1] + 2]; }
    }
    return [11, 6];
  }
  function largura(n) {
    switch (n.tipo) {
      case 'num': case 'name': case 'unit': case 'str': return 7 * n.v.length + 4;
      case 'bin': {
        const [a, b] = n.f.map(semPar);
        if (n.v === '/') return Math.max(largura(a), largura(b)) + 6;
        if (n.v === '^') return largura(a) + Math.floor(largura(b) * .7);
        return largura(a) + largura(b) + 14;
      }
      case 'un': return largura(n.f[0]) + 10;
      case 'func': return 7 * n.v.length + n.f.reduce((s, x) => s + largura(x) + 8, 0) + 10;
      case 'paren': return largura(n.f[0]) + 12;
    }
    return 20;
  }

  /* ------------------------------------------- unidades e avaliação numérica
     Dimensão = [comprimento, massa, tempo]. Os nomes são os do SMath (entries/Units.xml). */
  const FORCA = [1, 1, -2], TENSAO = [-1, 1, -2], ADIM = [0, 0, 0];
  const UNIDADES = {
    m: [1, [1, 0, 0]], mm: [1e-3, [1, 0, 0]], cm: [1e-2, [1, 0, 0]], km: [1e3, [1, 0, 0]],
    N: [1, FORCA], kN: [1e3, FORCA], MN: [1e6, FORCA], kgf: [9.80665, FORCA], tonnef: [9806.65, FORCA],
    Pa: [1, TENSAO], kPa: [1e3, TENSAO], MPa: [1e6, TENSAO], GPa: [1e9, TENSAO],
    kg: [1, [0, 1, 0]], g: [1e-3, [0, 1, 0]], t: [1e3, [0, 1, 0]],
    s: [1, [0, 0, 1]], min: [60, [0, 0, 1]], hr: [3600, [0, 0, 1]],
    '°': [Math.PI / 180, ADIM], rad: [1, ADIM], '%': [0.01, ADIM]
  };
  /* como a unidade aparece escrita nas páginas -> nome no SMath */
  const APELIDOS = {deg: '°', tf: 'tonnef', h: 'hr'};
  const FUNCOES = {
    sqrt: x => Math.sqrt(x), sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, ln: Math.log, exp: Math.exp, abs: Math.abs
  };
  const FUNC_PT = {sen: 'sin', tg: 'tan', arcsen: 'asin', arccos: 'acos', arctg: 'atan', raiz: 'sqrt'};

  const dimIgual = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  const adim = d => dimIgual(d, ADIM);

  /* valor com dimensão de uma árvore; lança erro se algo não for avaliável */
  function avaliar(n, vars) {
    switch (n.tipo) {
      case 'num': return {v: Number(n.v), d: ADIM};
      case 'unit': {
        const u = UNIDADES[n.v];
        if (!u) throw new Error('unidade desconhecida: ' + n.v);
        return {v: u[0], d: u[1]};
      }
      case 'name': {
        if (n.v === 'π') return {v: Math.PI, d: ADIM};
        const x = vars.get(n.v);
        if (!x) throw new Error('símbolo não definido: ' + n.v);
        return {v: x.v, d: x.d};
      }
      case 'paren': return avaliar(n.f[0], vars);
      case 'un': { const a = avaliar(n.f[0], vars); return {v: -a.v, d: a.d}; }
      case 'bin': {
        const a = avaliar(n.f[0], vars), b = avaliar(n.f[1], vars);
        switch (n.v) {
          case '+': case '-':
            if (!dimIgual(a.d, b.d)) throw new Error('soma de dimensões diferentes');
            return {v: n.v === '+' ? a.v + b.v : a.v - b.v, d: a.d};
          case '*': return {v: a.v * b.v, d: a.d.map((x, i) => x + b.d[i])};
          case '/': return {v: a.v / b.v, d: a.d.map((x, i) => x - b.d[i])};
          case '^':
            if (!adim(b.d)) throw new Error('expoente com unidade');
            return {v: Math.pow(a.v, b.v), d: a.d.map(x => x * b.v)};
        }
        throw new Error('operador não avaliável: ' + n.v);
      }
      case 'func': {
        const args = n.f.map(x => avaliar(x, vars));
        if (n.v === 'max' || n.v === 'min') {
          if (!args.length || args.some(x => !dimIgual(x.d, args[0].d))) throw new Error(n.v + ' com dimensões diferentes');
          return {v: Math[n.v](...args.map(x => x.v)), d: args[0].d};
        }
        const fn = FUNCOES[n.v];
        if (!fn || args.length !== 1) throw new Error('função não avaliável: ' + n.v);
        const a = args[0];
        if (n.v === 'sqrt') return {v: fn(a.v), d: a.d.map(x => x / 2)};
        if (n.v === 'abs') return {v: fn(a.v), d: a.d};
        if (!adim(a.d)) throw new Error(n.v + ' de grandeza com unidade');
        return {v: fn(a.v), d: ADIM};
      }
    }
    throw new Error('não avaliável: ' + n.tipo);
  }

  /* =========================================================== 2. XML e documento */
  function E(nome, attrs = {}, filhos = []) { return {nome, attrs, filhos}; }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function ser(el, ind = '') {
    const at = Object.entries(el.attrs).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
    if (typeof el.filhos === 'string') return `${ind}<${el.nome}${at}>${esc(el.filhos)}</${el.nome}>\n`;
    if (!el.filhos.length) return `${ind}<${el.nome}${at} />\n`;
    return `${ind}<${el.nome}${at}>\n` + el.filhos.map(f => ser(f, ind + '  ')).join('') + `${ind}</${el.nome}>\n`;
  }

  const GRADE = 9, LARG = 750, ESPACO = 9, V_PLUGINS = '1.75.9678.0';
  const grade = y => Math.ceil(y / GRADE) * GRADE;
  const paragrafos = (txt, estilo) => String(txt).split('\n').map(l => E('p', estilo ? {style: estilo} : {}, l));
  function alturaTexto(txt, larg, fonte = 10) {
    const cpl = Math.max(10, Math.floor(larg / (fonte * .6)));
    const linhas = String(txt).split('\n').reduce((s, p) => s + Math.max(1, Math.ceil(p.length / cpl)), 0);
    return 8 + linhas * Math.floor(fonte * 1.6);
  }

  class Documento {
    constructor({autor = '', casas = 4} = {}) {
      this.autor = autor; this.casas = casas;
      this.y = 0; this.raiz = []; this.pilha = [this.raiz]; this.areas = [];
    }
    _regiao(alt, interno, larg, extra = {}) {
      this.pilha[this.pilha.length - 1].push(E('region', {left: '0', top: String(this.y), width: String(Math.round(larg)),
        height: String(alt), color: '#000000', fontSize: '10', ...extra}, [interno]));
      this.y = grade(this.y + alt + ESPACO);
    }
    espaco(px = 9) { this.y = grade(this.y + px); }

    titulo(txt, nivel = 2) {
      const tam = {1: 14, 2: 12, 3: 10}[nivel] || 10;
      if (nivel <= 2 && this.y) this.espaco(9);
      const estilo = `font-size: ${tam}px; font-weight: bold; text-align: ${nivel === 1 ? 'center' : 'left'};`;
      this._regiao(alturaTexto(txt, LARG, tam) + (nivel === 1 ? 4 : 0),
        E('text', {lang: 'por', width: String(LARG), fontFamily: 'Arial', fontSize: '10'}, [E('content', {}, paragrafos(txt, estilo))]),
        LARG, nivel === 1 ? {border: 'true'} : {});
    }
    texto(txt, {negrito = false, italico = false, cor = null, alinhamento = 'left'} = {}) {
      if (txt == null || txt === '') return;
      const estilo = [`text-align: ${alinhamento};`, negrito ? 'font-weight: bold;' : '', italico ? 'font-style: italic;' : '',
        cor ? `color: ${cor};` : ''].filter(Boolean).join(' ');
      this._regiao(alturaTexto(txt, LARG),
        E('text', {lang: 'por', width: String(LARG), fontFamily: 'Arial', fontSize: '10'}, [E('content', {}, paragrafos(txt, estilo))]), LARG);
    }
    _math(nos, lista, descricao, contrato, resultado, casas) {
      let a = 11, d = 6, larg = 0;
      for (const n of nos) { if (!n) continue; const c = caixa(n); a = Math.max(a, c[0]); d = Math.max(d, c[1]); larg += largura(n) + 16; }
      if (resultado) larg += 80;
      const filhos = [];
      if (descricao) filhos.push(E('description', {active: 'true', position: 'Right', lang: 'por'}, [E('content', {}, paragrafos(descricao))]));
      filhos.push(E('input', {}, lista));
      if (contrato) filhos.push(E('contract', {}, rpn(contrato)));
      // valor provisório: o SMath recalcula ao abrir a folha
      if (resultado) filhos.push(E('result', {action: 'numeric'}, [E('e', {type: 'operand'}, '0')]));
      this._regiao(a + d + 12, E('math', casas != null ? {decimalPlaces: String(casas)} : {}, filhos), Math.min(LARG, larg));
    }
    /** nome := expr */
    atribuir(nome, expr, descricao) {
      const alvo = analisar(nome), ex = analisar(expr);
      this._math([alvo, ex], [...rpn(alvo), ...rpn(ex), E('e', {type: 'operator', args: '2'}, ':')], descricao, null, false, null);
    }
    /** nome := expr = resultado [unidade] */
    calcular(nome, expr, unidade, descricao, casas) {
      const alvo = analisar(nome), ex = analisar(expr), con = unidade ? analisar(unidade) : null;
      this._math([alvo, ex, con], [...rpn(alvo), ...rpn(ex), E('e', {type: 'operator', args: '2'}, ':')], descricao, con, true, casas ?? this.casas);
    }
    /** expr = resultado [unidade] */
    mostrar(expr, unidade, descricao, casas) {
      const ex = analisar(expr), con = unidade ? analisar(unidade) : null;
      this._math([ex, con], rpn(ex), descricao, con, true, casas ?? this.casas);
    }
    abrirArea(titulo, recolhida = true) {
      const cab = titulo
        ? E('area', {collapsed: recolhida ? 'true' : 'false'}, [E('title', {lang: 'por'}, [E('content', {}, paragrafos(titulo))])])
        : E('area', {collapsed: recolhida ? 'true' : 'false'});
      const el = E('region', {top: String(this.y), color: '#000000'}, [cab]);
      this.pilha[this.pilha.length - 1].push(el);
      this.pilha.push(el.filhos);
      this.areas.push(el);
      this.y = grade(this.y + 27);          // o conteúdo começa abaixo da linha da área
    }
    fecharArea() {
      if (!this.areas.length) throw new Error('fecharArea sem abrirArea');
      const fim = grade(this.y);
      this.pilha[this.pilha.length - 1].push(E('region', {top: String(fim), color: '#000000'}, [E('area', {terminator: 'true'})]));
      this.pilha.pop(); this.areas.pop();
      this.y = grade(fim + 27);
    }
    xml() {
      while (this.areas.length) this.fecharArea();
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
      const ws = E('worksheet', {xmlns: 'http://smath.info/schemas/worksheet/1.0'}, [
        E('settings', {ppi: '96'}, [
          E('identity', {}, [E('id', {}, id), E('revision', {}, '1')]),
          E('metadata', {lang: 'por'}, this.autor ? [E('author', {}, this.autor)] : []),
          E('calculation', {}, [
            E('precision', {}, String(this.casas)), E('exponentialThreshold', {}, '5'), E('trailingZeros', {}, 'false'),
            E('significantDigitsMode', {}, 'false'), E('mixedNumbers', {}, 'false'), E('roundingMode', {}, '0'),
            E('approximateEqualAccuracy', {}, '0'), E('fractions', {}, 'decimal')
          ]),
          E('pageModel', {active: 'false', viewMode: '2', printGrid: 'false', printAreas: 'true', simpleEqualsOnly: 'false', printBackgroundImages: 'true'}, [
            E('paper', {id: '9', orientation: 'Portrait', width: '827', height: '1169'}),
            E('margins', {left: '39', right: '39', top: '49', bottom: '49'}),
            E('header', {alignment: 'Center', color: '#a9a9a9'}, '&[DATE] &[TIME] - &[FILENAME]'),
            E('footer', {alignment: 'Center', color: '#a9a9a9'}, '&[PAGENUM] / &[COUNT]'),
            E('backgrounds')
          ]),
          E('dependencies', {}, [
            E('assembly', {name: 'SMath Core', version: V_PLUGINS, guid: 'a37cba83-b69c-4c71-9992-55ff666763bd'}),
            E('assembly', {name: 'MathRegion', version: V_PLUGINS, guid: '02f1ab51-215b-466e-a74d-5d8b1cf85e8d'}),
            E('assembly', {name: 'TextRegion', version: V_PLUGINS, guid: '485d28c5-349a-48b6-93be-12a35a1c1e39'}),
            E('assembly', {name: 'AreaRegion', version: V_PLUGINS, guid: '4974b228-4974-44cf-8274-bf2936b4a766'})
          ])
        ]),
        E('regions', {type: 'content'}, this.raiz)
      ]);
      return '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n' +
        '<?application progid="SMath Studio Desktop" version="1.5.0.9678"?>\n' + ser(ws);
    }
    /** arquivo pronto para baixar (o SMath grava com BOM) */
    blob() { return new Blob(['﻿' + this.xml()], {type: 'application/xml'}); }
  }

  /* =========================================================== 3. memorial */
  const ENT = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' '};
  /** texto puro: sem tags HTML; "S_y" vira "Sy", como no relatório Word */
  const limpar = s => String(s == null ? '' : s).replace(/<sub>(.*?)<\/sub>/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, m => ENT[m] || m).replace(/ /g, ' ')
    .replace(/([^\s_])_([\p{L}\p{N},]+)/gu, '$1$2').trim();
  const semTags = s => String(s == null ? '' : s).replace(/<sub>(.*?)<\/sub>/g, '_$1').replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, m => ENT[m] || m).replace(/ /g, ' ').trim();

  const RESERVADOS = new Set(['π', 'e', 'i', 'sin', 'cos', 'tan', 'sqrt', 'ln', 'exp', 'abs', 'max', 'min', 'if', 'log']);
  /** símbolo do memorial ("S_y,ch", "F''", "β_P1") -> nome válido no SMath ("S.y_ch") ou null */
  function identDe(sym) {
    const s = semTags(sym);
    const m = s.match(/^([\p{L}][\p{L}\p{N}]*)('*)(?:_([\p{L}\p{N}]+(?:,[\p{L}\p{N}]+)*))?('*)$/u);
    if (!m) return null;
    const [, base, pr1, sub, pr2] = m;
    if (pr1 && sub) return null;                     // F'_x: escrita ambígua no SMath
    const nome = base + (sub ? '.' + sub.replace(/,/g, '_') : '') + pr1 + pr2;
    return RESERVADOS.has(nome) ? null : nome;
  }

  /** "kN·m", "N/mm²", "tf", "°", "%" -> {src: "'kN*'m", v, d} ou null */
  function lerUnidade(txt) {
    let u = String(txt).trim().replace(/[·⋅×]/g, '*').replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4');
    if (!u) return null;
    if (!/^[\p{L}°%][\p{L}°%\d*/^()\s]*$/u.test(u)) return null;
    let ok = true;
    const src = u.replace(/[\p{L}°%]+/gu, nome => {
      const n = APELIDOS[nome] || nome;
      if (!UNIDADES[n]) ok = false;
      return "'" + n;
    }).replace(/\s+/g, '');
    if (!ok) return null;
    try { const val = avaliar(analisar(src), new Map()); return {src, v: val.v, d: val.d}; } catch (e) { return null; }
  }

  /** "1.234,56 kN" -> {src, v (SI), d, unidade, casas} ou null. Aceita "45,0°" e número puro. */
  function lerValor(txt) {
    const t = semTags(txt).replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim();
    const m = t.match(/^([-+]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?)\s*(.*)$/);
    if (!m) return null;
    const num = Number(m[1].replace(/\./g, '').replace(',', '.'));
    if (!isFinite(num)) return null;
    const casas = m[2] ? m[2].length : 0;
    const resto = m[3].trim();
    const numSrc = String(num);
    if (!resto) return {src: numSrc, v: num, d: ADIM, unidade: null, casas, num};
    const u = lerUnidade(resto);
    if (!u) return null;
    return {src: `${numSrc}*${u.src}`, v: num * u.v, d: u.d, unidade: u.src, casas, num, fator: u.v};
  }

  /** "M = 3,25 kN·m (anti-horário)" -> {id, val} ou null */
  function lerResultado(r) {
    const t = semTags(r);
    const m = t.match(/^([^=]+?)\s*=\s*(.+)$/);
    if (!m) return null;
    const id = identDe(m[1]);
    if (!id) return null;
    const valTxt = m[2].replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*\[[^\]]*\]\s*$/, '').split(/\s=\s/)[0];
    const val = lerValor(valTxt);
    return val ? {id, val} : null;
  }

  /** texto de fórmula da página -> candidatos {lhs, rhs} em sintaxe do SMath (ou []) */
  function converterFormula(f) {
    let t = semTags(f).split(/\s+—\s|\s{2,}—/)[0].trim();          // tira o comentário "— ..."
    if (!t || /\s{3,}/.test(t)) return [];                          // várias contas numa linha
    if (/[|Σ∑̄→≈{}∫≥≤]/.test(t)) return [];
    const partes = t.split('=');
    if (partes.length < 2) return [];
    const lhs = identDe(partes[0].trim());
    if (!lhs) return [];
    const out = [];
    for (const bruto of partes.slice(1)) {
      let s = bruto.trim()
        .replace(/[·⋅×]/g, '*').replace(/[−–]/g, '-').replace(/÷/g, '/')
        .replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4')
        .replace(/\[/g, '(').replace(/\]/g, ')')
        .replace(/√\(/g, 'sqrt(').replace(/√([\p{L}\p{N}_.,']+)/gu, 'sqrt($1)')
        .replace(/(\d),(\d)/g, '$1.$2')
        .replace(/(^|[^\p{L}\p{N}_.])(\d+(?:\.\d+)?)(?=[\p{L}(])/gu, '$1$2*')   // 0,6Fy -> 0.6*Fy
        .replace(/\)\s*\(/g, ')*(');
      let falhou = false;
      s = s.replace(/[\p{L}][\p{L}\p{N}]*'*(?:_[\p{L}\p{N}]+(?:,[\p{L}\p{N}]+)*)?'*(\s*\()?/gu, (tok, par) => {
        if (par) {
          const nome = tok.slice(0, tok.length - par.length);
          const fn = FUNC_PT[nome] || nome;
          if (FUNCOES[fn] || fn === 'max' || fn === 'min') return fn + '(';
          falhou = true; return tok;
        }
        if (tok === 'π') return tok;
        const id = identDe(tok);
        if (!id) { falhou = true; return tok; }
        return id;
      });
      if (!falhou) out.push({lhs, rhs: s});
    }
    return out;
  }

  class Memorial {
    /** @param doc Documento  @param opts.descricao(sym) -> texto da legenda (opcional) */
    constructor(doc, opts = {}) {
      this.doc = doc; this.vars = new Map(); this.descricao = opts.descricao || (() => '');
      this.stats = {vivas: 0, valores: 0, textos: 0};
    }
    /** define uma variável vinda de valor já calculado (sem passo) */
    definir(sym, valorTxt, descricao) {
      const id = identDe(sym), val = lerValor(valorTxt);
      if (!id || !val) return null;
      this.doc.atribuir(id, val.src, descricao || this.descricao(sym) || undefined);
      this.vars.set(id, val);
      return id;
    }
    /** linha de dados (entrada, constante, propriedade): vira variável quando o valor é legível */
    dado(sym, descricao, valorTxt, origem) {
      const desc = [limpar(descricao), origem ? `(${limpar(origem)})` : ''].filter(Boolean).join(' ');
      if (this.definir(sym, valorTxt, desc)) return true;
      const rot = sym && sym !== '—' ? `${limpar(sym)} — ` : '';
      this.doc.texto(`${rot}${limpar(descricao)}: ${limpar(valorTxt)}${origem ? ` (${limpar(origem)})` : ''}`);
      return false;
    }
    /** tenta montar a conta viva; devolve a expressão (sintaxe SMath) ou null */
    _viva(f, res) {
      if (!f) return null;
      for (const c of converterFormula(f)) {
        if (c.lhs !== res.id) continue;
        try {
          const no = analisar(c.rhs), val = avaliar(no, this.vars);
          if (!dimIgual(val.d, res.val.d)) continue;
          const alvo = res.val.v;
          // tolerância: arredondamento do valor mostrado na página, ou 0,5 %
          const meiaCasa = 0.5 * Math.pow(10, -res.val.casas) * (res.val.fator || 1);
          if (Math.abs(val.v - alvo) <= Math.max(0.005 * Math.abs(alvo), meiaCasa * 1.01)) return c.rhs;
        } catch (e) { /* símbolo faltando, função desconhecida etc. */ }
      }
      return null;
    }
    /**
     * Um passo do memorial. p = {t, f, s, r, ok, n}. Devolve a lista do que pode ser mostrado
     * fora da área. "ld = 24,0 mm     lt = 6,0 mm" (vários resultados separados por espaços
     * largos) vira uma variável para cada um.
     */
    passo(p) {
      const doc = this.doc;
      if (p.t) doc.texto(limpar(p.t), {negrito: true});
      const partesR = p.r ? semTags(p.r).split(/\s{3,}/).filter(Boolean) : [];
      const resList = partesR.map(lerResultado);
      const unico = resList.length === 1 ? resList[0] : null;
      const viva = unico ? this._viva(p.f, unico) : null;
      const desc = txt => this.descricao(txt.split('=')[0].trim()) || undefined;
      if (viva) {
        if (p.s) doc.texto(`Substituindo: ${limpar(p.s)}`, {italico: true});
        doc.calcular(unico.id, viva, unico.val.unidade, desc(partesR[0]), unico.val.casas);
        this.stats.vivas++;
      } else {
        if (p.f) doc.texto(`Fórmula: ${limpar(p.f)}`);
        if (p.s) doc.texto(`Substituindo: ${limpar(p.s)}`);
        if (p.r && (!resList.length || resList.some(x => !x))) { doc.texto(`Resultado: ${limpar(p.r)}`, {negrito: true}); this.stats.textos++; }
        resList.forEach((res, i) => { if (res) { doc.atribuir(res.id, res.val.src, desc(partesR[i])); this.stats.valores++; } });
      }
      if (p.ok === true || p.ok === false) doc.texto(p.ok ? '✔ ATENDE' : '✘ NÃO ATENDE', {negrito: true, cor: p.ok ? '#256B4D' : '#A1332C'});
      if (p.n) doc.texto(limpar(p.n), {italico: true});
      resList.forEach(res => { if (res) this.vars.set(res.id, res.val); });
      const titulo = limpar(p.t || ''), definidos = resList.filter(Boolean);
      if (!definidos.length) return [{id: null, titulo, ok: p.ok, r: limpar(p.r || p.s || '')}];
      return definidos.map(res => ({id: res.id, unidade: res.val.unidade, casas: res.val.casas,
        titulo: definidos.length > 1 ? `${titulo} (${res.id})` : titulo, ok: p.ok, r: limpar(p.r || '')}));
    }
    /**
     * Seção: título visível, todas as contas numa área recolhida e, fora dela, o resultado da
     * área chamado de novo: todos os resultados calculados nela (padrão) ou, com
     * opts.resultados = 'ultimo', só o último e as verificações. opts.depois(doc) escreve algo
     * dentro da área depois dos passos (tabelas).
     */
    secao(titulo, passos, opts = {}) {
      const doc = this.doc;
      doc.titulo(limpar(titulo), 2);
      doc.abrirArea(`Cálculos — ${limpar(titulo)}`, true);
      const infos = passos.filter(Boolean).flatMap(p => this.passo(p));
      if (opts.depois) opts.depois(doc);
      doc.fecharArea();
      const ultimoDe = new Map();                        // id -> índice da última definição
      infos.forEach((x, i) => { if (x.id) ultimoDe.set(x.id, i); });
      infos.forEach((x, i) => {
        const escolhido = opts.resultados !== 'ultimo' || i === infos.length - 1 || x.ok === true || x.ok === false;
        if (!escolhido) return;
        const jaDiz = /^(não )?atende$/i.test(x.r || '');           // resultado "atende": não repete
        const marca = jaDiz ? '' : x.ok === true ? ' — ATENDE' : x.ok === false ? ' — NÃO ATENDE' : '';
        if (x.id && ultimoDe.get(x.id) === i) doc.mostrar(x.id, x.unidade, `${x.titulo}${marca}`, x.casas);
        else if (x.r) doc.texto(`${x.titulo ? x.titulo + ': ' : ''}${x.r}${marca}`, {negrito: true});
      });
    }
    /** tabela simples como linhas de texto */
    tabela(cab, linhas) {
      const txt = [cab, ...linhas].map(l => l.map(limpar).join('  |  ')).join('\n');
      this.doc.texto(txt);
    }
    /** mostra uma variável já definida (resumo de saídas); devolve false se não houver */
    mostrarSeDefinido(sym, descricao) {
      const id = identDe(sym), x = id && this.vars.get(id);
      if (!x) return false;
      this.doc.mostrar(id, x.unidade, limpar(descricao), x.casas);
      return true;
    }
  }

  function baixar(nome, doc) {
    const url = URL.createObjectURL(doc.blob()), a = document.createElement('a');
    a.href = url; a.download = nome.endsWith('.sm') ? nome : nome + '.sm';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const api = {Documento, Memorial, analisar, avaliar, lerValor, lerUnidade, lerResultado, identDe, converterFormula, limpar, baixar};
  if (typeof window !== 'undefined') window.SMathExport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
