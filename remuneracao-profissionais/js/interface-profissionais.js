(function(){
  'use strict';
  const tbl=window.REMUNERATJ_TABELAS;
  const form=document.getElementById('profForm'),$=id=>document.getElementById(id);
  const format=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  let last=null;
  const p=$('padrao');
  for(const l of tbl.psicologiaServicoSocial.padroes){
    const opt=document.createElement('option');opt.value=l.padrao;opt.textContent=l.padrao+' · '+format(l.remuneracao);
    p.appendChild(opt);
  }
  const q=$('quinquenios');
  for(let n=0;n<=8;n++){
    const opt=document.createElement('option');opt.value=String(n);
    opt.textContent=n===0?'Nenhum':n+' ('+(n*5)+' anos)';q.appendChild(opt);
  }
  function manualToggle(){$('manualBox').hidden=$('modoPrevidencia').value!=='manual';}
  $('modoPrevidencia').addEventListener('change',manualToggle);manualToggle();
  const buttons=Array.from(document.querySelectorAll('[data-regime]'));
  function setRegime(name){for(const b of buttons){const selected=b.dataset.regime===name;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));}}
  for(const b of buttons){b.addEventListener('click',()=>{
    if(b.dataset.regime==='presencial')$('transporte').value='20';
    if(b.dataset.regime==='remoto')$('transporte').value='0';
    setRegime(b.dataset.regime);pending();
  });}
  $('transporte').addEventListener('input',()=>setRegime('personalizado'));
  function pending(){const had=last!==null; $('resultStatus').textContent=had?'Resultado anterior · clique para atualizar':'Aguardando cálculo';$('resultStatus').className='state'+(had?' stale':'');$('formStatus').textContent=had?'Campos alterados. Clique em Calcular remuneração para atualizar.':'Preencha os dados e clique em Calcular remuneração.';$('copyButton').disabled=true;$('printButton').disabled=true;$('errorBox').hidden=true;}
  form.addEventListener('input',pending);form.addEventListener('change',pending);
  form.addEventListener('reset',()=>setTimeout(()=>{manualToggle();setRegime('presencial');pending();},0));
  const val=id=>$(id).value;
  function extrair(){const data={cargo:val('cargo'),padrao:val('padrao'),quinquenios:val('quinquenios'),aq:val('aq'),modoPrevidencia:val('modoPrevidencia'),previdenciaManual:val('previdenciaManual'),dependentesIr:val('dependentesIr'),iamspe:val('iamspe'),saudeMajorada:val('saudeMajorada')==='1.5'};
    for(const k of ['alimentacao','transporte','faixaSaude','creche','filhoDeficiencia','agregadosMenor','agregadosMaior','dependentesMenor','dependentesMaior','emprestimoConsignado','outrosDescontos'])data[k]=val(k);return data;}
  const linha=(nome,valor,neg=false)=>'<div class="line'+(neg?' negative':'')+'"><span>'+nome+'</span><strong>'+format(valor)+'</strong></div>';
  const categoria=nome=>'<div class="group-label">'+nome+'</div>';
  function render(d){const c=d.composicao,a=c.aux,x=d.itensDesconto;
    $('liquido').textContent=format(d.total.liquido);$('liquidoRodape').textContent=format(d.total.liquido);$('bruto').textContent=format(d.total.bruto);$('descontos').textContent=format(d.total.descontos);
    $('ojResumoVencimentos').textContent=format(c.remuneracao);$('ojResumoAuxilios').textContent=format(d.total.auxilios);$('ojResumoDescontos').textContent=format(d.total.descontos);
    const share=d.total.bruto>0?100*c.remuneracao/d.total.bruto:0;
    $('ojBarVencimentos').style.width=share.toFixed(2)+'%';$('ojBarAuxilios').style.width=(100-share).toFixed(2)+'%';
    $('detalhes').innerHTML=categoria('VENCIMENTOS')+linha('Salário-base',c.salarioBase)+linha('Gratificação judiciária — GAJ',c.gaj)+linha('Adicional de qualificação',c.aq)+linha('Quinquênios — salário-base e AQ',c.quinqueniosBase)+linha('Quinquênios — GAJ',c.quinqueniosGaj)+linha('Sexta-parte',c.sextaParte)+linha('Remuneração ordinária',c.remuneracao)+categoria('AUXÍLIOS REGULARES')+linha('Auxílio-alimentação',a.alimentacao)+linha('Auxílio-transporte',a.transporte)+linha('Auxílio-saúde',a.saude)+linha('Auxílio-creche',a.creche)+linha('Auxílio a filho com deficiência',a.filhoDeficiencia)+categoria('DESCONTOS')+linha('IAMSPE do servidor',x.iamspe,true)+linha('IAMSPE · beneficiários',x.beneficiarios,true)+linha('IAMSPE · agregados',x.agregados,true)+linha('Contribuição previdenciária (RPPS)',x.previdencia,true)+linha('IRRF',x.ir,true)+linha('Empréstimo consignado',x.emprestimoConsignado,true)+linha('Outros descontos em folha',x.outrosDescontos,true);
    $('resultStatus').textContent='Cálculo concluído';$('resultStatus').className='state ready';$('formStatus').textContent='Resultado atualizado. Alterar os campos não recalcula automaticamente.';$('copyButton').disabled=false;$('printButton').disabled=false;
  }
  form.addEventListener('submit',event=>{event.preventDefault();try{
    for(const i of form.querySelectorAll('input[type=number]')){
      // Only require the manual contribution when that mode is selected.
      if(i.id==='previdenciaManual' && $('modoPrevidencia').value!=='manual')continue;
      if(['emprestimoConsignado','outrosDescontos'].includes(i.id) && i.value.trim()==='')continue;
      const n=Number(i.value);
      if(i.value.trim()===''||!Number.isFinite(n)||(i.min!==''&&n<Number(i.min))||(i.max!==''&&n>Number(i.max))||(i.step==='1'&&!Number.isInteger(n))||(['emprestimoConsignado','outrosDescontos'].includes(i.id)&&Math.abs(n*100-Math.round(n*100))>1e-6)){i.setAttribute('aria-invalid','true');i.focus();throw Error('Preencha '+(i.closest('.field')?.querySelector('label')?.textContent||'o campo')+' corretamente.');}
      i.removeAttribute('aria-invalid');
    }
    const d=window.RemuneraTJProfissionais.calcular(extrair(),tbl);last=d;render(d);$('errorBox').hidden=true;
    if(window.innerWidth<=1020)$('result-title').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){$('errorBox').textContent=error.message||'Não foi possível calcular.';$('errorBox').hidden=false;}});
  $('copyButton').addEventListener('click',()=>{if(!last)return;const nome=last.cargo==='psicologo'?'Psicólogo Judiciário':'Assistente Social Judiciário';const out=['RemuneraTJ · '+nome,'Padrão: '+last.padrao,'Bruto: '+format(last.total.bruto),'Descontos: '+format(last.total.descontos),'Empréstimo consignado: '+format(last.itensDesconto.emprestimoConsignado),'Outros descontos em folha: '+format(last.itensDesconto.outrosDescontos),'Líquido estimado: '+format(last.total.liquido),'Sem SPPREVCOM ou verbas eventuais.'].join('\n');const cp=navigator.clipboard?.writeText?.(out);if(cp)cp.catch(()=>window.prompt('Copie o resumo:',out));else window.prompt('Copie o resumo:',out);});
  $('printButton').addEventListener('click',()=>{if(last)window.print();});
  // A formação fica inicialmente sem seleção, inclusive ao voltar à página
  // com o histórico do navegador. Não é feito nenhum cálculo automático.
  window.addEventListener('pageshow', () => {
    const campo = document.getElementById('aq');
    if (campo && campo.value !== '') {
      campo.value = '';
      pending();
    }
  });
  pending();
})();
