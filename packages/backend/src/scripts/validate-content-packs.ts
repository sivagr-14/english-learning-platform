import fs from "fs";
import path from "path";
import {
  ContentManifest,
  parseContentPack,
  validateContentBatch,
  validateContentManifest,
} from "../services/content-pack-contract";
import { loadContentPackDocuments } from "../services/content-pack.service";

function main() {
  const directory = path.resolve(
    process.argv[2] || path.resolve(process.cwd(), "content-packs", "inbox"),
  );
  if (!fs.existsSync(directory)) {
    throw new Error(`Content-pack directory does not exist: ${directory}`);
  }
  const documents = loadContentPackDocuments(directory).map((document) => ({
    ...document,
    value: parseContentPack(document.content) as any,
  }));
  const manifests = new Map<string, ContentManifest>();
  const errors: string[] = [];
  for (const document of documents.filter((item) =>
    item.value?.formatVersion?.includes("manifest"),
  )) {
    const result = validateContentManifest(document.value);
    if (result.valid && result.value) {
      manifests.set(result.value.manifestId, result.value);
    } else {
      errors.push(`${document.path}: ${result.issues.join("; ")}`);
    }
  }
  for (const document of documents.filter((item) =>
    item.value?.formatVersion?.includes("batch"),
  )) {
    const manifest = manifests.get(document.value?.manifestId);
    const result = validateContentBatch(document.value, manifest);
    if (!result.valid)
      errors.push(`${document.path}: ${result.issues.join("; ")}`);
  }
  if (errors.length) {
    throw new Error(
      `Content-pack validation failed:\n- ${errors.join("\n- ")}`,
    );
  }
  console.log(
    `Validated ${manifests.size} manifest(s) and ${documents.length - manifests.size} batch(es).`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
