# WORKLOG

## 2026-07-14 — Criação do projeto

- Projeto criado do zero: linktree (`/`), avisos (`/avisos/`), admin (`/admin/`),
  cardápio portado do `cardapio-on` (`/cardapio/` e `/cardapio/admin/`).
- API Express + Postgres (container próprio `convictos-pg`, porta 5435).
- Auth: senha + OTP por e-mail + link mágico (mesmo e-mail), sessão em cookie.
- **Incidente:** o database criado no `quercerp-pg-prod` (escolha original do
  maestro) foi destruído minutos depois — aquele container é recriado
  automaticamente com volume anônimo (há outras sessões de agentes na máquina
  gerenciando containers Postgres; o `mastercare-local-postgres` também sumiu).
  Decisão: container dedicado com volume nomeado (`docker-compose.yml`).
- Verificação completa em VERIFY.md.

## 2026-07-15 — Migração para postgres-latest + collation pt-BR

- Banco movido do convictos-pg (removido junto com o docker-compose.yml) para o
  container existente postgres-latest (PG 18, porta 5432, volume nomeado — o
  crash-loop de ontem foi resolvido).
- Database convictos recriado com LOCALE_PROVIDER icu / ICU_LOCALE pt-BR
  (pedido do maestro); role convictos como owner.
- Schema e admin recriados; dados anteriores eram só semente/teste.
- Verificado: ordenação ICU correta (água < Ávila < banana < zebra) e API ok.
