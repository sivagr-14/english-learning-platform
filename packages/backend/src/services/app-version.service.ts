import { execFileSync } from "child_process";
import path from "path";

type RevisionCommand = (
  command: string,
  args: string[],
  options: { cwd: string; encoding: "utf8" },
) => string | Buffer;

interface RevisionOptions {
  environment?: NodeJS.ProcessEnv;
  repositoryRoot?: string;
  execute?: RevisionCommand;
}

function normalizeRevision(value: string | undefined) {
  const revision = value?.trim();
  return revision && /^[0-9a-f]{7,40}$/i.test(revision)
    ? revision.slice(0, 8).toLowerCase()
    : null;
}

export function resolveAppRevision({
  environment = process.env,
  repositoryRoot = path.resolve(__dirname, "../../../.."),
  execute = (command, args, options) => execFileSync(command, args, options),
}: RevisionOptions = {}) {
  const configured = normalizeRevision(environment.APP_REVISION);
  if (configured) return configured;

  try {
    const output = execute("git", ["rev-parse", "--short=8", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    return normalizeRevision(String(output)) || "unknown";
  } catch {
    return "unknown";
  }
}

export const appRevision = resolveAppRevision();
