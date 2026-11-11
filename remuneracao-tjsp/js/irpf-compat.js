/*
 * Compatibilidade com a calculadora original de remuneração do TJSP.
 * Este módulo só define calcularIrpf quando não há versão compartilhada.
 * Referência da assinatura e faixas: github.com/LCavalini/lcavalini.github.io
 * A regra abaixo reproduz o comportamento do módulo compartilhado de origem.
 * Para usar sua implementação já corrigida, mantenha ../shared/js/calculo.js.
 */
(function (global) {
  'use strict';
  if (typeof global.calcularIrpf === 'function') return;
  global.calcularIrpf = function (remuneracao, baseCalculo) {
    if (remuneracao <= 5000 || remuneracao <= 3036) return 0;

    const adicional = remuneracao <= 7350 ? 978.62 - 0.133145 * remuneracao : 0;
    let taxa = 0;
    let abatimento = 0;
    if (remuneracao <= 3533.31) {
      taxa = 0.075; abatimento = 182.16;
    } else if (remuneracao <= 4688.85) {
      taxa = 0.15; abatimento = 394.16;
    } else if (remuneracao <= 5830.85) {
      taxa = 0.225; abatimento = 675.49;
    } else {
      taxa = 0.275; abatimento = 908.73;
    }
    return baseCalculo * taxa - abatimento - adicional;
  };
})(window);
