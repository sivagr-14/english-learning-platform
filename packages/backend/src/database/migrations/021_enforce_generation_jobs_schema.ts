import { up as repairGenerationJobsSchema } from "./020_repair_generation_jobs_schema";

// Re-enforce the idempotent repair for Macs that previously selected compiled
// production migrations or recorded an earlier repair against another DB.
export async function up(knex: any): Promise<void> {
  await repairGenerationJobsSchema(knex);
}

export async function down(): Promise<void> {
  // Preserve repaired schema and user data.
}
