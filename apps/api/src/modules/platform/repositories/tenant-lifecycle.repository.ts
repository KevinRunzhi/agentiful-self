import { getDatabase } from "@agentifui/db/client";
import { tenant } from "@agentifui/db/schema";
import { eq } from "drizzle-orm";
import type { TenantLifecycleRepository } from "../services/tenant-lifecycle.service.js";

export class DrizzleTenantLifecycleRepository implements TenantLifecycleRepository {
  async slugExists(slug: string): Promise<boolean> {
    const db = getDatabase();
    const [row] = await db.select({ id: tenant.id }).from(tenant).where(eq(tenant.slug, slug)).limit(1);
    return !!row;
  }

  async create(input: {
    name: string;
    slug: string;
    status: "active" | "suspended" | "deleted";
    plan: "free" | "pro" | "enterprise";
    customConfig?: Record<string, unknown>;
    configVersion: number;
    createdAt: Date;
  }): Promise<{ id: string; slug: string; status: "active" | "suspended" | "deleted" }> {
    const db = getDatabase();
    const [created] = await db
      .insert(tenant)
      .values({
        name: input.name,
        slug: input.slug,
        status: input.status,
        plan: input.plan,
        customConfig: input.customConfig as any,
        configVersion: input.configVersion,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning({
        id: tenant.id,
        slug: tenant.slug,
        status: tenant.status,
      });

    if (!created) {
      throw new Error("Failed to create tenant");
    }

    return {
      id: created.id,
      slug: created.slug ?? input.slug,
      status: created.status as "active" | "suspended" | "deleted",
    };
  }

  async findById(tenantId: string): Promise<{ id: string; slug: string; status: "active" | "suspended" | "deleted" } | null> {
    const db = getDatabase();
    const [row] = await db
      .select({
        id: tenant.id,
        slug: tenant.slug,
        status: tenant.status,
      })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      slug: row.slug ?? "",
      status: row.status as "active" | "suspended" | "deleted",
    };
  }

  async updateStatus(tenantId: string, status: "active" | "suspended" | "deleted"): Promise<void> {
    const db = getDatabase();
    await db
      .update(tenant)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(tenant.id, tenantId));
  }

  async markDeleted(input: { tenantId: string; deletedAt: Date; purgeAt: Date }): Promise<void> {
    const db = getDatabase();
    await db
      .update(tenant)
      .set({
        status: "deleted",
        deletedAt: input.deletedAt,
        updatedAt: input.deletedAt,
      })
      .where(eq(tenant.id, input.tenantId));
  }
}

export function createTenantLifecycleRepository(): TenantLifecycleRepository {
  return new DrizzleTenantLifecycleRepository();
}
