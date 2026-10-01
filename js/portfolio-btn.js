/* Abre espaco para o botao em vez de cobrir o que ja existia no canto.
   1) empurra para a esquerda o conteudo da barra que ocupa aquele espaco;
   2) se ainda sobrar sobreposicao, desloca o proprio item. */
(function () {
  var btn = document.getElementById('mr-portfolio-btn');
  if (!btn) return;

  var desfazer = [];

  function limpar() {
    for (var i = 0; i < desfazer.length; i++) desfazer[i]();
    desfazer = [];
  }

  function guardar(el, prop) {
    var antes = el.style[prop];
    desfazer.push(function () { el.style[prop] = antes; });
  }

  /* item discreto = nao ocupa quase toda a largura; e um controle, rotulo ou icone */
  function ehItem(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    return el.getBoundingClientRect().width < innerWidth * 0.7;
  }

  /* sobe ate a barra que contem o item (algo largo o bastante para ter padding) */
  function barra(el) {
    for (var n = 0; el && n < 8; n++, el = el.parentElement) {
      if (el === document.body || el === document.documentElement) return null;
      if (el.getBoundingClientRect().width >= innerWidth * 0.6) return el;
    }
    return null;
  }

  function encosta(a, b) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }

  function varrer() {
    var r = btn.getBoundingClientRect();
    var y = Math.round(r.top + r.height / 2);
    var achados = [];
    btn.style.visibility = 'hidden';
    for (var x = Math.floor(r.right); x > r.left - 10; x -= 8) {
      if (x < 1 || x > innerWidth - 1) continue;
      var sob = document.elementFromPoint(x, y);
      if (ehItem(sob) && achados.indexOf(sob) < 0) achados.push(sob);
    }
    btn.style.visibility = '';
    return achados;
  }

  function ajustar() {
    /* o botao so disputa espaco com o cabecalho: rolada a pagina, o que passa por baixo
       dele e conteudo corrido e nao pode ser empurrado */
    if ((window.scrollY || document.documentElement.scrollTop) > 4) return;
    limpar();
    var r = btn.getBoundingClientRect();
    if (!r.width) return;
    var reserva = Math.ceil(r.width + 20);

    /* 1) padding na barra: desloca o conteudo dela para a esquerda */
    var barras = [];
    varrer().forEach(function (item) {
      var b = barra(item);
      if (b && barras.indexOf(b) < 0) barras.push(b);
    });
    barras.forEach(function (b) {
      if ((parseFloat(getComputedStyle(b).paddingRight) || 0) >= reserva) return;
      guardar(b, 'paddingRight');
      b.style.paddingRight = reserva + 'px';
    });

    /* 2) o que continuar embaixo do botao (tipicamente position:absolute,
          que nao anda com padding) e deslocado individualmente */
    r = btn.getBoundingClientRect();
    varrer().forEach(function (item) {
      if (!encosta(item.getBoundingClientRect(), r)) return;
      var cs = getComputedStyle(item);
      if (cs.position === 'absolute' || cs.position === 'fixed') {
        var atual = parseFloat(cs.right);
        guardar(item, 'right');
        item.style.right = (isNaN(atual) ? reserva : atual + reserva) + 'px';
      } else {
        guardar(item, 'marginRight');
        item.style.marginRight =
          ((parseFloat(cs.marginRight) || 0) + reserva) + 'px';
      }
    });

    /* 3) rede de seguranca: o que insistir em ficar embaixo do botao e
          deslocado no proprio elemento. transform sempre move, seja qual
          for o position, o display ou o container. */
    for (var tent = 0; tent < 3; tent++) {
      r = btn.getBoundingClientRect();
      var teimosos = varrer().filter(function (item) {
        return encosta(item.getBoundingClientRect(), r);
      });
      if (!teimosos.length) break;
      teimosos.forEach(function (item) {
        var caixa = item.getBoundingClientRect();
        var passo = Math.ceil(caixa.right - r.left + 10);
        if (passo <= 0) return;
        guardar(item, 'transform');
        item.style.transform = 'translateX(-' + passo + 'px)';
      });
    }

    btn.setAttribute('data-mr-ok', '1');   /* marca que o ajuste ja rodou */
  }

  var pendente = 0;
  function agendar() {
    /* sem requestAnimationFrame de proposito: ele nao dispara quando a pagina
       esta em aba oculta ou em iframe fora da tela, e as leituras de layout
       abaixo ja forcam o recalculo sozinhas */
    clearTimeout(pendente);
    pendente = setTimeout(ajustar, 60);
  }

  agendar();
  addEventListener('DOMContentLoaded', agendar);
  addEventListener('load', agendar);
  addEventListener('resize', agendar);

  /* muita pagina monta o cabecalho por JS depois do load; refaz o calculo
     quando o DOM mudar e em algumas passadas tardias, por seguranca */
  if (window.MutationObserver) {
    new MutationObserver(function (lista) {
      /* ignora mudancas dentro de [data-mr-ignore] (ex.: animacoes redesenhadas a cada quadro) */
      for (var i = 0; i < lista.length; i++) {
        var alvo = lista[i].target;
        if (!(alvo.closest ? alvo : alvo.parentElement || document.body).closest('[data-mr-ignore]')) { agendar(); return; }
      }
    }).observe(document.documentElement,
      { childList: true, subtree: true });
  }
  [400, 1200, 3000].forEach(function (t) { setTimeout(agendar, t); });
})();
