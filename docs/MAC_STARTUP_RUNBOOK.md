# macOS update and startup runbook

The supported daily path is **Update from GitHub & start** at
<http://localhost:3000>. The same action is available as **Update & restart**
in the signed-in application header.
It refuses to overwrite local changes, fetches and fast-forwards `main`, backs
up PostgreSQL before a code update, verifies or installs the locked
dependencies, applies and verifies forward migrations, synchronizes content,
and verifies both web services. These steps run in the browser workflow; the
commands below are recovery-only.

## First installation

Prerequisites: Docker Desktop, Git, and Node.js 20 or newer.

```bash
cd /Users/siva/gpt/english-learning-platform-v2/english-learning-platform
git switch main
git pull --ff-only origin main
npx --yes yarn@1.22.22 install --frozen-lockfile
npx --yes yarn@1.22.22 app:install
```

Open <http://localhost:3000> and select **Validate and start app**. Do not run
the backend or frontend separately; the installed macOS service owns them.

## Manual update and recovery

Use this sequence only when the control page cannot complete **Update &
restart**:

```bash
cd /Users/siva/gpt/english-learning-platform-v2/english-learning-platform
git status --short --branch
git switch main
git fetch origin main --prune
git merge --ff-only origin/main
npx --yes yarn@1.22.22 install --frozen-lockfile
docker compose up -d postgres redis
npx --yes yarn@1.22.22 db:migrate
npx --yes yarn@1.22.22 db:status
npx --yes yarn@1.22.22 app:install
```

Then reopen <http://localhost:3000> and select **Validate and start app**.

Before merging, `git status --short --branch` must show `main` and no local
changes. Never discard unexpected changes: commit them on a separate branch or
ask for help. Start Docker Desktop if `docker info` fails. If a port is owned by
an app started in another Terminal, stop that process before retrying.

## Database-schema recovery

The startup controller always starts PostgreSQL and Redis and runs
`migrate:latest` before content-pack synchronization. Migration
`020_repair_generation_jobs_schema` repairs databases created by older merged
branches where `generation_jobs` exists without the ChatGPT columns, including
`assessment_run_id`. It preserves existing generation rows and supports both
ChatGPT content packs and in-app generation jobs.

If migration 020 reports that `generation_jobs` itself is absent, do not create
columns manually. Preserve the database and restore the latest dump from the
repository `backups` directory, or request a targeted database repair.

## Verification

```bash
curl --fail http://127.0.0.1:5001/health
curl --fail http://localhost:3000
npx --yes yarn@1.22.22 app:doctor
```

The app is ready only when PostgreSQL, Redis, all migrations, backend health,
frontend health, and content synchronization have completed successfully.
