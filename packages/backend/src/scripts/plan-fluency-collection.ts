import fs from "fs";
import { createCollectionPlan } from "../services/collection-plan";

const [collectionId, output, ...inputs] = process.argv.slice(2);
if (!collectionId || !output || !inputs.length)
  throw new Error(
    "Usage: collection:plan <new-collection-id> <output.json> <validated-manifest.json> [...]",
  );
const plan = createCollectionPlan(
  collectionId,
  inputs.map((file) => JSON.parse(fs.readFileSync(file, "utf8"))),
);
// Never overwrite a frozen collection index, including on retries.
const bytes = JSON.stringify(plan, null, 2) + "\n";
if (fs.existsSync(output)) {
  if (fs.readFileSync(output, "utf8") !== bytes)
    throw new Error(
      "Immutable collection conflict: use a new identity and output path",
    );
} else fs.writeFileSync(output, bytes, { flag: "wx" });
console.log(
  JSON.stringify({
    collectionId,
    entries: plan.entryCount,
    visiblePacks: plan.packs.length,
    hash: plan.hash,
  }),
);
