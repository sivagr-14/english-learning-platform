import fs from "fs";
import path from "path";

describe("022 provider-neutral generation migration", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations/022_provider_neutral_generation_model.ts",
    ),
    "utf8",
  );

  it("contains every durable BASE-02 ledger", () => {
    for (const table of [
      "generation_job_segments",
      "generation_candidate_decisions",
      "generation_candidate_occurrences",
      "generation_plan_batches",
      "generation_plan_members",
      "generation_attempts",
      "generation_results",
      "generation_validation_failures",
      "generation_job_events",
    ]) {
      expect(source).toMatch(new RegExp(`createTable\\(\\s*["']${table}["']`));
    }
  });

  it("is additive, backfills legacy provider metadata, and protects segments", () => {
    expect(source).toContain('alterTable("generation_jobs"');
    expect(source).toContain("operation_id LIKE 'in-app:%' THEN 'gemini'");
    expect(source).toContain("ELSE 'chatgpt'");
    expect(source).toContain("generation segment ledger content is immutable");
    expect(source).not.toContain('dropTableIfExists("generation_jobs")');
  });
});
