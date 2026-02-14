import { describe, expect, it, vi } from "vitest";
import { PlatformHealthStore } from "../../src/modules/gateway/services/platform-health.store";

describe("PlatformHealthStore", () => {
  it("opens circuit after consecutive failures and blocks requests", () => {
    const store = new PlatformHealthStore(["dify"]);

    expect(store.shouldAllowRequest("dify")).toBe(true);

    for (let index = 0; index < 5; index += 1) {
      store.recordFailure("dify", { reason: "upstream_error" });
    }

    expect(store.getSnapshot("dify").status).toBe("unavailable");
    expect(store.shouldAllowRequest("dify")).toBe(false);
  });

  it("moves to half-open after cooldown then recovers on success", () => {
    const store = new PlatformHealthStore(["dify"]);
    const nowSpy = vi.spyOn(Date, "now");

    nowSpy.mockReturnValue(0);
    for (let index = 0; index < 5; index += 1) {
      store.recordFailure("dify", { reason: "timeout", timeout: true });
    }
    expect(store.shouldAllowRequest("dify")).toBe(false);
    expect(store.getSnapshot("dify").status).toBe("unavailable");

    nowSpy.mockReturnValue(60_500);
    expect(store.shouldAllowRequest("dify")).toBe(true);
    expect(store.getSnapshot("dify").status).toBe("degraded");

    store.recordSuccess("dify");
    expect(store.getSnapshot("dify").status).toBe("available");

    nowSpy.mockRestore();
  });
});
