import { up } from "../database/migrations/018_generation_jobs";

function chainFor(columns: string[]) {
  const chain: any = {};
  for (const method of [
    "nullable",
    "notNullable",
    "references",
    "inTable",
    "onDelete",
    "defaultTo",
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  return new Proxy(chain, {
    get(target, property: string) {
      if (property in target) return target[property];
      return jest.fn((name: string) => {
        if (typeof name === "string") columns.push(name);
        return chain;
      });
    },
  });
}

describe("018_generation_jobs migration", () => {
  it("evolves the table created by migration 006 without recreating it", async () => {
    const existing = new Set([
      "id",
      "owner_user_id",
      "assessment_run_id",
      "operation_id",
      "status",
      "total_items",
      "completed_items",
      "failed_items",
      "manual_review_items",
      "created_at",
      "updated_at",
    ]);
    const added: string[] = [];
    const rawStatements: string[] = [];
    const table = chainFor(added);
    const schema = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn((_table: string, column: string) =>
        Promise.resolve(existing.has(column)),
      ),
      createTable: jest.fn(),
      alterTable: jest.fn(async (_table: string, callback: (builder: any) => void) => {
        const before = added.length;
        callback(table);
        added.slice(before).forEach((column) => existing.add(column));
      }),
    };
    const knex = {
      schema,
      raw: jest.fn(async (sql: string) => {
        rawStatements.push(sql);
      }),
    };

    await up(knex);

    expect(schema.createTable).not.toHaveBeenCalled();
    expect(added).toEqual(
      expect.arrayContaining([
        "user_id",
        "source_name",
        "source_type",
        "source_hash",
        "stage_progress",
        "estimated_cost",
        "actual_cost",
        "tokens_used",
        "error_message",
        "attempt_count",
        "completed_at",
      ]),
    );
    expect(rawStatements.join("\n")).toContain("SET user_id = owner_user_id");
    expect(rawStatements.join("\n")).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_jobs_user_source_hash",
    );
  });

  it("fails clearly when the foundation migration has not created the table", async () => {
    const knex = {
      schema: {
        hasTable: jest.fn().mockResolvedValue(false),
      },
    };

    await expect(up(knex)).rejects.toThrow(
      "generation_jobs must be created by 006_chatgpt_control_foundation",
    );
  });
});
