export const TIPOS_VALIDOS = new Set(['R','C','G']);
export function idSeguro(valor) {
  return String(valor ?? '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0,180);
}
export function validarNota(nota) { return nota === 'na' || ['0','1','2','3',0,1,2,3].includes(nota); }
export function validarLaudo(laudo) {
  const erros=[];
  if (!String(laudo?.codigo || '').trim()) erros.push('Código do imóvel é obrigatório.');
  if (!TIPOS_VALIDOS.has(laudo?.tipo)) erros.push('Tipo de imóvel inválido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(laudo?.data || ''))) erros.push('Data da inspeção inválida.');
  for (const [item,nota] of Object.entries(laudo?.notas || {})) if (!validarNota(nota)) erros.push(`Nota inválida no item ${item}.`);
  return { valido: erros.length===0, erros };
}
