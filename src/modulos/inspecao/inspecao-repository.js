import { idSeguro } from './validacao.js';

export const COLECOES_INSPECAO = Object.freeze({
  ld_inspecoes_v2: 'inspecoes',
  ld_imoveis_v2: 'inspecaoImoveis'
});

export function criarRepositorioInspecao({
  db,
  criarReferencia,
  criarLote,
  agora = () => new Date().toISOString(),
  emailAtual = () => '',
  limiteLote = 400,
  colecoes = COLECOES_INSPECAO
}) {
  if (!db || typeof criarReferencia !== 'function' || typeof criarLote !== 'function') {
    throw new TypeError('Dependências do repositório de inspeção são obrigatórias.');
  }
  if (!Number.isInteger(limiteLote) || limiteLote < 1 || limiteLote > 500) {
    throw new RangeError('O limite do lote deve estar entre 1 e 500.');
  }

  const nomeColecao = chave => {
    const nome = colecoes[chave];
    if (!nome) throw new Error(`Chave de inspeção desconhecida: ${chave}`);
    return nome;
  };

  async function sincronizar(chave, lista, conhecidos = new Set()) {
    const colecao = nomeColecao(chave);
    const pendentes = (Array.isArray(lista) ? lista : []).filter(item =>
      !conhecidos.has(idSeguro(item.id || item.codigo)) || item.__alteradoLocal === true
    );
    let lotes = 0;
    for (let inicio = 0; inicio < pendentes.length; inicio += limiteLote) {
      const grupo = pendentes.slice(inicio, inicio + limiteLote);
      const lote = criarLote(db);
      const idsConfirmados = [];
      for (const item of grupo) {
        const id = idSeguro(item.id || item.codigo);
        if (!id) throw new Error('Registro de inspeção sem identificador válido.');
        const dados = { ...item, id, atualizadoEm: agora(), atualizadoPor: emailAtual() };
        delete dados.__alteradoLocal;
        lote.set(criarReferencia(db, colecao, id), dados, { merge: true });
        idsConfirmados.push(id);
      }
      await lote.commit();
      idsConfirmados.forEach(id => conhecidos.add(id));
      lotes++;
    }
    return { gravados: pendentes.length, lotes, conhecidos };
  }

  async function excluir(chave, idOriginal) {
    const colecao = nomeColecao(chave);
    const id = idSeguro(idOriginal);
    if (!id) throw new Error('Identificador inválido para exclusão.');
    const lote = criarLote(db);
    lote.delete(criarReferencia(db, colecao, id));
    await lote.commit();
    return { excluido: true, id, colecao };
  }

  return Object.freeze({ sincronizar, excluir, nomeColecao });
}
