import { ContentPackService } from "./content-pack.service";

describe("ChatGPT content-pack recovery orchestration", () => {
  it("claims new packs, resumes owned packs, verifies both, and returns only cleanup-eligible IDs", async () => {
    const rows = [
      { id: "new-pack", owner_user_id: null },
      { id: "owned-pack", owner_user_id: "user-1" },
    ];
    const accessibleQuery = {
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(rows),
    };
    const inaccessibleQuery = {
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([]),
    };
    const manifestUpdateQuery = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
    };
    const database = jest
      .fn()
      .mockReturnValueOnce(inaccessibleQuery)
      .mockReturnValueOnce(accessibleQuery)
      .mockReturnValue(manifestUpdateQuery) as any;
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
      failures: [],
      blockedByAccount: [],
    });
    expect(claim).toHaveBeenCalledWith("user-1", "new-pack");
    expect(commit).toHaveBeenCalledWith("user-1", "owned-pack");
    expect(verify).toHaveBeenNthCalledWith(1, "user-1", "new-pack");
    expect(verify).toHaveBeenNthCalledWith(2, "user-1", "owned-pack");
  });

  it("reports a fetched manifest claimed by another account", async () => {
    const inaccessibleQuery = {
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([{ id: "owned-elsewhere" }]),
    };
    const accessibleQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([]),
    };
    const database = jest
      .fn()
      .mockReturnValueOnce(inaccessibleQuery)
      .mockReturnValueOnce(accessibleQuery) as any;

    await expect(
      new ContentPackService(database).processAvailableManifests("user-1"),
    ).resolves.toEqual({
      processed: [],
      cleanupEligible: [],
      failures: [],
      blockedByAccount: ["owned-elsewhere"],
    });
  });

  it("isolates a failed manifest and records automatic retry state", async () => {
    const inaccessibleQuery = {
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([]),
    };
    const accessibleQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest
        .fn()
        .mockResolvedValue([{ id: "retry-pack", owner_user_id: null }]),
    };
    const manifestUpdateQuery = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
    };
    const database = jest
      .fn()
      .mockReturnValueOnce(inaccessibleQuery)
      .mockReturnValueOnce(accessibleQuery)
      .mockReturnValue(manifestUpdateQuery) as any;
    const service = new ContentPackService(database);
    jest
      .spyOn(service, "claimManifest")
      .mockRejectedValue(new Error("transient database interruption"));
    const verify = jest.spyOn(service, "verifyManifest");

    await expect(service.processAvailableManifests("user-1")).resolves.toEqual({
      processed: [],
      cleanupEligible: [],
      failures: [
        {
          manifestId: "retry-pack",
          message: "transient database interruption",
          retryable: true,
        },
      ],
      blockedByAccount: [],
    });
    expect(verify).not.toHaveBeenCalled();
    expect(manifestUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_status: "retry_pending",
        sync_error: "transient database interruption",
      }),
    );
  });
});
