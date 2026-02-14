export type AnnouncementScopeType = "platform" | "tenant";
export type AnnouncementDisplayType = "banner" | "modal";
export type AnnouncementStatus = "draft" | "published" | "ended";

export interface AnnouncementRecord {
  id: string;
  scopeType: AnnouncementScopeType;
  tenantId: string | null;
  title: string;
  content: string;
  displayType: AnnouncementDisplayType;
  status: AnnouncementStatus;
  isPinned: boolean;
  publishedAt: Date | null;
  expiresAt: Date | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnnouncementRepository {
  create(input: {
    scopeType: AnnouncementScopeType;
    tenantId?: string | null;
    title: string;
    content: string;
    displayType: AnnouncementDisplayType;
    isPinned?: boolean;
    status?: AnnouncementStatus;
    publishedAt?: Date | null;
    expiresAt?: Date | null;
    createdBy?: string;
    createdAt: Date;
  }): Promise<AnnouncementRecord>;
  update(input: {
    id: string;
    patch: Partial<Pick<AnnouncementRecord, "title" | "content" | "displayType" | "isPinned" | "status" | "publishedAt" | "expiresAt">>;
    updatedAt: Date;
  }): Promise<AnnouncementRecord | null>;
  findById(id: string): Promise<AnnouncementRecord | null>;
  listPublished(input: { tenantId: string; now: Date }): Promise<AnnouncementRecord[]>;
  listDismissedAnnouncementIds(input: { tenantId: string; userId: string }): Promise<string[]>;
  dismiss(input: { announcementId: string; tenantId: string; userId: string; dismissedAt: Date }): Promise<void>;
}

export class SystemAnnouncementService {
  constructor(
    private readonly repository: AnnouncementRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async createDraft(input: {
    scopeType: AnnouncementScopeType;
    tenantId?: string;
    title: string;
    content: string;
    displayType?: AnnouncementDisplayType;
    isPinned?: boolean;
    expiresAt?: Date | null;
    createdBy?: string;
  }): Promise<AnnouncementRecord> {
    const createdAt = this.now();
    return this.repository.create({
      scopeType: input.scopeType,
      tenantId: input.scopeType === "tenant" ? (input.tenantId ?? null) : null,
      title: input.title,
      content: input.content,
      displayType: input.displayType ?? "banner",
      isPinned: input.isPinned ?? false,
      status: "draft",
      publishedAt: null,
      expiresAt: input.expiresAt ?? null,
      createdBy: input.createdBy,
      createdAt,
    });
  }

  async publishAnnouncement(id: string): Promise<AnnouncementRecord> {
    const updated = await this.repository.update({
      id,
      patch: {
        status: "published",
        publishedAt: this.now(),
      },
      updatedAt: this.now(),
    });
    if (!updated) {
      throw new Error("Announcement not found");
    }
    return updated;
  }

  async endAnnouncement(id: string): Promise<AnnouncementRecord> {
    const updated = await this.repository.update({
      id,
      patch: {
        status: "ended",
      },
      updatedAt: this.now(),
    });
    if (!updated) {
      throw new Error("Announcement not found");
    }
    return updated;
  }

  async dismissAnnouncement(input: { announcementId: string; tenantId: string; userId: string }): Promise<void> {
    await this.repository.dismiss({
      announcementId: input.announcementId,
      tenantId: input.tenantId,
      userId: input.userId,
      dismissedAt: this.now(),
    });
  }

  async listVisibleAnnouncements(input: { tenantId: string; userId: string }): Promise<AnnouncementRecord[]> {
    const now = this.now();
    const [announcements, dismissedIds] = await Promise.all([
      this.repository.listPublished({ tenantId: input.tenantId, now }),
      this.repository.listDismissedAnnouncementIds({ tenantId: input.tenantId, userId: input.userId }),
    ]);

    const dismissed = new Set(dismissedIds);
    const visible = announcements.filter((item) => {
      if (dismissed.has(item.id)) {
        return false;
      }
      if (item.expiresAt && item.expiresAt.getTime() <= now.getTime()) {
        return false;
      }
      return true;
    });

    visible.sort((a, b) => {
      // Platform announcement first, then pinned, then newer first.
      if (a.scopeType !== b.scopeType) {
        return a.scopeType === "platform" ? -1 : 1;
      }
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      const aTime = a.publishedAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.publishedAt?.getTime() ?? b.createdAt.getTime();
      return bTime - aTime;
    });

    return visible;
  }
}
