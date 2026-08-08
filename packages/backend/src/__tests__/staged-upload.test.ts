import { Readable } from "stream";
import { readFile } from "fs/promises";
import { createHash } from "crypto";
import {
  removeStagedUpload,
  stageUpload,
  validateUploadMetadata,
} from "../services/staged-upload.service";

describe("REL-05 private streaming upload staging", () => {
  it("streams bytes to a private staged file and verifies SHA-256", async () => {
    const content = Buffer.from("streamed source content");
    const expectedHash = createHash("sha256").update(content).digest("hex");
    const staged = await stageUpload({
      stream: Readable.from([content]),
      ownerId: "user",
      filename: "source.pdf",
      sourceType: "pdf",
      expectedHash,
    });
    try {
      expect(staged).toMatchObject({
        hash: expectedHash,
        size: content.length,
      });
      expect(await readFile(staged.path)).toEqual(content);
    } finally {
      await removeStagedUpload(staged.path);
    }
  });

  it("rejects unsupported formats and mismatched hashes without permanent data", async () => {
    expect(() => validateUploadMetadata("exe", "bad.exe")).toThrow(
      "Unsupported",
    );
    await expect(
      stageUpload({
        stream: Readable.from(["data"]),
        ownerId: "user",
        filename: "source.txt",
        sourceType: "text",
        expectedHash: "0".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "HASH_MISMATCH" });
  });
});
