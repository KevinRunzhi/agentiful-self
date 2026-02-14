import { randomUUID } from "node:crypto";
import { UpstreamResponseError, UpstreamTimeoutError } from "../errors.js";
import type { GatewayAppIntegrationConfig } from "../services/app-config.service.js";
import type {
  GatewayChatRequestInput,
  GatewayCompletionResult,
  GatewayStreamChunk,
  GatewayUsage,
  PlatformAdapter,
} from "../types.js";

interface DifyAdapterOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

interface DifyUsageLike {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
}

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function toGatewayUsage(value: unknown, fallbackPrompt: number, fallbackCompletion: number): GatewayUsage {
  const usage = (value ?? {}) as DifyUsageLike;
  const promptTokens = asPositiveInt(usage.prompt_tokens, fallbackPrompt);
  const completionTokens = asPositiveInt(usage.completion_tokens, fallbackCompletion);
  const totalTokens = asPositiveInt(usage.total_tokens, promptTokens + completionTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function findLatestUserMessage(messages: GatewayChatRequestInput["messages"]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && message.content.trim().length > 0) {
      return message.content.trim();
    }
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveEventText(payload: Record<string, unknown>): string {
  const directAnswer = payload.answer;
  if (typeof directAnswer === "string" && directAnswer.length > 0) {
    return directAnswer;
  }

  const directDelta = payload.delta;
  if (typeof directDelta === "string" && directDelta.length > 0) {
    return directDelta;
  }

  const message = payload.message;
  if (typeof message === "string" && message.length > 0) {
    return message;
  }

  const outputText = payload.output;
  if (typeof outputText === "string" && outputText.length > 0) {
    return outputText;
  }

  return "";
}

export class DifyAdapter implements PlatformAdapter {
  public readonly platform = "dify" as const;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(
    private readonly config: GatewayAppIntegrationConfig,
    options: DifyAdapterOptions = {}
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  async sendMessage(input: GatewayChatRequestInput): Promise<GatewayCompletionResult> {
    const response = await this.requestChat(input, "blocking");
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message = typeof payload.message === "string" ? payload.message : "Dify blocking request failed";
      throw new UpstreamResponseError(message, response.status);
    }

    const metadata = asRecord(payload.metadata);
    const usageSource = metadata.usage ?? payload.usage;
    const usage = toGatewayUsage(
      usageSource,
      Math.max(1, Math.ceil(findLatestUserMessage(input.messages).length / 4)),
      64
    );

    const content = typeof payload.answer === "string" ? payload.answer : "";
    const id = typeof payload.message_id === "string" ? payload.message_id : `chatcmpl_${randomUUID()}`;
    const created = asPositiveInt(payload.created_at, Math.floor(Date.now() / 1000));
    const externalConversationId =
      typeof payload.conversation_id === "string" ? payload.conversation_id : undefined;
    const externalRunId = typeof payload.task_id === "string" ? payload.task_id : undefined;

    return {
      id,
      content,
      created,
      model: input.model,
      finishReason: "stop",
      usage,
      ...(externalConversationId ? { externalConversationId } : {}),
      ...(externalRunId ? { externalRunId } : {}),
    };
  }

  async *streamMessage(input: GatewayChatRequestInput): AsyncGenerator<GatewayStreamChunk> {
    const response = await this.requestChat(input, "streaming");
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const message = typeof payload.message === "string" ? payload.message : "Dify streaming request failed";
      throw new UpstreamResponseError(message, response.status);
    }

    if (!response.body) {
      throw new UpstreamResponseError("Dify streaming response body is missing", 502);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let emittedFinish = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let delimiterIndex = buffer.indexOf("\n\n");
      while (delimiterIndex >= 0) {
        const rawEvent = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);

        const parsed = this.parseSseEvent(rawEvent);
        if (!parsed) {
          delimiterIndex = buffer.indexOf("\n\n");
          continue;
        }

        if (parsed === "[DONE]") {
          emittedFinish = true;
          yield { finishReason: "stop" };
          delimiterIndex = buffer.indexOf("\n\n");
          continue;
        }

        const payload = asRecord(parsed);
        const eventType = typeof payload.event === "string" ? payload.event : "";
        if (eventType === "error") {
          const message = typeof payload.message === "string" ? payload.message : "Dify stream returned error";
          throw new UpstreamResponseError(message, 502);
        }

        const delta = resolveEventText(payload);
        const metadata = asRecord(payload.metadata);
        const usage =
          eventType === "message_end" || eventType === "agent_message_end"
            ? toGatewayUsage(metadata.usage ?? payload.usage, 0, 0)
            : undefined;
        const externalConversationId =
          typeof payload.conversation_id === "string" ? payload.conversation_id : undefined;
        const externalRunId =
          typeof payload.task_id === "string"
            ? payload.task_id
            : typeof payload.id === "string"
              ? payload.id
              : undefined;
        const shouldFinish = eventType === "message_end" || eventType === "agent_message_end";

        if (shouldFinish) {
          emittedFinish = true;
        }

        if (!delta && !usage && !externalConversationId && !externalRunId && !shouldFinish) {
          delimiterIndex = buffer.indexOf("\n\n");
          continue;
        }

        yield {
          ...(delta ? { delta } : {}),
          ...(shouldFinish ? { finishReason: "stop" as const } : {}),
          ...(usage ? { usage } : {}),
          ...(externalConversationId ? { externalConversationId } : {}),
          ...(externalRunId ? { externalRunId } : {}),
        };

        delimiterIndex = buffer.indexOf("\n\n");
      }
    }

    if (!emittedFinish) {
      yield { finishReason: "stop" };
    }
  }

  async stopGeneration(taskId: string, input: GatewayChatRequestInput): Promise<{ stopType: "hard" | "soft" }> {
    const url = `${this.baseUrl}/chat-messages/${taskId}/stop`;
    const response = await this.requestWithTimeout(
      url,
      {
        method: "POST",
        headers: this.buildHeaders(input),
      },
      input.signal
    );

    if (!response.ok) {
      return { stopType: "soft" };
    }

    return { stopType: "hard" };
  }

  async getConversation(
    conversationId: string,
    _input: GatewayChatRequestInput
  ): Promise<{ id: string; exists: boolean }> {
    if (!conversationId.trim()) {
      return { id: conversationId, exists: false };
    }
    return { id: conversationId, exists: true };
  }

  private async requestChat(
    input: GatewayChatRequestInput,
    responseMode: "blocking" | "streaming"
  ): Promise<Response> {
    const url = `${this.baseUrl}/chat-messages`;
    const body = {
      query: findLatestUserMessage(input.messages),
      response_mode: responseMode,
      conversation_id: input.externalConversationId ?? undefined,
      user: input.userId,
      inputs: {},
      files: [],
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      tools: input.tools,
    };

    return this.requestWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          ...this.buildHeaders(input),
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
      input.signal
    );
  }

  private buildHeaders(input: GatewayChatRequestInput): Record<string, string> {
    return {
      authorization: `Bearer ${this.config.apiKey}`,
      traceparent: input.traceparent,
      "x-trace-id": input.traceId,
      "x-tenant-id": input.tenantId,
      "x-user-id": input.userId,
    };
  }

  private async requestWithTimeout(
    url: string,
    init: RequestInit,
    signal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    let abortedByTimeout = false;
    const timeout = setTimeout(() => {
      abortedByTimeout = true;
      controller.abort();
    }, this.timeoutMs);

    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    try {
      return await this.fetchFn(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (abortedByTimeout) {
        throw new UpstreamTimeoutError("Upstream platform timed out");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  private parseSseEvent(rawEvent: string): Record<string, unknown> | "[DONE]" | null {
    const lines = rawEvent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const dataLines = lines.filter((line) => line.startsWith("data:"));
    if (dataLines.length === 0) {
      return null;
    }

    const dataPayload = dataLines
      .map((line) => line.slice(5).trim())
      .join("\n");

    if (!dataPayload) {
      return null;
    }

    if (dataPayload === "[DONE]") {
      return "[DONE]";
    }

    try {
      return JSON.parse(dataPayload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
