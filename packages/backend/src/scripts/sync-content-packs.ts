import path from "path";
import { execFileSync } from "child_process";
import {
  ContentPackDocument,
  ContentPackService,
  loadContentPackDocuments,
  loadContentPacksFromGit,
  resolveContentPackGitCommit,
} from "../services/content-pack.service";
import { database } from "../utils/db";

async function main() {
  const cleanupFailedIndex = process.argv.indexOf("--mark-cleanup-failed");
  if (cleanupFailedIndex >= 0) {
    const manifestId = process.argv[cleanupFailedIndex + 1];
    const message = process.argv[cleanupFailedIndex + 2];
    if (!manifestId || !message) {
      throw new Error(
        "--mark-cleanup-failed requires a manifest ID and message.",
      );
    }
    await new ContentPackService(database).markInboxCleanupFailed(
      manifestId,
      message,
    );
    console.log(JSON.stringify({ cleanupFailed: manifestId }));
    return;
  }
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
  const commitIndex = process.argv.indexOf("--fetched-commit");
  const fetchedCommit =
    commitIndex >= 0 ? process.argv[commitIndex + 1] : undefined;
  const inboxBranchIndex = process.argv.indexOf("--inbox-branch");
  const inboxBranch =
    inboxBranchIndex >= 0
      ? process.argv[inboxBranchIndex + 1]
      : gitRef
          ?.replace(/^refs\/remotes\//, "")
          .replace(/^origin\//, "");
  const directoryIndex = process.argv.indexOf("--directory");
  const directory =
    directoryIndex >= 0
      ? path.resolve(process.argv[directoryIndex + 1])
      : path.resolve(process.cwd(), "content-packs", "inbox");
  // An already-running older control process can invoke this newly updated
  // script with the logical branch plus an exact fetched commit. Always prefer
  // that immutable commit so the first Update & Restart remains compatible
  // across controller/script versions.
  const immutableGitRef = fetchedCommit || gitRef;
  const resolvedCommit = immutableGitRef
    ? resolveContentPackGitCommit(
        immutableGitRef,
        path.resolve(__dirname, "../../../.."),
        undefined,
        () => {
          execFileSync(
            "git",
            [
              "fetch",
              "origin",
              "refs/heads/chatgpt-content-inbox:refs/remotes/origin/chatgpt-content-inbox",
              "--force",
              "--depth=1",
            ],
            {
              cwd: path.resolve(__dirname, "../../../.."),
              encoding: "utf8",
            },
          );
        },
      )
    : undefined;
  const documents = resolvedCommit
    ? loadContentPacksFromGit(resolvedCommit)
    : loadContentPackDocuments(directory);
  const result = await new ContentPackService(database).ingestDocuments(
    documents,
    {
      // gitRef can be an exact commit SHA. Keep that immutable source identity
      // separate from the logical inbox branch used by processing queries.
      inboxBranch,
      fetchedCommit: fetchedCommit || resolvedCommit,
    },
  );
  console.log(
    JSON.stringify(
      {
        source: gitRef || directory,
        documents: documents.length,
        documentPaths: documents.map((document) => document.path),
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
