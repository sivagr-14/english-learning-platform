# English Mastery

A personal, Mac-local English vocabulary learning platform controlled through
ChatGPT.

ChatGPT is the vocabulary-management entry point. The web app is the learning
workspace for browsing lessons, active recall, spaced review, progress, and
content-processing history.

## Product workflow

1. Share text or a supported file with ChatGPT.
2. ChatGPT assesses the complete content and compares it with saved vocabulary.
3. Review exact counts for new, update, unchanged, filtered, Heavy-use, and
   Medium-use candidates.
4. Approve the proposed scope in ChatGPT.
5. ChatGPT creates or updates complete lessons through authenticated control
   tools.
6. The platform accounts for every approved item as completed, failed, or
   requiring manual review.

Assessment never creates or updates vocabulary. Direct single-entry and JSON
imports are disabled so they cannot bypass this workflow.

## Current features

- Email/password registration and authentication
- ChatGPT-controlled assessment and approval API
- Exact assessment counts and source traceability
- Idempotent generation-job foundation
- User-owned vocabulary with version-history foundations
- Hierarchical primary/secondary category foundations
- Full vocabulary lesson storage with Tamil support
- Vocabulary library and contextual search
- Active-production recall cards with spaced scheduling
- Real progress totals, review accuracy, and category mastery
- Control history for assessment and generation status
- PostgreSQL and Redis running locally through Docker

The remote ChatGPT MCP connector and complete-entry job processor are the next
implementation phase. The current app does not call the paid OpenAI API.

## Local Mac setup

### Requirements

- Docker Desktop
- Git
- Node.js 20 or newer
- Yarn 1.22

### First setup

```bash
git clone https://github.com/sivagr-14/english-learning-platform.git
cd english-learning-platform

corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install

yarn app:install
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

OAuth, email delivery, Google Translate, and `OPENAI_API_KEY` are optional and
may remain empty for the personal local version.

## Main API surfaces

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### ChatGPT control

- `GET /api/control/overview`
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
