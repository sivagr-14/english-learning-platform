import fs from "fs";
import path from "path";

describe("generation job source-index repair", () => {
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations/10001_remove_legacy_generation_job_source_indexes.ts",
    ),
    "utf8",
  );

  it("removes every historical source-level uniqueness variant", () => {
    expect(migration).toContain("generation_jobs_user_id_source_hash_unique");
    expect(migration).toContain("idx_generation_jobs_user_source_hash");
    expect(migration).toContain("idx_generation_jobs_user_source_provider");
    expect(migration).toContain("generation_jobs_owner_assessment_unique");
  });
});
