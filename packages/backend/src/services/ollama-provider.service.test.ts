import { OllamaAdapter } from "./ai-provider.service";

describe("local Ollama provider", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      OLLAMA_MODEL: "qwen3:14b",
      OLLAMA_CONNECTION_TIMEOUT_MS: "1000",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("tests the configured model through schema-constrained non-thinking chat", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: '{"ok":true}' },
        prompt_eval_count: 12,
        eval_count: 5,
      }),
    }) as typeof fetch;

    await expect(new OllamaAdapter().testConnection()).resolves.toMatchObject({
      model: "qwen3:14b",
    });

    const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      model: "qwen3:14b",
      stream: false,
      think: false,
      options: { temperature: 0 },
    });
    expect(body.format).toMatchObject({
      type: "object",
      required: ["ok"],
    });
  });

  it("reports an invalid connectivity payload instead of accepting it", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{"ok":false}' } }),
    }) as typeof fetch;

    await expect(new OllamaAdapter().testConnection()).rejects.toThrow(
      "Ollama connectivity response was invalid",
    );
  });
});
