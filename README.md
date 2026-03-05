# MasterList

> A full-stack internal web app for managing large-scale master list data — upload, search, filter, and export Excel/CSV files with up to 500K rows.

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18.x-336791?logo=postgresql)](https://postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

---

## Overview

**MasterList** replaces manual Excel file sharing with a centralized web interface. Data Administrators (DAs) upload Excel or CSV files, and agents search, filter, and export data in real time — all behind Lark SSO with role-based access control.

### Key Features

- **Large file support** — Upload and parse files up to 300 MB / 500K rows
- **Password-protected Excel** — Decrypt & parse `.xlsx` files protected with passwords
- **Real-time search** — Full-text search powered by PostgreSQL GIN indexes (sub-millisecond)
- **Column filtering** — Filter any column with partial/exact match
- **CSV export** — Export filtered results (up to 100K rows) as streaming CSV
- **Role-based access** — Super Admin, Data Admin (DA), and Agent roles
- **Lark SSO** — Single Sign-On via Lark/Larksuite OAuth 2.0 with PKCE
- **Progressive upload** — See preview data after the first 50K rows while upload continues
- **Dark mode** — Full dark/light theme support
- **Audit trail** — Every login, upload, activation, and deletion is logged

### Architecture

```
Browser (React)  ──HTTPS──►  Next.js Server (Node.js)  ──TCP──►  PostgreSQL
                                      │
                                      ▼
                              Local File Storage
                              (./storage/)
```

- **Frontend:** React 18 + Tailwind CSS + Zustand + TanStack Query/Table
- **Backend:** Next.js 14 App Router API routes + `pg` connection pool
- **Database:** PostgreSQL 18 with JSONB storage, GIN indexes, COPY protocol
- **Auth:** Lark OAuth 2.0 + PKCE → JWT (HS256) in httpOnly cookies
- **Process:** PM2 (fork mode, auto-restart, memory limits)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14 (App Router) | Full-stack React framework |
| Language | TypeScript 5.x | Type-safe development |
| Styling | Tailwind CSS 3.4 | Utility-first CSS |
| Database | PostgreSQL 18.x | Primary data store |
| DB Client | pg + pg-copy-streams + pg-cursor | Pool, bulk insert, streaming export |
| Auth | jose (HS256 JWT) | Token signing & verification |
| Excel Parse | ExcelJS (server) / SheetJS (client) | Streaming Excel parsing |
| Encryption | officecrypto-tool | Password-protected Excel decryption |
| State | Zustand 5.x | Global state management |
| Data Fetching | TanStack React Query 5.x | Server state caching |
| Table | TanStack React Table 8.x | Headless table with sorting/filtering |
| Process Mgmt | PM2 | Production process manager |

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: 20.x LTS)
- **PostgreSQL** 15+ (tested: 18.x)
- **Lark Developer Account** with an OAuth app configured

### 1. Clone & Install

```bash
git clone https://github.com/jakemesina/masterlist-app.git
cd masterlist-app
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# PostgreSQL
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/masterlist_db

# Lark OAuth
LARK_APP_ID=cli_your_app_id
LARK_APP_SECRET=your_app_secret
LARK_REDIRECT_URI=http://localhost:3000/api/auth/lark/callback

# JWT (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<random-hex-string>

# Internal API
INTERNAL_API_SECRET=<random-hex-string>

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Database

```bash
psql -U postgres
```

```sql
CREATE DATABASE masterlist_db;
\c masterlist_db

-- Run init script
\i scripts/init_db.sql

-- Run all migrations (001–014)
\i supabase/migrations/001_create_users.sql
\i supabase/migrations/002_create_uploads.sql
\i supabase/migrations/003_create_rows.sql
\i supabase/migrations/004_create_audit_log.sql
\i supabase/migrations/005_rls_policies.sql
\i supabase/migrations/006_bulk_insert_and_array_format.sql
\i supabase/migrations/007_filter_rpc.sql
\i supabase/migrations/008_fix_bulk_insert_locks.sql
\i supabase/migrations/009_fix_duplicates_and_trigger.sql
\i supabase/migrations/010_add_super_admin_role.sql
\i supabase/migrations/011_vector_status_and_search_fallback.sql
\i supabase/migrations/012_security_fixes.sql
\i supabase/migrations/013_staging_table.sql
\i supabase/migrations/014_fix_audit_findings.sql
```

### 4. Configure Lark OAuth

1. Go to [Lark Developer Console](https://open.larksuite.com/)
2. Create an app → note the **App ID** and **App Secret**
3. Under **Security Settings** → add redirect URL: `http://localhost:3000/api/auth/lark/callback`

### 5. Start Development Server

```bash
npm run dev
```

Open **http://localhost:3000** — click "Sign in with Lark" to authenticate. The first user gets the `super_admin` role automatically.

---

## Production Deployment

### Build & Start with PM2

```bash
# Build production bundle
npm run build

# Start with PM2
npm run pm2:start

# Verify
curl http://localhost:3000/api/health
```

### PM2 Commands

| Command | Purpose |
|---------|---------|
| `npm run pm2:start` | Start production server |
| `npm run pm2:stop` | Stop server |
| `npm run pm2:restart` | Restart server |
| `npm run pm2:logs` | View application logs |
| `npm run pm2:monit` | Real-time monitoring dashboard |
| `npm run pm2:status` | Process status |

### Health Check

`GET /api/health` (no auth required) returns:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "checks": { "database": { "status": "ok", "latencyMs": 2 } },
  "memory": { "rss": "470 MB", "heapUsed": "227 MB" }
}
```

---

## Project Structure

```
masterlist-app/
├── ecosystem.config.js            # PM2 configuration
├── scripts/
│   └── init_db.sql                # Database initialization
├── storage/                       # Uploaded files (gitignored)
├── supabase/migrations/           # Database migrations (001–014)
└── src/
    ├── middleware.ts               # Global JWT + RBAC route protection
    ├── app/                       # Next.js pages + API routes
    │   ├── page.tsx               # Dashboard (data table)
    │   ├── upload/page.tsx        # Upload page (DA only)
    │   ├── history/page.tsx       # Upload history
    │   ├── admin/page.tsx         # Admin panel (Super Admin only)
    │   └── api/                   # REST API routes
    │       ├── auth/              # Lark OAuth (lark, callback, logout)
    │       ├── master-list/       # Data (paginated, columns, export)
    │       ├── uploads/           # Upload, activate, delete, vectorize
    │       ├── admin/             # User management, activity log
    │       └── health/            # Health check endpoint
    ├── backend/                   # Server-only code
    │   └── lib/
    │       ├── auth/              # JWT, sessions, middleware
    │       ├── db/                # PostgreSQL pool + query helpers
    │       ├── excel/             # Streaming Excel parser (ExcelJS)
    │       ├── csv/               # Streaming CSV parser (state machine)
    │       ├── security/          # Rate limiting, upload lock, idempotency
    │       └── storage/           # Local file system storage
    ├── frontend/                  # Client-only code
    │   ├── stores/                # Zustand stores (auth, search, upload, UI)
    │   ├── hooks/                 # React Query hooks
    │   ├── lib/                   # Client-side Excel parser (SheetJS)
    │   └── components/            # UI components
    └── shared/                    # Shared types & constants
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/auth/lark` | Public | Initiate Lark OAuth |
| `GET` | `/api/auth/lark/callback` | Public | OAuth callback |
| `POST` | `/api/auth/logout` | Required | Logout |
| `GET` | `/api/me` | Required | Current user info |
| `GET` | `/api/master-list` | Required | Paginated data with search/filter |
| `GET` | `/api/master-list/columns` | Required | Column headers |
| `GET` | `/api/master-list/export` | Required | Streaming CSV export |
| `POST` | `/api/uploads` | DA+ | Upload file (NDJSON progress stream) |
| `GET` | `/api/uploads` | Required | Upload history |
| `DELETE` | `/api/uploads/[id]` | DA+ | Delete upload |
| `POST` | `/api/uploads/[id]/activate` | DA+ | Set active dataset |
| `GET` | `/api/admin/users` | Super Admin | List users |
| `PATCH` | `/api/admin/users` | Super Admin | Update user role |
| `GET` | `/api/admin/activity` | Super Admin | Activity/audit log |
| `GET` | `/api/health` | Public | Health check |

---

## Upload Pipeline

The upload pipeline handles files up to 300 MB with 500K rows efficiently:

```
Client                          Server                         Database
  │                               │                               │
  │  Excel file (≤150MB)          │                               │
  │  ──SheetJS parse──►  CSV      │                               │
  │  ──POST /api/uploads──►       │                               │
  │                               │  Read stream → Buffer          │
  │                               │  Store on disk (≤50MB)         │
  │  ◄──NDJSON progress──         │  Parse in 50K-row batches     │
  │                               │  ──COPY protocol──►  Staging   │
  │  ◄──Preview (10 rows)──       │                               │
  │                               │  ──INSERT SELECT──► Production │
  │  ◄──Complete──                │  Background vectorization      │
```

**Performance:** Peak memory ~500 MB for a 300 MB file (down from ~1.4 GB after OOM optimizations).

---

## Roles & Permissions

| Capability | Agent | DA | Super Admin |
|------------|:-----:|:--:|:-----------:|
| View dashboard & search | ✅ | ✅ | ✅ |
| Export to CSV | ✅ | ✅ | ✅ |
| View upload history | ✅ | ✅ | ✅ |
| Upload files | ❌ | ✅ | ✅ |
| Activate / delete uploads | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| View activity log | ❌ | ❌ | ✅ |

---

## Security

- **OAuth 2.0 + PKCE** — Lark SSO with code exchange protection
- **JWT in httpOnly cookies** — Tokens inaccessible to JavaScript
- **Rate limiting** — Per-user API limits (120 req/min), per-IP auth limits (10 req/min)
- **Parameterized queries** — All SQL uses `$1, $2, ...` parameters
- **MIME type + extension validation** — Defense-in-depth on uploads
- **Path traversal protection** — Storage paths validated against root
- **Security headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Audit logging** — All significant actions recorded

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `next dev` | Development server (8GB heap) |
| `npm run build` | `next build` | Production build |
| `npm run start` | `next start` | Production server (8GB heap) |
| `npm run lint` | `next lint` | ESLint |
| `npm run pm2:start` | PM2 start | Production with process management |
| `npm run pm2:logs` | PM2 logs | View application logs |
| `npm run pm2:monit` | PM2 monitor | Real-time dashboard |

---

## Documentation

- **[DOCUMENTATION.md](DOCUMENTATION.md)** — Full software documentation (19 sections, 1300+ lines)
  - System architecture, database schema, API reference
  - Upload pipeline details, security measures
  - Setup guide, user guide, troubleshooting, glossary
- **[DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md)** — Original development plan with sprint breakdown

---

## License

This is a private internal tool. All rights reserved.
