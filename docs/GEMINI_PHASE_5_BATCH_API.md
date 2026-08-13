# Gemini Phase 5 — Batch API execution

Gemini lesson generation now has three user-selectable modes:

- Automatic: Standard API for 1–20 approved entries requiring generation; Batch API for 21 or more.
- Standard: immediate standard-price requests.
- Batch: asynchronous provider batch processing at the published discounted rate.

The threshold uses the immutable generation plan after assessment, never raw extracted candidates. Existing, filtered, rejected, and attention-required candidates do not count.

Provider Batch jobs are separate from content-pack lesson cycles, which contain
1–100 entries and are balanced to 50–100 entries when a plan exceeds 100.
Provider resource names and per-candidate request identities are stored durably.
Polling resumes after app restarts, unordered results reconcile by immutable
candidate ID, valid partial results are saved immediately, and only failed or
missing candidates are submitted in a later cycle.

Batch creation is never blindly retried because Google's create operation is not idempotent. An uncertain creation result stops for attention and tells the user to inspect existing Gemini batches first. Cancellation calls the provider before marking the local job cancelled.

Every returned lesson still passes the shared structured-output and semantic quality gate before durable persistence. Completion still requires content-pack reconciliation, transactional import, and PostgreSQL read-back verification.
