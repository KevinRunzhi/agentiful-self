import { describe, expect, it } from "vitest";
import { PIIDetector } from "../../src/modules/compliance/services/pii-detector.service";
import { PIIMasker } from "../../src/modules/compliance/services/pii-masker.service";

describe("PIIDetector", () => {
  it("detects common pii patterns", () => {
    const detector = new PIIDetector();
    const result = detector.detect({
      text: "Contact me at test.user@example.com or +86 13800138000, card 4242 4242 4242 4242",
    });

    const types = result.detections.map((item) => item.type);
    expect(types).toContain("email");
    expect(types).toContain("phone");
    expect(types).toContain("credit_card");
    expect(result.hitRate).toBeGreaterThan(0);
  });
});

describe("PIIMasker", () => {
  it("masks pii by default strategy", () => {
    const masker = new PIIMasker();
    const result = masker.mask({
      text: "My email is test.user@example.com",
    });

    expect(result.maskedCount).toBeGreaterThan(0);
    expect(result.maskedText).not.toContain("test.user@example.com");
  });

  it("hashes pii when hash strategy is configured", () => {
    const masker = new PIIMasker();
    const result = masker.mask({
      text: "Reach me at 13800138000",
      strategy: "hash",
    });

    expect(result.maskedText).toContain("sha256:");
  });

  it("redacts pii when remove strategy is configured", () => {
    const masker = new PIIMasker();
    const result = masker.mask({
      text: "Card: 4242 4242 4242 4242",
      strategy: "remove",
    });

    expect(result.maskedText).toContain("[REDACTED]");
  });
});
