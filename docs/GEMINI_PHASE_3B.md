# Gemini in-app generation (GEM-01–GEM-07)

Gemini is an optional local workflow and is disabled unless `GEMINI_ENABLED=true`.
Put the API key only in the ignored `.env.local`; the backend returns boolean
configuration status and never returns or logs the key or provider source text.

The pipeline keeps deterministic extraction authoritative. Gemini must return
exactly one schema-constrained decision for each stable candidate ID. The
provider cannot add, drop, merge or rename inventory items. The shared manifest,
taxonomy and `simplified-v2` validators remain the import boundary.

Generation plans are deterministic, normally eight entries per batch, with
larger plans balanced into batches of five to ten. Each lesson is persisted
before the worker advances. English meaning and evidence must match the assessed
sense exactly; Tamil must contain Tamil text and teach only that sense.

Set `GEMINI_WARNING_BUDGET_USD` and `GEMINI_HARD_BUDGET_USD` locally. Before
each new lesson call, the worker checks the hard budget and moves the job to
`attention_required` without discarding valid durable results. Attempts store
request type, model, prompt version, input/output/cached tokens, latency and cost;
they never store prompt/source content.

The Import (AI) screen shows masked configuration state, offers an authenticated
connectivity test, accepts per-job budgets, and reports durable progress, token
totals, cost, cancellation and budget stops across browser refreshes.
