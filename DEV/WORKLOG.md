# WORKLOG

## 2026-07-16 — Cardápio do cliente: busca + topo fixo

- Bug de usabilidade: .nav era sticky mas o header (sticky, z-index maior)
  cobria as pílulas ao rolar. Agora a marca rola com a página e um .topbar
  fixo concentra busca + categorias.
- Busca de produtos por nome/descrição, sem acento/caixa; categorias sem
  resultado somem da lista e das pílulas; estado "nada encontrado" e botão ✕.

## 2026-07-16 — Cardápio como seção do painel

- Editor do cardápio extraído para src/cardapio/admin/MenuEditor.jsx e usado
  em dois lugares: a nova seção "Cardápio" na sidebar do /admin/ (navegação
  interna igual às demais seções) e a página standalone /cardapio/admin/,
  que continua servindo o domínio cardapio.* sem mudanças.

## 2026-07-16 — URL RESTful do ranking (/rifa/<id>)

- Regra do maestro (agora global em ~/.orquestrador/rules.md): sempre padrão
  RESTful — recurso no caminho, nunca query string.
- /rifa/<id> vira a URL canônica (rewrite no Express e no dev server do Vite;
  o front lê o id do pathname). O formato antigo ?id= segue aceito para não
  quebrar links já compartilhados. Links do admin e da lista pública atualizados.

## 2026-07-16 — Permissões granulares (Ver/Editar por área)

- Cada área do catálogo virou "<area>:view" e "<area>:manage" (manage implica
  view — expansão em expandPermissions). GETs exigem :view; mutações, :manage.
- Migração automática no schema: permissões antigas sem nível viram :manage
  (era o comportamento anterior). Gestor migrado sem intervenção.
- UI: menu entra com :view; sem :manage a seção fica somente leitura (banner
  "👁", formulários desabilitados via fieldset, botões de criação/exclusão
  ocultos; em ações a navegação para o detalhe continua). Cardápio admin idem.
- Novo PermissionPicker (chips Ver/Editar por área) usado em Perfis e nos
  acessos extras de Usuários.

## 2026-07-16 — Níveis de acesso dinâmicos (RBAC)

- Catálogo de permissões em server/permissions.js (links, aparencia, avisos,
  acoes, cardapio, usuarios, perfis). Tabela `access_profiles` (nome distinto
  da `profile` do linktree) + `profile_id`/`extra_permissions` em admin_users.
- Permissões efetivas = perfil ∪ extras; super admin tem tudo (fixo).
  requirePermission(...keys) guarda cada grupo de rotas; /me devolve as
  permissões e o front monta o menu a partir disso (cardápio admin idem).
- Perfil **Gestor** semeado: tudo exceto `perfis`. Regras: ninguém cria super
  admin (role nunca vem do payload); só o super admin altera a própria conta;
  quem não é super admin não concede `perfis` (nem extra, nem via perfil).
- Telas: "Perfis de acesso" (chips por permissão, contagem de usuários) e
  Usuários reformulada (select de perfil + acessos extras por usuário).

## 2026-07-15 — Ranking público: só posição por padrão

- Por padrão o /rifa/ mostra apenas posição e nome (pódio e tabela).
- Nova flag `show_sold_numbers` por ação (pill "🔢 Mostrar números vendidos"
  no admin, visível quando o ranking é público) libera a quantidade vendida.
- Valores em R$ removidos da página e da API pública em qualquer modo.

## 2026-07-15 — Ranking público da ação (/rifa/)

- Flag `public_ranking` na ação (criação e edição via pill no admin, com link
  para a página quando ativo).
- Página pública `/rifa/?id=<acao>`: pódio dos top 3 + tabela dos demais
  (empates dividem posição — 1, 2, 2, 4). Sem id, lista as ações públicas.
- API pública só expõe nome e vendas (nunca recebido/pendente); ação privada
  responde 404. Nova entrada `rifa` no Vite; estilos em public.css com o tema
  do admin.

## 2026-07-15 — Ciclo de entrega dos blocos

- Bloco agora tem estado `returned` (pegou → entregou). Enquanto está com o
  vendedor, o pendente é o bloco inteiro − recebido; após a entrega vale o
  vendido − recebido (status derivado: pago / pagamento parcial / não pago).
- Bloco recém-adicionado nasce "com o vendedor" (pendente cheio), regra do
  maestro. Agregados da listagem calculam o pendente por bloco no SQL.

## 2026-07-15 — Sidebar no admin + ações entre amigos

- **Layout:** /admin/ migrado de abas horizontais para navegação lateral
  (gaveta no mobile, fixa ≥900px), preparado para novas seções. Admin.jsx
  virou shell; cada seção vive em src/admin/sections/. CSS novo escopado em
  `#root.admin-root` para não afetar o admin do cardápio (mesmo admin.css).
- **Ações entre amigos:** ação (nome + valor do número + números por bloco,
  padrão 10) → vendedores → blocos (número inicial, vendidos, recebido).
  Vendido/pendente sempre calculados (sold_count × number_price − received),
  nunca gravados. Tabelas acoes/acao_sellers/acao_blocks; rotas em
  server/routes/acoes.js (requireAdmin). Blocos da mesma ação não podem se
  sobrepor (409) e vendidos ≤ tamanho do bloco (400).

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
