/* Fórmulas do simulador. Parâmetros financeiros: js/tabelas.js. */
function numberToReal(numero) {
    if (!Number.isFinite(numero)) throw new Error('Valor financeiro inválido. Confira os parâmetros das tabelas.');
    return numero.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}).replace(/\u00a0/g, ' ');
}

function calcSallary() {
    const tabelas = window.REMUNERATJ_TABELAS;
    if (!tabelas) throw new Error('Arquivo js/tabelas.js não carregado.');
    const v = tabelas.vencimentos;
    const a = tabelas.auxilios;
    const base = v.base;
    const baseGratificacao = v.baseGratificacao;
    const multiplicadoresGaj = v.multiplicadoresGaj;
    const multiplicadoresRepr = v.multiplicadoresRepr;
    const valoresProgressao = v.progressao;
    const valoresAuxilioSaude = a.saude;
    const auxilioCreche = a.creche;
    const auxilioFillhoDeficiencia = a.filhoDeficiencia;
    const auxilioAlimentacao = a.alimentacao;
    const auxilioTransporte = a.transporte;
    const deducaoDependenteIRPF = v.deducaoDependenteIRPF;
    const faixasContribuicaoPrevidenciaria = tabelas.previdencia.faixas.map(x => ({
        limite: x.limite === null ? Infinity : x.limite,
        aliquota: x.aliquota,
        deducao: x.deducao
    }));
    const cargoNivelSuperior = v.cargoNivelSuperior;
    const tetoInss = tabelas.previdencia.tetoInss;
	// obtém os parâmetros fornecidos pelo usuário
	let cargo = document.getElementById("cargo").value;
	let diasTransporte = Number(document.getElementById("diasTransporte").value);
	let diasAlimentacao = Number(document.getElementById("diasAlimentacao").value);
	let numAuxilioCreche = Number(document.getElementById("auxilioCreche").value);
	let numAuxilioFilhoDeficiencia = Number(document.getElementById("auxilioFilhoDeficiencia").value);
	let formacaoAcademica = Number(document.getElementById("formacaoAcademica").value);
	let iamspe = Number(document.getElementById("iamspe").value);
	let agregadosIamspeIdadeInferior = Number(document.getElementById("agregadosIamspeIdadeInferior").value);
	let agregadosIamspeIdadeSuperior = Number(document.getElementById("agregadosIamspeIdadeSuperior").value);
	let dependentesIamspeIdadeInferior = Number(document.getElementById("dependentesIamspeIdadeInferior").value);
	let dependentesIamspeIdadeSuperior = Number(document.getElementById("dependentesIamspeIdadeSuperior").value);
	let dependentes = Number(document.getElementById("dependentes").value);
	let quinquenios = Number(document.getElementById("quinquenios").value);
	let acrescimoAuxilioSaude = Number(document.getElementById("acrescimoAuxilioSaude").value);
	let faixaEtariaAuxilioSaude = Number(document.getElementById("faixaEtariaAuxilioSaude").value);
	let padraoVecimento = document.getElementById("padraoVencimento").value;

	let multiplicadorGaj = multiplicadoresGaj.find(m => m.cargo === cargo) ?? multiplicadoresGaj.find(m => m.cargo === "");
	let multiplicadorRepr = multiplicadoresRepr.find(m => m.cargo === cargo) ?? multiplicadoresRepr.find(m => m.cargo === "");
	let gaj = multiplicadorGaj.valor * baseGratificacao;
	let repr = multiplicadorRepr.valor * baseGratificacao;
	let adicionalProgressao = (valoresProgressao.find(v => v.padrao === padraoVecimento) ?? valoresProgressao.find(v => v.padrao === "5A-CE")).valor;
	let valorBase = (base.find(b => b.cargo === cargo) ?? base.find(b => b.cargo === "")).valor;
	let vencimentos = valorBase + gaj + repr + adicionalProgressao;
	let adicionalQualificacao = cargoNivelSuperior.includes(cargo) && formacaoAcademica == 0.05
		? 0.0
		: formacaoAcademica * (vencimentos);
	let adicionalTempoServico = 0.0;
	let totalContribuicaoPrevidenciaria = 0.0;
	
	// com sexta parte (20 anos = 4 quinquenios)
	// COMUNICADO Nº 94/2024 SGP: incluiu o adicional de qualificação na base de cálculo do adicional de tempo.
	if (quinquenios >= 4) {
		adicionalTempoServico = (0.05 * quinquenios + 1 / 6) * (vencimentos - repr + adicionalQualificacao);
	} else { // sem sexta parte
		adicionalTempoServico = 0.05 * quinquenios * (vencimentos - repr + adicionalQualificacao);
	}
				
	// cálculo dos auxílios
	let totalAuxilioAlimentacao = diasAlimentacao * auxilioAlimentacao;
	let totalAuxilioTransporte = diasTransporte * auxilioTransporte;
	let totalAuxilioCreche = numAuxilioCreche * auxilioCreche;
	let totalAuxilioFilhoDeficiencia = numAuxilioFilhoDeficiencia * auxilioFillhoDeficiencia;
	let totalAdicionais = adicionalQualificacao + adicionalTempoServico;
	let totalAuxilioSaude = faixaEtariaAuxilioSaude != null && faixaEtariaAuxilioSaude >= 1 && faixaEtariaAuxilioSaude <= 10
		? valoresAuxilioSaude.find(x => x.faixa == faixaEtariaAuxilioSaude).valor * acrescimoAuxilioSaude
		: 0;
	let baseCalculoDeducoes = vencimentos + adicionalQualificacao + adicionalTempoServico;
	
	// cálculo das deduções
	let descontoIamspeAgregados = agregadosIamspeIdadeInferior * 0.02 + agregadosIamspeIdadeSuperior * 0.03;
	let descontoIamspeDependentes = dependentesIamspeIdadeInferior * 0.005 + dependentesIamspeIdadeSuperior * 0.01;
	let totalDescontoIamspe = (iamspe + descontoIamspeAgregados + descontoIamspeDependentes) * baseCalculoDeducoes;			
	let totalDeducaoDependenteIRPF = dependentes * deducaoDependenteIRPF;

	// o TJ-SP não considera na contribuição previdenciária os valores percebidos por ocupar cargo em comissão.
	let remuneracaoPrevidencia = base.find(b => b.cargo === "").valor + adicionalProgressao
		+ (multiplicadoresGaj.find(m => m.cargo === "").valor * baseGratificacao);
	let adicionalQualificacaoPrevidencia = formacaoAcademica * remuneracaoPrevidencia;
	remuneracaoPrevidencia += adicionalQualificacaoPrevidencia;
	remuneracaoPrevidencia *= 1 + (quinquenios >= 4 ? 0.05 * quinquenios + 1 / 6 : 0.05 * quinquenios);

	// O valor previdenciário depende do enquadramento funcional individual.
	// "teto" mantém o comportamento original do Escrevente, sem alterar seu resultado padrão.
	// "integral" aplica as faixas progressivas também à parcela que ultrapassa o teto do INSS.
	// "manual" utiliza o valor descontado que o usuário informa (também para dedução no IRPF).
	const modoPrevidencia = document.getElementById("modoPrevidencia").value;
	if (!["teto", "integral", "manual"].includes(modoPrevidencia)) {
		throw new Error('Regime previdenciário inválido.');
	}
	if (modoPrevidencia === 'manual') {
		totalContribuicaoPrevidenciaria = Number(document.getElementById("previdenciaManual").value);
		if (!Number.isFinite(totalContribuicaoPrevidenciaria) || totalContribuicaoPrevidenciaria < 0 || totalContribuicaoPrevidenciaria > Math.max(0, remuneracaoPrevidencia)) {
			throw new Error('Contribuição previdenciária manual inválida para a remuneração contributiva.');
		}
	} else {
		let baseCalculoPrevidencia = Math.max(0, modoPrevidencia === 'teto'
			? Math.min(remuneracaoPrevidencia, tetoInss)
			: remuneracaoPrevidencia);
		let limiteAnterior = 0;
		for (const faixa of faixasContribuicaoPrevidenciaria) {
			const limiteAtual = faixa.limite;
			const baseDaFaixa = Math.max(0, Math.min(baseCalculoPrevidencia, limiteAtual) - limiteAnterior);
			totalContribuicaoPrevidenciaria += baseDaFaixa * faixa.aliquota;
			limiteAnterior = limiteAtual;
			if (baseCalculoPrevidencia <= limiteAtual) break;
		}
	}

	let baseCalculoIRPF = baseCalculoDeducoes - totalDeducaoDependenteIRPF - totalContribuicaoPrevidenciaria;
	
	let totalIRPF = Math.max(0, calcularIrpf(baseCalculoDeducoes, baseCalculoIRPF)); // Imposto não pode ser negativo
	
	let totalAuxilios =  totalAuxilioAlimentacao + totalAuxilioTransporte + totalAuxilioCreche +
		totalAuxilioFilhoDeficiencia + totalAuxilioSaude;
	let remuneracaoBruta = baseCalculoDeducoes + totalAuxilios;
	let totalDescontos = totalDescontoIamspe + totalContribuicaoPrevidenciaria + totalIRPF
	let remuneracaoLiquida = remuneracaoBruta - totalDescontos;
	
	document.getElementById("totalAuxilioAlimentacao").innerHTML = numberToReal(totalAuxilioAlimentacao);
	document.getElementById("totalAuxilioTransporte").innerHTML = numberToReal(totalAuxilioTransporte);
	document.getElementById("totalAuxilioSaude").innerHTML = numberToReal(totalAuxilioSaude);
	document.getElementById("totalAuxilioCreche").innerHTML = numberToReal(totalAuxilioCreche);
	document.getElementById("totalAuxilioFilhoDeficiencia").innerHTML = numberToReal(totalAuxilioFilhoDeficiencia);
	document.getElementById("totalDescontoIamspe").innerHTML = numberToReal(totalDescontoIamspe);
	document.getElementById("regimePrevidenciaResultado").textContent = document.getElementById("modoPrevidencia").selectedOptions[0].textContent.trim();
	document.getElementById("totalContribuicaoPrevidenciaria").innerHTML = 
		numberToReal(totalContribuicaoPrevidenciaria);
	document.getElementById("totalIRPF").innerHTML = 
		numberToReal(totalIRPF);
	
	document.getElementById("totalAdicionalQualificacao").innerHTML = 
	numberToReal(adicionalQualificacao);
	
	document.getElementById("totalAdicionalTempoServico").innerHTML = 
	numberToReal(adicionalTempoServico);
	
	document.getElementById("base").innerHTML = numberToReal(valorBase);
	document.getElementById("progressao").innerHTML = numberToReal(adicionalProgressao);
	document.getElementById("gaj").innerHTML = numberToReal(gaj);
	document.getElementById("repr").innerHTML = numberToReal(repr);
	document.getElementById("vencimentos").innerHTML = numberToReal(vencimentos);
	for (const elementoTotalAdicionais of document.getElementsByClassName("totalAdicionais")) {
		elementoTotalAdicionais.innerHTML = numberToReal(totalAdicionais);
	}
	for (const elementoTotalAuxilios of document.getElementsByClassName("totalAuxilios")) {
		elementoTotalAuxilios.innerHTML = numberToReal(totalAuxilios);
	}
	for (const elementoTotalDescontos of document.getElementsByClassName("totalDescontos")) {
		elementoTotalDescontos.innerHTML = numberToReal(totalDescontos);
	}
	document.getElementById("remuneracaoBruta").innerHTML = numberToReal(remuneracaoBruta);
	document.getElementById("remuneracaoLiquida").innerHTML = numberToReal(remuneracaoLiquida);

}
