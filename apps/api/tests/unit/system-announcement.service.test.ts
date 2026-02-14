import { describe, expect, it } from "vitest";
import { SystemAnnouncementService } from "../../src/modules/platform/services/system-announcement.service";

class InMemoryAnnouncementRepository {
  private readonly rows: Array<any> = [];
  private readonly dismissed: Array<{ announcementId: string; userId: string; tenantId: string }> = [];
  private counter = 0;

  async create(input: any): Promise<any> {
    const row = {
      id: `a-${++this.counter}`,
      scopeType: input.scopeType,
      tenantId: input.tenantId ?? null,
      title: input.title,
      content: input.content,
      displayType: input.displayType,
      status: input.status ?? "draft",
      isPinned: input.isPinned ?? false,
      publishedAt: input.publishedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
    this.rows.push(row);
    return row;
  }

  async update(input: any): Promise<any | null> {
    const row = this.rows.find((item) => item.id === input.id);
    if (!row) {
      return null;
    }
    Object.assign(row, input.patch);
    row.updatedAt = input.updatedAt;
    return row;
  }

  async findById(id: string): Promise<any | null> {
    return this.rows.find((item) => item.id === id) ?? null;
  }

  async listPublished(input: { tenantId: string; now: Date }): Promise<any[]> {
    return this.rows.filter((row) => {
      if (row.status !== "published") {
        return false;
      }
      if (row.scopeType === "platform") {
        return true;
      }
      return row.tenantId === input.tenantId;
    });
  }

  async listDismissedAnnouncementIds(input: { userId: string; tenantId: string }): Promise<string[]> {
    return this.dismissed
      .filter((item) => item.userId === input.userId && item.tenantId === input.tenantId)
      .map((item) => item.announcementId);
  }

  async dismiss(input: { announcementId: string; userId: string; tenantId: string }): Promise<void> {
    this.dismissed.push(input);
  }
}

describe("SystemAnnouncementService", () => {
  it("orders platform announcement before tenant announcement", async () => {
    const repository = new InMemoryAnnouncementRepository();
    const now = new Date("2026-02-14T00:00:00.000Z");
    const service = new SystemAnnouncementService(repository as any, () => now);

    const platform = await service.createDraft({
      scopeType: "platform",
      title: "Platform notice",
      content: "maintenance",
      isPinned: true,
    });
    const tenant = await service.createDraft({
      scopeType: "tenant",
      tenantId: "tenant-1",
      title: "Tenant notice",
      content: "policy update",
    });

    await service.publishAnnouncement(platform.id);
    await service.publishAnnouncement(tenant.id);

    const visible = await service.listVisibleAnnouncements({
      tenantId: "tenant-1",
      userId: "user-1",
    });

    expect(visible.map((item) => item.id)).toEqual([platform.id, tenant.id]);
  });

  it("supports dismissing announcement per user", async () => {
    const repository = new InMemoryAnnouncementRepository();
    const now = new Date("2026-02-14T00:00:00.000Z");
    const service = new SystemAnnouncementService(repository as any, () => now);

    const tenant = await service.createDraft({
      scopeType: "tenant",
      tenantId: "tenant-1",
      title: "Tenant notice",
      content: "policy update",
    });
    await service.publishAnnouncement(tenant.id);

    await service.dismissAnnouncement({
      announcementId: tenant.id,
      tenantId: "tenant-1",
      userId: "user-1",
    });

    const visible = await service.listVisibleAnnouncements({
      tenantId: "tenant-1",
      userId: "user-1",
    });

    expect(visible).toHaveLength(0);
  });
});
