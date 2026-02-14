import { and, desc, eq, gte, isNull, lte, or, type SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDatabase } from "@agentifui/db/client";
import { modelPricing, run } from "@agentifui/db/schema";
import type {
  CostEstimateInput,
  CostEstimateResult,
  ModelPricingInput,
} from "@agentifui/shared/types";

interface PricingRecord {
  provider: string;
  model: string;
  inputPricePer1kUsd: number;
  outputPricePer1kUsd: number;
}

const DEFAULT_MODEL_PRICING: PricingRecord[] = [
  { provider: "openai", model: "gpt-4o", inputPricePer1kUsd: 0.005, outputPricePer1kUsd: 0.015 },
  { provider: "openai", model: "gpt-4o-mini", inputPricePer1kUsd: 0.00015, outputPricePer1kUsd: 0.0006 },
  { provider: "anthropic", model: "claude-3.5-sonnet", inputPricePer1kUsd: 0.003, outputPricePer1kUsd: 0.015 },
];

function normalizeProvider(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeModel(value: string): string {
  return value.trim();
}

function calculateCostUsd(
  inputTokens: number,
  outputTokens: number,
  pricing: { inputPricePer1kUsd: number; outputPricePer1kUsd: number }
): number {
  const inCost = (Math.max(0, inputTokens) / 1000) * pricing.inputPricePer1kUsd;
  const outCost = (Math.max(0, outputTokens) / 1000) * pricing.outputPricePer1kUsd;
  return Number((inCost + outCost).toFixed(8));
}

export class CostEstimator {
  constructor(private readonly db: PostgresJsDatabase = getDatabase() as PostgresJsDatabase) {}

  async upsertPricing(input: ModelPricingInput, createdBy?: string): Promise<void> {
    await this.db.insert(modelPricing).values({
      tenantId: input.tenantId,
      provider: normalizeProvider(input.provider),
      model: normalizeModel(input.model),
      inputPricePer1kUsd: input.inputPricePer1kUsd,
      outputPricePer1kUsd: input.outputPricePer1kUsd,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      createdBy: createdBy ?? null,
      createdAt: new Date(),
    });
  }

  async listPricing(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await this.db
      .select()
      .from(modelPricing)
      .where(or(eq(modelPricing.tenantId, tenantId), isNull(modelPricing.tenantId)))
      .orderBy(desc(modelPricing.effectiveFrom));

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider,
      model: row.model,
      inputPricePer1kUsd: row.inputPricePer1kUsd,
      outputPricePer1kUsd: row.outputPricePer1kUsd,
      currency: row.currency,
      effectiveFrom: row.effectiveFrom.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async estimate(input: CostEstimateInput): Promise<CostEstimateResult> {
    const usageAt = input.usageAt ? new Date(input.usageAt) : new Date();
    const pricing = await this.resolvePricing(
      input.tenantId,
      input.provider,
      input.model,
      usageAt
    );

    const estimatedCostUsd = calculateCostUsd(
      input.inputTokens,
      input.outputTokens,
      pricing
    );

    return {
      tenantId: input.tenantId,
      provider: normalizeProvider(input.provider),
      model: normalizeModel(input.model),
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      inputPricePer1kUsd: pricing.inputPricePer1kUsd,
      outputPricePer1kUsd: pricing.outputPricePer1kUsd,
      estimatedCostUsd,
      usageAt: usageAt.toISOString(),
    };
  }

  async estimateForRuns(input: {
    tenantId: string;
    startAt?: Date;
    endAt?: Date;
    groupId?: string;
  }): Promise<
    Array<{
      runId: string;
      userId: string;
      appId: string;
      model: string;
      provider: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      createdAt: Date;
      groupId: string | null;
      costUsd: number;
    }>
  > {
    const conditions: SQL[] = [eq(run.tenantId, input.tenantId)];
    if (input.groupId) {
      conditions.push(eq(run.activeGroupId, input.groupId));
    }
    if (input.startAt) {
      conditions.push(gte(run.createdAt, input.startAt));
    }
    if (input.endAt) {
      conditions.push(lte(run.createdAt, input.endAt));
    }

    // Keep query simple and explicit to avoid broad table scans in tests.
    const rows = await this.db
      .select({
        runId: run.id,
        userId: run.userId,
        appId: run.appId,
        groupId: run.activeGroupId,
        model: run.model,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.totalTokens,
        createdAt: run.createdAt,
      })
      .from(run)
      .where(and(...conditions))
      .orderBy(desc(run.createdAt))
      .limit(20_000);

    const output: Array<{
      runId: string;
      userId: string;
      appId: string;
      model: string;
      provider: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      createdAt: Date;
      groupId: string | null;
      costUsd: number;
    }> = [];

    for (const row of rows) {
      const provider = this.deriveProvider(row.model);
      const estimate = await this.estimate({
        tenantId: input.tenantId,
        provider,
        model: row.model ?? "unknown",
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        usageAt: row.createdAt.toISOString(),
      });
      output.push({
        runId: row.runId,
        userId: row.userId,
        appId: row.appId,
        model: row.model ?? "unknown",
        provider,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        totalTokens: row.totalTokens,
        createdAt: row.createdAt,
        groupId: row.groupId,
        costUsd: estimate.estimatedCostUsd,
      });
    }

    return output;
  }

  private deriveProvider(model: string | null): string {
    if (!model) {
      return "openai";
    }

    const normalized = model.toLowerCase();
    if (normalized.includes("claude")) {
      return "anthropic";
    }
    if (normalized.includes("gpt")) {
      return "openai";
    }
    return "openai";
  }

  private async resolvePricing(
    tenantId: string,
    provider: string,
    modelName: string,
    usageAt: Date
  ): Promise<PricingRecord> {
    const providerNormalized = normalizeProvider(provider);
    const modelNormalized = normalizeModel(modelName);

    const [tenantRow] = await this.db
      .select({
        inputPricePer1kUsd: modelPricing.inputPricePer1kUsd,
        outputPricePer1kUsd: modelPricing.outputPricePer1kUsd,
      })
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.tenantId, tenantId),
          eq(modelPricing.provider, providerNormalized),
          eq(modelPricing.model, modelNormalized),
          lte(modelPricing.effectiveFrom, usageAt)
        )
      )
      .orderBy(desc(modelPricing.effectiveFrom))
      .limit(1);

    if (tenantRow) {
      return {
        provider: providerNormalized,
        model: modelNormalized,
        inputPricePer1kUsd: tenantRow.inputPricePer1kUsd,
        outputPricePer1kUsd: tenantRow.outputPricePer1kUsd,
      };
    }

    const [globalRow] = await this.db
      .select({
        inputPricePer1kUsd: modelPricing.inputPricePer1kUsd,
        outputPricePer1kUsd: modelPricing.outputPricePer1kUsd,
      })
      .from(modelPricing)
      .where(
        and(
          isNull(modelPricing.tenantId),
          eq(modelPricing.provider, providerNormalized),
          eq(modelPricing.model, modelNormalized),
          lte(modelPricing.effectiveFrom, usageAt)
        )
      )
      .orderBy(desc(modelPricing.effectiveFrom))
      .limit(1);

    if (globalRow) {
      return {
        provider: providerNormalized,
        model: modelNormalized,
        inputPricePer1kUsd: globalRow.inputPricePer1kUsd,
        outputPricePer1kUsd: globalRow.outputPricePer1kUsd,
      };
    }

    const fallback =
      DEFAULT_MODEL_PRICING.find(
        (item) => item.provider === providerNormalized && item.model === modelNormalized
      ) ??
      DEFAULT_MODEL_PRICING[0]!;

    return {
      provider: providerNormalized,
      model: modelNormalized,
      inputPricePer1kUsd: fallback.inputPricePer1kUsd,
      outputPricePer1kUsd: fallback.outputPricePer1kUsd,
    };
  }
}

export function createCostEstimator(db?: PostgresJsDatabase): CostEstimator {
  return new CostEstimator(db ?? (getDatabase() as PostgresJsDatabase));
}
