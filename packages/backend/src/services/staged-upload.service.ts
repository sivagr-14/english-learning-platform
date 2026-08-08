import { createHash, randomUUID } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, open, stat, unlink } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { Transform } from "stream";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const STAGED_UPLOAD_ROOT = path.resolve(
  process.env.GENERATION_STAGING_DIR ||
    path.join(process.cwd(), "var", "generation-staging"),
);
const SUPPORTED = new Set(["text", "pdf", "srt", "docx", "epub"]);

export class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "INVALID_UPLOAD",
  ) {
    super(message);
  }
}

export function validateUploadMetadata(
  sourceType: string,
  filename: string,
  declaredSize?: number,
) {
  if (!SUPPORTED.has(sourceType))
    throw new UploadValidationError(
      `Unsupported file type: ${sourceType}`,
      415,
      "UNSUPPORTED_FILE_TYPE",
    );
  if (!filename || filename.length > 255)
    throw new UploadValidationError("A valid filename is required");
  const extension = path.extname(filename).slice(1).toLowerCase();
  const allowedExtensions: Record<string, string[]> = {
    text: ["txt", "md"],
    pdf: ["pdf"],
    srt: ["srt"],
    docx: ["docx"],
    epub: ["epub"],
  };
  if (!allowedExtensions[sourceType]?.includes(extension))
    throw new UploadValidationError(
      `Filename extension does not match source type ${sourceType}`,
      415,
      "FILE_TYPE_MISMATCH",
    );
  if (declaredSize !== undefined && declaredSize > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(
      `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`,
      413,
      "FILE_TOO_LARGE",
    );
  }
}

export async function validateStagedFileContent(
  stagedPath: string,
  sourceType: string,
) {
  const handle = await open(stagedPath, "r");
  try {
    const buffer = Buffer.alloc(8);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);
    if (sourceType === "pdf" && head.toString("ascii", 0, 5) !== "%PDF-")
      throw new UploadValidationError(
        "File content is not a valid PDF",
        415,
        "FILE_CONTENT_MISMATCH",
      );
    if (
      ["docx", "epub"].includes(sourceType) &&
      !(head[0] === 0x50 && head[1] === 0x4b)
    )
      throw new UploadValidationError(
        `File content is not a valid ${sourceType.toUpperCase()} archive`,
        415,
        "FILE_CONTENT_MISMATCH",
      );
    if (["text", "srt"].includes(sourceType) && head.includes(0))
      throw new UploadValidationError(
        "Text upload contains binary data",
        415,
        "FILE_CONTENT_MISMATCH",
      );
  } finally {
    await handle.close();
  }
}

export async function stageUpload(input: {
  stream: NodeJS.ReadableStream;
  ownerId: string;
  filename: string;
  sourceType: string;
  expectedHash?: string;
}) {
  validateUploadMetadata(input.sourceType, input.filename);
  await mkdir(STAGED_UPLOAD_ROOT, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const stagedPath = path.join(STAGED_UPLOAD_ROOT, id);
  const hash = createHash("sha256");
  let size = 0;
  const guard = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES)
        return callback(
          new UploadValidationError(
            `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`,
            413,
            "FILE_TOO_LARGE",
          ),
        );
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      input.stream as any,
      guard,
      createWriteStream(stagedPath, { flags: "wx", mode: 0o600 }),
    );
    const digest = hash.digest("hex");
    if (input.expectedHash && input.expectedHash.toLowerCase() !== digest) {
      throw new UploadValidationError(
        "Uploaded file hash does not match the declared SHA-256",
        422,
        "HASH_MISMATCH",
      );
    }
    return { id, path: stagedPath, hash: digest, size };
  } catch (error) {
    await unlink(stagedPath).catch(() => undefined);
    throw error;
  }
}

export async function openStagedUpload(stagedPath: string) {
  const resolved = path.resolve(stagedPath);
  if (!resolved.startsWith(`${STAGED_UPLOAD_ROOT}${path.sep}`))
    throw new Error("Invalid staged upload path");
  await stat(resolved);
  return createReadStream(resolved);
}

export async function removeStagedUpload(stagedPath?: string | null) {
  if (!stagedPath) return;
  const resolved = path.resolve(stagedPath);
  if (!resolved.startsWith(`${STAGED_UPLOAD_ROOT}${path.sep}`)) return;
  await unlink(resolved).catch(() => undefined);
}
