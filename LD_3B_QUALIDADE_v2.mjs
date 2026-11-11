#!/usr/bin/env node
/**
 * LD Imóveis — v2.0.0 — Fase 3B
 * Qualidade e continuidade: integração contínua, changelog, documentação técnica
 * e script de backup local do Firestore.
 *
 * Nada aqui altera a aplicação em produção. São arquivos de apoio ao repositório.
 *
 * Execute na raiz do repositório:  node .\APLICAR_QUALIDADE_3B.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';

const aplicadas = [];
const avisos = [];

function pasta(caminho) {
  if (!existsSync(caminho)) mkdirSync(caminho, { recursive: true });
}

function criar(caminho, conteudo) {
  if (existsSync(caminho)) {
    avisos.push('já existe, mantido sem alteração: ' + caminho);
    return;
  }
  const barra = caminho.lastIndexOf('/');
  if (barra > 0) pasta(caminho.slice(0, barra));
  writeFileSync(caminho, conteudo, 'utf8');
  aplicadas.push(caminho);
}

/* ============================================================
   1. Integração contínua
   ============================================================ */
criar('.github/workflows/validar.yml', `name: Validação

on:
  push:
    branches-ignore:
      - main
  pull_request:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: validar-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  testes:
    name: HTML, unitários e E2E
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Obter o código
        uses: actions/checkout@v4

      - name: Preparar Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Instalar dependências
        run: npm ci || npm install

      - name: Verificar blocos JavaScript do HTML
        run: npm run check:html

      - name: Testes unitários
        run: npm test

      - name: Preparar navegador do Playwright
        run: npx playwright install --with-deps chromium

      - name: Testes de ponta a ponta
        run: npm run test:e2e

      - name: Guardar relatório em caso de falha
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: relatorio-playwright
          path: |
            playwright-report
            test-results
          retention-days: 7

  higiene:
    name: Higiene do repositório
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Obter o código
        uses: actions/checkout@v4

      - name: Conferir espaços e conflitos de merge
        run: |
          git diff --check \$(git rev-list --max-parents=0 HEAD) HEAD
          if git grep -nE '^(<<<<<<<|>>>>>>>|=======)\$' -- .; then
            echo "Marcador de conflito encontrado."; exit 1
          fi

      - name: Procurar credenciais no que foi versionado
        run: |
          if git ls-files | grep -Ei '(\\.pem\$|\\.p12\$|serviceAccount|cofre.*preenchid|backup.*\\.zip\$|\\.env\$)'; then
            echo "Arquivo sensível versionado."; exit 1
          fi
          echo "Nenhum arquivo sensível encontrado."
`);

/* ============================================================
   2. Changelog
   ============================================================ */
criar('CHANGELOG.md', `# Histórico de versões — LD Imóveis

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[versionamento semântico](https://semver.org/lang/pt-BR/).

## [2.0.0] — 15/10/2026 — Edição Documental e Controle Geral

### Adicionado
- Código único e rastreável por documento oficial, no padrão \`LD-{TIPO}-{ANO}-{SEQUENCIAL}\`,
  com sequência independente por tipo e ano e sem reutilização.
- Reserva de código no início do documento, dentro de transação.
- Snapshot histórico imutável do conteúdo emitido.
- Reimpressão do mesmo código, registrada em auditoria sem consumir sequência.
- Cancelamento administrativo com motivo obrigatório e marca \`CANCELADO\`.
- Substituição com novo código e vínculo bidirecional entre original e substituto.
- Checklist completo do laudo residencial, com 81 itens e opção “não se aplica”.
- Bloqueio de emissão de laudo incompleto e bloqueio por item crítico zerado.
- PDF oficial A4 dedicado, paginado, com rodapé institucional e bibliotecas locais
  (jsPDF 2.5.1 e AutoTable 3.8.4 em \`public/vendor/\`).
- Aba **Auditoria e Controle Geral**: indicadores por tipo de ação, filtros por módulo,
  ação e período, coluna de resultado (antes → depois) e exportação CSV e PDF.
- Reversão segura de ações auditadas, com bloqueio explícito quando não há cópia do estado anterior.
- Aba **Pendências**: visão somente leitura do que está atrasado, derivada dos dados existentes.
- Identificação da versão no painel e nos documentos gerados.

### Alterado
- Documentos emitidos deixaram de ter exclusão definitiva; passaram a ter ciclo de vida.
- Auditoria passou a distinguir emissão, reimpressão, cancelamento e substituição.

### Corrigido
- Estado documental do laudo não era persistido após cancelamento ou substituição.
- Reversão de auditoria falhava em silêncio e marcava como revertida uma exclusão sem cópia.
- Reimpressão aparecia em documentos em estado terminal.

### Segurança
- Regras do Firestore protegem documentos oficiais e estados terminais contra alteração e exclusão.
- 58 testes de Rules cobrindo o ciclo documental.

## [1.3.2] — versão anterior

Publicação estável anterior, preservada como referência de rollback.
`);

/* ============================================================
   3. Documentação técnica
   ============================================================ */
criar('docs/QUALIDADE.md', `# Qualidade e validação

## Comandos

| Comando | O que faz |
|---|---|
| \`npm run check:html\` | Valida os blocos JavaScript embutidos nos arquivos HTML |
| \`npm test\` | Testes unitários (Vitest) |
| \`npm run test:rules\` | Testes das regras do Firestore (requer emulador) |
| \`npm run test:e2e\` | Testes de ponta a ponta (Playwright) |
| \`git diff --check\` | Higiene de espaços em branco |

## Integração contínua

O fluxo \`.github/workflows/validar.yml\` roda HTML, unitários e E2E a cada push em branches
e a cada pull request para a \`main\`. Falha bloqueia o merge.

Os testes de **Rules** não rodam no CI por exigirem emulador do Firebase e Java.
Devem ser executados localmente antes de publicar qualquer alteração em \`firestore.rules\`.

## Antes de publicar

1. \`npm run check:html\`
2. \`npm test\`
3. \`npm run test:rules\` (somente se as Rules mudaram)
4. \`npm run test:e2e\`
5. \`git diff --check\`
6. Canal temporário e homologação real
7. \`firebase deploy --only hosting --project ld-imoveis\`

## Contagem de referência da v2.0.0

- 91 testes unitários (71 de inspeção + 20 de pendências)
- 58 testes de Rules
- 26 testes E2E
`);

/* ============================================================
   4. Script de backup local do Firestore
   ============================================================ */
criar('scripts/backup-firestore.mjs', `#!/usr/bin/env node
/**
 * Backup local do Firestore — LD Imóveis
 *
 * Exporta as coleções para arquivos JSON na pasta escolhida.
 * NUNCA versionar o resultado: os arquivos contêm dados reais.
 *
 * Uso:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\caminho\\chave.json"
 *   node .\\scripts\\backup-firestore.mjs "C:\\Users\\voce\\iCloudDrive\\LD_Backups"
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
  console.error('  node .\\\\scripts\\\\backup-firestore.mjs "C:\\\\Users\\\\voce\\\\iCloudDrive\\\\LD_Backups"');
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
    const linhas = snap.docs.map((d) => JSON.stringify({ id: d.id, ...d.data() })).join('\\n');
    writeFileSync(join(destino, nome + '.jsonl'), linhas ? linhas + '\\n' : '', 'utf8');
    total += snap.size;
    console.log(nome.padEnd(22) + snap.size + ' documento(s)');
  } catch (erro) {
    console.warn(nome.padEnd(22) + 'não exportado: ' + erro.message);
  }
}

writeFileSync(join(destino, '_resumo.txt'),
  'LD Imóveis — backup do Firestore\\n' +
  'Data: ' + new Date().toLocaleString('pt-BR') + '\\n' +
  'Coleções: ' + COLECOES.length + '\\n' +
  'Documentos: ' + total + '\\n', 'utf8');

console.log('');
console.log('Backup concluído: ' + destino);
console.log('Documentos exportados: ' + total);
console.log('ATENÇÃO: esta pasta contém dados reais. Não versionar, não enviar por mensagem.');
`);

/* ============================================================
   5. Proteção contra versionamento de dados sensíveis
   ============================================================ */
const GITIGNORE = `
# LD Imóveis — dados e segredos nunca versionados
*.pem
*.p12
serviceAccount*.json
*credenciais*.json
.env
.env.*
LD_Backups/
LD_Firestore_*/
backup*.zip
*cofre*preenchid*
firestore-export*/
test-results/
playwright-report/
`;

if (existsSync('.gitignore')) {
  const atual = readFileSync('.gitignore', 'utf8');
  const faltando = GITIGNORE.trim().split('\n').filter((l) => l && !l.startsWith('#') && !atual.includes(l.trim()));
  if (faltando.length) {
    appendFileSync('.gitignore', '\n# Adicionado na v2.0.0 — proteção de dados sensíveis\n' + faltando.join('\n') + '\n', 'utf8');
    aplicadas.push('.gitignore reforçado (' + faltando.length + ' regras)');
  } else {
    avisos.push('.gitignore já cobria todas as regras');
  }
} else {
  writeFileSync('.gitignore', GITIGNORE.trim() + '\n', 'utf8');
  aplicadas.push('.gitignore criado');
}

console.log('OK: Fase 3B aplicada — integração contínua, changelog, documentação e backup.');
for (const a of aplicadas) console.log(' - ' + a);
for (const a of avisos) console.log(' · ' + a);
