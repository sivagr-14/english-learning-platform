# English Mastery

A personal, Mac-local English vocabulary learning platform controlled through
ChatGPT.

For both supported workflows (ChatGPT content pack and Gemini API), rollout controls, Update and Restart, backups and recovery, see [the Phase 4 operations runbook](docs/PHASE_4_OPERATIONS_RUNBOOK.md).

ChatGPT performs vocabulary assessment and complete lesson generation without
an OpenAI API key. It sends structured content through a dedicated private
GitHub inbox branch. The local app validates, approves and saves it to local
PostgreSQL.

## Product workflow

1. Paste text or attach a PDF in ChatGPT.
2. ChatGPT creates a complete page/chunk/candidate manifest in the private
   `chatgpt-content-inbox` branch.
3. Select **Sync ChatGPT content** and claim the import locally.
4. Review exact counts and approve the intended candidates.
5. ChatGPT creates complete eight-section batches in the same inbox.
6. The local backend validates and commits each batch transactionally.
7. Verify that words, lessons, categories, progress and review cards can all be
   read back from PostgreSQL.

Assessment never creates or updates vocabulary. Direct single-entry and JSON
imports are disabled so they cannot bypass this workflow.

## Current features

- Email/password registration and authentication
- ChatGPT-controlled assessment and approval API
- Exact assessment counts and source traceability
- Resumable ChatGPT content-pack generation jobs
- User-owned vocabulary with version-history foundations
- Hierarchical primary/secondary category foundations
- Full vocabulary lesson storage with Tamil support
- Vocabulary library and contextual search
- Active-production recall cards with spaced scheduling
- Real progress totals, review accuracy, and category mastery
- Control history for assessment and generation status
- PostgreSQL and Redis running locally through Docker

No OpenAI API key or separate API billing is required. ChatGPT never receives
PostgreSQL credentials. The GitHub inbox contains only structured manifests and
lesson packs; only the authenticated local backend writes the database.

## Local Mac setup

### Requirements

- Docker Desktop
- Git
- Node.js 20 or newer
- npm (included with Node.js)

### First setup

```bash
git clone https://github.com/sivagr-14/english-learning-platform.git
cd english-learning-platform

npx --yes yarn@1.22.22 install --frozen-lockfile
npx --yes yarn@1.22.22 app:install
```

`yarn app:install` performs the one-time macOS background-service setup. It
creates a user-level `launchd` service that starts automatically at login and is
kept alive by macOS. It resolves the current repository and Node.js paths while
installing, so it does not contain a hard-coded user or project directory.

After installation, open:

- App: <http://localhost:3000>
- Backend health: <http://127.0.0.1:5001/health>

Port 3000 always presents either:

- A lightweight **Validate and start app** page when the learning services are
  stopped, or
- The complete Next.js learning app after startup succeeds.

The button checks Node.js, local configuration, dependencies, Docker Desktop,
PostgreSQL, Redis, migrations, backend health, and frontend health. It opens
Docker Desktop when necessary. Startup progress and actionable errors appear
inside the page. The browser URL remains `localhost:3000`; the gateway proxies
the running Next.js service from its private port 3001.

Create your personal account through the registration screen. No sample user or
sample vocabulary is created. Migration `007_remove_prototype_content` removes
only the old known prototype entries and the old `sample@example.com` account;
it preserves personal accounts and user-owned vocabulary.

### Daily use

There is no daily Terminal command. After a Mac login or restart, open
<http://localhost:3000> and select **Validate and start app**.

Use **Update & restart** in the application header to fetch and fast-forward to
GitHub `main`, back up PostgreSQL, install changed dependencies, run migrations,
synchronize enabled built-in lessons, and restart. It refuses to overwrite local
changes. **Restart current** reloads only the code already installed on the Mac.

Vocabulary transport is independent of code updates. The launcher fetches
`chatgpt-content-inbox` every five minutes without switching the local branch or
changing the working tree. **Sync ChatGPT content** checks it immediately; a
restart is not required for new entries.

Completed packs are removed automatically from the active inbox only after a
strict PostgreSQL read-back verifies the word, lesson, progress and review rows.
The active ledger retains only actionable or resumable imports. Completed,
verified imports disappear after guarded inbox cleanup.

To run the control page in the foreground for troubleshooting, use
`yarn app:start`. To remove automatic startup without deleting database data,
use `yarn app:uninstall`.

The older terminal launcher remains available as `yarn app:start:legacy`. Use
`yarn app:doctor` to run its comprehensive validation without starting the web
services.

For the exact first-install, manual update, schema-recovery, and verification
commands, see [the macOS startup runbook](docs/MAC_STARTUP_RUNBOOK.md).

`yarn db:seed` is now non-destructive. It updates the standardized category
definitions and never deletes or creates vocabulary.

## Local environment

Create `.env.local` from `.env.example`. The essential local values are:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=english_learning
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/english_learning
REDIS_URL=redis://localhost:6379
PORT=5001
NEXT_PUBLIC_API_URL=http://127.0.0.1:5001
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
JWT_SECRET=replace-with-openssl-rand-hex-32
```

No AI credential belongs in `.env.local`. Keep database and authentication
secrets local and never commit that file.

## Main API surfaces

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### ChatGPT control

- `GET /api/control/overview`
- `GET /api/control/connection-status`
- `GET /api/control/content-packs`
- `GET /api/control/content-packs/:id`
- `POST /api/control/content-packs/:id/claim`
- `POST /api/control/content-packs/:id/approve`
- `POST /api/control/content-packs/:id/verify`
- `POST /api/control/assessments`
- `GET /api/control/assessments/:id`
- `POST /api/control/assessments/:id/approve`

### Learning

- `GET /api/vocabulary/categories`
- `GET /api/vocabulary/categories/:id/words`
- `GET /api/vocabulary/search`
- `GET /api/vocabulary/words/:id`
- `GET /api/flashcards/categories`
- `GET /api/flashcards/due`
- `POST /api/flashcards/:wordId/review`
- `GET /api/progress`

## Validation

```bash
npx --yes yarn@1.22.22 app:doctor
```

## Project structure

```text
packages/
  backend/
    src/database/       PostgreSQL migrations and safe category seeds
    src/routes/         Authenticated API routes
    src/services/       Authentication, assessment, and vocabulary logic
  frontend/
    app/                Next.js pages
    components/         Shared authenticated application shell
    lib/                API and authentication state
```
