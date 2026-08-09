import fs from "fs";
import path from "path";

describe("Ollama provider identity migration", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../database/migrations/028_ollama_provider.ts"),
    "utf8",
  );

  it("deduplicates an imported source independently per immutable provider", () => {
    expect(source).toContain("DROP INDEX IF EXISTS idx_generation_jobs_user_source_hash");
    expect(source).toContain("ON generation_jobs (user_id, source_hash, provider)");
  });
});
