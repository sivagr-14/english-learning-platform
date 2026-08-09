import fs from "fs";
import path from "path";

describe("Import AI terminal cleanup and fresh submission", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../services/generation-job.service.ts"),
    "utf8",
  );
  const routes = fs.readFileSync(
    path.join(__dirname, "../routes/generation.ts"),
    "utf8",
  );
  const page = fs.readFileSync(
    path.join(__dirname, "../../../frontend/app/import/page.tsx"),
    "utf8",
  );

  it("replaces failed and cancelled source matches before creating a new job", () => {
    expect(service).toContain(
      'if (!["failed", "cancelled"].includes(existing.status))',
    );
    expect(service).toContain(
      "await this.clearTerminal(input.userId, existing.id)",
    );
  });

  it("only permits destructive cleanup for terminal failed or cancelled jobs", () => {
    expect(service).toContain("Only failed or cancelled imports can be cleared.");
    expect(routes).toContain('router.delete(\n  "/jobs/failed"');
    expect(routes).toContain('router.delete(\n  "/jobs/:id"');
  });

  it("does not label cancelled or attention-required jobs as in progress", () => {
    expect(page).toContain(
      '["queued", "extracting", "assessing", "generating", "validating"]',
    );
    expect(page).toContain("Clear failed imports");
  });

  it("preserves the selected source when the exact same active job already exists", () => {
    expect(page).toContain("if (data.alreadyExisted)");
    expect(page).toContain("This exact pasted content already has an import");
    expect(page).toContain("This exact file already has an import");
  });
});
