# Convictos

Full-stack hub application (link tree + announcement board + menu management) served at **https://convictos.querc.app** and **https://cardapio.querc.app**.

## Overview

Convictos is a modern web application built with Node.js backend and React frontend, deployed on VPS via Docker and Coolify. The project demonstrates end-to-end architecture, from database design through production deployment, with a focus on security, modularity, and developer experience.

**Live URLs:**
- Main hub: https://convictos.querc.app
- Cardápio (menu) subdomain: https://cardapio.querc.app

## Tech Stack

| Layer | Tech |
|---|---|
| **Backend** | Node.js + Express (ES6 modules) |
| **Frontend** | React 18 + Vite |
| **Database** | PostgreSQL 18 (collation: `pt-BR` ICU) |
| **Authentication** | Password + OTP (6-digit code) + Magic link, bcryptjs, httpOnly cookies (30-day session) |
| **Email** | Nodemailer (console fallback in dev, SMTP in prod) |
| **Infrastructure** | Docker, Coolify, VPS |
| **Process management** | concurrently (dev mode) |

## Project Structure

```
convictos/
├── server/                    # Express API
│   ├── index.js              # Entry point, route mounting, static serving
│   ├── auth.js               # Authentication logic (password, OTP, magic link)
│   ├── db.js                 # Database connection pool
│   ├── mail.js               # Email sending (Nodemailer)
│   ├── permissions.js        # Authorization helpers
│   ├── schema.sql            # Database schema and seeds
│   ├── scripts/
│   │   ├── run-schema.js     # Initialize DB (idempotent)
│   │   └── create-admin.js   # Create admin user
│   └── routes/               # API endpoints
│       ├── convictos.js      # Hub (links, appearance, announcements)
│       ├── cardapio.js       # Menu CRUD
│       ├── acoes.js          # Actions/analytics (optional)
│       └── accessProfiles.js # Role-based access
├── src/                      # React frontend (Vite)
│   ├── pages/
│   │   ├── home.jsx         # Main hub (public)
│   │   ├── avisos.jsx       # Announcements board (public)
│   │   ├── admin/           # Admin dashboard (protected)
│   │   ├── cardapio/        # Menu display (public)
│   │   └── cardapio/admin/  # Menu editor (protected)
│   └── ...
├── dist/                     # Vite build output (production)
├── package.json
├── vite.config.js           # Vite configuration
├── Dockerfile               # Multi-stage: build + serve
├── docker-compose.yml       # Docker Compose (app container)
└── .env.example             # Environment variables template
```

## Features

### Public Pages
- **Hub** (`/`) — title, avatar, theme toggle, clickable links (Linktree-style)
- **Announcements** (`/avisos/`) — public bulletin board
- **Menu** (`/cardapio/`) — displays current menu items (ported from cardapio-on)

### Admin Panel (`/admin/`)
Protected by authentication (password, OTP, or magic link):
- **Links** — CRUD for hub links
- **Appearance** — theme, avatar, title
- **Announcements** — manage bulletin board
- **Menu Editor** (`/cardapio/admin/`) — add/edit/delete menu items

### Multi-Tenant Domain Routing
- Both `convictos.querc.app` and `cardapio.querc.app` point to the same backend
- Express rewrites `cardapio.*` requests to `/cardapio/` paths
- Shared asset cache (`/assets`) across both domains

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 18 (running, e.g., in `postgres-latest` container)

### Local Development

1. **Clone & install:**
   ```bash
   cd convictos
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and SMTP (optional)
   ```

3. **Initialize database (once):**
   ```bash
   npm run db:schema
   ```

4. **Create admin user:**
   ```bash
   npm run admin:create -- your@email.com yourpassword "Your Name"
   ```
   In dev mode, OTP codes and magic links print to console.

5. **Start dev server:**
   ```bash
   npm run dev
   ```
   - API: http://localhost:3001
   - Frontend (Vite): http://localhost:5173
   - Vite proxies `/api/*` requests to the backend

### Production Build

```bash
npm run build      # Vite outputs to dist/
npm start          # Express serves API + static files from dist/ on port 3001
```

The Dockerfile handles this: builds React, then runs Node.js to serve both.

## Deployment

### On VPS (Coolify)

1. **Docker build & push** (or let Coolify auto-build from git)

2. **Database setup (one time):**
   - Create a PostgreSQL role and database with `pt-BR` ICU collation:
     ```bash
     psql -U postgres -c "CREATE ROLE convictos LOGIN PASSWORD 'convictos_dev'"
     psql -U postgres -c "CREATE DATABASE convictos OWNER convictos TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'pt-BR'"
     ```
   - Run migrations from container or local machine:
     ```bash
     npm run db:schema
     npm run admin:create -- your@email.com yourpassword "Your Name"
     ```

3. **Environment variables in Coolify:**
   - `DATABASE_URL` — e.g., `postgres://convictos:password@postgres:5432/convictos` (use `host.docker.internal` if Postgres runs on host)
   - `APP_URL` — e.g., `https://convictos.querc.app` (used in magic links)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — for real email sending
   - `NODE_ENV` — `production`
   - `PORT` — `3001` (Coolify exposes via reverse proxy)

4. **DNS & Reverse Proxy:**
   - Point `convictos.querc.app` and `cardapio.querc.app` to the same service
   - Coolify (or nginx) terminates HTTPS; Express runs on port 3001
   - Let's Encrypt auto-provisioning can be set up in Coolify

## Authentication & Security

- **Passwords:** bcryptjs with salt rounds configured in `server/auth.js`
- **Sessions:** httpOnly cookies (30 days), cannot be accessed by JavaScript
- **OTP:** 6-digit codes sent via email (or printed in dev console)
- **Magic links:** One-time URLs sent via email; validate and create session on click
- **Permissions:** Role-based access via `accessProfiles.js` (admin, viewer, etc.)

In dev mode (no SMTP), codes and links are **printed to console** for easy testing.

## API Endpoints

### Authentication
- `POST /api/auth/login` — password, OTP, or magic link request
- `POST /api/auth/logout` — clear session
- `GET /api/auth/me` — current user (if logged in)

### Hub (Convictos)
- `GET /api/convictos` — public hub data (title, avatar, links, appearance)
- `POST /api/convictos/links` — add link (admin only)
- `PUT /api/convictos/links/:id` — update link (admin)
- `DELETE /api/convictos/links/:id` — delete link (admin)
- (Similar CRUD for announcements, appearance)

### Menu (Cardápio)
- `GET /api/cardapio` — list menu items
- `POST /api/cardapio` — add menu item (admin)
- `PUT /api/cardapio/:id` — update (admin)
- `DELETE /api/cardapio/:id` — delete (admin)

### Health
- `GET /api/health` — simple health check (returns `{ ok: true }`)

## Database Schema

The `schema.sql` file defines:
- `users` — admin accounts (email, password hash, role)
- `sessions` — active sessions (user_id, token, expires_at)
- `convictos_links` — hub links (title, url, icon, order)
- `convictos_appearance` — hub theme (title, avatar_url, theme_color)
- `avisos` — announcements (title, content, created_at, active)
- `cardapio_itens` — menu items (name, description, price, category, image)
- (and more)

All tables are designed with proper indexes and constraints. Collation is `pt-BR` (Unicode, case-insensitive for Portuguese).

## Development Workflow

### Scripts
- `npm run dev` — start both API (port 3001) and Vite (port 5173) concurrently
- `npm run dev:api` — API only
- `npm run dev:web` — Vite only
- `npm run build` — Vite production build
- `npm run preview` — preview production build locally
- `npm start` — production server (Node.js only)
- `npm run db:schema` — initialize database
- `npm run admin:create` — create admin user

### Environment Variables
See `.env.example` for all available options:
- `NODE_ENV` — `development` or `production`
- `PORT` — server port (default: 3001)
- `DATABASE_URL` — PostgreSQL connection string
- `APP_URL` — public URL (for magic links)
- `SMTP_*` — email configuration (optional in dev)

## Notes

- **No TypeScript:** Project uses vanilla JavaScript (ES6 modules).
- **No test framework:** Currently no automated tests; can be added (Jest, Vitest, etc.).
- **Single codebase:** Both domains served from the same build via request rewriting.
- **Idempotent migrations:** `npm run db:schema` can run multiple times safely.
- **Stateless API:** Sessions stored in database (or can be moved to Redis if needed).

## References

- Original **cardapio-on** project ported to this stack (Supabase → Express + Postgres)
- Deployed on **Coolify** (PaaS) on VPS
- Built with **AI-assisted development** (Claude, code review & iteration)

## License

Private project.
