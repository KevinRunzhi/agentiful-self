import { describe, expect, it } from "vitest";
import {
  ConversationService,
  __conversationServiceTestUtils,
} from "../../src/modules/conversation/services/conversation.service";

describe("conversation.service helpers", () => {
  it("splits generated content into chunks", () => {
    const chunks = __conversationServiceTestUtils.splitToChunks("abcdefghijklmnopqrstuvwxyz", 5);
    expect(chunks).toEqual(["abcde", "fghij", "klmno", "pqrst", "uvwxy", "z"]);
  });

  it("injects latex hint for math prompts", () => {
    const result = __conversationServiceTestUtils.buildAssistantText("请解释这个数学公式");
    expect(result.includes("$$a^2 + b^2 = c^2$$")).toBe(true);
  });

  it("builds hitl payload when confirmation is needed", () => {
    const part = __conversationServiceTestUtils.maybeBuildHitlPart("请确认是否继续");
    expect(part?.type).toBe("hitl");
  });
});

describe("conversation.service stop control", () => {
  it("returns hard stop when adapter supports abort", () => {
    const service = new ConversationService({} as never);
    service.registerStreamRun("msg-hard", true);
    const result = service.requestStop("msg-hard");
    expect(result.stopType).toBe("hard");
    expect(service.isHardStopped("msg-hard")).toBe(true);
  });

  it("returns soft stop when adapter does not support abort", () => {
    const service = new ConversationService({} as never);
    service.registerStreamRun("msg-soft", false);
    const result = service.requestStop("msg-soft");
    expect(result.stopType).toBe("soft");
    expect(service.isSoftStopped("msg-soft")).toBe(true);
  });
});

