import {describe,it,expect} from 'vitest';
import {idSeguro,validarNota,validarLaudo} from '../../src/modulos/inspecao/validacao.js';
import {laudoValido} from '../fixtures/inspecao.js';
describe('validação da inspeção',()=>{
 it('aceita laudo válido',()=>expect(validarLaudo(laudoValido)).toEqual({valido:true,erros:[]}));
 it('rejeita código vazio',()=>expect(validarLaudo({...laudoValido,codigo:''}).valido).toBe(false));
 it('rejeita tipo desconhecido',()=>expect(validarLaudo({...laudoValido,tipo:'X'}).valido).toBe(false));
 it('rejeita data fora do padrão',()=>expect(validarLaudo({...laudoValido,data:'03/11/2026'}).valido).toBe(false));
 it.each(['0','1','2','3',0,1,2,3,'na'])('aceita nota %s',n=>expect(validarNota(n)).toBe(true));
 it('rejeita nota fora da escala',()=>expect(validarNota(4)).toBe(false));
 it('sanitiza identificador',()=>expect(idSeguro('LD 001/Pará')).toBe('LD_001_Par_'));
 it('limita identificador a 180 caracteres',()=>expect(idSeguro('a'.repeat(250))).toHaveLength(180));
});
