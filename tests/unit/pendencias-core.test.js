import { describe, it, expect } from 'vitest';
import {
  calcularPendencias,
  resumirPendencias,
  diasEntre,
  AREAS_POR_PERFIL
} from '../../public/js/pendencias-core.js';

const hoje = '2026-10-15';

const imovel = (codigo, status = 'alugado') => ({ id: codigo, codigo, status });
const contrato = (extra = {}) => Object.assign(
  { id: 'c1', imovelCodigo: 'LD-0011', inquilino: 'Maria Souza', inicio: '2025-09-01', fim: '2027-09-01', valor: 1800 },
  extra
);

describe('Central de Pendências — contratos', () => {
  it('marca como crítica quando o contrato venceu e o imóvel segue alugado', () => {
    const lista = calcularPendencias(
      { contratos: [contrato({ fim: '2026-09-02' })], imoveis: [imovel('LD-0011')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ area: 'contratos', nivel: 'critica', titulo: 'Contrato vencido' });
    expect(lista[0].diasAtraso).toBe(43);
  });

  it('não cria pendência quando o imóvel não está mais alugado', () => {
    const lista = calcularPendencias(
      { contratos: [contrato({ fim: '2026-09-02' })], imoveis: [imovel('LD-0011', 'disponivel')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista.filter(p => p.titulo === 'Contrato vencido')).toHaveLength(0);
  });

  it('avisa contrato vencendo dentro de 30 dias e ignora o 31º dia', () => {
    const dentro = calcularPendencias(
      { contratos: [contrato({ fim: '2026-11-14' })], imoveis: [imovel('LD-0011')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(dentro.some(p => p.titulo === 'Contrato vencendo')).toBe(true);

    const fora = calcularPendencias(
      { contratos: [contrato({ fim: '2026-11-15' })], imoveis: [imovel('LD-0011')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(fora.some(p => p.titulo === 'Contrato vencendo')).toBe(false);
  });

  it('não avisa contrato que ainda não começou', () => {
    const lista = calcularPendencias(
      { contratos: [contrato({ inicio: '2027-01-01', fim: '2027-11-01' })], imoveis: [imovel('LD-0011')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista).toHaveLength(0);
  });
});

describe('Central de Pendências — laudos e documentos', () => {
  it('aponta documento emitido sem snapshot como crítica', () => {
    const lista = calcularPendencias(
      { documentosOficiais: [{ codigo: 'LD-LAI-2026-000010', status: 'emitido', dadosEmitidos: null, emitidoEm: '2026-10-13' }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista[0]).toMatchObject({ area: 'laudos', nivel: 'critica' });
    expect(lista[0].detalhe).toContain('LD-LAI-2026-000010');
  });

  it('ignora documento emitido que já tem snapshot', () => {
    const lista = calcularPendencias(
      { documentosOficiais: [{ codigo: 'LD-LAI-2026-000008', status: 'emitido', dadosEmitidos: { imovel: 'LD-0011' } }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista).toHaveLength(0);
  });

  it('aponta rascunho com mais de 7 dias e ignora o de 7 dias', () => {
    const antigo = calcularPendencias(
      { inspecoes: [{ id: 'L1', documentoCodigo: 'LD-LAI-2026-000011', documentoStatus: 'rascunho', criadoEm: '2026-10-07T10:00:00.000Z', codigo: 'LD-0022' }] },
      { hoje, perfil: 'admin' }
    );
    expect(antigo).toHaveLength(1);
    expect(antigo[0]).toMatchObject({ area: 'laudos', nivel: 'alta', titulo: 'Rascunho de laudo abandonado' });

    const recente = calcularPendencias(
      { inspecoes: [{ id: 'L2', documentoCodigo: 'LD-LAI-2026-000012', documentoStatus: 'rascunho', criadoEm: '2026-10-08T10:00:00.000Z' }] },
      { hoje, perfil: 'admin' }
    );
    expect(recente).toHaveLength(0);
  });

  it('nunca trata laudo cancelado ou substituído como rascunho', () => {
    const lista = calcularPendencias(
      { inspecoes: [
        { id: 'L3', documentoCodigo: 'LD-LAI-2026-000007', documentoStatus: 'cancelado', criadoEm: '2026-09-01T10:00:00.000Z' },
        { id: 'L4', documentoCodigo: 'LD-LAI-2026-000006', documentoStatus: 'substituido', criadoEm: '2026-09-01T10:00:00.000Z' }
      ] },
      { hoje, perfil: 'admin' }
    );
    expect(lista).toHaveLength(0);
  });
});

describe('Central de Pendências — fechamento', () => {
  const base = { contratos: [contrato({ fim: '2027-09-01' })] };

  it('aponta o mês anterior em aberto a partir do dia 6', () => {
    const lista = calcularPendencias(Object.assign({ fechamentos: [] }, base), { hoje: '2026-10-06', perfil: 'admin' });
    expect(lista.map(p => p.titulo)).toContain('Fechamento em aberto');
    expect(lista[0].detalhe).toContain('set/2026');
  });

  it('respeita a carência até o dia 5', () => {
    const lista = calcularPendencias(Object.assign({ fechamentos: [] }, base), { hoje: '2026-10-05', perfil: 'admin' });
    expect(lista.map(p => p.titulo)).not.toContain('Fechamento em aberto');
  });

  it('não cobra fechamento já registrado', () => {
    const lista = calcularPendencias(Object.assign({ fechamentos: [{ id: 'f1', periodo: '2026-09' }] }, base), { hoje: '2026-10-15', perfil: 'admin' });
    expect(lista.map(p => p.titulo)).not.toContain('Fechamento em aberto');
  });

  it('não cobra fechamento em mês sem contrato vigente', () => {
    const semContrato = { contratos: [contrato({ inicio: '2026-10-01', fim: '2027-10-01' })], fechamentos: [] };
    const lista = calcularPendencias(semContrato, { hoje: '2026-10-15', perfil: 'admin' });
    expect(lista.map(p => p.titulo)).not.toContain('Fechamento em aberto');
  });
});

describe('Central de Pendências — manutenção e permissões', () => {
  it('aponta chamado com prazo vencido e ignora concluído', () => {
    const lista = calcularPendencias({
      manutencoes: [
        { id: 'm1', status: 'Aberto', prazo: '2026-10-10', descricao: 'Infiltração', imovelCodigo: 'LD-0031' },
        { id: 'm2', status: 'Concluído', prazo: '2026-10-01', descricao: 'Pintura' }
      ]
    }, { hoje, perfil: 'admin' });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ area: 'manutencoes', nivel: 'media' });
  });

  it('aponta chamado parado há mais de 15 dias sem prazo', () => {
    const lista = calcularPendencias({
      manutencoes: [{ id: 'm3', status: 'Em Andamento', criadoEm: '2026-09-20', descricao: 'Vazamento' }]
    }, { hoje, perfil: 'admin' });
    expect(lista).toHaveLength(1);
  });

  it('corretor vê laudo e manutenção, mas não contrato nem fechamento', () => {
    const dados = {
      contratos: [contrato({ fim: '2026-09-02' })],
      imoveis: [imovel('LD-0011')],
      inspecoes: [{ id: 'L1', documentoCodigo: 'LD-LAI-2026-000011', documentoStatus: 'rascunho', criadoEm: '2026-10-01T10:00:00.000Z' }],
      manutencoes: [{ id: 'm1', status: 'Aberto', prazo: '2026-10-10', descricao: 'X' }],
      fechamentos: []
    };
    const lista = calcularPendencias(dados, { hoje, perfil: 'corretor' });
    const areas = [...new Set(lista.map(p => p.area))].sort();
    expect(areas).toEqual(['laudos', 'manutencoes']);
    expect(AREAS_POR_PERFIL.corretor).toContain('laudos');
  });

  it('perfil de manutenção vê apenas chamados', () => {
    const lista = calcularPendencias({
      contratos: [contrato({ fim: '2026-09-02' })],
      imoveis: [imovel('LD-0011')],
      manutencoes: [{ id: 'm1', status: 'Aberto', prazo: '2026-10-10', descricao: 'X' }]
    }, { hoje, perfil: 'manutencao' });
    expect(lista.every(p => p.area === 'manutencoes')).toBe(true);
  });
});

describe('Central de Pendências — ordenação e resumo', () => {
  it('ordena por gravidade e depois pelo mais antigo', () => {
    const lista = calcularPendencias({
      contratos: [contrato({ fim: '2026-11-01' })],
      imoveis: [imovel('LD-0011')],
      manutencoes: [{ id: 'm1', status: 'Aberto', prazo: '2026-10-10', descricao: 'X' }],
      documentosOficiais: [{ codigo: 'LD-LAI-2026-000010', status: 'emitido', dadosEmitidos: null, emitidoEm: '2026-10-01' }],
      fechamentos: [{ id: 'f', periodo: '2026-09' }]
    }, { hoje, perfil: 'admin' });
    expect(lista[0].nivel).toBe('critica');
    expect(lista[lista.length - 1].nivel).toBe('media');
  });

  it('resume os quatro números dos indicadores', () => {
    const lista = [
      { nivel: 'critica' }, { nivel: 'critica' }, { nivel: 'alta' }, { nivel: 'media' }
    ];
    expect(resumirPendencias(lista)).toEqual({ critica: 2, alta: 1, media: 1, total: 4 });
  });

  it('calcula diferença de dias sem erro de fuso', () => {
    expect(diasEntre('2026-10-01', '2026-10-15')).toBe(14);
    expect(diasEntre('', '2026-10-15')).toBeNull();
  });

  it('lista vazia não quebra o resumo', () => {
    expect(resumirPendencias()).toEqual({ critica: 0, alta: 0, media: 0, total: 0 });
  });
});
