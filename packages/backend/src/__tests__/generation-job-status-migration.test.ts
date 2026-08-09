import fs from "fs";
import path from "path";

describe("generation job status contract migration", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations/9999_reconcile_generation_job_status_contract.ts",
    ),
    "utf8",
  );

  it("replaces legacy constraints with the shared operational states", () => {
    for (const status of [
      "queued",
      "extracting",
      "assessing",
      "processing",
      "generating",
      "validating",
      "committed",
      "completed",
      "attention_required",
      "manual_review",
      "failed",
      "cancelled",
    ]) {
      expect(source).toContain(`"${status}"`);
    }
    expect(source).toContain("DROP CONSTRAINT IF EXISTS generation_jobs_status_check");
    expect(source).toContain('.where({ status: "approved" })');
    expect(source).toContain('.update({ status: "processing"');
    expect(source).not.toMatch(/^[^/\n]*"approved",?$/m);
  });
});
