# Convictos

Hub de links (estilo Linktree) em `convictos.querc.app`, com mural de avisos,
painel administrativo e o **Cardápio ON** portado do projeto `cardapio-on`
(servido em `cardapio.querc.app` pelo mesmo backend).

## Stack

- **Front:** React 18 + Vite, cinco entradas:
  - `/` — página inicial estilo linktree (título, avatar, tema e links editáveis)
  - `/avisos/` — mural de avisos público
  - `/admin/` — painel (abas Links, Aparência, Avisos)
  - `/cardapio/` — cardápio do cliente (portado do cardapio-on)
  - `/cardapio/admin/` — editor do cardápio
- **API:** Express (`server/`) com Postgres via `pg` (sem Supabase)
- **Banco:** Postgres 18 no container existente `postgres-latest` (porta 5432),
  database `convictos` com collation padrão ICU `pt-BR`
- **Auth do admin:** senha (bcrypt) **ou** código OTP de 6 dígitos **ou** link
  mágico — código e link chegam no mesmo e-mail. Sessão de 30 dias em cookie
  httpOnly. Sem SMTP configurado, código/link são impressos no console do
  servidor (modo dev).

## Setup (uma vez)

```bash
# no container postgres-latest, criar role e database com collation pt-BR:
docker exec postgres-latest psql -U postgres -c "CREATE ROLE convictos LOGIN PASSWORD 'convictos_dev'"
docker exec postgres-latest psql -U postgres -c "CREATE DATABASE convictos OWNER convictos TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'pt-BR' LOCALE 'en_US.utf8'"

cp .env.example .env          # ajuste se necessário
npm install
npm run db:schema             # cria tabelas e sementes (idempotente)
npm run admin:create -- seu@email.com suasenha "Seu Nome"
```

## Rodar em desenvolvimento

```bash
npm run dev                   # API em :3001 + Vite em :5173 (proxy /api)
```

## Produção

```bash
npm run build                 # gera dist/
npm start                     # Express serve API + dist na porta 3001
```

O servidor reescreve requisições com `Host: cardapio.*` para as páginas de
`/cardapio/` — aponte os dois domínios (`convictos.querc.app` e
`cardapio.querc.app`) para o mesmo serviço no reverse proxy.

Para envio real de e-mail (OTP/link mágico), preencha `SMTP_*` e `APP_URL`
no `.env`.

## Deploy no VPS (Coolify)

O repositório tem `Dockerfile` (build do Vite + Node servindo API e estáticos
na porta 3001) e `docker-compose.yml` para o app — o banco **não** sobe no
compose: a app usa o Postgres já existente no servidor.

No Coolify, defina as variáveis de ambiente (nunca commitadas):

- `DATABASE_URL` — ex.: `postgres://usuario:senha@host.docker.internal:5432/convictos`
  (o compose já mapeia `host.docker.internal` para o host do VPS)
- `APP_URL` — `https://convictos.querc.app` (usada nos links mágicos)
- `SMTP_HOST/PORT/USER/PASS/FROM` — para envio real do e-mail de login

No banco do servidor, crie o database uma vez (collation pt-BR) e rode o
schema/admin de dentro do container ou de qualquer máquina com acesso:

```bash
npm run db:schema
npm run admin:create -- seu@email.com suasenha "Seu Nome"
```

## Diferenças em relação ao cardapio-on

- Supabase substituído por Express + Postgres local; as funções `replace_menu`
  e `create_order` viraram rotas com transação (mesma semântica: atualização
  pelo id preserva carrinhos abertos; pedidos com número único via sequence).
- Supabase Realtime substituído por polling de 30s + recarga ao focar a aba.
- Login OTP do Supabase Auth substituído pelo auth próprio (compartilhado com
  o painel do convictos — uma sessão vale para os dois admins).

## Banco de dados

O projeto usa o container `postgres-latest` (PG 18, porta 5432, volume nomeado
`postgres-latest-data`). Para apontar para outro Postgres, basta trocar
`DATABASE_URL` no `.env` e rodar `npm run db:schema`. Evite containers com
volume anônimo — nesta máquina eles já foram recriados perdendo os dados.
