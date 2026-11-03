# LD Imóveis — Notas da versão 1.2.0

Data de preparação: 03/11/2026

## Objetivo

Fortalecer a arquitetura e a segurança do módulo de Inspeção de Imóveis sem alterar sua identidade visual, suas regras funcionais ou os dados de produção.

## Principais entregas

- Núcleo puro para cálculos, classificação, bloqueios, prioridades e controle de frequência.
- Validação isolada de laudos e identificadores.
- Repositório Firestore com dependências injetadas, lotes limitados, `merge`, metadados e exclusão explícita.
- Camada de serviço com autenticação injetada, estados operacionais, tratamento de erros e bloqueio de concorrência.
- Integração gradual do núcleo, repositório e serviço ao módulo existente.
- Remoção de artefatos externos `/cdn-cgi/` e inclusão de favicon local.
- Scanner de segurança e verificação automática de higiene dos HTMLs.
- Testes de Firebase Rules somente no projeto fictício `demo-ld-imoveis-tests`.
- Playwright com servidor local e fixtures fictícias, sem acesso ao Firebase real.

## Validação da release candidate

- 71 testes unitários.
- 34 testes de regras do Firestore.
- 5 testes Playwright.
- 110 testes automatizados no total.
- Builds dos três bundles da Inspeção aprovados.
- Teste visual local aprovado no Painel Gerencial.

## Compatibilidade e operação

- O visual do Painel e da Inspeção foi preservado.
- As coleções e permissões existentes foram preservadas.
- O deploy continua manual.
- Nenhuma publicação automática foi configurada.

## Observação conhecida

O Painel pode registrar no Console um Data URL de imagem inválido proveniente de dado preexistente. O aviso não é causado pela arquitetura da Inspeção e não deve ser corrigido alterando dados reais durante a homologação.
