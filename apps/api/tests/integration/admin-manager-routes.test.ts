import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerAdminManagerRoutes } from "../../src/modules/admin/routes";

type QueueValue = unknown;

function createQueuedDb(queue: QueueValue[]) {
  const consume = () => (queue.length > 0 ? queue.shift() : []);

  const makeChain = () => {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      rightJoin: () => chain,
      where: () => chain,
      groupBy: () => chain,
      orderBy: () => chain,
      limit: async () => consume(),
      offset: async () => consume(),
      returning: async () => consume(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(consume()).then(resolve),
    };
    return chain;
  };

  return {
    select: () => makeChain(),
    insert: () => ({
      values: () => ({
        returning: async () => consume(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(consume()).then(resolve),
      }),
    }),
    update: () => ({
      set: () => makeChain(),
    }),
    delete: () => makeChain(),
    execute: async () => consume(),
  };
}

async function createTestApp(queue: QueueValue[]) {
  const app = Fastify();
  (app as { db: unknown }).db = createQueuedDb(queue);
  await app.register(registerAdminManagerRoutes, { prefix: "/api/v1" });
  return app;
}

describe("admin/manager routes", () => {
  const apps: Array<Awaited<ReturnType<typeof Fastify>>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop();
      if (app) {
        await app.close();
      }
    }
  });

  it("returns 401 when admin endpoint is called without tenant/user headers", async () => {
    const app = await createTestApp([]);
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
    });

    expect(response.statusCode).toBe(401);
    const payload = response.json() as { errors: Array<{ code: string }> };
    expect(payload.errors[0]?.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for non-admin caller on admin endpoint", async () => {
    const app = await createTestApp([
      [],
      [{ role: "USER" }],
    ]);
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: {
        "x-user-id": "user-1",
        "x-tenant-id": "tenant-1",
      },
    });

    expect(response.statusCode).toBe(403);
    const payload = response.json() as { errors: Array<{ code: string }> };
    expect(payload.errors[0]?.code).toBe("FORBIDDEN");
  });

  it("blocks manager from accessing unmanaged group scope", async () => {
    const app = await createTestApp([
      [],
      [],
      [{ groupId: "group-2" }],
      [{ id: "group-1" }],
    ]);
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/manager/groups/group-1/members",
      headers: {
        "x-user-id": "manager-1",
        "x-tenant-id": "tenant-1",
      },
    });

    expect(response.statusCode).toBe(403);
    const payload = response.json() as { errors: Array<{ message: string }> };
    expect(payload.errors[0]?.message).toContain("scope");
  });

  it("supports manager adding a member to a managed group", async () => {
    const app = await createTestApp([
      [],
      [],
      [{ groupId: "group-1" }],
      [{ id: "group-1" }],
      [{ id: "user-role-1" }],
      [],
      [],
    ]);
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/manager/groups/group-1/members",
      headers: {
        "x-user-id": "manager-1",
        "x-tenant-id": "tenant-1",
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        userId: "user-2",
      }),
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { data: { added: number; created: string[] } };
    expect(payload.data.added).toBe(1);
    expect(payload.data.created).toContain("user-2");
  });

  it("returns admin user details within tenant scope", async () => {
    const now = new Date("2026-02-14T12:00:00.000Z");
    const app = await createTestApp([
      [],
      [{ role: "TENANT_ADMIN" }],
      [],
      [{ id: "user-role-target" }],
      [{
        id: "user-2",
        email: "user2@example.com",
        name: "User Two",
        status: "active",
        emailVerified: true,
        mfaEnabled: false,
        mfaForced: false,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      }],
      [{ role: "USER" }],
      [],
    ]);
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users/user-2",
      headers: {
        "x-user-id": "admin-1",
        "x-tenant-id": "tenant-1",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { data: { id: string; roles: string[] } };
    expect(payload.data.id).toBe("user-2");
    expect(payload.data.roles).toContain("USER");
  });

  it("supports admin patching user status and revokes sessions on suspend", async () => {
    const now = new Date("2026-02-14T12:00:00.000Z");
    const app = await createTestApp([
      [],
      [{ role: "TENANT_ADMIN" }],
      [],
      [{ id: "user-role-target" }],
      [{
        id: "user-2",
        email: "user2@example.com",
        name: "User Two",
        status: "suspended",
        emailVerified: true,
        mfaEnabled: false,
        mfaForced: false,
        createdAt: now,
        updatedAt: now,
      }],
      [],
    ]);
    apps.push(app);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/users/user-2",
      headers: {
        "x-user-id": "admin-1",
        "x-tenant-id": "tenant-1",
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        status: "suspended",
      }),
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { data: { status: string } };
    expect(payload.data.status).toBe("suspended");
  });

  it("supports POST /admin/users as invite alias", async () => {
    const app = await createTestApp([
      [],
      [{ role: "TENANT_ADMIN" }],
      [],
      [],
      [],
      [{ id: "invite-1" }],
    ]);
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: {
        "x-user-id": "admin-1",
        "x-tenant-id": "tenant-1",
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        email: "new-user@example.com",
      }),
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      data: { created: Array<{ invitationId: string }> };
    };
    expect(payload.data.created[0]?.invitationId).toBe("invite-1");
  });

  it("prevents deleting the last tenant admin", async () => {
    const app = await createTestApp([
      [],
      [{ role: "TENANT_ADMIN" }],
      [],
      [{ id: "user-role-target" }],
      [],
      [{ role: "TENANT_ADMIN" }],
      [{ count: 1 }],
    ]);
    apps.push(app);

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/admin/users/user-2",
      headers: {
        "x-user-id": "admin-1",
        "x-tenant-id": "tenant-1",
      },
    });

    expect(response.statusCode).toBe(400);
    const payload = response.json() as { errors: Array<{ code: string }> };
    expect(payload.errors[0]?.code).toBe("LAST_ADMIN_PROTECTION");
  });
});
