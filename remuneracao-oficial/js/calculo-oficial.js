/* RemuneraTJ / Oficial de Justiça: cálculo puro, sem alterações no DOM. */
(function (global) {
  'use strict';
  const cents = x => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
  const valid = (x, name, min=0, max=1e8) => {const n=Number(x);if(!Number.isFinite(n)||n<min||n>max)throw Error('Valor inválido para '+name);return n;};
  function rpps(base, tab, limitado) {
    const teto=valid(tab.tetoInss,'teto INSS');
    const contrib=limitado? Math.min(base,teto):base;
    let desconto=0, anterior=0;
    for(const faixa of tab.faixas){
      const fim=faixa.limite===null?Infinity:faixa.limite;
      desconto+=(Math.max(0,Math.min(contrib,fim)-anterior))*faixa.aliquota;
      anterior=fim;
      if(contrib<=fim)break;
    }
    return cents(desconto);
  }
  function ir2026(bruto, base) {
    const faixas=[[2428.80,0,0],[2826.65,.075,182.16],[3751.05,.15,394.16],[4664.68,.225,675.49],[Infinity,.275,908.73]];
    const faixa=faixas.find(f=>base<=f[0]);
    const imposto=Math.max(0,cents(base*faixa[1]-faixa[2]));
    // Tabela de redução de IR a partir de janeiro de 2026, limitada ao imposto apurado.
    const abatimento=bruto<=5000?imposto:(bruto<=7350?Math.min(imposto,Math.max(0,cents(978.62-.133145*bruto))):0);
    return cents(Math.max(0,imposto-abatimento));
  }
  // Cota gratuita e antecipação vêm dos últimos valores AOJESP validados no arquivo JSON.
  // Ressarcimentos de mandados pagos continuam informados pelo servidor.
  function moedaInformada(x, nome) {
    if (typeof x === 'number') return cents(valid(x, nome, 0, 1e7));
    let texto = String(x ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
    if (!texto) throw Error('Informe o valor de ' + nome + '.');
    if (texto.includes(',') && texto.includes('.')) {
      texto = texto.lastIndexOf(',') > texto.lastIndexOf('.')
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto.replace(/,/g, '');
    } else if (texto.includes(',')) {
      texto = texto.replace(',', '.');
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) throw Error('Valor monetário inválido para ' + nome + '. Use, por exemplo, 103,16.');
    return cents(valid(Number(texto), nome, 0, 1e7));
  }
  // Remotos gratuitos com meios próprios: uma cota por lote completo de 10.
  // Valores pagos são os ressarcimentos efetivos já líquidos de retenção administrativa.
  function indenizacoesInformadas(entrada) {
    const inteiro = (valor, nome, maximo=5000) => {
      const n=valid(valor ?? 0, nome, 0, maximo);
      if(!Number.isInteger(n))throw Error('A quantidade de ' + nome + ' precisa ser inteira.');
      return n;
    };
    const cotasGratuitasPresenciais = inteiro(entrada.quantidadeGratuita, 'cotas gratuitas presenciais');
    const mandadosGratuitosRemotos = inteiro(entrada.quantidadeGratuitaRemota, 'mandados gratuitos remotos', 50000);
    const mandadosPagosPresenciais = inteiro(entrada.quantidadePaga, 'mandados pagos presenciais');
    const mandadosPagosRemotos = inteiro(entrada.quantidadePagaRemota, 'mandados pagos remotos');
    const cotasGratuitasRemotas = Math.floor(mandadosGratuitosRemotos / 10);
    const mandadosSemCota = mandadosGratuitosRemotos % 10;
    const dinheiroOuZero = (valor, nome, exigido) => {
      if (String(valor ?? '').trim()==='') {
        if (exigido) throw Error('Informe o valor atualizado de ' + nome + ' (R$).');
        return 0;
      }
      const n=moedaInformada(valor,nome);
      if (exigido && n<=0) throw Error('O valor de ' + nome + ' deve ser maior que zero.');
      return n;
    };
    const gratuita = dinheiroOuZero(entrada.valorGratuita, 'cada cota gratuita', cotasGratuitasPresenciais+cotasGratuitasRemotas>0);
    const unitarioPresencial = dinheiroOuZero(entrada.valorPaga, 'cada mandado pago presencial', mandadosPagosPresenciais>0);
    const unitarioRemoto = dinheiroOuZero(entrada.valorPagaRemota, 'cada mandado pago remoto', mandadosPagosRemotos>0);
    const incluirAntecipacao = entrada.incluirAntecipacao === true || entrada.incluirAntecipacao === 'true';
    const antecipacaoCadastrada = dinheiroOuZero(entrada.valorAntecipacao, 'antecipação', incluirAntecipacao);
    const antecipacao = incluirAntecipacao ? antecipacaoCadastrada : 0;
    const gratuitaPresencial = {unitario:gratuita, quantidade:cotasGratuitasPresenciais, total:cents(gratuita*cotasGratuitasPresenciais)};
    const gratuitaRemota = {unitario:gratuita, mandados:mandadosGratuitosRemotos, cotas:cotasGratuitasRemotas, restantes:mandadosSemCota, total:cents(gratuita*cotasGratuitasRemotas)};
    const pagaPresencial = {unitario:unitarioPresencial, quantidade:mandadosPagosPresenciais, personalizada:true, total:cents(unitarioPresencial*mandadosPagosPresenciais)};
    const pagaRemota = {unitario:unitarioRemoto, quantidade:mandadosPagosRemotos, total:cents(unitarioRemoto*mandadosPagosRemotos)};
    return {
      gratuita:gratuitaPresencial, gratuitaRemota,
      paga:pagaPresencial, pagaRemota,
      antecipacao, antecipacaoCadastrada, incluirAntecipacao,
      competencia:entrada.competenciaDiligencias || 'referência AOJESP',
      total:cents(gratuitaPresencial.total+gratuitaRemota.total+pagaPresencial.total+pagaRemota.total+antecipacao)
    };
  }
  // Descontos voluntariamente informados: não compõem deduções tributárias.
  const descontoUsuario = (valor, nome) => {
    if (valor === '' || valor === null || valor === undefined) return 0;
    const n = valid(valor, nome, 0, 9999999.99);
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw Error('Informe reais e centavos em ' + nome + '.');
    return cents(n);
  };
  function calcular(entrada,tabelas){
    const o=tabelas?.oficialJustica,a=tabelas?.auxilios,p=tabelas?.previdencia;
    if(!o||!a||!p)throw Error('Tabelas financeiras incompletas.');
    const padrao=o.padroes.find(x=>x.padrao===entrada.padrao);
    if(!padrao)throw Error('Selecione um padrão de vencimento válido.');
    const quinquenios=valid(entrada.quinquenios,'quinquênios',0,12);
    if(!Number.isInteger(quinquenios))throw Error('Quinquênios devem ser inteiros.');
    const taxaAq=valid(entrada.aq,'adicional de qualificação',0,.25);
    // Escala publicada como somatório de parcelas (salário-base + GAJ + RETEJ).
    // Desmembramento por índices legais: GAJ fixa sobre padrão 1-A; RETEJ sobre base efetiva.
    const gajIndice=valid(o.multiplicadorGaj,'índice GAJ',0,20);
    const retejIndice=valid(o.percentualRetej,'índice RETEJ',0,2);
    const gajNominal=cents(tabelas.vencimentos.baseGratificacao*gajIndice);
    const salarioBase=cents((padrao.remuneracao-gajNominal)/(1+retejIndice));
    const retej=cents(salarioBase*retejIndice);
    const gaj=cents(padrao.remuneracao-salarioBase-retej); // conciliação dos centavos com tabela oficial
    const basica=cents(salarioBase+gaj+retej);
    const aq=cents(basica*taxaAq);
    // Holerite 02/2025 permite aferir repartição: 10% base+RETEJ+AQ, mais 10% GAJ.
    const quinqueniosBase=cents((salarioBase+retej+aq)*quinquenios*.05);
    const quinqueniosGaj=cents(gaj*quinquenios*.05);
    const sextaParte=quinquenios>=4?cents((salarioBase+retej+gaj+aq)/6):0;
    const remuneracao=cents(basica+aq+quinqueniosBase+quinqueniosGaj+sextaParte);
    const unitarios={alimentacao:a.alimentacao,transporte:a.transporte,creche:a.creche,filhoDeficiencia:a.filhoDeficiencia};
    const aux={};
    for(const campo of Object.keys(unitarios)){
      const q=valid(entrada[campo],'quantidade '+campo,0,40);
      if(!Number.isInteger(q))throw Error('Quantidades de auxílio devem ser inteiras.');
      aux[campo]=cents(q*unitarios[campo]);
    }
    const faixaSaude=valid(entrada.faixaSaude,'faixa de auxílio-saúde',0,10);
    const linhaSaude=a.saude.find(x=>x.faixa===faixaSaude);
    aux.saude=linhaSaude?cents(linhaSaude.valor*(entrada.saudeMajorada?1.5:1)):0;
    const totalAux=cents(Object.values(aux).reduce((t,n)=>t+n,0));
    // IAMSPE: coeficientes do simulador de Escrevente, aplicados à remuneração ordinária.
    const iamspeTaxa=valid(entrada.iamspe,'taxa IAMSPE',0,.03);
    const percentuais={agregadosMenor:.02,agregadosMaior:.03,dependentesMenor:.005,dependentesMaior:.01};
    let taxaBeneficiarios=0, taxaAgregados=0;
    for(const [chave,al] of Object.entries(percentuais)){
      const q=valid(entrada[chave],chave,0,20);
      if(!Number.isInteger(q))throw Error('Quantidade de beneficiários e agregados deve ser inteira.');
      if(chave.startsWith('dependentes'))taxaBeneficiarios+=q*al;
      else taxaAgregados+=q*al;
    }
    const descontoIamspe=cents(remuneracao*iamspeTaxa);
    // Preservamos o arredondamento do cálculo anterior sobre o conjunto das taxas.
    // A separação visual aloca eventual centavo residual à rubrica dos agregados.
    const descontoAgregados=cents(remuneracao*(taxaBeneficiarios+taxaAgregados));
    const descontoBeneficiarios=cents(remuneracao*taxaBeneficiarios);
    const descontoAgregadosEspecificos=cents(descontoAgregados-descontoBeneficiarios);
    const modo=entrada.modoPrevidencia;
    const prev=modo==='manual'?cents(valid(entrada.previdenciaManual,'previdência manual',0,remuneracao)):
      rpps(remuneracao,p,modo==='teto');
    if(!['integral','teto','manual'].includes(modo))throw Error('Regime de contribuição inválido.');
    const qtdDependentes=valid(entrada.dependentesIr,'dependentes IR',0,20);
    if(!Number.isInteger(qtdDependentes))throw Error('Dependentes do IR devem ser inteiros.');
    const deducaoLegal=cents(prev+qtdDependentes*tabelas.vencimentos.deducaoDependenteIRPF);
    // Desconto simplificado de R$ 607,20 só quando for mais vantajoso que deduções legais.
    const deducaoIr=Math.max(deducaoLegal,607.20);
    const baseIr=cents(Math.max(0,remuneracao-deducaoIr));
    const ir=ir2026(remuneracao,baseIr);
    const emprestimoConsignado=descontoUsuario(entrada.emprestimoConsignado,'empréstimo consignado');
    const outrosDescontos=descontoUsuario(entrada.outrosDescontos,'outros descontos em folha');
    const descontoTotal=cents(descontoIamspe+descontoAgregados+prev+ir+emprestimoConsignado+outrosDescontos);
    const bruto=cents(remuneracao+totalAux);
    const indenizacoes=indenizacoesInformadas(entrada);
    const liquidoSalario=cents(bruto-descontoTotal);
    return {
      padrao:entrada.padrao,composicao:{salarioBase,gaj,retej,basica,aq,quinqueniosBase,quinqueniosGaj,sextaParte,remuneracao,aux},
      baseIR:baseIr,basePrevidencia:modo==='teto'?Math.min(remuneracao,p.tetoInss):remuneracao,
      regime:modo,
      total:{bruto,auxilios:totalAux,descontos:descontoTotal,liquido:liquidoSalario},
      indenizacoes,
      recebimentosEstimados:cents(liquidoSalario + indenizacoes.total),
      itensDesconto:{iamspe:descontoIamspe,agregados:descontoAgregados,beneficiarios:descontoBeneficiarios,agregadosEspecificos:descontoAgregadosEspecificos,previdencia:prev,ir,emprestimoConsignado,outrosDescontos}
    };
  }
  global.RemuneraTJOficial={calcular,rpps,ir2026,cents,moedaInformada,indenizacoesInformadas};
})(typeof window === 'undefined'?globalThis:window);
