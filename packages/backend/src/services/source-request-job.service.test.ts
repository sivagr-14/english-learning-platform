jest.mock("srt-parser-2", () => ({
  __esModule: true,
  default: class {
    fromSrt() {
      return [];
    }
  },
}));
jest.mock("epub2", () => ({
  __esModule: true,
  default: { createAsync: jest.fn() },
}));

import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { SourceRequestJobService } from "./source-request-job.service";

describe("durable source request jobs", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "source-request-jobs-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test("returns immediately and completes through status polling", async () => {
    const request = {
      requestId: "source-request-test",
      reconciliation: { readableWords: 50000, processingChunks: 40 },
    };
    const builder = jest.fn(async () => request) as any;
    const service = new SourceRequestJobService({}, directory, builder);
    const created = await service.create("user-1", {
      sourceName: "large.txt",
      contentBase64: Buffer.from("large source").toString("base64"),
    });

    expect(created.status).toBe("queued");
    expect(created.request).toBeUndefined();

    let current = created;
    for (let attempt = 0; attempt < 50 && current.status !== "completed"; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      current = (await service.get("user-1", created.id))!;
    }

    expect(current.status).toBe("completed");
    expect(current.request).toEqual(request);
    expect(builder).toHaveBeenCalledTimes(1);
  });

  test("does not expose another user's source job", async () => {
    const service = new SourceRequestJobService(
      {},
      directory,
      (async () => ({ requestId: "source-request-test" })) as any,
    );
    const created = await service.create("user-1", {
      sourceName: "private.txt",
      contentBase64: Buffer.from("private source").toString("base64"),
    });

    await expect(service.get("user-2", created.id)).resolves.toBeNull();
  });
});
