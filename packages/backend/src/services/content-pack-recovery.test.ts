import { ContentPackService } from "./content-pack.service";

describe("ChatGPT content-pack recovery orchestration", () => {
  it("claims new packs, resumes owned packs, verifies both, and returns only cleanup-eligible IDs", async () => {
    const rows = [
      { id: "new-pack", owner_user_id: null },
      { id: "owned-pack", owner_user_id: "user-1" },
    ];
    const query = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(rows),
    };
    const database = jest.fn(() => query) as any;
    const service = new ContentPackService(database);
    const claim = jest
      .spyOn(service, "claimManifest")
      .mockResolvedValue({} as any);
    const commit = jest
      .spyOn(service, "commitAvailableBatches")
      .mockResolvedValue({} as any);
    const verify = jest
      .spyOn(service, "verifyManifest")
      .mockResolvedValueOnce({ verified: true, entries: 1, issues: [] })
      .mockResolvedValueOnce({
        verified: false,
        entries: 0,
        issues: ["Missing batch"],
      });

    await expect(service.processAvailableManifests("user-1")).resolves.toEqual({
      processed: ["new-pack", "owned-pack"],
      cleanupEligible: ["new-pack"],
    });
    expect(claim).toHaveBeenCalledWith("user-1", "new-pack");
    expect(commit).toHaveBeenCalledWith("user-1", "owned-pack");
    expect(verify).toHaveBeenNthCalledWith(1, "user-1", "new-pack");
    expect(verify).toHaveBeenNthCalledWith(2, "user-1", "owned-pack");
  });
});
