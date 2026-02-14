import { describe, expect, it } from "vitest";
import { getTraceId, traceMiddleware } from "../../src/middleware/trace.middleware";

function createReply() {
  return {
    headers: {} as Record<string, string>,
    header(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };
}

describe("traceMiddleware", () => {
  it("reuses incoming W3C traceparent", async () => {
    const request = {
      headers: {
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      },
      id: "initial",
    } as any;
    const reply = createReply() as any;

    await traceMiddleware(request, reply);

    expect(request.id).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(reply.headers["x-trace-id"]).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(reply.headers.traceparent).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/
    );
  });

  it("normalizes x-trace-id uuid and generates traceparent", async () => {
    const request = {
      headers: {
        "x-trace-id": "4bf92f35-77b3-4da6-a3ce-929d0e0e4736",
      },
      id: "initial",
    } as any;
    const reply = createReply() as any;

    await traceMiddleware(request, reply);

    expect(getTraceId(request)).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(reply.headers.traceparent).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/
    );
  });
});
