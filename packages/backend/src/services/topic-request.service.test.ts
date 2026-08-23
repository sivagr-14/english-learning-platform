import {
  buildPortableTopicRequest,
  CreateTopicRequestSchema,
  UNIVERSAL_TOPIC_DIMENSIONS,
} from "./topic-request.service";

describe("topic request", () => {
  const database = () => ({
    select: () => database(),
    where: () => database(),
    orderBy: async () => [],
  });

  it("enforces the universal B1-C2 non-expert policy for any topic", async () => {
    const request = await buildPortableTopicRequest(database(), "user-1", {
      topic: "Projector",
      intendedContext: "Office presentations",
    });
    expect(request.discoveryPolicy.cefr).toEqual({
      include: ["B1", "B2", "C1", "C2"],
      exclude: ["A1", "A2"],
    });
    expect(request.discoveryPolicy.relevanceLayers).toEqual([
      "L1", "L2", "L3", "L4", "L5",
    ]);
    expect(request.discoveryPolicy.maximumAudienceBand).toBe(
      "informed_non_expert",
    );
    expect(request.coveragePlan.universalDimensions).toHaveLength(
      UNIVERSAL_TOPIC_DIMENSIONS.length,
    );
  });

  it("requires a meaningful topic and rejects unsupported fields", () => {
    expect(() => CreateTopicRequestSchema.parse({ topic: " " })).toThrow();
    expect(() =>
      CreateTopicRequestSchema.parse({ topic: "pain", cefr: "A1" }),
    ).toThrow();
  });

  it("configures one continuous one-to-five-wave drain", async () => {
    const request = await buildPortableTopicRequest(database(), "user-1", {
      topic: "country defence",
    });
    expect(request.executionPolicy).toMatchObject({
      automaticContinuation: true,
      approvalRequired: false,
      generationCycleMax: 100,
      maximumWaves: 5,
      maximumConcurrentCycles: 1,
    });
  });
});
