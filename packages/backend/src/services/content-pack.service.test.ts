import { STARTER_SAMPLES } from "../data/starter-samples";
import { contentPackHash } from "./content-pack-contract";
import { ContentPackService } from "./content-pack.service";

class MemoryQuery {
  private predicates: Array<(row: any) => boolean> = [];

  constructor(
    private readonly rows: any[],
    private readonly database: MemoryDatabase,
  ) {}

  where(values: Record<string, unknown>) {
    this.predicates.push((row) =>
      Object.entries(values).every(([key, value]) => row[key] === value),
    );
    return this;
  }

  whereNot(column: string, operator: string, value: unknown) {
    this.predicates.push((row) => {
      if (operator === "like" && typeof value === "string") {
        const prefix = value.endsWith("%") ? value.slice(0, -1) : value;
        return !String(row[column] || "").startsWith(prefix);
      }
      return row[column] !== value;
    });
    return this;
  }

  whereNotIn(column: string, values: unknown[]) {
    this.predicates.push((row) => !values.includes(row[column]));
    return this;
  }

  whereNotNull(column: string) {
    this.predicates.push(
      (row) => row[column] !== null && row[column] !== undefined,
    );
    return this;
  }

  whereNull(column: string) {
    this.predicates.push(
      (row) => row[column] === null || row[column] === undefined,
    );
    return this;
  }

  orderBy() {
    return this;
  }

  private matches() {
    return this.rows.filter((row) =>
      this.predicates.every((predicate) => predicate(row)),
    );
  }

  async first() {
    return this.matches()[0];
  }

  async insert(value: any) {
    const values = Array.isArray(value) ? value : [value];
    for (const row of values) this.rows.push({ ...row });
    return values;
  }

  async update(value: any) {
    const matches = new Set(this.matches());
    for (const row of this.rows) {
      if (matches.has(row)) Object.assign(row, value);
    }
    return matches.size;
  }

  async select() {
    return this.matches().map((row) => ({ ...row }));
  }
}

class MemoryDatabase {
  tables: Record<string, any[]> = {
    content_pack_manifests: [],
    content_pack_batches: [],
    content_pack_ingest_errors: [],
  };

  query(table: string) {
    this.tables[table] ||= [];
    return new MemoryQuery(this.tables[table], this);
  }
}

function databaseDouble() {
  const memory = new MemoryDatabase();
  const callable = ((table: string) => memory.query(table)) as any;
  callable.memory = memory;
  return callable;
}

function smokeDocuments() {
  const sample = STARTER_SAMPLES[0];
  const manifest: any = {
    formatVersion: "chatgpt-vocabulary-manifest-v1",
    manifestId: "service-smoke-001",
    createdAt: "2026-08-01T12:00:00.000Z",
    source: {
      name: "Service smoke text",
      type: "text",
      contentHash: "c".repeat(64),
      totalPages: 1,
      totalChunks: 1,
    },
    coverage: {
      pages: [{ page: 1, status: "assessed", chunkIds: ["chunk-001"] }],
      chunks: [
        {
          chunkId: "chunk-001",
          pageStart: 1,
          pageEnd: 1,
          status: "assessed",
          candidateIds: ["candidate-001"],
        },
      ],
    },
    candidates: [
      {
        candidateId: "candidate-001",
        term: sample.word,
        baseForm: sample.word,
        itemType: sample.itemType,
        decision: "generate",
        operation: "new",
        cefrLevel: sample.cefrLevel,
        usageFrequency: "heavy",
        fluencyValue: "essential",
        categoryName: sample.categoryName,
        contextualMeaning: sample.englishMeaning,
        occurrences: [
          {
            page: 1,
            chunkId: "chunk-001",
            sentence: sample.lesson.meaning_in_context.source_sentence,
          },
        ],
      },
    ],
    counts: {
      totalCandidates: 1,
      generate: 1,
      existing: 0,
      filtered: 0,
      rejected: 0,
      heavyUse: 1,
      mediumUse: 0,
    },
    generationPlan: {
      batchSize: 8,
      batches: [{ batchNumber: 1, candidateIds: ["candidate-001"] }],
    },
  };
  const batch: any = {
    formatVersion: "chatgpt-vocabulary-batch-v1",
    batchId: "service-smoke-001-batch-001",
    manifestId: manifest.manifestId,
    manifestHash: contentPackHash(manifest),
    batchNumber: 1,
    createdAt: "2026-08-01T12:05:00.000Z",
    entries: [
      {
        candidateId: "candidate-001",
        word: sample.word,
        pronunciation: sample.pronunciation,
        wordType: sample.wordType,
        englishMeaning: sample.englishMeaning,
        tamilMeaning: sample.tamilMeaning,
        coreIdea: sample.coreIdea,
        lesson: sample.lesson,
      },
    ],
  };
  return {
    manifest,
    batch,
    documents: [
      { path: "manifest.json", content: JSON.stringify(manifest) },
      { path: "batch-001.json", content: JSON.stringify(batch) },
    ],
  };
}

describe("ChatGPT content-pack staging ledger", () => {
  it("stages one manifest and batch idempotently", async () => {
    const database = databaseDouble();
    const service = new ContentPackService(database);
    const { documents } = smokeDocuments();

    const first = await service.ingestDocuments(documents);
    expect(first).toMatchObject({
      manifestsAdded: 1,
      batchesAdded: 1,
      unchanged: 0,
      errors: [],
    });
    expect(database.memory.tables.content_pack_manifests).toHaveLength(1);
    expect(database.memory.tables.content_pack_batches).toHaveLength(1);

    const retry = await service.ingestDocuments(documents);
    expect(retry.unchanged).toBe(2);
    expect(database.memory.tables.content_pack_manifests).toHaveLength(1);
    expect(database.memory.tables.content_pack_batches).toHaveLength(1);
  });

  it("does not process an owned manifest during account-neutral staging", async () => {
    const database = databaseDouble();
    const service = new ContentPackService(database);
    const { documents } = smokeDocuments();
    await service.ingestDocuments(documents, {
      inboxBranch: "chatgpt-content-inbox",
      fetchedCommit: "a".repeat(40),
    });
    Object.assign(database.memory.tables.content_pack_manifests[0], {
      owner_user_id: "user-1",
      approved_at: new Date(),
    });
    const commit = jest
      .spyOn(service, "commitAvailableBatches")
      .mockResolvedValue(1);
    const verify = jest.spyOn(service, "verifyManifest").mockResolvedValue({
      verified: true,
      entries: 1,
      issues: [],
    });

    const retry = await service.ingestDocuments(documents, {
      inboxBranch: "chatgpt-content-inbox",
      fetchedCommit: "b".repeat(40),
    });

    expect(retry).toMatchObject({
      committedEntries: 0,
      cleanupEligible: [],
      errors: [],
    });
    expect(commit).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("reopens a stale cleanup marker when the pack is fetched again", async () => {
    const database = databaseDouble();
    const service = new ContentPackService(database);
    const { documents } = smokeDocuments();
    await service.ingestDocuments(documents, {
      inboxBranch: "chatgpt-content-inbox",
      fetchedCommit: "a".repeat(40),
    });
    Object.assign(database.memory.tables.content_pack_manifests[0], {
      inbox_cleaned_at: new Date("2026-08-09T12:00:00.000Z"),
      inbox_cleanup_commit: "b".repeat(40),
    });

    await service.ingestDocuments(documents, {
      inboxBranch: "chatgpt-content-inbox",
      fetchedCommit: "c".repeat(40),
    });

    expect(database.memory.tables.content_pack_manifests[0]).toMatchObject({
      inbox_branch: "chatgpt-content-inbox",
      fetched_commit: "c".repeat(40),
      inbox_cleaned_at: null,
      inbox_cleanup_commit: null,
    });
  });

  it("resolves disappeared ChatGPT errors without resolving in-app diagnostics", async () => {
    const database = databaseDouble();
    database.memory.tables.content_pack_ingest_errors.push(
      {
        id: "chatgpt-stale",
        document_path: "removed/manifest.json",
        status: "active",
      },
      {
        id: "inapp-stale",
        document_path: "inapp/internal/manifest.json",
        status: "active",
      },
    );
    const service = new ContentPackService(database);
    const { documents } = smokeDocuments();

    await service.ingestDocuments(documents);

    expect(database.memory.tables.content_pack_ingest_errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "chatgpt-stale", status: "resolved" }),
        expect.objectContaining({ id: "inapp-stale", status: "active" }),
      ]),
    );
  });

  it("does not reconcile ChatGPT errors during an in-app ingestion", async () => {
    const database = databaseDouble();
    database.memory.tables.content_pack_ingest_errors.push({
      id: "chatgpt-stale",
      document_path: "removed/manifest.json",
      status: "active",
    });
    const service = new ContentPackService(database);
    const { documents } = smokeDocuments();

    await service.ingestDocuments(documents, { inboxBranch: "inapp" });

    expect(database.memory.tables.content_pack_ingest_errors[0]).toMatchObject({
      id: "chatgpt-stale",
      status: "active",
    });
  });

  it("rejects a changed reused batch ID without mutating saved content", async () => {
    const database = databaseDouble();
    const service = new ContentPackService(database);
    const { documents, batch } = smokeDocuments();
    await service.ingestDocuments(documents);

    batch.entries[0].coreIdea =
      "A changed but still useful core idea must not replace an immutable batch.";
    const conflict = await service.ingestDocuments([
      { path: "batch-001.json", content: JSON.stringify(batch) },
    ]);

    expect(conflict.errors[0].message).toMatch(/different content/i);
    expect(database.memory.tables.content_pack_batches[0].status).toBe(
      "staged",
    );
    expect(database.memory.tables.content_pack_batches[0].payload).toBe(
      documents[1].content,
    );
  });

  it("rejects a changed reused manifest ID without mutating saved content", async () => {
    const database = databaseDouble();
    const service = new ContentPackService(database);
    const { documents, manifest } = smokeDocuments();
    await service.ingestDocuments(documents);
    const original = { ...database.memory.tables.content_pack_manifests[0] };

    manifest.source.name = "Changed immutable source";
    const conflict = await service.ingestDocuments([
      { path: "manifest.json", content: JSON.stringify(manifest) },
    ]);

    expect(conflict.errors[0].message).toMatch(/different content/i);
    expect(database.memory.tables.content_pack_manifests[0]).toEqual(original);
  });
});
