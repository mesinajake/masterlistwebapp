# MasterList Web App — Software Documentation

> **Version:** 0.1.0  
> **Last Updated:** March 5, 2026  
> **Status:** Production-Ready (Internal Tool)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Purpose & Problem Statement](#2-purpose--problem-statement)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Project Structure](#5-project-structure)
6. [Database Schema](#6-database-schema)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [API Reference](#8-api-reference)
9. [Upload Pipeline](#9-upload-pipeline)
10. [Storage System](#10-storage-system)
11. [Search & Filtering](#11-search--filtering)
12. [Frontend Architecture](#12-frontend-architecture)
13. [Security Measures](#13-security-measures)
14. [Environment Configuration](#14-environment-configuration)
15. [Setup & Installation](#15-setup--installation)
16. [Production Deployment & Process Management](#16-production-deployment--process-management)
17. [User Guide](#17-user-guide)
18. [Troubleshooting](#18-troubleshooting)
19. [Glossary](#19-glossary)

---

## 1. Introduction

**MasterList** is an internal web application designed for managing large-scale master list data files. It provides a secure, role-based platform where data administrators (DAs) can upload Excel/CSV files containing hundreds of thousands of rows, and agents can search, filter, and export that data in real time.

The application replaces manual spreadsheet sharing workflows with a centralized web interface that supports:
- Files up to **300 MB** with up to **500,000 rows**
- Password-protected Excel files
- Real-time full-text search with sub-second response times
- Role-based access control (Super Admin, DA, Agent)
- Single Sign-On via **Lark (Larksuite)** OAuth
- Dark mode and responsive design

---

## 2. Purpose & Problem Statement

### Problem
Organizations managing large datasets (e.g., employee directories, inventory lists, contact databases) often rely on sharing Excel files manually. This creates:
- **Version control issues** — multiple copies floating around
- **Access control gaps** — anyone with the file has full access
- **Performance limitations** — Excel struggles with 300K+ rows
- **No searchability** — finding specific records requires scrolling

### Solution
MasterList provides:
- A **single source of truth** — one active dataset at a time
- **Role-based access** — DAs upload and manage; Agents can only view/search
- **Instant search** — PostgreSQL full-text search with GIN indexes
- **Upload history** — track who uploaded what and when
- **Audit trail** — every action (login, upload, activate) is logged

---

## 3. Tech Stack

### Core Framework
| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 14.2.35 | Full-stack React framework (App Router) |
| **React** | 18.x | UI component library |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Tailwind CSS** | 3.4.x | Utility-first CSS styling |

### Backend & Database
| Technology | Version | Purpose |
|---|---|---|
| **PostgreSQL** | 18.x | Primary database |
| **pg (node-postgres)** | 8.19.x | PostgreSQL client |
| **pg-copy-streams** | 7.x | High-performance COPY protocol for bulk inserts |
| **pg-cursor** | 2.18.x | Cursor-based streaming for CSV export |
| **jose** | 6.x | JWT signing & verification (HS256) |

### Data Parsing
| Technology | Version | Purpose |
|---|---|---|
| **ExcelJS** | 4.4.x | Server-side streaming Excel parser |
| **SheetJS (xlsx)** | 0.18.x | Client-side Excel parser (browser) |
| **officecrypto-tool** | 0.0.19 | Password-protected Excel decryption |

### State Management & Data Fetching
| Technology | Version | Purpose |
|---|---|---|
| **Zustand** | 5.x | Lightweight global state management |
| **TanStack React Query** | 5.x | Server state caching & data fetching |
| **TanStack React Table** | 8.x | Headless table with sorting, filtering |

### Utilities
| Technology | Version | Purpose |
|---|---|---|
| **Zod** | 4.x | Runtime schema validation |
| **Sonner** | 2.x | Toast notifications |
| **clsx / tailwind-merge** | — | Conditional CSS class composition |

### Process Management
| Technology | Version | Purpose |
|---|---|---|
| **PM2** | latest | Production process manager (auto-restart, logging, monitoring) |

### Dev & Testing
| Technology | Version | Purpose |
|---|---|---|
| **Vitest** | 4.x | Unit test runner |
| **Playwright** | 1.58.x | End-to-end browser testing |
| **Testing Library** | 16.x | React component testing |
| **ESLint** | 8.x | Code linting |
| **Prettier** | 3.x | Code formatting (with Tailwind plugin) |

---

## 4. System Architecture

### High-Level Flow

```
┌──────────────┐     HTTPS      ┌───────────────────┐     TCP      ┌──────────────┐
│              │  ◄──────────►  │                   │  ◄────────►  │              │
│   Browser    │                │   Next.js Server  │              │  PostgreSQL  │
│   (React)    │                │   (Node.js)       │              │  Database    │
│              │                │                   │              │              │
└──────────────┘                └───────────────────┘              └──────────────┘
                                        │
                                        ▼
                                ┌───────────────────┐
                                │   Local Storage   │
                                │   ./storage/      │
                                │   (File System)   │
                                └───────────────────┘
```

### Request Flow

```
Browser → Next.js Middleware (JWT verify) → API Route (role check) → Database → Response
```

### Upload Pipeline Flow

```
User → Client-side Parse (Excel→CSV) → Server Upload (NDJSON stream)
     → Parse CSV → COPY into Staging Table → Move to Production Table
     → Background Vectorization → Complete
```

---

## 5. Project Structure

```
masterlist-app/
├── .env.local                    # Environment variables (gitignored)
├── .env.example                  # Template for environment setup
├── .gitignore                    # Git ignore rules
├── next.config.mjs               # Next.js configuration + security headers
├── package.json                  # Dependencies and scripts
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
│
├── scripts/
│   └── init_db.sql               # Database initialization script
│
├── storage/                      # Local file storage (gitignored)
│   └── master-list-files/        # Uploaded files (≤50MB stored)
│
├── supabase/
│   └── migrations/               # Database migrations (001–014)
│       ├── 001_create_users.sql
│       ├── 002_create_uploads.sql
│       ├── 003_create_rows.sql
│       ├── 004_create_audit_log.sql
│       ├── 005_rls_policies.sql
│       ├── 006_bulk_insert_and_array_format.sql
│       ├── 007_filter_rpc.sql
│       ├── 008_fix_bulk_insert_locks.sql
│       ├── 009_fix_duplicates_and_trigger.sql
│       ├── 010_add_super_admin_role.sql
│       ├── 011_vector_status_and_search_fallback.sql
│       ├── 012_security_fixes.sql
│       ├── 013_staging_table.sql
│       └── 014_fix_audit_findings.sql
│
└── src/
    ├── middleware.ts              # Global route protection (JWT + RBAC)
    │
    ├── app/                      # Next.js App Router pages + API routes
    │   ├── layout.tsx            # Root layout with providers
    │   ├── page.tsx              # Dashboard (Master List table)
    │   ├── login/page.tsx        # Login page
    │   ├── upload/page.tsx       # Upload page (DA-only)
    │   ├── history/page.tsx      # Upload history page
    │   ├── settings/page.tsx     # User settings page
    │   ├── admin/page.tsx        # Admin panel (Super Admin only)
    │   └── api/
    │       ├── me/route.ts               # GET — current user info
    │       ├── auth/
    │       │   ├── lark/route.ts          # GET — initiate Lark OAuth
    │       │   ├── lark/callback/route.ts # GET — Lark OAuth callback
    │       │   └── logout/route.ts        # POST — logout
    │       ├── master-list/
    │       │   ├── route.ts               # GET — paginated data
    │       │   ├── columns/route.ts       # GET — column headers
    │       │   └── export/route.ts        # GET — CSV export
    │       ├── uploads/
    │       │   ├── route.ts               # GET/POST — list + upload
    │       │   └── [id]/
    │       │       ├── route.ts           # DELETE — delete upload
    │       │       ├── activate/route.ts  # POST — activate upload
    │       │       └── vectorize/route.ts # POST/GET — background vectors
    │       └── admin/
    │           ├── users/route.ts         # GET/PATCH — user management
    │           └── activity/route.ts      # GET — activity log
    │
    ├── backend/                  # Server-only code (never sent to browser)
    │   └── lib/
    │       ├── auth/
    │       │   ├── jwt.ts        # JWT sign/verify (HS256, jose)
    │       │   ├── session.ts    # Cookie-based session management
    │       │   └── middleware.ts # requireAuth / requireDA / requireSuperAdmin
    │       ├── db/
    │       │   └── index.ts      # PostgreSQL pool + query helpers
    │       ├── excel/
    │       │   └── parser.ts     # Streaming Excel parser (ExcelJS)
    │       ├── csv/
    │       │   └── parser.ts     # Streaming CSV parser (state machine)
    │       ├── lark/
    │       │   └── oauth.ts      # Lark OAuth + PKCE helpers
    │       ├── security/
    │       │   ├── rate-limit.ts    # In-memory sliding window rate limiter
    │       │   ├── upload-lock.ts   # Upload mutex (single upload at a time)
    │       │   └── idempotency.ts   # Idempotency token store
    │       ├── storage/
    │       │   └── index.ts      # Local file system storage
    │       └── utils/
    │           ├── errors.ts     # Typed error classes (AppError, etc.)
    │           └── uuid.ts       # UUID validation utility
    │
    ├── frontend/                 # Client-only code
    │   ├── lib/
    │   │   └── client-excel-parser.ts  # Browser-side Excel→CSV parser
    │   ├── stores/
    │   │   ├── authStore.ts      # Auth state (user info, login status)
    │   │   ├── searchStore.ts    # Search query, filters, pagination
    │   │   ├── uploadStore.ts    # Upload progress, preview, errors
    │   │   └── uiStore.ts       # UI state (dark mode, sidebar)
    │   ├── hooks/
    │   │   ├── useAuth.ts        # Authentication hook
    │   │   ├── useUpload.ts      # Upload mutation with NDJSON streaming
    │   │   ├── useUploadHistory.ts # Upload history query
    │   │   ├── useMasterList.ts  # Master list data query
    │   │   ├── useColumns.ts     # Column headers query
    │   │   ├── useSearch.ts      # Search with debounce
    │   │   └── useExport.ts      # CSV export hook
    │   └── components/
    │       ├── auth/             # AuthGuard, RoleGuard, LarkLoginButton
    │       ├── layout/           # Header, SearchBar, UserMenu
    │       ├── dashboard/        # MasterListTable, TableToolbar, ColumnFilter
    │       ├── upload/           # UploadForm, PreviewTable, UploadConfirm
    │       ├── history/          # HistoryTable, ConfirmDeleteModal
    │       └── ui/               # Shared: Button, Input, Modal, Badge, etc.
    │
    └── shared/                   # Code shared between frontend + backend
        ├── types/
        │   ├── user.ts           # User, UserRole types
        │   └── upload.ts         # Upload, UploadPreview, UploadProgress types
        └── utils/
            └── constants.ts      # App constants (limits, defaults)
```

---

## 6. Database Schema

### Tables

#### `users`
Stores all authenticated users. Created automatically on first Lark login.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | Primary key |
| `lark_user_id` | TEXT | UNIQUE, NOT NULL | Lark SSO identifier |
| `name` | TEXT | NOT NULL | Display name from Lark |
| `email` | TEXT | nullable | Email from Lark profile |
| `avatar_url` | TEXT | nullable | Profile picture URL |
| `role` | TEXT | NOT NULL, CHECK | `super_admin` \| `da` \| `agent` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default NOW() | Account creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto-updated via trigger | Last modification |

#### `master_list_uploads`
Tracks each uploaded file. Only one upload can be `is_active = true` at a time.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | Primary key |
| `uploaded_by` | UUID | FK → users(id), CASCADE | Who uploaded |
| `file_name` | TEXT | NOT NULL | Original filename |
| `storage_path` | TEXT | NOT NULL | Path in local storage |
| `is_active` | BOOLEAN | NOT NULL, default false | Currently active dataset |
| `row_count` | INTEGER | NOT NULL, default 0 | Number of data rows |
| `column_headers` | JSONB | nullable | Column names array |
| `vector_status` | TEXT | NOT NULL, default 'pending' | `pending` \| `processing` \| `complete` \| `failed` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default NOW() | Upload timestamp |
| `updated_at` | TIMESTAMPTZ | nullable | Last modification |

**Indexes:**
- `idx_uploads_active` — partial unique index on `is_active WHERE true` (enforces single active upload)
- `idx_uploads_created_at` — descending for history listing
- `idx_uploads_uploaded_by` — for user-specific queries

#### `master_list_rows`
Stores the actual data rows from uploaded files. Each row's data is stored as JSONB.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | Primary key |
| `upload_id` | UUID | FK → uploads(id), CASCADE | Parent upload |
| `row_index` | INTEGER | NOT NULL | Row position (1-based) |
| `data` | JSONB | NOT NULL | Row data as key-value pairs |
| `search_vector` | TSVECTOR | nullable | Full-text search vector |

**Indexes:**
- `idx_rows_search_vector` — GIN index for full-text search
- `idx_rows_upload_id_row_index` — composite index for paginated fetching

**Triggers:**
- `trg_rows_search_vector` — auto-generates `search_vector` from all JSONB values on INSERT/UPDATE

#### `master_list_rows_staging`
Temporary table for the COPY streaming upload pipeline. Identical to `master_list_rows` but with **no indexes** and **no triggers** for maximum write performance.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `upload_id` | UUID | Parent upload (no FK constraint) |
| `row_index` | INTEGER | Row position |
| `data` | JSONB | Row data |
| `search_vector` | TSVECTOR | Always NULL (vectors generated later) |

#### `audit_log`
Immutable log of all significant actions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | Primary key |
| `user_id` | UUID | FK → users(id) | Who performed action |
| `action` | TEXT | CHECK constraint | `upload` \| `activate` \| `login` \| `logout` |
| `target_id` | UUID | nullable | Upload ID or related entity |
| `metadata` | JSONB | nullable | Additional context (file_name, row_count) |
| `created_at` | TIMESTAMPTZ | NOT NULL | When action occurred |

### Database Functions

| Function | Purpose |
|---|---|
| `filter_master_list(...)` | Server-side search + filter with full-text or ILIKE fallback |
| `generate_search_vector()` | Trigger function to build tsvector from JSONB data |
| `generate_search_vectors_batch(...)` | Batch vectorization for background processing |
| `disable_search_trigger()` | Disables the search vector trigger during bulk inserts |
| `enable_search_trigger()` | Re-enables the search vector trigger |
| `ensure_search_trigger_enabled()` | Safety check to verify trigger is active |
| `update_updated_at()` | Auto-updates `updated_at` timestamp on row change |

---

## 7. Authentication & Authorization

### Authentication Flow

MasterList uses **Lark (Larksuite) OAuth 2.0 with PKCE** for Single Sign-On:

```
1. User clicks "Sign in with Lark"
2. Browser → GET /api/auth/lark
   - Generates PKCE code_verifier + code_challenge
   - Generates random state token
   - Stores state + code_verifier in httpOnly cookies
   - Redirects to Lark authorization URL

3. User authenticates on Lark
4. Lark redirects → GET /api/auth/lark/callback?code=xxx&state=yyy
   - Validates state matches cookie
   - Exchanges auth code + code_verifier for user access token
   - Fetches user profile from Lark API
   - Creates or updates user record in PostgreSQL
   - Signs JWT with user info (HS256)
   - Sets JWT in httpOnly session cookie
   - Redirects to dashboard

5. All subsequent requests include the session cookie
   - Middleware verifies JWT on every request
   - Invalid/expired tokens → redirect to /login
```

### JWT Token Structure

```json
{
  "sub": "user-uuid",
  "larkId": "lark-open-id",
  "role": "da",
  "name": "John Doe",
  "iss": "masterlist",
  "aud": "masterlist-app",
  "iat": 1709654400,
  "exp": 1709740800
}
```

- **Algorithm:** HS256 (HMAC-SHA256)
- **Expiry:** 24 hours
- **Storage:** httpOnly, secure (in production), sameSite=lax cookie

### Role-Based Access Control (RBAC)

| Role | Dashboard | Search | Export | Upload | Activate | Delete | History | Admin Panel | User Management |
|---|---|---|---|---|---|---|---|---|---|
| **Agent** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (view) | ❌ | ❌ |
| **DA** (Data Admin) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Super Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Enforcement layers:**
1. **Middleware** (`src/middleware.ts`) — page-level route protection
2. **API middleware** (`requireAuth`, `requireDA`, `requireSuperAdmin`) — API-level
3. **Frontend guards** (`AuthGuard`, `RoleGuard`) — UI-level (defense-in-depth)

---

## 8. API Reference

### API Style: REST API

MasterList uses a **REST API** architecture built with Next.js App Router **Route Handlers**:

- **Protocol:** HTTP/HTTPS
- **Format:** JSON request/response bodies (`application/json`)
- **Methods:** `GET` (read), `POST` (create/action), `PATCH` (update), `DELETE` (remove)
- **URL pattern:** Resource-based — `/api/{resource}` and `/api/{resource}/{id}/{action}`
- **Status codes:** Standard HTTP (200, 307, 400, 401, 403, 409, 429, 500)
- **Authentication:** Session cookie (httpOnly JWT) — sent automatically by the browser
- **Streaming exception:** `POST /api/uploads` returns `application/x-ndjson` (newline-delimited JSON) for real-time progress updates during file processing

All API routes live under `/api/` and are server-side only — they never expose secrets or internal logic to the browser.

### Authentication

#### `GET /api/auth/lark`
Initiates Lark OAuth flow. Generates PKCE tokens and redirects to Lark.

- **Auth:** None (public)
- **Response:** 307 redirect to Lark authorization URL

#### `GET /api/auth/lark/callback`
Handles Lark OAuth callback. Exchanges code for token, creates/updates user, sets session.

- **Auth:** None (public)
- **Query params:** `code` (auth code), `state` (CSRF token)
- **Response:** 307 redirect to `/` on success, `/login?error=...` on failure

#### `POST /api/auth/logout`
Clears session cookie and logs the action.

- **Auth:** Required
- **Response:** `{ success: true }`

### User

#### `GET /api/me`
Returns the current authenticated user's information. Runs startup health checks on first call.

- **Auth:** Required
- **Response:**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "avatarUrl": "https://...",
  "role": "da",
  "larkUserId": "ou_xxx",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

### Master List Data

#### `GET /api/master-list`
Returns paginated rows from the active upload.

- **Auth:** Required
- **Query params:**
  - `page` (number, default 1)
  - `pageSize` (number, default 50, max 100)
  - `search` (string, full-text search)
  - `sortBy` (string, column name)
  - `sortOrder` (`asc` | `desc`)
  - `filters` (JSON string, column→value map)
- **Response:**
```json
{
  "rows": [{ "col1": "val", "col2": "val" }],
  "total": 339000,
  "page": 1,
  "pageSize": 50,
  "uploadId": "uuid"
}
```

#### `GET /api/master-list/columns`
Returns column headers for the active upload.

- **Auth:** Required
- **Response:** `{ "columns": ["Name", "Email", "Phone", ...] }`

#### `GET /api/master-list/export`
Streams a CSV export of the current data (with applied search/filters).

- **Auth:** Required
- **Query params:** Same as `/api/master-list` (search, filters)
- **Response:** `text/csv` stream with `Content-Disposition: attachment`
- **Limits:** Max 100,000 rows per export

### Uploads

#### `POST /api/uploads`
Uploads and processes a file. Returns an NDJSON stream with progress events.

- **Auth:** DA or Super Admin
- **Content-Type:** `multipart/form-data`
- **Body:**
  - `file` — the file (.xlsx, .xls, .csv), max 300 MB
  - `password` — optional, for encrypted Excel files
  - `idempotencyToken` — UUID to prevent duplicate submissions
- **Response:** NDJSON stream (`application/x-ndjson`)

```json
{"stage":"parsing","progress":10,"detail":"Parsing and inserting rows..."}
{"stage":"inserting","progress":45,"detail":"Inserted 150,000 rows"}
{"stage":"preview","progress":45,"detail":"Preview ready","data":{...}}
{"stage":"inserting","progress":90,"detail":"Inserted 330,000 rows"}
{"stage":"complete","progress":100,"detail":"Upload complete","data":{...}}
```

#### `GET /api/uploads`
Lists all uploads (history).

- **Auth:** Required
- **Response:**
```json
{
  "uploads": [{
    "id": "uuid",
    "fileName": "data.xlsx",
    "rowCount": 339000,
    "isActive": true,
    "columnHeaders": ["Name", "Email"],
    "uploadedBy": { "id": "uuid", "name": "Admin" },
    "createdAt": "2026-03-01T..."
  }]
}
```

#### `DELETE /api/uploads/[id]`
Deletes an upload and all its rows. Cannot delete the active upload.

- **Auth:** DA or Super Admin
- **Response:** `{ success: true }`

#### `POST /api/uploads/[id]/activate`
Sets an upload as the active Master List (deactivates the current one).

- **Auth:** DA or Super Admin
- **Response:** `{ success: true }`

#### `POST /api/uploads/[id]/vectorize`
Triggers background search vector generation. Called automatically after upload.

- **Auth:** Internal API secret (`x-internal-secret` header)
- **Response:** NDJSON progress stream

#### `GET /api/uploads/[id]/vectorize`
Checks vectorization progress.

- **Auth:** Required
- **Response:** `{ status: "processing", progress: 75 }`

### Admin

#### `GET /api/admin/users`
Lists all users with roles.

- **Auth:** Super Admin
- **Response:** `{ "users": [{ "id": "...", "name": "...", "role": "agent" }] }`

#### `PATCH /api/admin/users`
Updates a user's role.

- **Auth:** Super Admin
- **Body:** `{ "userId": "uuid", "role": "da" }`
- **Response:** `{ success: true }`

#### `GET /api/admin/activity`
Returns the activity/audit log.

- **Auth:** Super Admin
- **Response:** `{ "activities": [{ "action": "upload", "user": "...", "metadata": {...} }] }`

### Health & Monitoring

#### `GET /api/health`
Public health check endpoint — no authentication required.

- **Auth:** None (public)
- **Purpose:** Uptime monitoring, PM2 health checks, deployment verification
- **Response (200 — healthy):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-03-05T00:45:54.224Z",
    "uptime": 556,
    "version": "0.1.0",
    "checks": {
      "database": { "status": "ok", "latencyMs": 2 }
    },
    "memory": {
      "rss": "470 MB",
      "heapUsed": "227 MB",
      "heapTotal": "265 MB",
      "external": "398 MB"
    },
    "latencyMs": 3
  }
  ```
- **Response (503 — degraded):** Same shape with `"status": "degraded"` and error details in `checks.database.error`

---

## 9. Upload Pipeline

The upload pipeline is the most complex part of the system, optimized for handling files with **300+ MB** and **340,000+ rows**.

### Complete Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User selects file (.xlsx, .xls, .csv)                        │
│  2. If Excel + ≤150MB: parse in browser using SheetJS            │
│     → Convert to CSV (avoids 60-75s server-side parsing)         │
│  3. Upload CSV/file via POST /api/uploads (FormData)             │
│  4. Read NDJSON response stream for progress updates             │
│  5. Show progressive preview after first batch                   │
│                                                                  │
└──────────┬───────────────────────────────────────────────────────┘
           │ NDJSON Stream
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                        SERVER (API Route)                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Rate limit check (prevent abuse)                             │
│  2. Idempotency check (prevent duplicate submissions)            │
│  3. Upload mutex (only one upload at a time globally)            │
│  4. Read file stream → single Buffer (memory optimized)          │
│  5. Store original file on disk (if ≤50MB)                       │
│  6. Stream-parse file in batches of 50,000 rows                  │
│  7. For each batch:                                              │
│     a. COPY into staging table (no indexes, no triggers)         │
│     b. Emit progress event via NDJSON                            │
│     c. After batch 0: emit preview event with first 10 rows      │
│  8. Move all rows: staging → production (atomic INSERT...SELECT) │
│  9. Update upload record with final row count                    │
│  10. Log action to audit_log                                     │
│  11. Emit "complete" event                                       │
│  12. Fire-and-forget: trigger background vectorization           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Memory Optimization

The pipeline is specifically optimized to avoid out-of-memory errors with large files:

| Optimization | Before | After |
|---|---|---|
| File reading | `file.arrayBuffer()` → `Buffer.from()` (2 copies) | `file.stream()` → `Buffer.concat()` (1 copy) |
| Parser input | Always `Buffer.from(buffer)` (extra copy) | `Buffer.isBuffer()` check (zero-copy) |
| COPY buffering | String concatenation `+=` (O(n²)) | Array `.push()` + `.join("")` (O(n)) |
| Client-side | No limit, loads full file | 150MB limit, GC hints after parse |

**Peak memory:** Reduced from ~1.4 GB to ~500-600 MB for a 300 MB file.

### PostgreSQL COPY Protocol

Instead of standard SQL INSERTs, the upload uses PostgreSQL's COPY protocol for bulk insertion:

```
COPY master_list_rows_staging (upload_id, row_index, data) FROM STDIN WITH (FORMAT csv)
```

- **2,000 rows** buffered before flush to COPY stream
- **50,000 rows** per parse batch
- Staging table has **no indexes** and **no triggers** → raw write speed
- After all batches: atomic `INSERT INTO production SELECT FROM staging`

### Progressive Preview

Users see preview data **immediately after the first batch** (50,000 rows) finishes, rather than waiting for all batches to complete:

1. After batch 0 COPY finishes → emit `"preview"` NDJSON event with first 10 rows
2. Frontend receives preview → auto-switches from "Upload" step to "Preview" step
3. Remaining batches continue inserting in background
4. Progress indicator shows on the preview page
5. "Activate" button becomes enabled only after upload completes
6. Final "complete" event updates preview with accurate total row count

### Background Vectorization

After the upload completes (user sees "Upload complete"):
1. Server sends a fire-and-forget POST to `/api/uploads/[id]/vectorize`
2. Vectorize endpoint processes rows in batches of 5,000
3. For each batch: generates `search_vector` (tsvector) from JSONB data
4. Until vectorization completes, search uses ILIKE fallback
5. After completion, search uses the fast GIN index

---

## 10. Storage System

### Where Are Files Stored?

Files are stored on the **local file system** under the `./storage/` directory in the project root.

```
masterlist-app/
└── storage/                          # gitignored
    └── master-list-files/            # bucket name
        └── uploads/
            └── 1709654400000_data.xlsx   # timestamped filename
```

### Storage Rules

| Condition | Behavior |
|---|---|
| File ≤ 50 MB | Stored on disk + parsed into database |
| File > 50 MB | **NOT stored on disk** — only parsed into database |
| File > 300 MB | Rejected with HTTP 400 |

### Why This Design?

- **No cloud dependency** — runs fully offline / on-premise
- **50 MB disk limit** — large files (100-300 MB) would waste disk space since the data is already in PostgreSQL
- **Path traversal protection** — `path.resolve()` is validated against `STORAGE_ROOT`
- **The database IS the primary storage** — files stored on disk are just for reference/re-download

### What Consumes Storage?

| Resource | Location | Size Impact |
|---|---|---|
| **Uploaded files** (≤50MB) | `./storage/` | Small — only files under 50MB |
| **Row data** | PostgreSQL `master_list_rows` | Large — 2.3M rows ≈ 2.3 GB |
| **Search vectors** | PostgreSQL `search_vector` column | Medium — adds ~20% to data size |
| **Indexes** | PostgreSQL | Medium — ~500 MB for 2.3M rows |
| **Staging table** | PostgreSQL `master_list_rows_staging` | Temporary — emptied after each upload |
| **Inactive uploads** | PostgreSQL | Large — old uploads still consume space until deleted |

### Recommendation
Delete inactive uploads regularly to reclaim database space. Each upload with 340K rows consumes approximately 300 MB of database space (data + indexes).

---

## 11. Search & Filtering

### Full-Text Search

MasterList uses PostgreSQL's built-in full-text search (tsvector + GIN index):

1. Each row has a `search_vector` column (tsvector)
2. Generated from ALL values in the JSONB `data` column
3. Indexed with a GIN index for sub-millisecond lookups
4. Uses `'simple'` dictionary (no stemming — exact token matching)

### Search Fallback

If search vectors haven't been generated yet (background vectorization in progress):
- The system automatically falls back to **ILIKE** pattern matching
- Slightly slower but still functional
- Transparent to the user

### Column Filtering

Users can filter by individual columns (exact or partial match):
- Filter values are sent as a JSON object: `{ "Name": "John", "City": "NY" }`
- Each filter generates an ILIKE condition or tsvector condition
- Multiple filters are combined with AND logic

### Search Performance

| Dataset Size | Search Method | Latency |
|---|---|---|
| 340K rows | GIN index (vectorized) | < 1 ms |
| 340K rows | ILIKE fallback | 50-200 ms |
| 2.3M rows (all uploads) | GIN index | < 5 ms |

### Client-Side Debouncing

Search input is debounced using `useDeferredValue` (React 18) + 300ms delay to prevent excessive API calls.

---

## 12. Frontend Architecture

### State Management

The frontend uses **Zustand** for global state with 4 stores:

| Store | Purpose | Key State |
|---|---|---|
| `authStore` | Auth state | `user`, `isAuthenticated`, `isLoading` |
| `searchStore` | Search/filter | `query`, `filters`, `page`, `pageSize`, `sortBy` |
| `uploadStore` | Upload state | `progress`, `preview`, `isUploading`, `error` |
| `uiStore` | UI preferences | `darkMode`, `sidebarOpen` |

### Data Fetching

Server data is managed via **TanStack React Query**:

| Hook | API Endpoint | Key Features |
|---|---|---|
| `useMasterList` | `/api/master-list` | Paginated, `placeholderData` for smooth transitions |
| `useColumns` | `/api/master-list/columns` | Cached, staleTime 30s |
| `useUploadHistory` | `/api/uploads` | List all uploads |
| `useUpload` | `/api/uploads` (POST) | Mutation with NDJSON stream reader |
| `useAuth` | `/api/me` | Current user, auto-redirect on 401 |
| `useExport` | `/api/master-list/export` | CSV download with progress |

### Upload Progress Persistence

Upload progress and state are stored in the Zustand `uploadStore`, which persists across SPA navigations. The user can navigate away from `/upload` and come back without losing progress — the NDJSON stream reader runs in the hook's mutation scope, independent of the component lifecycle.

### Component Architecture

```
AuthGuard → Checks authentication, redirects to /login if needed
  └── RoleGuard → Checks role permissions
       └── Header → Navigation bar with SearchBar, UserMenu
            └── Page Content
                 ├── MasterListTable → Data table with sorting, filtering
                 ├── UploadForm → File selection + progress
                 ├── PreviewTable → Preview uploaded data
                 ├── HistoryTable → Upload history with actions
                 └── Admin panels → User management, activity log
```

### Dark Mode

- Controlled via `uiStore.darkMode`
- Persisted in `localStorage` (key: `masterlist-theme`)
- Uses Tailwind's `dark:` variant classes
- System preference detection on first visit

---

## 13. Security Measures

### 1. Authentication Security

| Measure | Implementation |
|---|---|
| **OAuth 2.0 with PKCE** | Prevents authorization code interception attacks |
| **State parameter** | Random token in cookie — prevents CSRF on OAuth flow |
| **httpOnly cookies** | JWT stored in httpOnly cookie — inaccessible to JavaScript |
| **Secure flag** | Cookie marked `secure` in production (HTTPS only) |
| **SameSite=lax** | Prevents cross-site cookie sending |
| **24-hour expiry** | JWTs auto-expire, forcing re-authentication |

### 2. API Security

| Measure | Implementation |
|---|---|
| **Server-side secrets only** | All secrets (`JWT_SECRET`, `LARK_APP_SECRET`, `DATABASE_URL`, `INTERNAL_API_SECRET`) are ONLY accessed in `src/backend/` — never exposed to the browser |
| **Role-based guards** | `requireAuth()`, `requireDA()`, `requireSuperAdmin()` middleware on every API route |
| **Middleware protection** | Global Next.js middleware verifies JWT on every request |
| **Rate limiting** | Upload endpoint rate-limited per user (sliding window) |
| **Upload mutex** | Only one upload can process at a time globally |
| **Idempotency tokens** | Prevents duplicate form submissions (10-minute TTL) |
| **UUID validation** | All ID parameters validated before database queries |

### 3. Input Validation & Injection Prevention

| Measure | Implementation |
|---|---|
| **Parameterized queries** | All SQL uses `$1, $2, ...` parameters — no string interpolation |
| **SQL identifier validation** | RPC function names validated against `/^[a-z_][a-z0-9_]*$/i` |
| **File extension validation** | Only `.xlsx`, `.xls`, `.csv` accepted |
| **File size limit** | Max 300 MB enforced server-side |
| **Row/column limits** | Max 500,000 rows, 100 columns |
| **Path traversal protection** | Storage paths validated with `path.resolve()` against `STORAGE_ROOT` |
| **Filename sanitization** | Special characters stripped: `[/\\:*?"<>|]` |

### 4. HTTP Security Headers

All responses include these headers (configured in `next.config.mjs`):

| Header | Value | Purpose |
|---|---|---|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referer leaking |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS |
| `Content-Security-Policy` | Restrictive policy | Prevents XSS, data injection |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unused APIs |

### 5. Content Security Policy (CSP) Details

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
img-src 'self' data: blob: https://*.feishucdn.com https://*.larksuite.com https://*.larksuitecdn.com
connect-src 'self'
frame-ancestors 'none'
```

### 6. Database Security

| Measure | Implementation |
|---|---|
| **Connection pool** | Max 20 connections, 10s timeout, 30s idle timeout |
| **Trigger safety** | `ensure_search_trigger_enabled()` runs on startup |
| **Graceful shutdown** | Pool drains on process exit |
| **Audit logging** | All actions logged to `audit_log` table |

### 7. Secret Management

| Secret | Where Used | Exposure |
|---|---|---|
| `DATABASE_URL` | `src/backend/lib/db/index.ts` | Server-only |
| `JWT_SECRET` | `src/backend/lib/auth/jwt.ts` | Server-only |
| `LARK_APP_SECRET` | `src/backend/lib/lark/oauth.ts` | Server-only |
| `INTERNAL_API_SECRET` | `src/app/api/` routes | Server-only |
| `NEXT_PUBLIC_APP_URL` | API routes (server-side) | Public (just a URL, not a secret) |

**No secrets are ever sent to the browser.** The `src/backend/` directory uses the `"server-only"` import guard — any attempt to import these modules in client code will cause a build error.

### 8. .gitignore Protection

The following sensitive files are excluded from version control:
- `.env*.local` — environment files with real secrets
- `/storage/` — uploaded files
- `/node_modules/` — dependencies
- `.next/` — build output

---

## 14. Environment Configuration

### Required Environment Variables

Create a `.env.local` file from `.env.example`:

```bash
# ─── PostgreSQL ────────────────────────────────────────
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/masterlist_db

# ─── Lark OAuth (International / Larksuite) ────────────
LARK_APP_ID=cli_your_app_id            # From Lark Developer Console
LARK_APP_SECRET=your_app_secret_here   # From Lark Developer Console
LARK_REDIRECT_URI=http://localhost:3000/api/auth/lark/callback

# ─── JWT ───────────────────────────────────────────────
JWT_SECRET=<random-256-bit-hex>
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ─── Internal API ─────────────────────────────────────
INTERNAL_API_SECRET=<random-256-bit-hex>
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ─── App ───────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Variable Classification

| Variable | Required | Server-Only | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | PostgreSQL connection string |
| `LARK_APP_ID` | ✅ | ✅ | Lark OAuth client ID |
| `LARK_APP_SECRET` | ✅ | ✅ | Lark OAuth client secret |
| `LARK_REDIRECT_URI` | ✅ | ✅ | OAuth callback URL |
| `JWT_SECRET` | ✅ | ✅ | JWT signing key |
| `INTERNAL_API_SECRET` | ✅ | ✅ | Internal API auth |
| `NEXT_PUBLIC_APP_URL` | ✅ | ❌ | Base URL of the app |

---

## 15. Setup & Installation

### Prerequisites

- **Node.js** 18+ (recommended: 20.x LTS)
- **PostgreSQL** 15+ (tested on 18.x)
- **Lark Developer Account** with OAuth app configured

### Step 1: Clone & Install Dependencies

```bash
git clone <repository-url>
cd masterlist-app
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

### Step 3: Set Up Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE masterlist_db;

# Connect to it
\c masterlist_db

# Run initialization
\i scripts/init_db.sql

# Run all migrations in order
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

### Step 4: Configure Lark OAuth

1. Go to [Lark Developer Console](https://open.larksuite.com/)
2. Create an app
3. Under **Credentials & Basic Info**: note `App ID` and `App Secret`
4. Under **Security Settings** → Add Redirect URL:
   ```
   http://localhost:3000/api/auth/lark/callback
   ```
5. Update `.env.local` with these values

### Step 5: Start Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

### Step 6: First Login

1. Open http://localhost:3000
2. Click "Sign in with Lark"
3. Authenticate with your Lark account
4. The first user is automatically assigned the `super_admin` role

### NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start development server (with 8GB heap) |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server (with 8GB heap) |
| `lint` | `next lint` | Run ESLint |
| `pm2:start` | `pm2 start ecosystem.config.js` | Start production with PM2 |
| `pm2:stop` | `pm2 stop masterlist-app` | Stop the PM2 process |
| `pm2:restart` | `pm2 restart masterlist-app` | Restart the PM2 process |
| `pm2:logs` | `pm2 logs masterlist-app` | View application logs |
| `pm2:status` | `pm2 status` | View process status |
| `pm2:monit` | `pm2 monit` | Real-time monitoring dashboard |

---

## 16. Production Deployment & Process Management

### Overview

The application uses **PM2** as a production process manager for reliable deployment on a single server. PM2 provides auto-restart on crash, memory limit enforcement, structured logging, and real-time monitoring.

### Why Single-Instance (No Load Balancing)

The application intentionally runs as a **single Node.js process** because:

1. **In-memory state** — Rate limiting, upload locks, and idempotency tokens use `Map` objects in process memory. Multiple instances would not share this state.
2. **Local file storage** — Uploaded files are stored on the server's local filesystem (`./storage/`), not on shared storage like S3.
3. **Upload mutex** — Only one upload can process at a time to prevent database corruption. This lock is per-process.
4. **Sufficient capacity** — A single Node.js instance can handle 1,000+ concurrent connections. For 150 users (100 agents + 50 DAs), this provides >10x headroom.

### Scaling Thresholds

The single-instance architecture is appropriate up to ~500 concurrent users. If scaling beyond that becomes necessary:

| Component | Current | Multi-Instance Upgrade |
|---|---|---|
| Rate limiting | In-memory `Map` | Redis |
| Upload lock | In-memory variable | Redis distributed lock |
| Idempotency tokens | In-memory `Map` | Redis with TTL |
| File storage | Local `./storage/` | S3 / MinIO |
| Process management | PM2 fork mode | PM2 cluster mode or Kubernetes |
| Reverse proxy | Direct access | Nginx / cloud load balancer |

### PM2 Configuration (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [{
    name: "masterlist-app",
    script: "node_modules/next/dist/bin/next",
    args: "start",
    instances: 1,              // Single instance (in-memory state)
    exec_mode: "fork",         // Fork mode (not cluster)
    autorestart: true,         // Auto-restart on crash
    max_memory_restart: "2G",  // Restart if memory exceeds 2GB
    max_restarts: 10,          // Max restarts in restart_delay window
    min_uptime: "10s",         // Min uptime to consider "started"
    restart_delay: 5000,       // 5s delay between restarts
    kill_timeout: 10000,       // 10s grace period for cleanup
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      NODE_OPTIONS: "--max-old-space-size=4096",
    },
  }],
};
```

### Production Deployment Steps

```bash
# 1. Build the production bundle
npm run build

# 2. Start with PM2
npm run pm2:start

# 3. Verify health
curl http://localhost:3000/api/health

# 4. Monitor
npm run pm2:monit   # Real-time dashboard
npm run pm2:logs    # View logs
npm run pm2:status  # Process status
```

### Health Check Endpoint

`GET /api/health` is a public (no auth) endpoint that returns:
- **Server status** — `"healthy"` or `"degraded"`
- **Database connectivity** — connection test with latency
- **Memory usage** — RSS, heap used/total, external
- **Process uptime** — seconds since start
- **App version** — from package.json

Use this for PM2 health monitoring, uptime bots (e.g., UptimeRobot), or deployment verification scripts.

### Database Connection Pool

The PostgreSQL connection pool is tuned for the expected user load:

| Setting | Value | Rationale |
|---|---|---|
| `max` | 20 | 20 connections × <1ms/query = ~45,000 queries/sec capacity |
| `idleTimeoutMillis` | 30,000 | Close idle connections after 30s |
| `connectionTimeoutMillis` | 10,000 | Fail if can't connect in 10s |
| `statement_timeout` | 60,000 | Kill queries running >60s (safety net) |
| `allowExitOnIdle` | true | Allow clean process shutdown |

For 150 concurrent users with sub-millisecond query times, 20 connections provides **100x headroom** over typical load.

### Logging

PM2 logs are written to `./logs/` (gitignored):
- `pm2-out.log` — Application stdout (JSON formatted)
- `pm2-error.log` — Application stderr

View logs: `npm run pm2:logs`

---

## 17. User Guide

### For Agents (View-Only Users)

#### Viewing the Master List
1. Log in with your Lark account
2. The dashboard shows the currently active Master List
3. Scroll horizontally/vertically to view all data
4. Use the pagination controls at the bottom to navigate

#### Searching
1. Type in the search bar at the top of the page
2. Search results update automatically (300ms debounce)
3. Search looks across ALL columns in the data

#### Filtering by Column
1. Click the filter icon next to any column header
2. Type a filter value
3. Multiple column filters are combined (AND logic)
4. Clear filters with the "Clear" button

#### Exporting to CSV
1. Click the **Export** button in the toolbar
2. Current search/filter criteria are applied to the export
3. Maximum 100,000 rows per export
4. The CSV file downloads automatically

#### Viewing Upload History
1. Navigate to the **History** page from the header menu
2. View all past uploads with dates, file names, and uploaders
3. The currently active upload is marked with a green badge

### For Data Administrators (DAs)

#### Uploading a File
1. Navigate to the **Upload** page
2. Drag & drop or click to select a file (.xlsx, .xls, .csv)
3. If the file is password-protected, expand the password section and enter it
4. Click **Upload & Parse**
5. Watch the progress bar — preview appears after the first batch
6. After completion, click **Activate as Master List** to make it live

#### Managing Uploads
- **Activate:** Switch any inactive upload to become the active Master List
- **Delete:** Remove an upload and all its data (cannot delete the active one)

### For Super Admins

#### Managing Users
1. Navigate to the **Admin** page
2. View all registered users with their roles
3. Change any user's role using the role dropdown
4. Roles take effect on the user's next page load

#### Viewing Activity Log
1. Navigate to **Admin** → **Activity Log**
2. View all login, upload, activate, and logout events
3. Each entry shows who, what, when, and relevant metadata

### Dark Mode
- Click the moon/sun icon in the header to toggle dark mode
- Your preference is saved and persists across sessions

---

## 18. Troubleshooting

### Common Issues

#### "Port 3000 is in use"
```bash
# On Windows: Find and kill the process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use a different port
next dev -p 3001
```

#### Out of Memory during upload
- The app is configured with `--max-old-space-size=8192` (8 GB heap)
- Ensure your machine has at least 16 GB RAM for 300 MB files
- The client-side parser limits Excel files to 150 MB in-browser
- Close other memory-intensive applications during upload

#### "Missing DATABASE_URL environment variable"
- Ensure `.env.local` exists with a valid `DATABASE_URL`
- Restart the dev server after changing `.env.local`

#### Lark OAuth "invalid redirect URI"
- Ensure `LARK_REDIRECT_URI` in `.env.local` exactly matches the redirect URL in Lark Developer Console
- Include the full path: `http://localhost:3000/api/auth/lark/callback`

#### Search is slow (ILIKE fallback)
- This happens when search vectors haven't been built yet (after a fresh upload)
- Check vectorization status: `GET /api/uploads/[id]/vectorize`
- Vectors are built automatically in the background — wait a few minutes

#### Upload hangs or fails
- Check server console for errors
- Only one upload can process at a time — wait for any existing upload to finish
- Uploads have a 10-minute lock timeout — stale locks auto-release
- Ensure PostgreSQL is running and accessible

#### PM2 process keeps restarting
- Check logs: `npm run pm2:logs`
- Check memory: `npm run pm2:monit` — if hitting 2GB limit, investigate memory leaks
- Check health: `curl http://localhost:3000/api/health`
- Verify `.env.local` has correct `DATABASE_URL`

#### Health endpoint returns 503 (degraded)
- Database is unreachable — check PostgreSQL is running
- Check `checks.database.error` in the response for details
- Verify `DATABASE_URL` in `.env.local`

---

## 19. Glossary

| Term | Definition |
|---|---|
| **Master List** | The primary dataset displayed on the dashboard. Only one upload is "active" at a time. |
| **Upload** | A file (.xlsx, .xls, .csv) submitted by a DA. Stored in the database as rows. |
| **Active Upload** | The upload currently being displayed to all users on the dashboard. |
| **DA (Data Admin)** | A user role with permission to upload, activate, and delete files. |
| **Agent** | A user role with read-only access (search, filter, export). |
| **Super Admin** | A user role with full access including user management and activity logs. |
| **NDJSON** | Newline-delimited JSON — a streaming format where each line is a JSON object. Used for real-time upload progress. |
| **COPY Protocol** | PostgreSQL's native bulk loading protocol. Much faster than INSERT for large datasets. |
| **Staging Table** | A temporary table (`master_list_rows_staging`) without indexes, used during COPY to maximize write speed. |
| **Vectorization** | The process of generating `search_vector` (tsvector) values for full-text search. Runs in the background after upload. |
| **GIN Index** | Generalized Inverted Index — PostgreSQL's index type for full-text search. Enables sub-millisecond lookups. |
| **PKCE** | Proof Key for Code Exchange — an OAuth 2.0 extension that prevents authorization code interception attacks. |
| **Idempotency Token** | A unique token sent with each upload to prevent duplicate submissions if the user retries. |
| **Progressive Preview** | Feature that shows preview data after the first batch (50K rows) finishes, while the rest of the upload continues. |
| **PM2** | Production process manager for Node.js. Provides auto-restart, logging, and monitoring. |
| **Health Check** | Public API endpoint (`/api/health`) that reports server status, database connectivity, and memory usage. |

---

*This documentation is maintained alongside the codebase. For the latest version, see `DOCUMENTATION.md` in the project root.*
