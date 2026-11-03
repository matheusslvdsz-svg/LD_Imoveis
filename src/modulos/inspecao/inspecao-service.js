const ESTADOS = Object.freeze({ OCIOSO:'ocioso', SINCRONIZANDO:'sincronizando', SINCRONIZADO:'sincronizado', EXCLUINDO:'excluindo', ERRO:'erro' });

export function criarServicoInspecao({ repositorio, usuarioAtual = () => null, aoMudarEstado = () => {} }) {
  if (!repositorio || typeof repositorio.sincronizar !== 'function' || typeof repositorio.excluir !== 'function') {
    throw new TypeError('Repositório da inspeção é obrigatório.');
  }
  if (typeof usuarioAtual !== 'function' || typeof aoMudarEstado !== 'function') {
    throw new TypeError('Dependências do serviço da inspeção são inválidas.');
  }
  let ocupado = false;
  const publicar = (estado, detalhes = {}) => aoMudarEstado(Object.freeze({ estado, ...detalhes }));
  const exigirUsuario = () => {
    const usuario = usuarioAtual();
    if (!usuario) throw new Error('Usuário não autenticado.');
    return usuario;
  };
  const executar = async (estadoInicial, operacao) => {
    if (ocupado) throw new Error('Operação da inspeção já está em andamento.');
    exigirUsuario(); ocupado = true; publicar(estadoInicial);
    try {
      const resultado = await operacao();
      publicar(ESTADOS.SINCRONIZADO, { resultado });
      return resultado;
    } catch (causa) {
      const erro = causa instanceof Error ? causa : new Error(String(causa));
      publicar(ESTADOS.ERRO, { erro });
      throw erro;
    } finally { ocupado = false; }
  };
  return Object.freeze({
    sincronizar: (chave, lista, conhecidos) => executar(ESTADOS.SINCRONIZANDO, () => repositorio.sincronizar(chave, lista, conhecidos)),
    excluir: (chave, id) => executar(ESTADOS.EXCLUINDO, () => repositorio.excluir(chave, id)),
    estaOcupado: () => ocupado,
    estados: ESTADOS
  });
}
