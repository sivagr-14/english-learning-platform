# ChatGPT content inbox

This directory is populated on the private `chatgpt-content-inbox` branch.
Application code remains on `main`.

Each import uses one immutable manifest plus numbered lesson batches:

```text
content-packs/inbox/<manifest-id>/manifest.json
content-packs/inbox/<manifest-id>/batch-001.json
content-packs/inbox/<manifest-id>/batch-002.json
```

The Mac fetches this branch without switching branches or changing the working
tree. PostgreSQL records the manifest and batch hashes, so repeated fetches are
idempotent and changed content under a reused ID becomes a visible conflict.

