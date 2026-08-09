import {
  assertProviderImmutable,
  providerRolloutConfig,
} from "./provider-rollout.service";

describe("provider rollout controls", () => {
  it("exposes ChatGPT, Gemini and Ollama and safely falls back to ChatGPT", () => {
    const config = providerRolloutConfig({
      GEMINI_ENABLED: "false",
      DEFAULT_GENERATION_WORKFLOW: "gemini",
    });
    expect(config.workflows.map((workflow) => workflow.id)).toEqual([
      "chatgpt",
      "gemini",
      "ollama",
    ]);
    expect(config.defaultWorkflow).toBe("chatgpt");
    expect(config.workflows[0].ready).toBe(true);
    expect(config.workflows[1].ready).toBe(false);
  });

  it("allows local Ollama without an API key", () => {
    const config = providerRolloutConfig({
      OLLAMA_ENABLED: "true",
      DEFAULT_GENERATION_WORKFLOW: "ollama",
    });
    expect(config.defaultWorkflow).toBe("ollama");
    expect(config.workflows.find((item) => item.id === "ollama")?.ready).toBe(true);
  });

  it("allows Gemini only when both flag and key are present", () => {
    const config = providerRolloutConfig({
      GEMINI_ENABLED: "true",
      GEMINI_API_KEY: "test-only",
      DEFAULT_GENERATION_WORKFLOW: "gemini",
    });
    expect(config.defaultWorkflow).toBe("gemini");
    expect(config.workflows[1].ready).toBe(true);
  });

  it("rejects mutation of an existing job provider", () => {
    expect(() => assertProviderImmutable("gemini", "chatgpt")).toThrow(
      /start a new job/i,
    );
    expect(() => assertProviderImmutable("gemini", "gemini")).not.toThrow();
  });
});
