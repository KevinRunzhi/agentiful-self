import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDatabase } from "@agentifui/db/client";
import { tenant } from "@agentifui/db/schema";
import type {
  SecurityPolicyPayload,
  TenantConfig,
  TenantSecurityPolicyConfig,
} from "@agentifui/shared/types";
import { auditService } from "../../auth/services/audit.service.js";

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(
        output[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
      continue;
    }

    output[key] = value;
  }
  return output as T;
}

function clampRetentionDays(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.floor(value);
  if (rounded < 180) {
    return 180;
  }
  if (rounded > 365 * 7) {
    return 365 * 7;
  }
  return rounded;
}

export const DEFAULT_SECURITY_POLICY: TenantSecurityPolicyConfig = {
  authMethods: {
    password: true,
    google: false,
    github: false,
    phone: false,
    wechat: false,
    sso: false,
  },
  mfaPolicy: "optional",
  promptInjection: {
    enabled: true,
    action: "alert",
    customKeywords: [],
  },
  pii: {
    enabled: true,
    strategy: "mask",
    fields: ["phone", "email", "id_card", "bank_card", "credit_card"],
  },
  outputCompliance: {
    enabled: true,
    action: "log",
    categories: ["violence", "hate", "adult", "political_cn", "self_harm"],
    customKeywords: [],
  },
  audit: {
    retentionDays: 180,
  },
};

export interface UpdateSecurityPolicyInput {
  tenantId: string;
  actorUserId: string;
  actorRole: "tenant_admin" | "root_admin";
  traceId: string;
  patch: SecurityPolicyPayload;
}

export class SecurityPolicyConfigService {
  constructor(private readonly db: PostgresJsDatabase = getDatabase() as PostgresJsDatabase) {}

  async getPolicy(tenantId: string): Promise<TenantSecurityPolicyConfig> {
    const [row] = await this.db
      .select({ customConfig: tenant.customConfig })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    const customConfig = (row?.customConfig ?? {}) as TenantConfig;
    return deepMerge(DEFAULT_SECURITY_POLICY, customConfig.security ?? {});
  }

  async updatePolicy(input: UpdateSecurityPolicyInput): Promise<TenantSecurityPolicyConfig> {
    const [row] = await this.db
      .select({
        customConfig: tenant.customConfig,
      })
      .from(tenant)
      .where(eq(tenant.id, input.tenantId))
      .limit(1);

    if (!row) {
      throw new Error("Tenant not found");
    }

    const currentConfig = (row.customConfig ?? {}) as TenantConfig;
    const before = deepMerge(DEFAULT_SECURITY_POLICY, currentConfig.security ?? {});
    const merged = deepMerge(before, input.patch);

    if (merged.audit) {
      merged.audit.retentionDays = clampRetentionDays(merged.audit.retentionDays);
    }

    const nextCustomConfig: TenantConfig = {
      ...currentConfig,
      security: merged,
    };

    await this.db
      .update(tenant)
      .set({
        customConfig: nextCustomConfig,
        updatedAt: new Date(),
      })
      .where(eq(tenant.id, input.tenantId));

    await auditService.logSuccess({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: "user",
      actorRole: input.actorRole,
      action: "authz.policy.updated",
      eventCategory: "authorization",
      eventType: "authz.policy.updated",
      severity: "high",
      traceId: input.traceId,
      metadata: {
        before,
        after: merged,
      },
    });

    return merged;
  }
}

export function createSecurityPolicyConfigService(
  db?: PostgresJsDatabase
): SecurityPolicyConfigService {
  return new SecurityPolicyConfigService(db ?? (getDatabase() as PostgresJsDatabase));
}
