import knexFactory from "knex";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const requiredColumns = [
  "id",
  "owner_user_id",
  "assessment_run_id",
  "operation_id",
  "total_items",
  "completed_items",
  "failed_items",
  "manual_review_items",
];

const requiredJobStatuses = [
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
];

async function main(): Promise<void> {
  const db = knexFactory({
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "english_learning",
    },
  });
  try {
    const result: any = await db.raw("select current_database() as current_database");
    const database = result.rows[0].current_database;
    if (!(await db.schema.hasTable("generation_jobs"))) {
      throw new Error(`Database ${database} is missing table generation_jobs`);
    }
    const missing: string[] = [];
    for (const column of requiredColumns) {
      if (!(await db.schema.hasColumn("generation_jobs", column))) missing.push(column);
    }
    if (missing.length) {
      throw new Error(
        `Database ${database} has an incomplete generation_jobs schema; missing: ${missing.join(", ")}`,
      );
    }

    const constraintResult: any = await db.raw(`
      SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
       WHERE conrelid = 'generation_jobs'::regclass
         AND conname = 'generation_jobs_status_check'
    `);
    const definition = constraintResult.rows[0]?.definition || "";
    const missingStatuses = requiredJobStatuses.filter(
      (status) => !definition.includes(`'${status}'`),
    );
    if (missingStatuses.length) {
      throw new Error(
        `Database ${database} has an outdated generation_jobs status constraint; missing: ${missingStatuses.join(", ")}`,
      );
    }
    if (definition.includes("'approved'")) {
      throw new Error(
        `Database ${database} still permits the retired generation job status approved`,
      );
    }

    console.log(
      JSON.stringify({
        database,
        generationJobsSchema: "ready",
        generationJobStatuses: "ready",
      }),
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
