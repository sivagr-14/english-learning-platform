import {
  enqueueAfterCommit,
  generationStageJobId,
} from "../queue/generation.queue";

describe("assessment to generation handoff", () => {
  it("never exposes a stage delivery before durable state commits", async () => {
    const order: string[] = [];
    let releaseCommit!: () => void;
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });

    const handoff = enqueueAfterCommit(
      async () => {
        order.push("transaction-started");
        await commitGate;
        order.push("transaction-committed");
      },
      async () => {
        order.push("queue-delivered");
      },
    );

    await Promise.resolve();
    expect(order).toEqual(["transaction-started"]);
    releaseCommit();
    await handoff;
    expect(order).toEqual([
      "transaction-started",
      "transaction-committed",
      "queue-delivered",
    ]);
  });

  it("uses deterministic stage IDs for repeated delivery", () => {
    expect(generationStageJobId("job-123", "generate")).toBe(
      generationStageJobId("job-123", "generate"),
    );
    expect(generationStageJobId("job-123", "generate")).toBe(
      "job-123:generate",
    );
  });
});
