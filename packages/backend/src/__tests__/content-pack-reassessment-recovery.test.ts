import fs from "fs";
import path from "path";
import { ContentPackService } from "../services/content-pack.service";

describe("immutable reassessment recovery", () => {
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations/10000_reconcile_reassessment_job_identity.ts",
    ),
    "utf8",
  );

  it("replaces source-level job uniqueness with assessment-level identity", () => {
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS generation_jobs_user_id_source_hash_unique",
    );
    expect(migration).toContain("generation_jobs_owner_assessment_unique");
    expect(migration).toContain("(owner_user_id, assessment_run_id)");
  });

  it("does not expose internal provider validation rows as ChatGPT corrections", async () => {
    const rows = [
      {
        document_path: "inapp/inapp-legacy/manifest.json",
        pack_id: "inapp-legacy",
        status: "active",
        issues: "[]",
      },
      {
        document_path: "content-packs/inbox/example/manifest.json",
        pack_id: "example",
        status: "active",
        issues: "[]",
      },
    ];
    const query: any = {
      where(values: Record<string, unknown>) {
        for (const [key, value] of Object.entries(values)) {
          rows.splice(
            0,
            rows.length,
            ...rows.filter((row: any) => row[key] === value),
          );
        }
        return this;
      },
      whereNot(column: string, operator: string, value: string) {
        if (operator === "like" && value.endsWith("%")) {
          const prefix = value.slice(0, -1);
          rows.splice(
            0,
            rows.length,
            ...rows.filter(
              (row: any) => !String(row[column] || "").startsWith(prefix),
            ),
          );
        }
        return this;
      },
      orderBy() {
        return this;
      },
      select() {
        return Promise.resolve(rows);
      },
    };
    const database = (() => query) as any;
    const errors = await new ContentPackService(database).listIngestErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].document_path).toContain("content-packs/inbox/");
  });
});
