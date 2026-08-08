import {
  durableHash,
  manifestIdentity,
} from "./provider-neutral-job.repository";

describe("provider-neutral durable job identity", () => {
  const identity = {
    sourceHash: "a".repeat(64),
    promptVersion: "prompt-v1",
    contractVersion: "manifest-v3/simplified-v2",
    policySnapshot: { frequencies: ["heavy", "medium"], maxBatch: 10 },
  };

  it("is deterministic for reordered policy keys", () => {
    expect(manifestIdentity(identity)).toBe(
      manifestIdentity({
        ...identity,
        policySnapshot: { maxBatch: 10, frequencies: ["heavy", "medium"] },
      }),
    );
  });

  it("does not include provider or model in manifest identity", () => {
    const geminiSelection = { ...identity, provider: "gemini", model: "flash" };
    const chatgptSelection = {
      ...identity,
      provider: "chatgpt",
      model: "chatgpt",
    };
    expect(manifestIdentity(geminiSelection)).toBe(
      manifestIdentity(chatgptSelection),
    );
  });

  it("changes identity when validation policy or contract changes", () => {
    expect(manifestIdentity(identity)).not.toBe(
      manifestIdentity({ ...identity, contractVersion: "manifest-v4" }),
    );
    expect(durableHash(identity.policySnapshot)).not.toBe(
      durableHash({ frequencies: ["heavy"], maxBatch: 10 }),
    );
  });
});
