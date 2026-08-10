jest.mock("srt-parser-2", () => ({
  __esModule: true,
  default: class {
    fromSrt(input: string) {
      return input
        ? [
            {
              text: "Look into it.",
              startTime: "00:00:01,000",
              endTime: "00:00:03,000",
            },
          ]
        : [];
    }
  },
}));
jest.mock("epub2", () => ({
  __esModule: true,
  default: { createAsync: jest.fn() },
}));

import { createHash } from "crypto";
import { buildInventory, resolveSourceType } from "./build-content-inventory";

describe("content inventory source inputs", () => {
  test.each([
    ["chapter.txt", undefined, "text"],
    ["chapter.markdown", undefined, "md"],
    ["captions.srt", undefined, "srt"],
    ["document.pdf", undefined, "pdf"],
    ["pasted-text.txt", "text", "text"],
  ])("maps %s to a supported parser type", (name, requested, expected) => {
    expect(resolveSourceType(name, requested)).toBe(expected);
  });

  test("builds a byte-exact inventory for pasted UTF-8 text", async () => {
    const bytes = Buffer.from(
      "A precise sentence.\n\nAnother useful paragraph.",
      "utf8",
    );
    const inventory = await buildInventory({
      bytes,
      sourceName: "pasted-text.txt",
      sourceType: "text",
    });

    expect(inventory.source).toMatchObject({
      name: "pasted-text.txt",
      type: "text",
      sourceHash: createHash("sha256").update(bytes).digest("hex"),
      segmentCount: 2,
    });
    expect(inventory.inventoryHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("uses the SRT parser while hashing the original subtitle bytes", async () => {
    const bytes = Buffer.from(
      "1\n00:00:01,000 --> 00:00:03,000\nLook into it.\n",
      "utf8",
    );
    const inventory = await buildInventory({
      bytes,
      sourceName: "captions.srt",
      sourceType: "srt",
    });

    expect(inventory.source.sourceHash).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    expect(inventory.segments[0].locator).toMatchObject({
      unit: "cue",
      cue: 1,
    });
  });
});
