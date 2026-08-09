import { selectGenerationResumeStage } from "./generation-recovery.service";

function databaseFor(input: {
  job?: any;
  manifest?: any;
  extracted?: any;
  staged?: any;
  plan?: any[];
}) {
  const db: any = (table: string) => {
    const rows: Record<string, any> = {
      generation_jobs: input.job,
      content_pack_manifests: input.manifest,
      generation_job_segments: input.extracted || input.staged,
    };
    const builder: any = {
      where: () => builder,
      andWhere: (_column: string, operator: string) => {
        if (table === "generation_job_segments") {
          rows[table] = operator === ">" ? input.extracted : input.staged;
        }
        return builder;
      },
      first: async () => rows[table],
      join: () => builder,
      leftJoin: () => builder,
      select: () => builder,
      orderBy: async () => input.plan || [],
    };
    return builder;
  };
  db.raw = jest.fn();
  return db;
}

describe("Gemini Phase 3 durable recovery selection", () => {
  it("resumes extraction or assessment from the last durable source boundary", async () => {
    await expect(selectGenerationResumeStage(databaseFor({
      job: { id: "job", status: "failed", staged_upload_path: "/staged" },
    }), "user", "job")).resolves.toMatchObject({ stage: "extract" });
    await expect(selectGenerationResumeStage(databaseFor({
      job: { id: "job", status: "failed" }, extracted: { id: "segment" },
    }), "user", "job")).resolves.toMatchObject({ stage: "assess" });
  });

  it("resumes only missing generation members", async () => {
    const recovery = await selectGenerationResumeStage(databaseFor({
      job: { id: "job", status: "failed", manifest_id: "manifest", stage_progress: "{}" },
      manifest: { id: "manifest", manifest_hash: "hash" },
      plan: [{ external_candidate_id: "a", result_id: null, validation_status: null }],
    }), "user", "job");
    expect(recovery).toEqual({
      stage: "generate",
      progressPatch: { manifestId: "manifest", manifestHash: "hash" },
    });
  });

  it("skips provider generation and resumes commit when every result is durable", async () => {
    await expect(selectGenerationResumeStage(databaseFor({
      job: { id: "job", status: "failed", manifest_id: "manifest", stage_progress: "{}" },
      manifest: { id: "manifest", manifest_hash: "hash" },
      plan: [{ external_candidate_id: "a", result_id: "result", validation_status: "valid" }],
    }), "user", "job")).resolves.toMatchObject({ stage: "commit" });
  });

  it("refuses cancelled and already-verified terminal jobs", async () => {
    await expect(selectGenerationResumeStage(databaseFor({
      job: { id: "job", status: "cancelled", cancellation_requested_at: new Date() },
    }), "user", "job")).rejects.toThrow("cancelled generation job");
    await expect(selectGenerationResumeStage(databaseFor({
      job: { id: "job", status: "committed" },
    }), "user", "job")).rejects.toThrow("already completed and verified");
  });
});
