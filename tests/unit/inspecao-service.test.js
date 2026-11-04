import { describe, it, expect, vi } from 'vitest';
import { criarServicoInspecao } from '../../src/modulos/inspecao/inspecao-service.js';
import { USUARIO_FICTICIO, LAUDOS_FICTICIOS } from '../fixtures/inspecao.js';

function cenario(opcoes={}) {
 const estados=[];
 const repositorio={
  sincronizar:vi.fn(async()=>opcoes.resultadoSincronizar??{gravados:2,lotes:1}),
  excluir:vi.fn(async()=>opcoes.resultadoExcluir??{excluido:true,id:'LAUDO-001'})
 };
 const servico=criarServicoInspecao({repositorio,usuarioAtual:()=>opcoes.semUsuario?null:USUARIO_FICTICIO,aoMudarEstado:e=>estados.push(e)});
 return {servico,repositorio,estados};
}

describe('serviço da inspeção',()=>{
 it('exige repositório',()=>expect(()=>criarServicoInspecao({})).toThrow('obrigatório'));
 it('exige dependências funcionais',()=>expect(()=>criarServicoInspecao({repositorio:{sincronizar(){},excluir(){}},usuarioAtual:null})).toThrow('inválidas'));
 it('bloqueia sincronização sem usuário',async()=>{const {servico}=cenario({semUsuario:true});await expect(servico.sincronizar('ld_inspecoes_v2',[])).rejects.toThrow('não autenticado')});
 it('não chama repositório sem usuário',async()=>{const {servico,repositorio}=cenario({semUsuario:true});await expect(servico.excluir('x','1')).rejects.toThrow();expect(repositorio.excluir).not.toHaveBeenCalled()});
 it('delega sincronização integralmente',async()=>{const {servico,repositorio}=cenario();const conhecidos=new Set();await servico.sincronizar('ld_inspecoes_v2',LAUDOS_FICTICIOS,conhecidos);expect(repositorio.sincronizar).toHaveBeenCalledWith('ld_inspecoes_v2',LAUDOS_FICTICIOS,conhecidos)});
 it('devolve resultado da sincronização',async()=>{const {servico}=cenario();await expect(servico.sincronizar('x',[])).resolves.toEqual({gravados:2,lotes:1})});
 it('publica ciclo de sincronização',async()=>{const {servico,estados}=cenario();await servico.sincronizar('x',[]);expect(estados.map(e=>e.estado)).toEqual(['sincronizando','sincronizado'])});
 it('delega exclusão explícita',async()=>{const {servico,repositorio}=cenario();await servico.excluir('ld_inspecoes_v2','LAUDO-001');expect(repositorio.excluir).toHaveBeenCalledWith('ld_inspecoes_v2','LAUDO-001')});
 it('publica ciclo de exclusão',async()=>{const {servico,estados}=cenario();await servico.excluir('x','1');expect(estados.map(e=>e.estado)).toEqual(['excluindo','sincronizado'])});
 it('publica e propaga erro do repositório',async()=>{const {servico,repositorio,estados}=cenario();repositorio.sincronizar.mockRejectedValue(new Error('falha fictícia'));await expect(servico.sincronizar('x',[])).rejects.toThrow('falha fictícia');expect(estados.at(-1)).toMatchObject({estado:'erro'});expect(estados.at(-1).erro).toBeInstanceOf(Error)});
 it('normaliza rejeição que não seja Error',async()=>{const {servico,repositorio}=cenario();repositorio.excluir.mockRejectedValue('indisponível');await expect(servico.excluir('x','1')).rejects.toThrow('indisponível')});
 it('informa ocupação e bloqueia concorrência',async()=>{let liberar;const promessa=new Promise(r=>liberar=r);const {servico,repositorio}=cenario();repositorio.sincronizar.mockReturnValue(promessa);const primeira=servico.sincronizar('x',[]);expect(servico.estaOcupado()).toBe(true);await expect(servico.excluir('x','1')).rejects.toThrow('já está em andamento');liberar({gravados:0});await primeira;expect(servico.estaOcupado()).toBe(false)});
 it('libera ocupação após falha',async()=>{const {servico,repositorio}=cenario();repositorio.excluir.mockRejectedValue(new Error('falha'));await expect(servico.excluir('x','1')).rejects.toThrow();expect(servico.estaOcupado()).toBe(false)});
 it('expõe estados imutáveis',()=>{const {servico}=cenario();expect(Object.isFrozen(servico.estados)).toBe(true);expect(servico.estados.ERRO).toBe('erro')});
});
