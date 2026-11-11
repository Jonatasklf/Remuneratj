/**
 * Calcula o IRPF da base de cálculo (rendimento bruto - contribuição previdenciária)
 * @param {*} baseCalculo 
 * @returns 
 */
function calcularIrpf(remuneracao, baseCalculo) {
    const bruto = Math.max(0, Number(remuneracao) || 0);
    const baseInformada = Math.max(0, Number(baseCalculo) || 0);
    // Receita Federal: dedução simplificada de R$ 607,20 quando supera as deduções legais.
    const base = Math.min(baseInformada, Math.max(0, bruto - 607.20));
    // Tabela mensal da Receita Federal a partir de janeiro de 2026.
    // Faixas aplicadas à BASE TRIBUTÁVEL, e não ao rendimento antes das deduções.
    const faixas = [
        { limite: 2428.80, aliquota: 0, deducao: 0 },
        { limite: 2826.65, aliquota: .075, deducao: 182.16 },
        { limite: 3751.05, aliquota: .15, deducao: 394.16 },
        { limite: 4664.68, aliquota: .225, deducao: 675.49 },
        { limite: Infinity, aliquota: .275, deducao: 908.73 }
    ];
    const faixa = faixas.find(x => base <= x.limite);
    const apurado = Math.max(0, base * faixa.aliquota - faixa.deducao);
    if (bruto <= 5000) return 0;
    const reducao = bruto <= 7350 ? Math.max(0, 978.62 - .133145 * bruto) : 0;
    return Math.max(0, apurado - reducao);
}

/**
 * Retorna o valor do teto do INSS.
 * @returns 
 */
function obterTetoInss() {
    return window.REMUNERATJ_TABELAS?.previdencia?.tetoInss || 8475.55;
}

/**
 * Transforma número em moeda.
 * @param {*} numero 
 * @returns 
 */
function numeroParaMoeda(valor) {
	let numero = parseFloat(valor).toFixed(2).split('.');
	numero[0] = 'R$ ' + numero[0].split(/(?=(?:...)*$)/).join('.');
	return numero.join(',');
}