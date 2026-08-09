export type WorkflowProvider = "chatgpt" | "gemini" | "ollama";

export interface WorkflowAvailability {
  id: WorkflowProvider;
  name: string;
  enabled: boolean;
  ready: boolean;
  prerequisite: string | null;
  cost: string;
  privacy: string;
  automation: string;
}

export function providerRolloutConfig(
  environment: NodeJS.ProcessEnv = process.env,
): { workflows: WorkflowAvailability[]; defaultWorkflow: WorkflowProvider } {
  const geminiKey = Boolean(
    environment.PRIMARY_AI_API_KEY || environment.GEMINI_API_KEY,
  );
  const geminiEnabled = environment.GEMINI_ENABLED === "true";
  const ollamaEnabled = environment.OLLAMA_ENABLED === "true";
  const requested = environment.DEFAULT_GENERATION_WORKFLOW;
  const defaultWorkflow: WorkflowProvider =
    requested === "gemini" && geminiEnabled && geminiKey
      ? "gemini"
      : requested === "ollama" && ollamaEnabled
        ? "ollama"
        : "chatgpt";

  return {
    defaultWorkflow,
    workflows: [
      {
        id: "chatgpt",
        name: "ChatGPT content pack",
        enabled: true,
        ready: true,
        prerequisite: null,
        cost: "Uses your ChatGPT workflow; no API key or per-request API charge.",
        privacy: "Source assessment happens in ChatGPT; only validated packs travel through the private inbox branch.",
        automation: "Sync, claim and import are automated after ChatGPT creates the pack.",
      },
      {
        id: "gemini",
        name: "Gemini API",
        enabled: geminiEnabled,
        ready: geminiEnabled && geminiKey,
        prerequisite: !geminiEnabled
          ? "Enable GEMINI_ENABLED in local secret configuration."
          : !geminiKey
            ? "Add GEMINI_API_KEY (or PRIMARY_AI_API_KEY) to .env.local."
            : null,
        cost: "API usage is metered; warning and hard budgets are enforced per job.",
        privacy: "Uploaded source segments are sent to the configured Gemini API models.",
        automation: "The local worker extracts, reviews, generates and imports entries.",
      },
      {
        id: "ollama",
        name: "Local Ollama",
        enabled: ollamaEnabled,
        ready: ollamaEnabled,
        prerequisite: ollamaEnabled
          ? null
          : "Set OLLAMA_ENABLED=true and start Ollama locally.",
        cost: "No API charge; generation uses local compute.",
        privacy: "Source text stays on this computer and is sent only to the configured Ollama server.",
        automation: "The same extraction, eight-section validator and PostgreSQL import gates are used.",
      },
    ],
  };
}

export function assertProviderImmutable(
  storedProvider: string | null | undefined,
  requestedProvider: WorkflowProvider,
): void {
  if (storedProvider && storedProvider !== requestedProvider) {
    const error = new Error(
      "A workflow cannot be switched on an existing job. Start a new job instead.",
    ) as Error & { status: number; code: string };
    error.status = 409;
    error.code = "IMMUTABLE_PROVIDER_CONFLICT";
    throw error;
  }
}
