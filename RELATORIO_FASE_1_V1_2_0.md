# Relatório — v1.2.0 Fase 1

## Resultado
- 33 blocos JavaScript dos HTMLs validados.
- 39 testes unitários aprovados.
- 34 testes de regras aprovados no Firestore Emulator.
- 73 testes automatizados no total.
- Scanner de arquivos e padrões sensíveis aprovado.
- Fixtures exclusivamente sintéticas.

## Segurança da execução
Os testes de regras usam `demo-ld-imoveis-tests`; tentativas de acessar serviços não emulados falham. Nenhum teste acessa `ld-imoveis` nem dados reais.

## Dependências
Dependências são apenas de desenvolvimento e não entram em `public/` nem no Hosting. O `npm audit` ainda aponta avisos transitivos no ecossistema Firebase de testes; não foi aplicado `--force`, pois isso sugeriria versões incompatíveis e poderia quebrar a suíte. As versões estão travadas no `package-lock.json` e devem ser revisadas periodicamente.

## Próxima fase proposta
Extrair do HTML as funções de cálculo já testadas, conectar via módulo ES e comparar o comportamento visual no emulador, sem deploy.
