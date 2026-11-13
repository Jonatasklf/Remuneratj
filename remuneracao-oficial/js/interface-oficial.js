(function(){
 'use strict';
 const tbl=window.REMUNERATJ_TABELAS;
 const form=document.getElementById('ojForm');const $=id=>document.getElementById(id);
 const format=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 let last=null;
 // Cota gratuita e antecipação são lidas de um JSON atualizado pelo GitHub Actions.
 // A cópia de referência e o último valor válido em cache mantêm o cálculo possível
 // se a AOJESP ou o arquivo remoto ficarem indisponíveis.
 const URL_DADOS='../dados/diligencias-aojesp.json';
 const CHAVE_ULTIMOS_DADOS='remuneratj-aojesp-valores-v1';
 let referencia={cota_gratuita:103.16,antecipacao:2755.71,competencia:'Setembro/2026',atualizado_em:'2026-11-13'};
 let dadosDisponiveis='referência de segurança';
 let consultaPendente=null;
 function validarReferencia(d){
   if(!d || typeof d!=='object')return null;
   const g=Number(d.cota_gratuita),a=Number(d.antecipacao);
   if(!Number.isFinite(g)||g<=0||g>1000||!Number.isFinite(a)||a<=0||a>20000)return null;
   if(Math.abs(g*100-Math.round(g*100))>1e-6||Math.abs(a*100-Math.round(a*100))>1e-6)return null;
   const comp=typeof d.competencia==='string' && d.competencia.length<60?d.competencia:'competência não informada';
   const dia=typeof d.atualizado_em==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d.atualizado_em)?d.atualizado_em:'';
   return {cota_gratuita:g,antecipacao:a,competencia:comp,atualizado_em:dia};
 }
 function exibirReferencia(){
   $('valorGratuitaExibido').textContent=format(referencia.cota_gratuita);
   $('valorAntecipacaoExibido').textContent=format(referencia.antecipacao);
   $('competenciaGratuitaExibida').textContent='Referência: '+referencia.competencia+'. Multiplicada pelas cotas presenciais e remotas reconhecidas.';
   $('statusDadosAOJESP').textContent='Fonte: AOJESP · '+referencia.competencia+' · '+dadosDisponiveis+(referencia.atualizado_em?' · Atualização registrada: '+referencia.atualizado_em.split('-').reverse().join('/'):'')+'.';
 }
 try{const guardado=validarReferencia(JSON.parse(localStorage.getItem(CHAVE_ULTIMOS_DADOS)||'null'));if(guardado){referencia=guardado;dadosDisponiveis='última referência armazenada';}}catch(_e){}
 exibirReferencia();
 async function atualizarReferencia(){
   if(consultaPendente)return consultaPendente;
   consultaPendente=(async()=>{
     const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),7000);
     try{
       const resposta=await fetch(URL_DADOS+'?r='+Date.now(),{cache:'no-store',signal:controller.signal});
       if(!resposta.ok)throw Error('Arquivo de referência indisponível');
       const dados=validarReferencia(await resposta.json());
       if(!dados)throw Error('Arquivo de referência inválido');
       referencia=dados;dadosDisponiveis='valores validados no arquivo do site';
       try{localStorage.setItem(CHAVE_ULTIMOS_DADOS,JSON.stringify(dados));}catch(_e){}
     }catch(_e){dadosDisponiveis='última referência válida disponível (sem consulta nesta tentativa)';}
     finally{clearTimeout(timeout);exibirReferencia();}
   })().finally(()=>{consultaPendente=null;});
   return consultaPendente;
 }
 // Carrega valores exibidos, mas nunca executa o cálculo automaticamente.
 void atualizarReferencia();
 const btnCalcular=form.querySelector('button[type="submit"]');
 const select=$('padrao');for(const row of tbl.oficialJustica.padroes){const opt=document.createElement('option');opt.value=row.padrao;opt.textContent=row.padrao+' · '+format(row.remuneracao);select.appendChild(opt);}
 const quinq=$('quinquenios');for(let n=0;n<=8;n++){const opt=document.createElement('option');opt.value=String(n);opt.textContent=n===0?'Nenhum':n+' ('+(n*5)+' anos)';quinq.appendChild(opt);}
 const manualToggle=()=>$('manualBox').hidden=$('modoPrevidencia').value!=='manual';
 $('modoPrevidencia').addEventListener('change',manualToggle);manualToggle();
 // Os atalhos são apenas uma conveniência de preenchimento: não executam o cálculo.
 const regimeButtons=Array.from(document.querySelectorAll('[data-regime]'));
 function selecionarRegime(nome){
   for(const b of regimeButtons){
     const active=b.dataset.regime===nome;
     b.classList.toggle('active',active);
     b.setAttribute('aria-pressed',String(active));
   }
 }
 for(const b of regimeButtons){
   b.addEventListener('click',()=>{
     const escolha=b.dataset.regime;
     if(escolha==='presencial')$('transporte').value='20';
     if(escolha==='remoto')$('transporte').value='0';
     selecionarRegime(escolha);
     pending();
   });
 }
 $('transporte').addEventListener('input',()=>selecionarRegime('personalizado'));

 function pending(){const had=last!==null;$('resultStatus').textContent=had?'Resultado anterior · clique para atualizar':'Aguardando cálculo';$('resultStatus').className='state'+(had?' stale':'');$('formStatus').textContent=had?'Campos alterados. Clique em Calcular remuneração para atualizar.':'Preencha os dados e clique em Calcular remuneração.';$('copyButton').disabled=true;$('printButton').disabled=true;$('errorBox').hidden=true;}
 // Alterações não recalculam; botão de cálculo é o único acionador.
 form.addEventListener('input',pending);form.addEventListener('change',pending);
 form.addEventListener('reset',()=>{setTimeout(()=>{manualToggle();selecionarRegime('presencial');pending()},0);});
 const val=id=>$(id).value;
 function extrair(){const o={padrao:val('padrao'),quinquenios:val('quinquenios'),aq:val('aq'),modoPrevidencia:val('modoPrevidencia'),previdenciaManual:val('previdenciaManual'),dependentesIr:val('dependentesIr'),iamspe:val('iamspe'),saudeMajorada:val('saudeMajorada')==='1.5'};
 for(const k of ['alimentacao','transporte','faixaSaude','creche','filhoDeficiencia','agregadosMenor','agregadosMaior','dependentesMenor','dependentesMaior','quantidadeGratuita','quantidadeGratuitaRemota','quantidadePaga','quantidadePagaRemota','valorPaga','valorPagaRemota','emprestimoConsignado','outrosDescontos'])o[k]=val(k);o.valorGratuita=referencia.cota_gratuita;o.valorAntecipacao=referencia.antecipacao;o.competenciaDiligencias=referencia.competencia;o.incluirAntecipacao=$('incluirAntecipacao').checked;return o;}
 const label=(a,v,negative=false,extra='')=>'<div class="line'+(negative?' negative':'')+'"><span>'+a+'</span><strong>'+format(v)+'</strong></div>';
 const group=title=>'<div class="group-label">'+title+'</div>';
 function render(d){const c=d.composicao, a=c.aux, x=d.itensDesconto;
 $('liquido').textContent=format(d.total.liquido);$('liquidoRodape').textContent=format(d.total.liquido);$('bruto').textContent=format(d.total.bruto);$('descontos').textContent=format(d.total.descontos);
 $('ojResumoVencimentos').textContent=format(c.remuneracao);$('ojResumoAuxilios').textContent=format(d.total.auxilios);$('ojResumoDescontos').textContent=format(d.total.descontos);
 const perc=d.total.bruto>0?100*c.remuneracao/d.total.bruto:0; $('ojBarVencimentos').style.width=perc.toFixed(2)+'%'; $('ojBarAuxilios').style.width=(100-perc).toFixed(2)+'%';
 $('detalhes').innerHTML=group('VENCIMENTOS')+label('Salário-base',c.salarioBase)+label('Gratificação judiciária — GAJ',c.gaj)+label('RETEJ · regime externo',c.retej)+label('Adicional de qualificação',c.aq)+label('Quinquênios sobre base, RETEJ e AQ',c.quinqueniosBase)+label('Quinquênios sobre GAJ',c.quinqueniosGaj)+label('Sexta-parte',c.sextaParte)+label('Remuneração ordinária',c.remuneracao)+group('AUXÍLIOS REGULARES')+label('Auxílio-alimentação',a.alimentacao)+label('Auxílio-transporte',a.transporte)+label('Auxílio-saúde',a.saude)+label('Auxílio-creche',a.creche)+label('Auxílio a filho com deficiência',a.filhoDeficiencia)+group('DESCONTOS')+label('IAMSPE do servidor',x.iamspe,true)+label('IAMSPE · beneficiários',x.beneficiarios,true)+label('IAMSPE · agregados',x.agregadosEspecificos,true)+label('Contribuição previdenciária',x.previdencia,true)+label('IRRF',x.ir,true)+label('Empréstimo consignado',x.emprestimoConsignado,true)+label('Outros descontos em folha',x.outrosDescontos,true);
 const i=d.indenizacoes;
 $('totalIndenizacoes').textContent=format(i.total);
 $('totalRecebimentos').textContent=format(d.recebimentosEstimados);
 $('detalhesIndenizacoes').innerHTML=group('MANDADOS GRATUITOS')
   +label('Presenciais · '+i.gratuita.quantidade+' cotas × '+format(i.gratuita.unitario),i.gratuita.total)
   +label('Remotos · '+i.gratuitaRemota.mandados+' mandados → '+i.gratuitaRemota.cotas+' cotas',i.gratuitaRemota.total)
   +(i.gratuitaRemota.restantes ? '<p class="remote-remainder">'+i.gratuitaRemota.restantes+' mandado(s) remoto(s) fora de lote completo, sem cota nesta simulação.</p>' : '')
   +group('MANDADOS PAGOS')
   +label('Presenciais · '+i.paga.quantidade+' × '+format(i.paga.unitario),i.paga.total)
   +label('Remotos · '+i.pagaRemota.quantidade+' × '+format(i.pagaRemota.unitario),i.pagaRemota.total)
   +group('ANTECIPAÇÃO')+label(i.incluirAntecipacao ? 'Antecipação AOJESP · valor único':'Antecipação não incluída',i.antecipacao);
 $('resultStatus').textContent='Cálculo concluído';$('resultStatus').className='state ready';$('formStatus').textContent='Resultado atualizado. Alterar os campos não recalcula automaticamente.';$('copyButton').disabled=false;$('printButton').disabled=false;
 }
 form.addEventListener('submit',async e=>{e.preventDefault();btnCalcular.disabled=true;
  try{
   await atualizarReferencia();
   for(const inp of form.querySelectorAll('input[type=number]')){
    const number=Number(inp.value);if(['emprestimoConsignado','outrosDescontos'].includes(inp.id) && inp.value.trim()==='')continue;if(inp.value.trim()===''||!Number.isFinite(number)||(inp.min!==''&&number<Number(inp.min))||(inp.max!==''&&number>Number(inp.max))||(inp.step==='1'&&!Number.isInteger(number))||(['emprestimoConsignado','outrosDescontos'].includes(inp.id)&&Math.abs(number*100-Math.round(number*100))>1e-6)){inp.setAttribute('aria-invalid','true');inp.focus();throw Error('Preencha '+(inp.closest('.field')?.querySelector('label')?.textContent||'o campo')+' corretamente.');}inp.removeAttribute('aria-invalid');}
   last=window.RemuneraTJOficial.calcular(extrair(),tbl);
   render(last);$('errorBox').hidden=true;if(window.innerWidth<=1020)$('result-title').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){$('errorBox').textContent=error.message||'Erro ao calcular.';$('errorBox').hidden=false;if(last){$('resultStatus').textContent='Resultado anterior · não atualizado';$('resultStatus').className='state stale';}}
  finally {btnCalcular.disabled=false;}
 });
 $('copyButton').addEventListener('click',()=>{if(!last)return;const i=last.indenizacoes;const out=[
 'RemuneraTJ · Oficial de Justiça', 'Padrão: '+last.padrao,
 'Bruto salarial: '+format(last.total.bruto),'Descontos: '+format(last.total.descontos),
 'Empréstimo consignado: '+format(last.itensDesconto.emprestimoConsignado),
 'Outros descontos em folha: '+format(last.itensDesconto.outrosDescontos),
 'Líquido salarial: '+format(last.total.liquido),'',
 'INDENIZAÇÕES · GRATUITAS E ANTECIPAÇÃO: FONTE AOJESP',
 'Competência da cota gratuita: '+i.competencia,
 'Fonte: https://aojesp.org.br/ (valores das pagas informados pelo servidor)',
 'Gratuitas presenciais: '+i.gratuita.quantidade+' cotas × '+format(i.gratuita.unitario)+' = '+format(i.gratuita.total),
 'Gratuitas remotas: '+i.gratuitaRemota.mandados+' mandados → '+i.gratuitaRemota.cotas+' cotas = '+format(i.gratuitaRemota.total),
 'Mandados remotos fora de lote: '+i.gratuitaRemota.restantes,
 'Pagas presenciais: '+i.paga.quantidade+' × '+format(i.paga.unitario)+' = '+format(i.paga.total),
 'Pagas remotas: '+i.pagaRemota.quantidade+' × '+format(i.pagaRemota.unitario)+' = '+format(i.pagaRemota.total),
 'Antecipação incluída: '+format(i.antecipacao),
 'Total indenizatório: '+format(i.total),
 'Líquido + indenizações: '+format(last.recebimentosEstimados),
 'Consignados e outros descontos considerados somente quando informados. Cotas gratuitas e antecipação pela AOJESP; conferir mapas e comunicados do TJSP.'
 ].join('\n');const copy=navigator.clipboard?.writeText?.(out);if(copy)copy.catch(()=>{window.prompt('Copie o resumo:',out)});else window.prompt('Copie o resumo:',out);});
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