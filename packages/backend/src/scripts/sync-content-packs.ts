import { execFileSync } from "child_process";
import path from "path";
import {
  ContentPackDocument,
  ContentPackService,
  loadContentPackDocuments,
} from "../services/content-pack.service";
import { database } from "../utils/db";

export function loadContentPacksFromGit(
  ref: string,
  repoRoot = path.resolve(__dirname, "../../../.."),
): ContentPackDocument[] {
  const output = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", ref, "content-packs/inbox"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.endsWith(".json"))
    .map((file) => ({
      path: file,
      content: execFileSync("git", ["show", `${ref}:${file}`], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 25 * 1024 * 1024,
      }),
    }));
}

async function main() {
  const cleanedIndex = process.argv.indexOf("--mark-cleaned");
  if (cleanedIndex >= 0) {
    const manifestId = process.argv[cleanedIndex + 1];
    const commitSha = process.argv[cleanedIndex + 2];
    if (!manifestId || !commitSha) {
      throw new Error("--mark-cleaned requires a manifest ID and commit SHA.");
    }
    await new ContentPackService(database).markInboxCleaned(
      manifestId,
      commitSha,
    );
    console.log(JSON.stringify({ markedCleaned: manifestId, commitSha }));
    return;
  }
  const refIndex = process.argv.indexOf("--git-ref");
  const gitRef = refIndex >= 0 ? process.argv[refIndex + 1] : undefined;
  const directoryIndex = process.argv.indexOf("--directory");
  const directory =
    directoryIndex >= 0
      ? path.resolve(process.argv[directoryIndex + 1])
      : path.resolve(process.cwd(), "content-packs", "inbox");
  const documents = gitRef
    ? loadContentPacksFromGit(gitRef)
    : loadContentPackDocuments(directory);
  const result = await new ContentPackService(database).ingestDocuments(
    documents,
  );
  console.log(
    JSON.stringify(
      {
        source: gitRef || directory,
        documents: documents.length,
        ...result,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await database.destroy();
    });
}
