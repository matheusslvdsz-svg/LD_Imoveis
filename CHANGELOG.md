# Histórico de versões — LD Imóveis

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[versionamento semântico](https://semver.org/lang/pt-BR/).

## [2.0.0] — 15/10/2026 — Edição Documental e Controle Geral

### Adicionado
- Código único e rastreável por documento oficial, no padrão `LD-{TIPO}-{ANO}-{SEQUENCIAL}`,
  com sequência independente por tipo e ano e sem reutilização.
- Reserva de código no início do documento, dentro de transação.
- Snapshot histórico imutável do conteúdo emitido.
- Reimpressão do mesmo código, registrada em auditoria sem consumir sequência.
- Cancelamento administrativo com motivo obrigatório e marca `CANCELADO`.
- Substituição com novo código e vínculo bidirecional entre original e substituto.
- Checklist completo do laudo residencial, com 81 itens e opção “não se aplica”.
- Bloqueio de emissão de laudo incompleto e bloqueio por item crítico zerado.
- PDF oficial A4 dedicado, paginado, com rodapé institucional e bibliotecas locais
  (jsPDF 2.5.1 e AutoTable 3.8.4 em `public/vendor/`).
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
