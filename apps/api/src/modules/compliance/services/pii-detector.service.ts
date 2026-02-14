import type { PIIDetection, PIIDetectionResult } from "@agentifui/shared/types";

type PIIDetectionType = PIIDetection["type"];

interface DetectorRule {
  type: PIIDetectionType;
  pattern: RegExp;
  normalize: (value: string) => string;
  validate: (normalized: string) => boolean;
}

function normalizeDigits(value: string): string {
  return value.replace(/[^\dXx]/g, "");
}

function luhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let num = Number.parseInt(digits[i] ?? "0", 10);
    if (shouldDouble) {
      num *= 2;
      if (num > 9) {
        num -= 9;
      }
    }
    sum += num;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function isLikelyChinaId(value: string): boolean {
  const normalized = normalizeDigits(value).toUpperCase();
  if (!/^\d{17}[\dX]$/.test(normalized)) {
    return false;
  }

  // China ID checksum
  const factors = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checksum = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += Number.parseInt(normalized[i] ?? "0", 10) * (factors[i] ?? 0);
  }
  const expected = checksum[sum % 11];
  return normalized[17] === expected;
}

const DEFAULT_RULES: DetectorRule[] = [
  {
    type: "email",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    normalize: (value) => value.trim().toLowerCase(),
    validate: (value) => value.includes("@") && value.includes("."),
  },
  {
    type: "phone",
    pattern: /(?:\+?\d[\d\s-]{7,}\d)/g,
    normalize: (value) => value.replace(/\s+/g, ""),
    validate: (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 11 && digits.length <= 15;
    },
  },
  {
    type: "id_card",
    pattern: /\b\d{17}[\dXx]\b/g,
    normalize: (value) => normalizeDigits(value).toUpperCase(),
    validate: isLikelyChinaId,
  },
  {
    type: "credit_card",
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    normalize: normalizeDigits,
    validate: luhnCheck,
  },
  {
    type: "bank_card",
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    normalize: normalizeDigits,
    validate: luhnCheck,
  },
];

export interface PIIDetectInput {
  text: string;
  enabledTypes?: PIIDetectionType[];
}

export class PIIDetector {
  constructor(private readonly rules: DetectorRule[] = DEFAULT_RULES) {}

  detect(input: PIIDetectInput): PIIDetectionResult {
    const text = input.text ?? "";
    if (!text) {
      return { detections: [], hitRate: 1 };
    }

    const enabled = new Set(input.enabledTypes ?? DEFAULT_RULES.map((rule) => rule.type));
    const seen = new Set<string>();
    const detections: PIIDetection[] = [];
    let candidateCount = 0;

    for (const rule of this.rules) {
      if (!enabled.has(rule.type)) {
        continue;
      }

      const localPattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g")
        ? rule.pattern.flags
        : `${rule.pattern.flags}g`);

      let match = localPattern.exec(text);
      while (match) {
        const raw = match[0] ?? "";
        const start = match.index;
        const end = start + raw.length;
        const normalized = rule.normalize(raw);
        candidateCount += 1;

        if (rule.validate(normalized)) {
          const key = `${rule.type}:${start}:${end}:${normalized}`;
          if (!seen.has(key)) {
            detections.push({
              type: rule.type,
              value: raw,
              start,
              end,
            });
            seen.add(key);
          }
        }

        match = localPattern.exec(text);
      }
    }

    detections.sort((a, b) => a.start - b.start);
    const hitRate = candidateCount === 0 ? 1 : detections.length / candidateCount;
    return {
      detections,
      hitRate: Number(hitRate.toFixed(4)),
    };
  }
}

export const piiDetector = new PIIDetector();
