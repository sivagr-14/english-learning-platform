import { synchronizeEnabledStarterSamples } from "../services/starter-samples.service";
import { database } from "../utils/db";

async function main() {
  const results = await synchronizeEnabledStarterSamples();
  const created = results.reduce((total, result) => total + result.created, 0);
  const updated = results.reduce((total, result) => total + result.updated, 0);
  console.log(
    `Built-in vocabulary synchronized for ${results.length} account(s): ${created} created, ${updated} updated.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.destroy();
  });
