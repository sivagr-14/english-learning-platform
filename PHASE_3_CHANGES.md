# Phases 2 & 3: async pipeline, file parsers, and in-app AI generation

This is the big one -- it wires together everything discussed in this
conversation: BullMQ job queue, PDF/SRT/DOCX/EPUB parsing, a Gemini-based
generation pipeline with validator-gated escalation, and a frontend page to
drive it. It reuses your existing `ContentPackService` for ingestion/commit
rather than reimplementing that logic, so committed words get the same
transactional-write + read-back verification as the manual ChatGPT flow.

## New dependencies (run `yarn install` after pulling this in)

- `bullmq`, `ioredis` -- job queue (Redis-backed, separate connection from
  the `redis` v4 client already used for caching)
- `pdf-parse`, `mammoth`, `srt-parser-2`, `epub2` -- format-specific text
  extraction, all local/deterministic, no AI calls

## New environment variables (`.env.example` has full comments)

```
PRIMARY_AI_PROVIDER=gemini
PRIMARY_AI_MODEL=gemini-2.5-flash
PRIMARY_AI_API_KEY=<your key>

ESCALATION_AI_PROVIDER=gemini
ESCALATION_AI_MODEL=gemini-2.5-pro
ESCALATION_AI_API_KEY=<your key, can be the same key>

GENERATION_WORKER_CONCURRENCY=2
```

Nothing in this pipeline runs, or costs anything, until `PRIMARY_AI_API_KEY`
is set -- the existing ChatGPT-UI manual flow is completely untouched and
keeps working exactly as before.

## What was built

**Job queue** (`packages/backend/src/queue/`)
`generation.queue.ts` defines a 4-stage pipeline (extract → assess →
generate → commit) as a BullMQ queue; `generation.worker.ts` implements all
four stages and must run as its own process (`npm run worker`, or the new
`worker` service in `docker-compose.yml`) -- separate from the API server so
a long book import can never block request handling.

**File parsing** (`document-parser.service.ts`)
Plain text, PDF (`pdf-parse`), DOCX (`mammoth`), SRT (`srt-parser-2`,
grouped into pseudo-paragraphs by timing gap rather than word count), and
EPUB (`epub2`, per-chapter HTML stripped to text). A scanned/image PDF that
yields almost no text throws a clear error rather than silently proceeding
with garbage -- OCR (Tesseract.js) is the natural next step for that case
and isn't wired in yet.

**AI provider client** (`ai-provider.service.ts`)
Thin REST client supporting Gemini, OpenAI-compatible, and Anthropic APIs,
selected per-tier via env vars. No SDK dependency -- just `fetch`, since
Node 20 (already your engine requirement) has it built in.

**Generation orchestration** (`in-app-generation.service.ts`)
- `assessChunk`: cheap-tier call per chunk, proposes candidate vocabulary
  against your real 300-category taxonomy (validated against
  `isValidTaxonomyPath` -- invalid categories are dropped, not guessed at).
- `generateLessonEntry`: full 8-section lesson generation, validated with
  your existing `vocabularyLessonQualityIssues` (the same filler/placeholder/
  term-usage checks the manual ChatGPT flow already relies on). On
  rejection, retries once on the escalation tier before giving up on that
  one word -- this is the actual cost-minimization mechanism from the
  earlier cost discussion, implemented for real rather than just described.
- Manifest/batch documents are built to match your existing
  `ContentManifestSchema`/`ContentBatchSchema` exactly, then handed to
  `ContentPackService.ingestDocuments` / `.claimManifest` /
  `.approveManifest` -- the same code path the git-inbox flow uses.

**API + frontend**
`POST /api/generation/jobs` (text or base64 file content) → queues the
pipeline; `GET /api/generation/jobs/:id` for polling. New page at
`/import` (linked in nav as "Import (AI)") uploads a file or pasted text
and polls progress through all four stages.

## Known simplifications (deliberate, to keep this landable)

- **No sense-matching against existing vocabulary yet.** Every candidate is
  treated as `senseDecision: "new_sense"`. The contract supports matching
  an existing word/sense (`decision: "existing"`), which would avoid
  duplicate entries across imports -- reasonable next increment, skipped
  here to keep the first pass provable end-to-end.
- **No OCR fallback for scanned PDFs.** Fails with a clear message instead.
- **Sequential generation within a job**, not parallelized across
  candidates -- simpler and keeps API concurrency predictable, at the cost
  of a big book taking longer wall-clock time than it strictly needs to.
- **No cost estimation before running** -- `generation_jobs.estimated_cost`
  exists in the schema but nothing populates it yet. `actual_cost`/
  `tokens_used` columns are also unpopulated -- the AI provider responses
  do include token usage; wiring that through is a small follow-up.
- **No caching layer for repeated vocabulary** (the "cache lessons by
  normalized term + sense" idea from the cost discussion) -- every import
  regenerates from scratch even if a word was already taught to this user
  or another one. This is the highest-value next piece for cost at scale.

## Important: this has not been run

I don't have network access or your Postgres/Redis/Docker stack in this
sandbox, so none of this has actually executed end-to-end -- it's
consistent with the real schemas and existing service methods I read
directly from your codebase, but it needs a real run (with a real Gemini
key, against a real chunk of text) to catch anything that only shows up at
runtime: TypeScript errors tsc didn't catch by inspection, an edge case in
how `ContentPackService` expects `payload` to be shaped, etc.

**Suggested first test**, once dependencies are installed and migrations
run:
```bash
# with PRIMARY_AI_API_KEY set in .env.local, and postgres/redis running:
yarn workspace english-learning-backend worker &   # start the worker
# then, logged in, POST a small paragraph to /api/generation/jobs
# with sourceType "text" and watch it move through queued -> extracting
# -> assessing -> generating -> validating -> committed
```

If something breaks, it's most likely one of: a manifest-shape mismatch
between what `buildManifestDocument` produces and what
`validateContentManifest` expects on a field I didn't directly re-verify,
or a BullMQ/ioredis connection-option incompatibility with your Redis
version. Both are fast to diagnose with real error output, which is exactly
where Claude Code becomes the better tool than continuing here blind.
