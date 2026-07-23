# HANDOFF

Estado: funcional e verificado localmente (2026-07-14).

## Como subir

```bash
npm run dev  # banco: container postgres-latest (porta 5432)
# ou produção: npm run build && npm start (porta 3001)
```

Admin: `microzapple@gmail.com` — senha definida localmente via
`npm run admin:create -- email senha` (não registrada aqui).

## Atenção

- Banco no container postgres-latest (PG18, :5432, volume nomeado). Se der
  ECONNREFUSED :5432, verifique se o container está de pé (docker ps).
- SMTP não configurado: OTP/link mágico saem no console do servidor.

## Produção (Coolify)

- App "Landing page" no projeto Convictos (coolify.querc.app), domínios
  convictos.querc.app + cardapio.querc.app + url.querc.app, deploy por push
  na main.
- DATABASE_URL aponta para o Postgres do Coolify no VPS (database convictos).
- Após deploy com mudança de schema: `npm run db:schema` no terminal do
  container da app (Coolify → Terminal). Necessário após este deploy (cria
  a tabela `short_links`).

## Usuários

- microzapple@gmail.com é super_admin (fixado no schema.sql, idempotente).
- Só super admin vê a aba Usuários em /admin/ e acessa /api/admin/users.

## Próximos passos possíveis

- Configurar SMTP real no `.env` (produção: variáveis SMTP_* no Coolify).
- Tela de pedidos no admin do cardápio (pendência herdada do cardapio-on).
- Encurtador (aba "Encurtador" no /admin/): já em produção (DNS, SSL e
  db:schema confirmados em 2026-07-23). Falta só um teste manual pelo
  navegador logado, ainda não feito.
