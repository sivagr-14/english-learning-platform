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

  it("marks a reused batch ID with changed content as a conflict", async () => {
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
      "conflict",
    );
  });
});
