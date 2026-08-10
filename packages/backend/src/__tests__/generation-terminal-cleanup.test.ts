import fs from "fs";
import path from "path";

describe("ChatGPT-only generation entry points", () => {
  const backend = fs.readFileSync(
    path.join(__dirname, "../index.ts"),
    "utf8",
  );
  const importPage = fs.readFileSync(
    path.join(__dirname, "../../../frontend/app/import/page.tsx"),
    "utf8",
  );
  const reviewPage = fs.readFileSync(
    path.join(__dirname, "../../../frontend/app/candidate-review/page.tsx"),
    "utf8",
  );
  const devScript = fs.readFileSync(
    path.join(__dirname, "../../../../scripts/dev.js"),
    "utf8",
  );

  it("does not mount the retired in-app provider API", () => {
    expect(backend).not.toContain('app.use("/api/generation"');
    expect(backend).toContain("ChatGPT content packs only");
  });

  it("redirects legacy provider and review pages to ChatGPT Imports", () => {
    expect(importPage).toContain('redirect("/generate")');
    expect(reviewPage).toContain('redirect("/generate")');
  });

  it("does not start the retired generation worker", () => {
    expect(devScript).not.toContain("english-learning-backend', 'run', 'worker");
  });
});
