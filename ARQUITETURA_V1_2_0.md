# Arquitetura v1.2.0 — decisão inicial

## Estratégia
Modernização incremental, sem reescrita total. A v1.1.1 permanece imutável em `main`; todo trabalho ocorre em `desenvolvimento/v1.2.0`.

## Camadas iniciadas
- `src/modulos/inspecao/calculos.js`: regras puras e determinísticas.
- `src/modulos/inspecao/validacao.js`: validação e sanitização.
- `tests/unit`: regressão rápida sem navegador.
- `tests/rules`: autorização real contra Firestore Emulator.
- `scripts`: sintaxe dos HTMLs e prevenção de arquivos sensíveis.

## Regra de migração
Nenhum código é removido do HTML antes de existir teste equivalente. A conexão dos novos módulos à interface será feita em commits pequenos e reversíveis.

## Fora desta entrega
- Nenhuma mudança em `public/`.
- Nenhum deploy.
- Nenhuma alteração de Firestore Rules.
- Nenhum acesso a dados reais.
