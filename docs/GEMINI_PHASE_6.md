# Gemini Phase 6 — measured cost optimization

Gemini cost reporting is derived from durable provider attempts. It records input, output, cached and thinking tokens, request type, attempt, model, execution mode, latency, pricing version and calculated cost without storing prompt or source content.

Cost previews use rolling observed averages for the same pipeline when samples exist and explicitly report whether the estimate is observed or fallback. Retries remain separate attempts and are included in totals.

Context caching is opt-in only when the estimated repeated-input saving exceeds cache storage cost for the configured lifetime. The decision and estimate are recorded; caching is never claimed when the provider did not report cached tokens.

Flash-Lite is limited to low-risk assessment and remains disabled unless both the Phase 4 benchmark gate is `passed` and the feature flag is enabled. Sense resolution, Tamil, and full eight-section lessons remain on Gemini 2.5 Flash.

Published prices change. The pricing table is versioned and unknown models fail closed rather than silently inheriting an unrelated rate.
