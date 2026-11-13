/* RemuneraTJ — Psicólogo Judiciário e Assistente Social Judiciário.
   Cálculo isolado, sem DOM; padrões e benefícios vêm de tabelas.js.
   Não são simulados SPPREVCOM, atrasados ou outras rubricas extraordinárias.
   Consignados e outros descontos podem ser informados pelo usuário. */
(function (global) {
  'use strict';
  const cents = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const truncCents = n => Math.floor((Number(n) + 1e-8) * 100) / 100;
  const num = (x, campo, min=0, max=1e8) => {
    if (x === '' || x === null || x === undefined || !Number.isFinite(Number(x)) || Number(x) < min || Number(x) > max)
      throw new Error('Valor inválido em ' + campo + '.');
    return Number(x);
  };
  const count = (x, campo, max=40) => {
    const q = num(x, campo, 0, max);
    if (!Number.isInteger(q)) throw new Error('Informe uma quantidade inteira para ' + campo + '.');
    return q;
  };
  const descontoUsuario = (valor, campo) => {
    if (valor === '' || valor === null || valor === undefined) return 0;
    const n = num(valor, campo, 0, 9999999.99);
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new Error('Informe reais e centavos em ' + campo + '.');
    return cents(n);
  };
  function rpps(base, tab, limitado) {
    const teto = num(tab.tetoInss, 'teto previdenciário');
    const valor = limitado ? Math.min(base, teto) : base;
    let total = 0, anterior = 0;
    for (const faixa of tab.faixas) {
      const max = faixa.limite === null ? Infinity : num(faixa.limite, 'faixa previdenciária');
      total += Math.max(0, Math.min(valor, max) - anterior) * num(faixa.aliquota, 'alíquota', 0, 1);
      anterior = max;
      if (valor <= max) break;
    }
    return cents(total);
  }
  function ir2026(remuneracao, baseIr) {
    const faixas=[[2428.80,0,0],[2826.65,.075,182.16],[3751.05,.15,394.16],[4664.68,.225,675.49],[Infinity,.275,908.73]];
    const faixa = faixas.find(f => baseIr <= f[0]);
    const calculado = Math.max(0,cents(baseIr*faixa[1]-faixa[2]));
    const reducao=remuneracao<=5000?calculado:(remuneracao<=7350?Math.min(calculado,Math.max(0,cents(978.62-.133145*remuneracao))):0);
    return cents(Math.max(0,calculado-reducao));
  }
  function calcular(entrada, tabelas) {
    const t=tabelas?.psicologiaServicoSocial, auxTabela=tabelas?.auxilios, prevTabela=tabelas?.previdencia;
    if (!t || !auxTabela || !prevTabela || !tabelas.vencimentos) throw new Error('Tabelas de remuneração indisponíveis.');
    const cargo = entrada.cargo;
    if (!['psicologo','assistenteSocial'].includes(cargo)) throw new Error('Selecione uma carreira válida.');
    const linha=t.padroes.find(x=>x.padrao===entrada.padrao);
    if (!linha) throw new Error('Selecione um padrão 8A–8R válido.');
    const gajIndice=num(t.multiplicadorGaj,'multiplicador da GAJ',0,20);
    const gaj=truncCents(num(tabelas.vencimentos.baseGratificacao,'base GAJ')*gajIndice);
    const base=cents(num(linha.remuneracao,'vencimento básico')-gaj);
    if (base < 0) throw new Error('Salário-base inconsistente com a GAJ cadastrada.');
    const basica=cents(base+gaj); // reproduz exatamente o padrão oficial
    // Campo 'Selecionar' em branco equivale a nenhum AQ; somente título reconhecido gera adicional.
    const aqTaxa=entrada.aq === '' ? 0 : num(entrada.aq,'adicional de qualificação',0,.25);
    // Os holerites de 2025 e 2026 demonstram truncamento do AQ ao centavo.
    const aq=truncCents(basica*aqTaxa);
    const q=count(entrada.quinquenios,'quinquênios',12);
    const quinqueniosBase=cents((base+aq)*.05*q);
    const quinqueniosGaj=cents(gaj*.05*q);
    const sextaParte=q>=4?cents((basica+aq)/6):0;
    const remuneracao=cents(basica+aq+quinqueniosBase+quinqueniosGaj+sextaParte);
    const auxilios={};
    for (const [k,valor] of Object.entries({alimentacao:auxTabela.alimentacao,transporte:auxTabela.transporte,creche:auxTabela.creche,filhoDeficiencia:auxTabela.filhoDeficiencia})) {
      auxilios[k]=cents(count(entrada[k],k)*num(valor,'valor de '+k));
    }
    const faixaSaude=count(entrada.faixaSaude,'faixa de auxílio-saúde',10);
    const linhaSaude=auxTabela.saude.find(x=>x.faixa===faixaSaude);
    auxilios.saude=linhaSaude?cents(linhaSaude.valor*(entrada.saudeMajorada?1.5:1)):0;
    const totalAux=cents(Object.values(auxilios).reduce((a,b)=>a+b,0));
    const taxaIamspe=num(entrada.iamspe,'IAMSPE',0,.03);
    const iamspe=cents(remuneracao*taxaIamspe);
    let somaBeneficiarios=0,somaAgregados=0;
    for (const [k,taxa] of Object.entries({dependentesMenor:.005,dependentesMaior:.01,agregadosMenor:.02,agregadosMaior:.03})) {
      const t=count(entrada[k],k,20)*taxa;
      if(k.startsWith('dependentes'))somaBeneficiarios+=t;else somaAgregados+=t;
    }
    const beneficiarios=cents(remuneracao*somaBeneficiarios);
    const agregados=cents(remuneracao*(somaBeneficiarios+somaAgregados)-beneficiarios);
    const modo=entrada.modoPrevidencia;
    if (!['integral','teto','manual'].includes(modo)) throw new Error('Regime previdenciário inválido.');
    const previdencia=modo==='manual'?cents(num(entrada.previdenciaManual,'previdência manual',0,remuneracao)):
      rpps(remuneracao,prevTabela,modo==='teto');
    const dependentesIr=count(entrada.dependentesIr,'dependentes IR',20);
    const descontoLegal=cents(previdencia+dependentesIr*num(tabelas.vencimentos.deducaoDependenteIRPF,'dedução IR'));
    const descontoIr=Math.max(descontoLegal,607.20);
    const baseIr=cents(Math.max(0,remuneracao-descontoIr));
    const ir=ir2026(remuneracao,baseIr);
    const emprestimoConsignado=descontoUsuario(entrada.emprestimoConsignado,'empréstimo consignado');
    const outrosDescontos=descontoUsuario(entrada.outrosDescontos,'outros descontos em folha');
    const totalDescontos=cents(iamspe+beneficiarios+agregados+previdencia+ir+emprestimoConsignado+outrosDescontos);
    const bruto=cents(remuneracao+totalAux);
    return {
      cargo, padrao:linha.padrao, regime:modo,
      composicao:{salarioBase:base,gaj,basica,aq,quinqueniosBase,quinqueniosGaj,sextaParte,remuneracao,aux:auxilios},
      baseIR:baseIr,basePrevidencia:modo==='teto'?Math.min(remuneracao,prevTabela.tetoInss):remuneracao,
      itensDesconto:{iamspe,beneficiarios,agregados,previdencia,ir,emprestimoConsignado,outrosDescontos},
      total:{bruto,auxilios:totalAux,descontos:totalDescontos,liquido:cents(bruto-totalDescontos)}
    };
  }
  global.RemuneraTJProfissionais={calcular,rpps,ir2026,cents};
})(typeof window==='undefined'?globalThis:window);
