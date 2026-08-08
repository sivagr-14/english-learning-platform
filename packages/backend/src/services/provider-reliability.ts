export type ProviderFailureCode =
  | "cancelled"
  | "timeout"
  | "rate_limited"
  | "provider_unavailable"
  | "authentication_failed"
  | "malformed_json"
  | "validation_failed"
  | "permanent_failure";

export class ProviderRequestError extends Error {
  constructor(
    public readonly code: ProviderFailureCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export function classifyHttpFailure(status: number, body = "") {
  if (status === 401 || status === 403) {
    return new ProviderRequestError(
      "authentication_failed",
      `Provider authentication failed (${status}): ${body.slice(0, 300)}`,
      false,
      status,
    );
  }
  if (status === 429) {
    return new ProviderRequestError(
      "rate_limited",
      "Provider rate limit exceeded",
      true,
      status,
    );
  }
  if (status >= 500) {
    return new ProviderRequestError(
      "provider_unavailable",
      `Provider is temporarily unavailable (${status})`,
      true,
      status,
    );
  }
  return new ProviderRequestError(
    "permanent_failure",
    `Provider request failed (${status}): ${body.slice(0, 300)}`,
    false,
    status,
  );
}

export function classifyProviderFailure(error: unknown): ProviderRequestError {
  if (error instanceof ProviderRequestError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ProviderRequestError(
      "cancelled",
      "Provider request was cancelled",
      false,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ProviderRequestError("permanent_failure", message, false);
}

export async function withProviderRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const maxAttempts = Math.min(3, Math.max(1, options.maxAttempts ?? 3));
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      const classified = classifyProviderFailure(error);
      if (!classified.retryable) throw classified;
      if (attempt === maxAttempts) {
        throw new ProviderRequestError(
          classified.code,
          classified.message,
          false,
          classified.status,
        );
      }
      await sleep((options.baseDelayMs ?? 1000) * 2 ** (attempt - 1));
    }
  }
  throw new Error("unreachable");
}

export interface ProviderTimeoutHandle {
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
}

export function timeoutSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): ProviderTimeoutHandle {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const cancel = () => controller.abort();
  parent?.addEventListener("abort", cancel, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", cancel);
    },
  };
}
