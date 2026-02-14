import { describe, expect, it } from "vitest";
import { createNotificationService } from "../../src/modules/notifications/services/notification.service";

function createMockDb() {
  const state: { values?: Record<string, unknown> } = {};
  const db = {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        state.values = values;
        return {
          returning: async () => [{ id: "notification-1" }],
        };
      },
    }),
  };

  return { db, state };
}

describe("NotificationService", () => {
  it("persists notification content when caller sends content field", async () => {
    const { db, state } = createMockDb();
    const service = createNotificationService(db as any);

    const id = await service.create({
      tenantId: "tenant-1",
      recipientId: "user-1",
      type: "quota_warning",
      title: "Quota warning",
      content: "Usage reached 90%",
      metadata: { threshold: 90 },
      createdAt: new Date("2026-02-14T00:00:00.000Z"),
      isRead: false,
    });

    expect(id).toBe("notification-1");
    expect(state.values?.["type"]).toBe("quota_alert");
    expect(state.values?.["content"]).toBe("Usage reached 90%");
    expect((state.values?.["metadata"] as Record<string, unknown>)?.["eventType"]).toBe(
      "quota_warning"
    );
  });
});
