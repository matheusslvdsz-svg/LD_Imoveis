#!/usr/bin/env node
/**
 * Backup local do Firestore — LD Imóveis
 *
 * Exporta as coleções para arquivos JSON na pasta escolhida.
 * NUNCA versionar o resultado: os arquivos contêm dados reais.
 *
 * Uso:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\chave.json"
 *   node .\scripts\backup-firestore.mjs "C:\Users\voce\iCloudDrive\LD_Backups"
 *
 * Requer:  npm i --no-save firebase-admin
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const COLECOES = [
  'imoveis', 'inquilinos', 'proprietarios', 'contratos', 'historicoContratos',
  'financeiro', 'fechamentos', 'manutencoes', 'eventos',
  'leadsCorretores', 'inspecoes', 'inspecaoImoveis',
  'documentosOficiais', 'documentosContadores', 'auditoriaSistema',
  'usuariosSistema', 'vitrinePublica'
];

const destinoBase = process.argv[2];
if (!destinoBase) {
  console.error('Informe a pasta de destino. Exemplo:');
  console.error('  node .\\scripts\\backup-firestore.mjs "C:\\Users\\voce\\iCloudDrive\\LD_Backups"');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho do arquivo de serviço.');
  console.error('Não cole o conteúdo da chave em chats, documentos ou no repositório.');
  process.exit(1);
}

let admin;
try {
  admin = await import('firebase-admin/app');
} catch {
  console.error('Instale a dependência localmente:  npm i --no-save firebase-admin');
  process.exit(1);
}

const { initializeApp, applicationDefault } = admin;
const { getFirestore } = await import('firebase-admin/firestore');

initializeApp({ credential: applicationDefault(), projectId: 'ld-imoveis' });
const db = getFirestore();

const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const destino = join(destinoBase, 'LD_Firestore_' + carimbo);
mkdirSync(destino, { recursive: true });

let total = 0;
for (const nome of COLECOES) {
  try {
    const snap = await db.collection(nome).get();
    const linhas = snap.docs.map((d) => JSON.stringify({ id: d.id, ...d.data() })).join('\n');
    writeFileSync(join(destino, nome + '.jsonl'), linhas ? linhas + '\n' : '', 'utf8');
    total += snap.size;
    console.log(nome.padEnd(22) + snap.size + ' documento(s)');
  } catch (erro) {
    console.warn(nome.padEnd(22) + 'não exportado: ' + erro.message);
  }
}

writeFileSync(join(destino, '_resumo.txt'),
  'LD Imóveis — backup do Firestore\n' +
  'Data: ' + new Date().toLocaleString('pt-BR') + '\n' +
  'Coleções: ' + COLECOES.length + '\n' +
  'Documentos: ' + total + '\n', 'utf8');

console.log('');
console.log('Backup concluído: ' + destino);
console.log('Documentos exportados: ' + total);
console.log('ATENÇÃO: esta pasta contém dados reais. Não versionar, não enviar por mensagem.');
