import type { TenantConfig, TenantStatus } from "@agentifui/db/schema";

export interface TenantLifecycleTenant {
  id: string;
  slug: string;
  status: TenantStatus;
}

export interface TenantLifecycleRepository {
  slugExists(slug: string): Promise<boolean>;
  create(input: {
    name: string;
    slug: string;
    status: TenantStatus;
    plan: "free" | "pro" | "enterprise";
    customConfig?: TenantConfig;
    configVersion: number;
    createdAt: Date;
  }): Promise<TenantLifecycleTenant>;
  findById(tenantId: string): Promise<TenantLifecycleTenant | null>;
  updateStatus(tenantId: string, status: TenantStatus): Promise<void>;
  markDeleted(input: { tenantId: string; deletedAt: Date; purgeAt: Date }): Promise<void>;
}

export interface DefaultGroupBootstrapper {
  createDefaultGroup(tenantId: string): Promise<void>;
}

export interface TenantAdminProvisioner {
  createTenantAdmin(input: { tenantId: string; email: string }): Promise<{ userId: string }>;
}

export interface TenantActivationNotifier {
  sendActivationEmail(input: { tenantId: string; tenantSlug: string; email: string }): Promise<void>;
}

export interface TenantSessionManager {
  revokeTenantSessions(tenantId: string): Promise<void>;
}

export interface TenantApiKeyRevoker {
  revokeAllForTenant(tenantId: string): Promise<void>;
}

export class TenantSlugConflictError extends Error {
  constructor(slug: string) {
    super(`Tenant slug already exists: ${slug}`);
    this.name = "TenantSlugConflictError";
  }
}

export function normalizeTenantSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export class TenantLifecycleService {
  constructor(
    private readonly repository: TenantLifecycleRepository,
    private readonly groupBootstrapper: DefaultGroupBootstrapper,
    private readonly adminProvisioner: TenantAdminProvisioner,
    private readonly activationNotifier: TenantActivationNotifier,
    private readonly sessionManager: TenantSessionManager,
    private readonly apiKeyRevoker: TenantApiKeyRevoker,
    private readonly now: () => Date = () => new Date()
  ) {}

  async createTenant(input: {
    name: string;
    slug: string;
    adminEmail: string;
    plan?: "free" | "pro" | "enterprise";
    customConfig?: TenantConfig;
  }): Promise<{
    tenantId: string;
    slug: string;
    status: TenantStatus;
    readyInMs: number;
  }> {
    const startedAt = this.now();
    const slug = normalizeTenantSlug(input.slug);

    if (!slug) {
      throw new Error("Tenant slug is required");
    }

    const conflict = await this.repository.slugExists(slug);
    if (conflict) {
      throw new TenantSlugConflictError(slug);
    }

    const created = await this.repository.create({
      name: input.name,
      slug,
      status: "active",
      plan: input.plan ?? "free",
      customConfig: input.customConfig,
      configVersion: 1,
      createdAt: startedAt,
    });

    await this.groupBootstrapper.createDefaultGroup(created.id);
    await this.adminProvisioner.createTenantAdmin({
      tenantId: created.id,
      email: input.adminEmail,
    });
    await this.activationNotifier.sendActivationEmail({
      tenantId: created.id,
      tenantSlug: created.slug,
      email: input.adminEmail,
    });

    const completedAt = this.now();

    return {
      tenantId: created.id,
      slug: created.slug,
      status: created.status,
      readyInMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  async disableTenant(tenantId: string): Promise<void> {
    const tenant = await this.repository.findById(tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }
    if (tenant.status === "deleted") {
      throw new Error("Tenant already deleted");
    }

    await this.repository.updateStatus(tenantId, "suspended");
    await this.sessionManager.revokeTenantSessions(tenantId);
    await this.apiKeyRevoker.revokeAllForTenant(tenantId);
  }

  async enableTenant(tenantId: string): Promise<void> {
    const tenant = await this.repository.findById(tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }
    if (tenant.status === "deleted") {
      throw new Error("Cannot enable deleted tenant");
    }

    await this.repository.updateStatus(tenantId, "active");
  }

  async deleteTenant(tenantId: string): Promise<{ scheduledPurgeAt: Date }> {
    const tenant = await this.repository.findById(tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const deletedAt = this.now();
    const purgeAt = new Date(deletedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

    await this.repository.markDeleted({
      tenantId,
      deletedAt,
      purgeAt,
    });

    await this.sessionManager.revokeTenantSessions(tenantId);
    await this.apiKeyRevoker.revokeAllForTenant(tenantId);

    return { scheduledPurgeAt: purgeAt };
  }
}
