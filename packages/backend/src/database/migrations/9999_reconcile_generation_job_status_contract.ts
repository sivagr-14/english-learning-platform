const GENERATION_JOB_STATUSES = [
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
] as const;

export async function up(knex: any): Promise<void> {
  if (!(await knex.schema.hasTable("generation_jobs"))) {
    throw new Error("generation_jobs is missing; apply the foundation migrations first");
  }

  const allowed = GENERATION_JOB_STATUSES.map(
    (status) => `'${status}'`,
  ).join(", ");

  // Older installations retained a narrower check constraint even after later
  // code and columns were updated. Remove the retired cross-lifecycle value
  // before installing the complete shared ChatGPT/Gemini status contract.
  await knex.raw(
    `ALTER TABLE generation_jobs
       DROP CONSTRAINT IF EXISTS generation_jobs_status_check`,
  );
  await knex("generation_jobs")
    .where({ status: "approved" })
    .update({ status: "processing", updated_at: knex.fn.now() });
  await knex.raw(
    `ALTER TABLE generation_jobs
       ADD CONSTRAINT generation_jobs_status_check
       CHECK (status IN (${allowed}))`,
  );
}

export async function down(): Promise<void> {
  // Preserve the widened constraint and every durable job row. A narrower
  // rollback could make valid ChatGPT or Gemini jobs unreadable.
}
