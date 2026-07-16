-- ============================================================
-- CONVICTOS — schema do Postgres local
-- Rodar com: npm run db:schema (idempotente)
-- Cobre: auth do admin, linktree (profile + links), avisos e
-- o cardápio portado do cardapio-on.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- AUTH ----------

create table if not exists admin_users (
  id serial primary key,
  email text not null unique,
  name text not null default '',
  password_hash text,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now()
);

-- Migração para bancos criados antes da coluna role.
alter table admin_users add column if not exists role text not null default 'admin';

-- Super admin fixo: único que gerencia usuários. Sem password_hash ainda
-- entra por OTP/link mágico.
insert into admin_users (email, role) values ('microzapple@gmail.com', 'super_admin')
  on conflict (email) do update set role = 'super_admin';

create table if not exists sessions (
  token uuid primary key default gen_random_uuid(),
  user_id int not null references admin_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Tokens de login por e-mail: o mesmo registro serve o OTP de 6 dígitos
-- e o link mágico (magic_token), enviados no mesmo e-mail.
create table if not exists login_tokens (
  id serial primary key,
  email text not null,
  code text not null,
  magic_token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- LINKTREE ----------

-- Linha única: título, subtítulo, avatar e tema (cores/cenário) da página inicial.
create table if not exists profile (
  id int primary key default 1 check (id = 1),
  title text not null default 'Convictos',
  subtitle text not null default '',
  avatar_emoji text not null default '✝️',
  theme jsonb not null default '{}'::jsonb
);

create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  emoji text not null default '',
  position int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CARDÁPIO (portado do cardapio-on) ----------

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  theme text not null default 'verde-escuro',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0,
  sold_out boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create sequence if not exists order_number_seq;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  customer_name text not null,
  customer_email text not null default '',
  customer_phone text not null default '',
  total numeric(10, 2) not null,
  status text not null default 'NOVO',
  created_at timestamptz not null default now()
);

-- Itens guardam um SNAPSHOT (nome e preço no momento do pedido), então editar o
-- cardápio depois não altera pedidos já feitos.
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  name text not null,
  unit_price numeric(10, 2) not null,
  quantity int not null,
  subtotal numeric(10, 2) not null,
  position int not null default 0
);

-- ---------- AÇÕES ENTRE AMIGOS ----------

create table if not exists acoes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  number_price numeric(10, 2) not null check (number_price > 0),
  block_size int not null default 10 check (block_size > 0),
  public_ranking boolean not null default false,
  -- No ranking público, por padrão só aparece a posição; a quantidade de
  -- números vendidos é opcional e valores em R$ nunca são expostos.
  show_sold_numbers boolean not null default false,
  created_at timestamptz not null default now()
);

-- Migração para bancos criados antes das colunas do ranking.
alter table acoes add column if not exists public_ranking boolean not null default false;
alter table acoes add column if not exists show_sold_numbers boolean not null default false;

create table if not exists acao_sellers (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid not null references acoes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Bloco de números de um vendedor. Enquanto não entregue (returned = false) o
-- vendedor responde pelo bloco inteiro: pendente = block_size × number_price −
-- received. Depois da entrega, vale o vendido: sold_count × number_price −
-- received (pago, parcial ou não pago).
create table if not exists acao_blocks (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid not null references acoes(id) on delete cascade,
  seller_id uuid not null references acao_sellers(id) on delete cascade,
  start_number int not null check (start_number > 0),
  sold_count int not null default 0 check (sold_count >= 0),
  received numeric(10, 2) not null default 0 check (received >= 0),
  returned boolean not null default false,
  created_at timestamptz not null default now(),
  unique (acao_id, start_number)
);

-- Migração para bancos criados antes da coluna returned.
alter table acao_blocks add column if not exists returned boolean not null default false;

-- Marca migrações de dados já aplicadas: o schema roda a cada subida do
-- container, e sem o marcador um insert "if not exists" ressuscitaria dados
-- que o admin renomeou ou excluiu.
create table if not exists schema_marks (
  name text primary key,
  applied_at timestamptz not null default now()
);

-- ---------- SEMENTES ----------

insert into profile (id) values (1) on conflict (id) do nothing;

-- Links iniciais só se a tabela estiver vazia (não sobrescreve edições do admin).
do $$
begin
  if not exists (select 1 from links) then
    insert into links (label, url, emoji, position) values
      ('Avisos', '/avisos/', '📢', 0),
      ('Cardápio', 'https://cardapio.querc.app', '🍔', 1);
  end if;
end $$;

-- Semente do cardápio (mesma do cardapio-on), só se ainda não houver categorias.
do $$
declare cid uuid;
begin
  if exists (select 1 from categories) then
    return;
  end if;

  insert into categories (name, theme, position) values ('Salgados', 'verde-escuro', 0) returning id into cid;
  insert into items (category_id, name, description, price, position) values
    (cid, 'Pão com pernil', '', 25.0, 0),
    (cid, 'Pastel self-service', 'Monte do seu jeito', 17.0, 1),
    (cid, 'Batata frita', 'Com bacon e cheddar', 15.5, 2),
    (cid, 'Salsichão', '', 8.0, 3),
    (cid, 'Coxinha', 'Frango', 8.0, 4),
    (cid, 'Cachorro quente self-service', 'Monte do seu jeito', 15.0, 5),
    (cid, 'Caldo 250ml', 'Frango', 8.0, 6),
    (cid, 'Caldo 500ml', 'Frango', 15.0, 7);

  insert into categories (name, theme, position) values ('Bebidas', 'laranja', 1) returning id into cid;
  insert into items (category_id, name, description, price, position) values
    (cid, 'Refrigerante 200ml', '', 3.0, 0),
    (cid, 'Suco 200ml', '', 3.5, 1),
    (cid, 'Água sem gás', '', 2.5, 2),
    (cid, 'Água com gás', '', 3.0, 3);

  insert into categories (name, theme, position) values ('Doces', 'verde-claro', 2) returning id into cid;
  insert into items (category_id, name, description, price, position) values
    (cid, 'Bala', '', 0.2, 0),
    (cid, 'Fruit-tella', '', 3.5, 1),
    (cid, 'Halls', '', 2.5, 2),
    (cid, 'Prestígio', '', 4.0, 3),
    (cid, 'Kit Kat', '', 4.5, 4),
    (cid, 'Trento', '', 3.5, 5),
    (cid, 'Trident', '', 3.0, 6),
    (cid, 'Mentos', '', 3.5, 7);
end $$;

-- Categoria Outros (pedido do maestro, 2026-07-15): inserida uma única vez —
-- depois o admin pode renomear ou excluir sem que ela volte a cada deploy.
do $$
begin
  if not exists (select 1 from schema_marks where name = 'cardapio-categoria-outros') then
    insert into categories (name, theme, position)
      select 'Outros', 'verde-escuro', coalesce(max(position) + 1, 0) from categories;
    insert into schema_marks (name) values ('cardapio-categoria-outros');
  end if;
end $$;
