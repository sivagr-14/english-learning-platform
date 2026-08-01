# English Mastery

A personal, Mac-local English vocabulary learning platform controlled through
ChatGPT.

The local web app is the vocabulary-management and learning workspace. It can
assess pasted content with OpenAI, require explicit approval, generate complete
lessons, and save validated entries to local PostgreSQL.

## Product workflow

1. Paste learning text into **Automated Vocabulary**.
2. The local backend assesses the content and compares it with saved vocabulary.
3. Review exact counts for new, update, unchanged, filtered, Heavy-use, and
   Medium-use candidates.
4. Approve the proposed scope in the local app.
5. The local generation worker creates complete lessons through the OpenAI
   Responses API and validates them before saving.
6. The platform accounts for every approved item as completed, failed, or
   requiring manual review.

Assessment never creates or updates vocabulary. Direct single-entry and JSON
imports are disabled so they cannot bypass this workflow.

## Current features

- Email/password registration and authentication
- ChatGPT-controlled assessment and approval API
- Exact assessment counts and source traceability
- Resumable automated generation jobs
- User-owned vocabulary with version-history foundations
- Hierarchical primary/secondary category foundations
- Full vocabulary lesson storage with Tamil support
- Vocabulary library and contextual search
- Active-production recall cards with spaced scheduling
- Real progress totals, review accuracy, and category mastery
- Control history for assessment and generation status
- PostgreSQL and Redis running locally through Docker

OpenAI API usage is paid separately from a ChatGPT subscription. The API never
receives PostgreSQL credentials: it returns structured JSON to the local
backend, and only the backend can write to the local database.

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

To run the control page in the foreground for troubleshooting, use
`yarn app:start`. To remove automatic startup without deleting database data,
use `yarn app:uninstall`.

The older terminal launcher remains available as `yarn app:start:legacy`. Use
`yarn app:doctor` to run its comprehensive validation without starting the web
services.

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

Add `OPENAI_API_KEY` to `.env.local` to enable automated assessment and lesson
generation. The launcher keeps this file readable only by the local account and
passes the key to the local backend process. Never commit `.env.local`.

## Main API surfaces

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### ChatGPT control

- `GET /api/control/overview`
- `GET /api/control/automation-status`
- `POST /api/control/assess-text`
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
yarn app:doctor
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
