import { up } from "../database/migrations/020_repair_generation_jobs_schema";

function columnChain(columns: string[]) {
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
  for (const method of ["uuid", "string", "integer"]) {
    chain[method] = jest.fn((name: string) => {
      columns.push(name);
      return chain;
    });
  }
  return chain;
}

describe("020_repair_generation_jobs_schema migration", () => {
  it("adds the missing ChatGPT columns and reconciles legacy in-app rows", async () => {
    const existing = new Set(["id", "user_id", "status"]);
    const added: string[] = [];
    const rawStatements: string[] = [];
    const table = columnChain(added);
    const schema = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn((_table: string, column: string) =>
        Promise.resolve(existing.has(column)),
      ),
      alterTable: jest.fn(
        async (_table: string, callback: (builder: any) => void) => {
          const before = added.length;
          callback(table);
          added.slice(before).forEach((column) => existing.add(column));
        },
      ),
    };
    const knex = {
      schema,
      raw: jest.fn(async (sql: string) => rawStatements.push(sql)),
    };

    await up(knex);

    expect(added).toEqual(
      expect.arrayContaining([
        "owner_user_id",
        "assessment_run_id",
        "operation_id",
        "total_items",
        "completed_items",
        "failed_items",
        "manual_review_items",
      ]),
    );
    const sql = rawStatements.join("\n");
    expect(sql).toContain("SET owner_user_id = user_id");
    expect(sql).toContain("legacy-generation:");
    expect(sql).toContain("assessment_run_id DROP NOT NULL");
    expect(sql).toContain("generation_jobs_assessment_owner_idx");
  });

  it("is idempotent when the repaired columns already exist", async () => {
    const existing = new Set([
      "owner_user_id",
      "assessment_run_id",
      "operation_id",
      "total_items",
      "completed_items",
      "failed_items",
      "manual_review_items",
    ]);
    const schema = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn((_table: string, column: string) =>
        Promise.resolve(existing.has(column)),
      ),
      alterTable: jest.fn(),
    };
    const knex = { schema, raw: jest.fn().mockResolvedValue(undefined) };

    await up(knex);

    expect(schema.alterTable).not.toHaveBeenCalled();
  });

  it("fails with a recoverable diagnostic when the shared table is absent", async () => {
    const knex = { schema: { hasTable: jest.fn().mockResolvedValue(false) } };
    await expect(up(knex)).rejects.toThrow("generation_jobs is missing");
  });
});
