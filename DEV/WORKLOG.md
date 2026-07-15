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

## 2026-07-15 — Categoria Outros no cardápio

- Categoria "Outros" (tema verde-escuro, última posição) via migração de dados
  única em schema.sql, guardada pela nova tabela `schema_marks` — evita que a
  categoria ressuscite a cada deploy se o admin renomear/excluir.

## 2026-07-15 — Fix cardapio.querc.app + gestão de usuários

- **Bug produção:** cardapio.querc.app abria em branco — a reescrita por Host
  em server/index.js mandava `/assets/*` para `/cardapio/assets/*` (inexistente,
  404). Corrigido excluindo `/assets` da reescrita.
- **Banco de produção verificado no Coolify:** DATABASE_URL aponta para
  `postgres://convictos:***@w3s1p13lsf6b9427m5sokej6:5432/convictos` (container
  Postgres do Coolify no VPS). Não há Supabase no projeto — é pg puro.
- **Gestão de usuários:** coluna `role` em admin_users ('admin'|'super_admin'),
  microzapple@gmail.com fixado como super_admin no schema (idempotente).
  Rotas /api/admin/users (CRUD, requireSuperAdmin), aba "Usuários" no /admin/
  visível só para super admin. Proteções: super admin não pode ser excluído,
  ninguém exclui a própria conta.
- Após deploy: rodar `npm run db:schema` no container da app (migra role).

## 2026-07-15 — Deploy: Dockerfile, GitHub e Coolify

- Dockerfile multi-stage (build Vite + runtime node:22-alpine, porta 3001) e
  docker-compose.yml do app para o VPS (banco fica fora — DATABASE_URL via env).
- Push para github.com/ozielguimaraes/convictos (main, d93a614), sem segredos.
- Coolify (coolify.querc.app): projeto "Convictos" criado; recurso "landing
  page" adicionado via GitHub App p-r-d-querc-coolify (build pack Dockerfile,
  branch main, porta 3001, domínios convictos.querc.app e cardapio.querc.app).
- Pendente para o 1º deploy: variáveis no Coolify (DATABASE_URL do Postgres do
  VPS, APP_URL, SMTP_*), criar database/role no Postgres do servidor e rodar
  db:schema + admin:create; DNS dos dois domínios apontando pro VPS.
