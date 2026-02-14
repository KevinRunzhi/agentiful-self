import type {
  OutputComplianceCategory,
  OutputComplianceHit,
  OutputComplianceResult,
  SecurityAction,
  TenantOutputCompliancePolicyConfig,
} from "@agentifui/shared/types";

const DEFAULT_BLOCKED_TEXT = "内容因合规策略被过滤";

const CATEGORY_KEYWORDS: Record<OutputComplianceCategory, string[]> = {
  violence: ["kill", "murder", "爆炸", "袭击", "bloodshed"],
  hate: ["种族清洗", "仇恨", "hate speech", "racial slur"],
  adult: ["porn", "色情", "成人视频", "explicit sexual"],
  political_cn: ["推翻政府", "政治敏感", "颠覆国家政权", "分裂国家"],
  self_harm: ["suicide", "自杀", "self-harm", "割腕"],
};

const DEFAULT_CATEGORIES: OutputComplianceCategory[] = [
  "violence",
  "hate",
  "adult",
  "political_cn",
  "self_harm",
];

export interface ComplianceCheckInput {
  text: string;
  policy?: TenantOutputCompliancePolicyConfig;
}

function resolveAction(policy?: TenantOutputCompliancePolicyConfig): SecurityAction {
  const action = policy?.action;
  if (action === "alert" || action === "block" || action === "log") {
    return action;
  }
  return "log";
}

export class OutputComplianceChecker {
  check(input: ComplianceCheckInput): OutputComplianceResult {
    const text = input.text ?? "";
    const policy = input.policy;
    const action = resolveAction(policy);

    if (!text || policy?.enabled === false) {
      return {
        flagged: false,
        hits: [],
        action,
      };
    }

    const categorySet = new Set<OutputComplianceCategory>(policy?.categories ?? DEFAULT_CATEGORIES);
    const custom = (policy?.customKeywords ?? []).filter((item) => item.trim().length > 0);
    const textLower = text.toLowerCase();
    const hits: OutputComplianceHit[] = [];

    for (const category of categorySet) {
      const keywords = [...(CATEGORY_KEYWORDS[category] ?? [])];
      if (custom.length > 0) {
        keywords.push(...custom);
      }

      for (const keyword of keywords) {
        if (!keyword) {
          continue;
        }
        if (textLower.includes(keyword.toLowerCase())) {
          hits.push({
            category,
            matchedKeyword: keyword,
          });
          break;
        }
      }
    }

    const flagged = hits.length > 0;
    return {
      flagged,
      hits,
      action,
      blockedText: flagged && action === "block" ? DEFAULT_BLOCKED_TEXT : undefined,
    };
  }

  enforce(input: ComplianceCheckInput): { content: string; result: OutputComplianceResult } {
    const result = this.check(input);
    if (result.flagged && result.action === "block") {
      return {
        content: result.blockedText ?? DEFAULT_BLOCKED_TEXT,
        result,
      };
    }

    return {
      content: input.text,
      result,
    };
  }
}

export const outputComplianceChecker = new OutputComplianceChecker();
