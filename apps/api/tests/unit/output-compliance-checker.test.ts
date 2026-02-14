import { describe, expect, it } from "vitest";
import { OutputComplianceChecker } from "../../src/modules/compliance/services/output-compliance-checker.service";

describe("OutputComplianceChecker", () => {
  it("returns non-flagged result for safe content", () => {
    const checker = new OutputComplianceChecker();
    const result = checker.check({
      text: "Here is a neutral product update summary.",
      policy: {
        enabled: true,
        action: "log",
      },
    });

    expect(result.flagged).toBe(false);
    expect(result.hits).toHaveLength(0);
    expect(result.action).toBe("log");
  });

  it("flags and blocks content when policy action is block", () => {
    const checker = new OutputComplianceChecker();
    const enforced = checker.enforce({
      text: "This contains suicide guidance",
      policy: {
        enabled: true,
        action: "block",
      },
    });

    expect(enforced.result.flagged).toBe(true);
    expect(enforced.result.action).toBe("block");
    expect(enforced.content).toBe("内容因合规策略被过滤");
  });
});
