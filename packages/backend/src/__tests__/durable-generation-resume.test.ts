import {
  pendingPlanMembers,
  reconstructDurableBatches,
} from "../services/durable-generation-plan";

describe("REL-03 exact durable resume", () => {
  const member = (candidate: string, batch: number, position: number, done = false) => ({
    batch_number: batch,
    position,
    external_candidate_id: candidate,
    result_id: done ? `result-${candidate}` : null,
    validation_status: done ? "valid" : null,
    entry_payload: done ? JSON.stringify({ word: candidate }) : null,
  });

  it("resumes only unfinished candidates after crashes at arbitrary boundaries", () => {
    for (let crashAfter = 0; crashAfter <= 4; crashAfter += 1) {
      const plan = [
        member("a", 1, 1, crashAfter >= 1),
        member("b", 1, 2, crashAfter >= 2),
        member("c", 2, 1, crashAfter >= 3),
        member("d", 2, 2, crashAfter >= 4),
      ];
      expect(pendingPlanMembers(plan).map((row) => row.external_candidate_id))
        .toEqual(["a", "b", "c", "d"].slice(crashAfter));
    }
  });

  it("reconstructs exact immutable batches rather than rechunking results", () => {
    const batches = reconstructDurableBatches([
      member("a", 1, 1, true),
      member("b", 1, 2, true),
      member("c", 2, 1, true),
    ]);
    expect(batches).toEqual([
      { batchNumber: 1, entries: [{ word: "a" }, { word: "b" }] },
      { batchNumber: 2, entries: [{ word: "c" }] },
    ]);
  });

  it("refuses finalization while any planned candidate lacks a durable result", () => {
    expect(() =>
      reconstructDurableBatches([
        member("a", 1, 1, true),
        member("b", 1, 2, false),
      ]),
    ).toThrow("1 of 2 planned entries");
  });
});
