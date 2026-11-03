# LD Imóveis v1.2.0 — fundação de testes

Fase inicial sem alteração do comportamento de produção. O código em `src/` modela regras puras da Inspeção para testes e futura extração controlada do HTML.

## Comandos
- `npm ci` — instala versões travadas.
- `npm run validate:fast` — sintaxe dos HTMLs, segurança e testes unitários.
- `npm run test:rules` — inicia Firestore Emulator e testa as regras.
- `npm run validate` — validação completa.

## Segurança
Fixtures usam somente dados sintéticos. Nenhum teste acessa o projeto `ld-imoveis`; os testes de regras usam `demo-ld-imoveis-tests` no emulador.

## Próxima fase
Conectar gradualmente `src/modulos/inspecao` ao HTML, um conjunto de funções por commit, mantendo comparação visual e testes de regressão.
