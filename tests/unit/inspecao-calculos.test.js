import {describe,it,expect} from 'vitest';
import {calcularNota,classificarNota,estaBloqueado,classificarPrioridade,frequenciaDoImovel,controleDoImovel,somarDias,diasEntre} from '../../src/modulos/inspecao/calculos.js';
import {itens} from '../fixtures/inspecao.js';
describe('cálculos da inspeção',()=>{
 it('calcula nota percentual',()=>expect(calcularNota(itens,{'1.1':'3','1.2':'2','1.3':'1'})).toBeCloseTo(66.666,2));
 it('ignora item não aplicável',()=>expect(calcularNota(itens,{'1.1':'3','1.2':'na'})).toBe(100));
 it('retorna nulo sem avaliações',()=>expect(calcularNota(itens,{})).toBeNull());
 it.each([[95,'ÓTIMO'],[80,'BOM'],[65,'REGULAR'],[50,'RUIM'],[20,'CRÍTICO']])('classifica %s como %s',(n,r)=>expect(classificarNota(n).rotulo).toBe(r));
 it('bloqueia item crítico nota zero',()=>expect(estaBloqueado(itens,{'1.2':'0'})).toBe(true));
 it('não bloqueia item comum nota zero',()=>expect(estaBloqueado(itens,{'1.3':'0'})).toBe(false));
 it.each([[true,0,'P1'],[false,0,'P2'],[true,1,'P2'],[false,1,'P3'],[false,2,null]])('prioridade correta',(critico,nota,p)=>expect(classificarPrioridade({critico},nota)).toBe(p));
 it.each([[{status:'obra'},null],[{status:'ocupado'},180],[{status:'vago',altoValor:true},15],[{status:'vago'},30]])('frequência correta para %j',(im,d)=>expect(frequenciaDoImovel(im)).toBe(d));
 it('soma dias sem deslocamento de fuso',()=>expect(somarDias('2026-01-30',2)).toBe('2026-02-01'));
 it('calcula diferença entre datas',()=>expect(diasEntre('2026-11-01','2026-11-08')).toBe(7));
 it('marca vistoria vencida',()=>expect(controleDoImovel({codigo:'A',status:'vago'},[{codigo:'A',data:'2026-09-01'}],'2026-11-03').status).toBe('vencida'));
 it('mantém imóvel em obra fora do controle',()=>expect(controleDoImovel({codigo:'A',status:'obra'},[],'2026-11-03').status).toBe('obra'));
});
