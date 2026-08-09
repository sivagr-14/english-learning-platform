import { GeminiAdapter } from "./ai-provider.service";
import { ProviderRequestError } from "./provider-reliability";

describe("GeminiAdapter connection test", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PRIMARY_AI_PROVIDER = "gemini";
    process.env.PRIMARY_AI_MODEL = "gemini-3.6-flash";
    process.env.PRIMARY_AI_API_KEY = "test-api-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("uses model metadata instead of paid content generation", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: "models/gemini-3.6-flash" }),
      text: async () => "",
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(new GeminiAdapter().testConnection()).resolves.toEqual({
      model: "gemini-3.6-flash",
      latencyMs: expect.any(Number),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/v1beta/models/gemini-3.6-flash",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET" });
  });

  test("preserves authentication failures for actionable API responses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "API key is invalid",
    }) as typeof fetch;

    await expect(new GeminiAdapter().testConnection()).rejects.toMatchObject<
      Partial<ProviderRequestError>
    >({
      name: "ProviderRequestError",
      code: "authentication_failed",
      retryable: false,
      status: 401,
    });
  });

  test("classifies network failures instead of leaking an unknown 500", async () => {
    global.fetch = jest.fn().mockRejectedValue(
      new TypeError("fetch failed"),
    ) as typeof fetch;

    await expect(new GeminiAdapter().testConnection()).rejects.toMatchObject<
      Partial<ProviderRequestError>
    >({
      name: "ProviderRequestError",
      code: "permanent_failure",
      retryable: false,
    });
  });
});
