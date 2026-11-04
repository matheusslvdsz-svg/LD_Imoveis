import { describe, it, expect, vi } from 'vitest';
import { criarRepositorioInspecao } from '../../src/modulos/inspecao/inspecao-repository.js';

function cenario(opcoes = {}) {
  const operacoes = [];
  const commits = [];
  const criarLote = vi.fn(() => ({
    set: (ref, dados, config) => operacoes.push({ tipo:'set', ref, dados, config }),
    delete: ref => operacoes.push({ tipo:'delete', ref }),
    commit: vi.fn(async () => { commits.push(true); if (opcoes.falhar) throw new Error('falha simulada'); })
  }));
  const criarReferencia = vi.fn((_db, colecao, id) => `${colecao}/${id}`);
  const repo = criarRepositorioInspecao({
    db: { teste:true }, criarReferencia, criarLote,
    agora: () => '2026-11-03T12:00:00.000Z',
    emailAtual: () => 'admin@teste.local',
    limiteLote: opcoes.limite || 400
  });
  return { repo, operacoes, commits, criarLote, criarReferencia };
}

describe('repositório da inspeção', () => {
  it('mapeia as duas coleções oficiais', () => {
    const {repo}=cenario();
    expect(repo.nomeColecao('ld_inspecoes_v2')).toBe('inspecoes');
    expect(repo.nomeColecao('ld_imoveis_v2')).toBe('inspecaoImoveis');
  });
  it('rejeita chave desconhecida', async () => {
    await expect(cenario().repo.sincronizar('outra',[])).rejects.toThrow('desconhecida');
  });
  it('grava registro novo com merge e metadados', async () => {
    const {repo,operacoes}=cenario();
    const r=await repo.sincronizar('ld_inspecoes_v2',[{id:'L-1',codigo:'A'}],new Set());
    expect(r).toMatchObject({gravados:1,lotes:1});
    expect(operacoes[0]).toMatchObject({tipo:'set',ref:'inspecoes/L-1',config:{merge:true}});
    expect(operacoes[0].dados).toMatchObject({atualizadoEm:'2026-11-03T12:00:00.000Z',atualizadoPor:'admin@teste.local'});
  });
  it('remove marcador interno antes de gravar', async () => {
    const {repo,operacoes}=cenario();
    await repo.sincronizar('ld_imoveis_v2',[{codigo:'A',__alteradoLocal:true}],new Set(['A']));
    expect(operacoes[0].dados).not.toHaveProperty('__alteradoLocal');
  });
  it('não regrava conhecido sem alteração', async () => {
    const {repo,operacoes}=cenario();
    const r=await repo.sincronizar('ld_inspecoes_v2',[{id:'L-1'}],new Set(['L-1']));
    expect(r).toMatchObject({gravados:0,lotes:0}); expect(operacoes).toHaveLength(0);
  });
  it('não cria exclusões implícitas', async () => {
    const {repo,operacoes}=cenario();
    await repo.sincronizar('ld_inspecoes_v2',[{id:'L-1'}],new Set(['L-1','L-2']));
    expect(operacoes.filter(x=>x.tipo==='delete')).toHaveLength(0);
  });
  it('divide gravações conforme limite do lote', async () => {
    const {repo,criarLote}=cenario({limite:2});
    const r=await repo.sincronizar('ld_inspecoes_v2',[{id:'1'},{id:'2'},{id:'3'},{id:'4'},{id:'5'}]);
    expect(r).toMatchObject({gravados:5,lotes:3}); expect(criarLote).toHaveBeenCalledTimes(3);
  });
  it('só confirma conhecidos após commit bem-sucedido', async () => {
    const conhecidos=new Set(),{repo}=cenario({falhar:true});
    await expect(repo.sincronizar('ld_inspecoes_v2',[{id:'L-1'}],conhecidos)).rejects.toThrow('falha simulada');
    expect(conhecidos.has('L-1')).toBe(false);
  });
  it('exclui explicitamente na coleção correta', async () => {
    const {repo,operacoes}=cenario();
    const r=await repo.excluir('ld_imoveis_v2','IM 01');
    expect(r).toEqual({excluido:true,id:'IM_01',colecao:'inspecaoImoveis'});
    expect(operacoes).toEqual([{tipo:'delete',ref:'inspecaoImoveis/IM_01'}]);
  });
  it('rejeita exclusão sem identificador', async () => {
    await expect(cenario().repo.excluir('ld_inspecoes_v2','')).rejects.toThrow('Identificador inválido');
  });
  it('rejeita limite de lote acima de 500', () => {
    expect(()=>criarRepositorioInspecao({db:{},criarReferencia(){},criarLote(){},limiteLote:501})).toThrow('entre 1 e 500');
  });
  it('exige dependências', () => {
    expect(()=>criarRepositorioInspecao({})).toThrow('obrigatórias');
  });
});
