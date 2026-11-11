/**
 * LD Imóveis — Central de Pendências (regras puras)
 * Sem Firestore, sem DOM, sem data atual implícita: recebe os dados e a data.
 */

const DIA = 24 * 60 * 60 * 1000;

export const NIVEIS = ['critica', 'alta', 'media'];
export const PESO_NIVEL = { critica: 0, alta: 1, media: 2 };

export const AREAS = {
  contratos: { nome: 'Contratos', aba: 'contratos' },
  laudos: { nome: 'Laudos e documentos', aba: 'inspecoes' },
  fechamento: { nome: 'Fechamento', aba: 'fechamento' },
  manutencoes: { nome: 'Manutenções', aba: 'manutencao' }
};

/** Áreas visíveis por perfil (decisão 4: corretor vê pendências de laudo). */
export const AREAS_POR_PERFIL = {
  admin: ['contratos', 'laudos', 'fechamento', 'manutencoes'],
  financeiro: ['contratos', 'laudos', 'fechamento'],
  corretor: ['laudos', 'manutencoes'],
  manutencao: ['manutencoes'],
  consulta: ['contratos', 'laudos', 'fechamento', 'manutencoes']
};

const LIMIARES = {
  diasContratoVencendo: 30,
  diasRascunhoAbandonado: 7,
  diasChamadoParado: 15,
  diaCarenciaFechamento: 5
};

const soData = (valor) => String(valor || '').slice(0, 10);

export function diasEntre(de, ate) {
  const a = Date.parse(soData(de) + 'T00:00:00Z');
  const b = Date.parse(soData(ate) + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DIA);
}

function somarDias(dataISO, dias) {
  const base = Date.parse(soData(dataISO) + 'T00:00:00Z');
  return new Date(base + dias * DIA).toISOString().slice(0, 10);
}

function mesAnterior(hoje) {
  const d = new Date(soData(hoje) + 'T00:00:00Z');
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function primeiroDiaDoMes(ym) { return ym + '-01'; }

function ultimoDiaDoMes(ym) {
  const d = new Date(ym + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

const numeroDoMes = (ym) => Number(String(ym).slice(5, 7));
const nomeDoMes = (ym) => ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'][numeroDoMes(ym) - 1] + '/' + String(ym).slice(0, 4);

function contratoVigenteNoMes(contrato, ym) {
  const inicio = soData(contrato.inicio || contrato.dataInicio);
  const fim = soData(contrato.fim || contrato.dataFim);
  if (!inicio && !fim) return false;
  if (inicio && inicio > ultimoDiaDoMes(ym)) return false;
  if (fim && fim < primeiroDiaDoMes(ym)) return false;
  return true;
}

function imovelAlugado(imoveis, contrato) {
  const codigo = String(contrato.imovelCodigo || contrato.codigoImovel || contrato.codigo || '');
  const alvo = imoveis.find((i) => String(i.codigo || '') === codigo || (contrato.imovelId && i.id === contrato.imovelId));
  return !!alvo && alvo.status === 'alugado';
}

function identificacaoContrato(contrato) {
  const codigo = contrato.imovelCodigo || contrato.codigoImovel || contrato.codigo || contrato.numero || 'sem código';
  const inquilino = contrato.inquilino || contrato.inquilinoNome || contrato.locatario || '';
  return inquilino ? codigo + ' · ' + inquilino : String(codigo);
}

/**
 * @param {{contratos?:Array, imoveis?:Array, inspecoes?:Array, documentosOficiais?:Array,
 *          fechamentos?:Array, manutencoes?:Array}} dados
 * @param {{perfil?:string, hoje?:string}} opcoes
 * @returns {Array<{id:string, area:string, nivel:string, titulo:string, detalhe:string,
 *                  desde:string, diasAtraso:number, acao:string, aba:string}>}
 */
export function calcularPendencias(dados = {}, opcoes = {}) {
  const hoje = soData(opcoes.hoje) || new Date().toISOString().slice(0, 10);
  const perfil = opcoes.perfil || 'admin';
  const areasPermitidas = AREAS_POR_PERFIL[perfil] || AREAS_POR_PERFIL.admin;

  const contratos = Array.isArray(dados.contratos) ? dados.contratos : [];
  const imoveis = Array.isArray(dados.imoveis) ? dados.imoveis : [];
  const inspecoes = Array.isArray(dados.inspecoes) ? dados.inspecoes : [];
  const documentos = Array.isArray(dados.documentosOficiais) ? dados.documentosOficiais : [];
  const fechamentos = Array.isArray(dados.fechamentos) ? dados.fechamentos : [];
  const manutencoes = Array.isArray(dados.manutencoes) ? dados.manutencoes : [];

  const lista = [];
  const push = (item) => {
    if (!areasPermitidas.includes(item.area)) return;
    const area = AREAS[item.area];
    lista.push(Object.assign({ aba: area.aba, acao: 'Abrir ' + area.nome }, item));
  };

  /* 1. Contrato vencido e imóvel ainda marcado como alugado */
  contratos.forEach((c) => {
    const fim = soData(c.fim || c.dataFim);
    if (!fim || fim >= hoje) return;
    if (!imovelAlugado(imoveis, c)) return;
    push({
      id: 'contrato-vencido:' + (c.id || fim),
      area: 'contratos',
      nivel: 'critica',
      titulo: 'Contrato vencido',
      detalhe: identificacaoContrato(c) + ' · venceu em ' + fim.split('-').reverse().join('/') + ' e o imóvel segue alugado',
      desde: fim,
      diasAtraso: diasEntre(fim, hoje) || 0
    });
  });

  /* 2. Contrato vencendo nos próximos 30 dias */
  const limite = somarDias(hoje, LIMIARES.diasContratoVencendo);
  contratos.forEach((c) => {
    const fim = soData(c.fim || c.dataFim);
    if (!fim || fim < hoje || fim > limite) return;
    const inicio = soData(c.inicio || c.dataInicio);
    const jaComecou = !inicio || inicio <= hoje;
    if (!jaComecou) return;
    push({
      id: 'contrato-vencendo:' + (c.id || fim),
      area: 'contratos',
      nivel: 'alta',
      titulo: 'Contrato vencendo',
      detalhe: identificacaoContrato(c) + ' · vence em ' + fim.split('-').reverse().join('/') +
        ' (' + (diasEntre(hoje, fim) || 0) + ' dias)',
      desde: fim,
      diasAtraso: 0,
      prazoDias: diasEntre(hoje, fim) || 0
    });
  });

  /* 3. Documento oficial emitido sem snapshot histórico */
  documentos.forEach((d) => {
    const status = String(d.status || '');
    if (status !== 'emitido') return;
    const snapshot = d.dadosEmitidos;
    const temSnapshot = snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0;
    if (temSnapshot) return;
    const referencia = soData(d.emitidoEm || d.atualizadoEm || d.criadoEm);
    const base = referencia || hoje;
    push({
      id: 'documento-sem-snapshot:' + (d.codigo || d.id || ''),
      area: 'laudos',
      nivel: 'critica',
      titulo: 'Documento emitido sem snapshot',
      detalhe: String(d.codigo || d.id || 'sem código') + ' · emitido sem o conteúdo histórico gravado',
      desde: base,
      diasAtraso: diasEntre(base, hoje) || 0
    });
  });

  /* 4. Rascunho de laudo abandonado há mais de 7 dias */
  inspecoes.forEach((l) => {
    const codigoDocumento = String(l.documentoCodigo || '');
    const status = String(l.documentoStatus || '');
    if (!codigoDocumento || status !== 'rascunho') return;
    const criado = soData(l.criadoEm);
    if (!criado) return;
    const dias = diasEntre(criado, hoje);
    if (dias === null || dias <= LIMIARES.diasRascunhoAbandonado) return;
    const imovel = l.codigo || l.imovelCodigo || 'imóvel sem código';
    push({
      id: 'rascunho:' + (l.id || codigoDocumento),
      area: 'laudos',
      nivel: 'alta',
      titulo: 'Rascunho de laudo abandonado',
      detalhe: codigoDocumento + ' · nunca foi emitido · ' + imovel,
      desde: criado,
      diasAtraso: dias
    });
  });

  /* 5. Fechamento do mês anterior em aberto (carência até o dia 5) */
  const hojeNumero = Number(hoje.slice(8, 10));
  if (hojeNumero > LIMIARES.diaCarenciaFechamento) {
    const ym = mesAnterior(hoje);
    const contratosDoMes = contratos.filter((c) => contratoVigenteNoMes(c, ym));
    const fechado = fechamentos.some((f) => String(f.periodo || f.data || '').slice(0, 7) === ym);
    if (contratosDoMes.length && !fechado) {
      const desde = primeiroDiaDoMes(ym);
      push({
        id: 'fechamento:' + ym,
        area: 'fechamento',
        nivel: 'alta',
        titulo: 'Fechamento em aberto',
        detalhe: nomeDoMes(ym) + ' · ' + contratosDoMes.length +
          (contratosDoMes.length === 1 ? ' contrato vigente no mês' : ' contratos vigentes no mês'),
        desde,
        diasAtraso: diasEntre(desde, hoje) || 0
      });
    }
  }

  /* 6. Chamado de manutenção parado */
  manutencoes.forEach((m) => {
    const status = String(m.status || 'Aberto');
    if (['Concluído', 'Concluido', 'Cancelado'].includes(status)) return;
    const prazo = soData(m.prazo);
    const criado = soData(m.criadoEm || m.data);
    const atrasadoPrazo = prazo && prazo < hoje;
    const diasCriado = criado ? diasEntre(criado, hoje) : null;
    const parado = diasCriado !== null && diasCriado > LIMIARES.diasChamadoParado;
    if (!atrasadoPrazo && !parado) return;
    const referencia = atrasadoPrazo ? prazo : criado;
    const codigo = m.imovelCodigo || m.codigo || m.imovel || 'imóvel sem código';
    push({
      id: 'manutencao:' + (m.id || codigo),
      area: 'manutencoes',
      nivel: 'media',
      titulo: 'Chamado parado',
      detalhe: String(m.descricao || m.problema || 'Manutenção') + ' · ' + codigo +
        (m.prioridade ? ' · prioridade ' + String(m.prioridade).toLowerCase() : ''),
      desde: referencia,
      diasAtraso: diasEntre(referencia, hoje) || 0
    });
  });

  return lista.sort((a, b) => {
    const nivel = PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel];
    if (nivel !== 0) return nivel;
    return (b.diasAtraso || 0) - (a.diasAtraso || 0);
  });
}

export function resumirPendencias(lista = []) {
  return {
    critica: lista.filter((p) => p.nivel === 'critica').length,
    alta: lista.filter((p) => p.nivel === 'alta').length,
    media: lista.filter((p) => p.nivel === 'media').length,
    total: lista.length
  };
}

export const LIMIARES_PENDENCIAS = Object.freeze(LIMIARES);
