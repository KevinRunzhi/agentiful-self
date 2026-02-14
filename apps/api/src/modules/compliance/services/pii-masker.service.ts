import { createHash } from "node:crypto";
import type { PIIMaskStrategy, PIIMaskingResult } from "@agentifui/shared/types";
import { PIIDetector, piiDetector, type PIIDetectInput } from "./pii-detector.service.js";

export interface PIIMaskInput extends PIIDetectInput {
  strategy?: PIIMaskStrategy;
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function maskWithAsterisks(value: string, visiblePrefix = 2, visibleSuffix = 2): string {
  if (value.length <= visiblePrefix + visibleSuffix) {
    return "*".repeat(Math.max(value.length, 4));
  }
  const prefix = value.slice(0, visiblePrefix);
  const suffix = value.slice(-visibleSuffix);
  return `${prefix}${"*".repeat(Math.max(4, value.length - visiblePrefix - visibleSuffix))}${suffix}`;
}

function maskValue(value: string, strategy: PIIMaskStrategy): string {
  if (strategy === "remove") {
    return "[REDACTED]";
  }
  if (strategy === "hash") {
    return `sha256:${hashValue(value)}`;
  }

  // Default strategy: mask
  if (value.includes("@")) {
    const [localPart, domain = ""] = value.split("@");
    return `${maskWithAsterisks(localPart, 1, 1)}@${domain}`;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length >= 11) {
    return maskWithAsterisks(value, 3, 2);
  }

  return maskWithAsterisks(value, 2, 2);
}

function replaceRanges(text: string, ranges: Array<{ start: number; end: number; replacement: string }>): string {
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let output = text;
  for (const range of sorted) {
    output = `${output.slice(0, range.start)}${range.replacement}${output.slice(range.end)}`;
  }
  return output;
}

export class PIIMasker {
  constructor(private readonly detector: PIIDetector = piiDetector) {}

  mask(input: PIIMaskInput): PIIMaskingResult {
    const strategy: PIIMaskStrategy = input.strategy ?? "mask";
    const detection = this.detector.detect(input);
    if (detection.detections.length === 0) {
      return {
        strategy,
        maskedText: input.text,
        maskedCount: 0,
        detections: [],
      };
    }

    const ranges = detection.detections.map((item) => ({
      start: item.start,
      end: item.end,
      replacement: maskValue(item.value, strategy),
    }));

    return {
      strategy,
      maskedText: replaceRanges(input.text, ranges),
      maskedCount: detection.detections.length,
      detections: detection.detections,
    };
  }

  /**
   * Masks all string leaf nodes in a plain object/array.
   */
  maskObject<T>(value: T, strategy: PIIMaskStrategy = "mask"): T {
    if (typeof value === "string") {
      return this.mask({ text: value, strategy }).maskedText as T;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.maskObject(item, strategy)) as T;
    }

    if (value && typeof value === "object") {
      const output: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        output[key] = this.maskObject(item, strategy);
      }
      return output as T;
    }

    return value;
  }
}

export const piiMasker = new PIIMasker();
