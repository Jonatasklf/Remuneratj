// Testes de regressão do cálculo: arquivo JSON afeta só indenizações.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const scope = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'remuneracao-tjsp/js/tabelas.js'),'utf8'),scope);
vm.runInNewContext(fs.readFileSync(path.join(root,'remuneracao-oficial/js/calculo-oficial.js'),'utf8'),scope);
const calc=scope.window.RemuneraTJOficial.calcular;
const tabs=scope.window.REMUNERATJ_TABELAS;
const entrada={
 padrao:tabs.oficialJustica.padroes[0].padrao,quinquenios:0,aq:'',
 modoPrevidencia:'teto',previdenciaManual:0,dependentesIr:0,
 iamspe:0,saudeMajorada:false,alimentacao:20,transporte:20,faixaSaude:0,
 creche:0,filhoDeficiencia:0,agregadosMenor:0,agregadosMaior:0,
 dependentesMenor:0,dependentesMaior:0,quantidadeGratuita:0,
 quantidadeGratuitaRemota:27,quantidadePaga:0,quantidadePagaRemota:20,
 valorGratuita:103.16,valorPaga:'',valorPagaRemota:'36,50',
 valorAntecipacao:2755.71,incluirAntecipacao:true,
 emprestimoConsignado:0,outrosDescontos:0,competenciaDiligencias:'Setembro/2026'
};
const antes=calc(entrada,tabs);
assert.equal(antes.indenizacoes.total,3692.03);
assert.equal(antes.indenizacoes.gratuitaRemota.cotas,2);
assert.equal(antes.indenizacoes.gratuitaRemota.restantes,7);
assert.equal(antes.indenizacoes.competencia,'Setembro/2026');
const novo=calc({...entrada,valorGratuita:110,valorAntecipacao:3000,competenciaDiligencias:'Outubro/2026'},tabs);
assert.equal(novo.indenizacoes.total,3950);
assert.equal(novo.total.bruto,antes.total.bruto);
assert.equal(novo.total.descontos,antes.total.descontos);
assert.equal(novo.total.liquido,antes.total.liquido);
assert.ok(Math.abs((novo.recebimentosEstimados-antes.recebimentosEstimados)-(3950-3692.03))<0.001);
const somenteSalario=calc({...entrada,quantidadeGratuitaRemota:0,quantidadePagaRemota:0,valorPagaRemota:'',incluirAntecipacao:false},tabs);
assert.equal(somenteSalario.indenizacoes.total,0);
console.log('Cálculo OJ OK: valores AOJESP, 10 remotos/1 cota, nenhuma alteração salarial.');
