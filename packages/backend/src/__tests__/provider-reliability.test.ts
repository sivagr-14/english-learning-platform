import {
  classifyHttpFailure,
  ProviderRequestError,
  withProviderRetry,
} from "../services/provider-reliability";

describe("REL-04 classified provider retry policy", () => {
  it.each([
    [429, "rate_limited", true],
    [503, "provider_unavailable", true],
    [401, "authentication_failed", false],
    [400, "permanent_failure", false],
  ])("classifies HTTP %i", (status, code, retryable) => {
    const error = classifyHttpFailure(status as number);
    expect(error).toMatchObject({ code, retryable, status });
  });

  it("caps temporary retries at three with exponential backoff", async () => {
    const attempts: number[] = [];
    const delays: number[] = [];
    await expect(
      withProviderRetry(
        async (attempt) => {
          attempts.push(attempt);
          throw new ProviderRequestError("timeout", "late", true);
        },
        {
          baseDelayMs: 10,
          sleep: async (ms) => {
            delays.push(ms);
          },
        },
      ),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(attempts).toEqual([1, 2, 3]);
    expect(delays).toEqual([10, 20]);
  });

  it("never retries auth, cancellation, malformed JSON or validation failures", async () => {
    for (const code of [
      "authentication_failed",
      "cancelled",
      "malformed_json",
      "validation_failed",
    ] as const) {
      let calls = 0;
      await expect(
        withProviderRetry(
          async () => {
            calls += 1;
            throw new ProviderRequestError(code, code, false);
          },
          { sleep: async () => undefined },
        ),
      ).rejects.toMatchObject({ code });
      expect(calls).toBe(1);
    }
  });
});
