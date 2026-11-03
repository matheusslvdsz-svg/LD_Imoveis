export const FAIXAS_PADRAO = [
  { min: 90, max: 100, rotulo: 'ÓTIMO' },
  { min: 75, max: 89.99, rotulo: 'BOM' },
  { min: 60, max: 74.99, rotulo: 'REGULAR' },
  { min: 40, max: 59.99, rotulo: 'RUIM' },
  { min: 0, max: 39.99, rotulo: 'CRÍTICO' }
];
export function calcularNota(itens, notas) {
  const avaliados = itens.filter(i => notas[i.id] !== undefined && notas[i.id] !== 'na');
  if (!avaliados.length) return null;
  const soma = avaliados.reduce((total, item) => total + Number(notas[item.id]), 0);
  return (soma / (3 * avaliados.length)) * 100;
}
export function classificarNota(media, faixas = FAIXAS_PADRAO) {
  if (media === null || media === undefined || Number.isNaN(media)) return null;
  return faixas.find(f => media >= f.min && media <= f.max) || faixas.at(-1);
}
export function itensCriticosZerados(itens, notas) {
  return itens.filter(item => item.critico && String(notas[item.id]) === '0');
}
export function estaBloqueado(itens, notas) { return itensCriticosZerados(itens, notas).length > 0; }
export function classificarPrioridade(item, nota) {
  if (Number(nota) === 0) return item.critico ? 'P1' : 'P2';
  if (Number(nota) === 1) return item.critico ? 'P2' : 'P3';
  return null;
}
export function somarDias(iso, dias) {
  const data = new Date(`${iso}T12:00:00`); data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}
export function diasEntre(inicioISO, fimISO) {
  return Math.round((new Date(`${fimISO}T12:00:00`) - new Date(`${inicioISO}T12:00:00`)) / 86400000);
}
export function frequenciaDoImovel(imovel) {
  if (imovel.status === 'obra') return null;
  if (imovel.status === 'ocupado') return 180;
  if (imovel.altoValor) return 15;
  return 30;
}
export function controleDoImovel(imovel, laudos, hojeISO) {
  const ultimo = laudos.filter(l => l.codigo === imovel.codigo && l.data)
    .sort((a,b) => String(b.data).localeCompare(String(a.data)))[0] || null;
  const dias = frequenciaDoImovel(imovel);
  if (dias === null) return { status:'obra', ultimo, dias:null, proxima:null, restam:null, passa:null };
  if (!ultimo) return { status:'sem', ultimo:null, dias, proxima:null, restam:null, passa:null };
  const proxima = somarDias(ultimo.data, dias); const restam = diasEntre(hojeISO, proxima);
  const status = restam < 0 ? 'vencida' : restam <= 7 ? 'avencer' : 'emdia';
  return { status, ultimo, dias, proxima, restam, passa: restam < 0 ? -restam : 0 };
}
