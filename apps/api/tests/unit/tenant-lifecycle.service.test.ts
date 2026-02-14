import { describe, expect, it } from "vitest";
import { TenantLifecycleService, TenantSlugConflictError } from "../../src/modules/platform/services/tenant-lifecycle.service";

class InMemoryTenantLifecycleRepository {
  public readonly tenants = new Map<string, any>();
  private counter = 0;

  async slugExists(slug: string): Promise<boolean> {
    for (const tenant of this.tenants.values()) {
      if (tenant.slug === slug) {
        return true;
      }
    }
    return false;
  }

  async create(input: any): Promise<any> {
    const id = `tenant-${++this.counter}`;
    const tenant = {
      id,
      slug: input.slug,
      status: input.status,
      deletedAt: null,
      purgeAt: null,
    };
    this.tenants.set(id, tenant);
    return tenant;
  }

  async findById(tenantId: string): Promise<any | null> {
    return this.tenants.get(tenantId) ?? null;
  }

  async updateStatus(tenantId: string, status: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.status = status;
    }
  }

  async markDeleted(input: { tenantId: string; deletedAt: Date; purgeAt: Date }): Promise<void> {
    const tenant = this.tenants.get(input.tenantId);
    if (tenant) {
      tenant.status = "deleted";
      tenant.deletedAt = input.deletedAt;
      tenant.purgeAt = input.purgeAt;
    }
  }
}

describe("TenantLifecycleService", () => {
  it("creates tenant with default group and admin in <= 30s window", async () => {
    const repository = new InMemoryTenantLifecycleRepository();
    const calls: string[] = [];
    const timepoints = [
      new Date("2026-02-14T00:00:00.000Z"),
      new Date("2026-02-14T00:00:12.000Z"),
    ];
    const now = () => timepoints.shift() ?? new Date("2026-02-14T00:00:12.000Z");

    const service = new TenantLifecycleService(
      repository as any,
      {
        createDefaultGroup: async () => calls.push("group"),
      },
      {
        createTenantAdmin: async () => {
          calls.push("admin");
          return { userId: "user-1" };
        },
      },
      {
        sendActivationEmail: async () => calls.push("email"),
      },
      {
        revokeTenantSessions: async () => undefined,
      },
      {
        revokeAllForTenant: async () => undefined,
      },
      now
    );

    const created = await service.createTenant({
      name: "Acme",
      slug: "Acme Inc",
      adminEmail: "admin@acme.com",
    });

    expect(created.slug).toBe("acme-inc");
    expect(created.readyInMs).toBe(12_000);
    expect(created.readyInMs).toBeLessThanOrEqual(30_000);
    expect(calls).toEqual(["group", "admin", "email"]);
  });

  it("rejects duplicate slug", async () => {
    const repository = new InMemoryTenantLifecycleRepository();
    await repository.create({
      slug: "acme",
      status: "active",
    });

    const service = new TenantLifecycleService(
      repository as any,
      { createDefaultGroup: async () => undefined },
      { createTenantAdmin: async () => ({ userId: "user-1" }) },
      { sendActivationEmail: async () => undefined },
      { revokeTenantSessions: async () => undefined },
      { revokeAllForTenant: async () => undefined }
    );

    await expect(() =>
      service.createTenant({
        name: "Acme 2",
        slug: "acme",
        adminEmail: "admin@acme2.com",
      })
    ).rejects.toBeInstanceOf(TenantSlugConflictError);
  });

  it("disables and deletes tenant with session/API key revocation", async () => {
    const repository = new InMemoryTenantLifecycleRepository();
    const created = await repository.create({
      slug: "tenant-a",
      status: "active",
    });

    let revokedSessions = 0;
    let revokedKeys = 0;
    const service = new TenantLifecycleService(
      repository as any,
      { createDefaultGroup: async () => undefined },
      { createTenantAdmin: async () => ({ userId: "user-1" }) },
      { sendActivationEmail: async () => undefined },
      {
        revokeTenantSessions: async () => {
          revokedSessions += 1;
        },
      },
      {
        revokeAllForTenant: async () => {
          revokedKeys += 1;
        },
      },
      () => new Date("2026-02-14T00:00:00.000Z")
    );

    await service.disableTenant(created.id);
    expect((await repository.findById(created.id))?.status).toBe("suspended");

    const deleted = await service.deleteTenant(created.id);
    expect((await repository.findById(created.id))?.status).toBe("deleted");
    expect(deleted.scheduledPurgeAt.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(revokedSessions).toBe(2);
    expect(revokedKeys).toBe(2);
  });
});
