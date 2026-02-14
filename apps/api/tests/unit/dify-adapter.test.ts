import { describe, expect, it, vi } from "vitest";
import { DifyAdapter } from "../../src/modules/gateway/adapters/dify.adapter";
import type { GatewayChatRequestInput, GatewayStreamChunk } from "../../src/modules/gateway/types";

function createAdapterInput(overrides: Partial<GatewayChatRequestInput> = {}): GatewayChatRequestInput {
  return {
    tenantId: "tenant-1",
    userId: "user-1",
    appId: "app-1",
    model: "app-1",
    messages: [{ role: "user", content: "hello" }],
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    conversationId: "conv-1",
    ...overrides,
  };
}

describe("DifyAdapter", () => {
  it("maps blocking response to OpenAI-compatible completion fields", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: "hello world",
          message_id: "msg-1",
          conversation_id: "dify-conv-1",
          task_id: "task-1",
          created_at: 1739510400,
          metadata: {
            usage: {
              prompt_tokens: 10,
              completion_tokens: 15,
              total_tokens: 25,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const adapter = new DifyAdapter(
      {
        baseUrl: "https://dify.example.com",
        apiKey: "plain-api-key",
      },
      { fetchFn }
    );

    const result = await adapter.sendMessage(createAdapterInput());
    expect(result).toMatchObject({
      id: "msg-1",
      content: "hello world",
      model: "app-1",
      externalConversationId: "dify-conv-1",
      externalRunId: "task-1",
      usage: {
        promptTokens: 10,
        completionTokens: 15,
        totalTokens: 25,
      },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://dify.example.com/chat-messages");
  });

  it("parses SSE stream and emits delta + finish chunks", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"event":"message","answer":"Hi","conversation_id":"conv-x","task_id":"run-x"}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"event":"message_end","metadata":{"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}}\n\n'
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      })
    );

    const adapter = new DifyAdapter(
      {
        baseUrl: "https://dify.example.com",
        apiKey: "plain-api-key",
      },
      { fetchFn }
    );

    const chunks: GatewayStreamChunk[] = [];
    for await (const chunk of adapter.streamMessage(createAdapterInput())) {
      chunks.push(chunk);
    }

    expect(chunks.some((chunk) => chunk.delta === "Hi")).toBe(true);
    expect(chunks.some((chunk) => chunk.finishReason === "stop")).toBe(true);
    expect(chunks.some((chunk) => chunk.externalConversationId === "conv-x")).toBe(true);
  });
});
