/**
 * App Repository
 *
 * Data access layer for App entities.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, sql } from 'drizzle-orm';
import { app } from '@agentifui/db/schema/rbac';
import type { App } from '@agentifui/db/schema/rbac';

// =============================================================================
// Repository Interface
// =============================================================================

export interface IAppRepository {
  findById(id: string): Promise<App | null>;
  findByTenant(tenantId: string): Promise<App[]>;
  findByIdAndTenant(id: string, tenantId: string): Promise<App | null>;
  create(data: {
    tenantId: string;
    name: string;
    status?: string;
  }): Promise<App>;
  update(
    id: string,
    data: Partial<{ name: string; status: string }>
  ): Promise<App | null>;
}

// =============================================================================
// Repository Implementation
// =============================================================================

export class AppRepository implements IAppRepository {
  constructor(private db: PostgresJsDatabase) {}

  async findById(id: string): Promise<App | null> {
    const result = await this.db
      .select()
      .from(app)
      .where(eq(app.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByTenant(tenantId: string): Promise<App[]> {
    return this.db
      .select()
      .from(app)
      .where(
        and(
          eq(app.tenantId, tenantId),
          sql`${app.status} = 'active'`
        )
      );
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<App | null> {
    const result = await this.db
      .select()
      .from(app)
      .where(
        and(
          eq(app.id, id),
          eq(app.tenantId, tenantId)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async create(data: {
    tenantId: string;
    name: string;
    status?: string;
  }): Promise<App> {
    const result = await this.db
      .insert(app)
      .values({
        id: crypto.randomUUID(),
        tenantId: data.tenantId,
        name: data.name,
        status: (data.status || 'active') as 'active' | 'disabled',
      })
      .returning();

    return result[0];
  }

  async update(
    id: string,
    data: Partial<{ name: string; status: string }>
  ): Promise<App | null> {
    const result = await this.db
      .update(app)
      .set(data)
      .where(eq(app.id, id))
      .returning();

    return result[0] || null;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createAppRepository(db: PostgresJsDatabase): AppRepository {
  return new AppRepository(db);
}
