# Qualidade e validação

## Comandos

| Comando | O que faz |
|---|---|
| `npm run check:html` | Valida os blocos JavaScript embutidos nos arquivos HTML |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:rules` | Testes das regras do Firestore (requer emulador) |
| `npm run test:e2e` | Testes de ponta a ponta (Playwright) |
| `git diff --check` | Higiene de espaços em branco |

## Integração contínua

O fluxo `.github/workflows/validar.yml` roda HTML, unitários e E2E a cada push em branches
e a cada pull request para a `main`. Falha bloqueia o merge.

Os testes de **Rules** não rodam no CI por exigirem emulador do Firebase e Java.
Devem ser executados localmente antes de publicar qualquer alteração em `firestore.rules`.

## Antes de publicar

1. `npm run check:html`
2. `npm test`
3. `npm run test:rules` (somente se as Rules mudaram)
4. `npm run test:e2e`
5. `git diff --check`
6. Canal temporário e homologação real
7. `firebase deploy --only hosting --project ld-imoveis`

## Contagem de referência da v2.0.0

- 91 testes unitários (71 de inspeção + 20 de pendências)
- 58 testes de Rules
- 26 testes E2E
