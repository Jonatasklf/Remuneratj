/* Interface de apresentação: a lógica financeira continua em calculo.js. */
(function () {
  'use strict';
  const form = document.getElementById('simuladorForm');
  const message = document.getElementById('calcMessage');
  const calculationStatus = document.getElementById('calculationStatus');
  const resultsState = document.getElementById('resultsState');
  const copyButton = document.getElementById('copyBtn');
  const printButton = document.getElementById('printBtn');
  const dataReferencia = document.getElementById('dataReferencia');
  if (dataReferencia && window.REMUNERATJ_TABELAS) {
    const meta = window.REMUNERATJ_TABELAS.meta || {};
    dataReferencia.textContent = meta.editadoEm ? 'Tabelas editadas em ' + meta.editadoEm.split('-').reverse().join('/') + '.' : '';
    if (meta.fonte) dataReferencia.title = meta.fonte;
  }
  const ids = ['remuneracaoLiquida','remuneracaoBruta','vencimentos','totalAdicionalQualificacao','totalAdicionalTempoServico','totalDescontoIamspe','totalContribuicaoPrevidenciaria','totalIRPF'];
  const currencyAsNumber = (text) => Number(String(text || '').replace(/[^\d,\-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
  function textValue(id) { return document.getElementById(id).textContent.trim(); }
  function readNumber(id) { return currencyAsNumber(textValue(id)); }
  function errorText(text) { message.textContent = text; message.hidden = false; }
  function clearError() { message.hidden = true; message.textContent = ''; }

  let validResult = false;
  function setPending() {
    // Alterar um campo NÃO executa o cálculo. Os valores anteriores permanecem
    // visíveis, com indicação clara de que precisam ser recalculados.
    calculationStatus.textContent = validResult
      ? 'Campos alterados. Clique em Calcular remuneração para atualizar o resultado.'
      : 'Preencha os campos e clique em Calcular remuneração para gerar a simulação.';
    resultsState.textContent = validResult ? 'Resultado anterior — clique em Calcular para atualizar' : 'Aguardando cálculo';
    resultsState.classList.remove('calculated');
    resultsState.classList.toggle('outdated', validResult);
    copyButton.disabled = true;
    printButton.disabled = true;
    clearError();
  }
  function setCalculated() {
    validResult = true;
    calculationStatus.textContent = 'Cálculo concluído. Os resultados só mudam ao clicar novamente em Calcular remuneração.';
    resultsState.textContent = 'Cálculo atualizado';
    resultsState.classList.remove('outdated');
    resultsState.classList.add('calculated');
    copyButton.disabled = false;
    printButton.disabled = false;
  }

  function syncView() {
    document.getElementById('liquidoResumo').textContent = textValue('remuneracaoLiquida');
    document.getElementById('vencimentosDetalhe').textContent = textValue('vencimentos');
    const wages = readNumber('vencimentos');
    const benefits = currencyAsNumber(document.querySelector('.totalAuxilios').textContent);
    const extras = currencyAsNumber(document.querySelector('.totalAdicionais').textContent);
    const total = wages + benefits + extras;
    [['barVencimentos',wages],['barAuxilios',benefits],['barAdicionais',extras]].forEach(([id,val]) => {
      document.getElementById(id).style.width = (total > 0 ? Math.max(0, val) / total * 100 : 0) + '%';
    });
  }
  function calculate() {
    const invalid = Array.from(form.querySelectorAll('input[type="number"]:not(:disabled)')).filter(el => {
      if (el.value.trim() === '') el.value = '0';
      const num = Number(el.value);
      const minimo = el.min === '' ? -Infinity : Number(el.min);
      const maximo = el.max === '' ? Infinity : Number(el.max);
      const casasDecimaisValidas = el.id === 'previdenciaManual'
        ? Math.abs(num * 100 - Math.round(num * 100)) < 1e-7
        : Number.isInteger(num);
      return !Number.isFinite(num) || !casasDecimaisValidas || num < minimo || num > maximo;
    });
    if (invalid.length) {
      errorText('Confira os campos numéricos: quantidades inteiras e contribuição previdenciária em reais e centavos.');
      invalid[0].setAttribute('aria-invalid', 'true');
      return;
    }
    form.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
    if (typeof calcularIrpf !== 'function') {
      errorText('Não foi possível carregar o módulo de IRPF (../shared/js/calculo.js). Mantenha a pasta compartilhada da instalação original para calcular corretamente.');
      return;
    }
    try {
      window.calcSallary();
      if (!ids.every(id => /^R\$ /.test(textValue(id)))) throw new Error('Resultado numérico não disponível.');
      syncView();
      clearError();
      setCalculated();
    } catch (e) {
      errorText('Não foi possível calcular: ' + (e && e.message ? e.message : 'erro desconhecido') + '. Verifique os campos e o módulo de IRPF.');
    }
  }
  // ÚNICO evento que dispara o cálculo: envio do formulário pelo botão Calcular
  // ou pela tecla Enter em um campo do formulário.
  form.addEventListener('input', setPending);
  form.addEventListener('change', () => { syncPreset(); setPending(); });
  form.addEventListener('submit', e => { e.preventDefault(); calculate(); });
  // Não calcular em teclas pressionadas nos campos. O botão continua acessível por teclado.
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target !== document.getElementById('calculateBtn')) e.preventDefault(); });
  const modoPrevidencia = document.getElementById('modoPrevidencia');
  const manualBox = document.getElementById('previdenciaManualBox');
  const manualInput = document.getElementById('previdenciaManual');
  function syncPrevidencia() {
    const manual = modoPrevidencia.value === 'manual';
    manualBox.hidden = !manual;
    manualInput.disabled = !manual;
  }
  modoPrevidencia.addEventListener('change', syncPrevidencia);
  const transport = document.getElementById('diasTransporte');
  const shortcuts = Array.from(document.querySelectorAll('[data-presencial]'));
  function syncPreset() {
    const value = Number(transport.value);
    shortcuts.forEach(button => {
      const active = button.dataset.presencial === 'custom' ? value !== 0 && value !== 20 : Number(button.dataset.presencial) === value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  shortcuts.forEach(button => button.addEventListener('click', () => {
    if (button.dataset.presencial !== 'custom') transport.value = button.dataset.presencial;
    syncPreset();
    if (button.dataset.presencial !== 'custom') setPending();
    if (button.dataset.presencial === 'custom') transport.focus();
  }));
  transport.addEventListener('input', syncPreset);
  document.getElementById('resetBtn').addEventListener('click', () => {
    form.reset();
    syncPrevidencia();
    syncPreset();
    setPending();
  });
  document.getElementById('copyBtn').addEventListener('click', async () => {
    if (!/^R\$ /.test(textValue('remuneracaoLiquida'))) { errorText('Calcule a remuneração antes de copiar o resumo.'); return; }
    const summary = [
      'SIMULAÇÃO DE REMUNERAÇÃO — ESCREVENTE TJSP',
      'Cargo/função: ' + document.getElementById('cargo').selectedOptions[0].text,
      'Padrão: ' + document.getElementById('padraoVencimento').value,
      'Regime previdenciário: ' + modoPrevidencia.selectedOptions[0].textContent.trim(),
      'Vencimentos: ' + textValue('vencimentos'),
      'Auxílios: ' + document.querySelector('.totalAuxilios').textContent.trim(),
      'Adicionais: ' + document.querySelector('.totalAdicionais').textContent.trim(),
      'Remuneração bruta: ' + textValue('remuneracaoBruta'),
      'Descontos: ' + document.querySelector('.totalDescontos').textContent.trim(),
      'LÍQUIDO ESTIMADO: ' + textValue('remuneracaoLiquida'),
      'Simulação informativa, não oficial. Considera mês completo.'
    ].join('\n');
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(summary);
      else {
        const input = document.createElement('textarea');
        input.value = summary; input.style.position = 'fixed'; input.style.left = '-9999px';
        document.body.appendChild(input); input.select();
        if (!document.execCommand('copy')) throw new Error('Cópia bloqueada');
        input.remove();
      }
      const label = document.getElementById('copyLabel');
      label.textContent = 'Copiado!';
      window.setTimeout(() => { label.textContent = 'Copiar resumo'; }, 2200);
    } catch (e) { errorText('O navegador não permitiu copiar automaticamente. Tente abrir a página em HTTPS.'); }
  });
  document.getElementById('printBtn').addEventListener('click', () => {
    const sections = Array.from(document.querySelectorAll('.breakdown'));
    const previous = sections.map(el => el.open);
    sections.forEach(el => { el.open = true; });
    window.addEventListener('afterprint', () => sections.forEach((el, i) => { el.open = previous[i]; }), { once: true });
    window.print();
  });
  syncPrevidencia();
  syncPreset();
  setPending();
})();
