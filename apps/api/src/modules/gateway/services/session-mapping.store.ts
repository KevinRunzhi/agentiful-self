interface SessionMappingRecord {
  conversationId: string;
  tenantId: string;
  userId: string;
  appId: string;
  externalConversationId: string | null;
  externalRunId: string | null;
  updatedAt: string;
}

class SessionMappingStore {
  private readonly records = new Map<string, SessionMappingRecord>();

  private makeKey(conversationId: string, tenantId: string, userId: string, appId: string): string {
    return `${tenantId}:${userId}:${appId}:${conversationId}`;
  }

  get(
    conversationId: string,
    tenantId: string,
    userId: string,
    appId: string
  ): SessionMappingRecord | null {
    const key = this.makeKey(conversationId, tenantId, userId, appId);
    return this.records.get(key) ?? null;
  }

  upsert(input: {
    conversationId: string;
    tenantId: string;
    userId: string;
    appId: string;
    externalConversationId?: string | null;
    externalRunId?: string | null;
  }): SessionMappingRecord {
    const key = this.makeKey(input.conversationId, input.tenantId, input.userId, input.appId);
    const current = this.records.get(key);
    const next: SessionMappingRecord = {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      userId: input.userId,
      appId: input.appId,
      externalConversationId:
        typeof input.externalConversationId === "string"
          ? input.externalConversationId
          : current?.externalConversationId ?? null,
      externalRunId:
        typeof input.externalRunId === "string"
          ? input.externalRunId
          : current?.externalRunId ?? null,
      updatedAt: new Date().toISOString(),
    };

    this.records.set(key, next);
    return next;
  }
}

export const sessionMappingStore = new SessionMappingStore();
