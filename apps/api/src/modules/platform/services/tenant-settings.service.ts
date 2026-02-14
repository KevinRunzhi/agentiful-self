import type { TenantConfig } from "@agentifui/db/schema";

export interface TenantSettingsRecord {
  id: string;
  customConfig: TenantConfig | null;
  configVersion: number;
}

export interface TenantSettingsRepository {
  findById(tenantId: string): Promise<TenantSettingsRecord | null>;
  updateConfig(input: { tenantId: string; customConfig: TenantConfig; configVersion: number }): Promise<void>;
}

export interface TenantSettingsAuditWriter {
  writeConfigDiff(input: {
    tenantId: string;
    actorUserId?: string;
    before: TenantConfig;
    after: TenantConfig;
    changedKeys: string[];
  }): Promise<void>;
}

export class TenantSettingsValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TenantSettingsValidationError";
  }
}

export const DEFAULT_TENANT_SETTINGS: TenantConfig = {
  i18n: {
    defaultLanguage: "zh-CN",
    allowUserOverride: true,
  },
  notification: {
    typesEnabled: ["quota", "approval", "system_announcement"],
    retentionDays: 90,
    inAppNotifications: true,
  },
  fileUpload: {
    maxSizeMb: 50,
    allowedTypes: ["pdf", "doc", "docx", "txt", "png", "jpg", "jpeg", "webp", "mp3", "mp4"],
    retentionDays: 90,
  },
  conversationShare: {
    defaultTtlDays: 0,
    maxTtlDays: 365,
    requireLogin: true,
  },
};

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends PlainObject>(base: T, patch: PlainObject): T {
  const result: PlainObject = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }

    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }

    result[key] = value;
  }

  return result as T;
}

function topLevelChangedKeys(before: TenantConfig, after: TenantConfig): string[] {
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changed: string[] = [];
  for (const key of keys) {
    const beforeValue = JSON.stringify((before as PlainObject)[key] ?? null);
    const afterValue = JSON.stringify((after as PlainObject)[key] ?? null);
    if (beforeValue !== afterValue) {
      changed.push(key);
    }
  }
  return changed.sort();
}

function parseHexColor(color: string): [number, number, number] | null {
  const normalized = color.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function luminance([r, g, b]: [number, number, number]): number {
  const toLinear = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function computeContrastRatio(colorA: string, colorB: string): number | null {
  const rgbA = parseHexColor(colorA);
  const rgbB = parseHexColor(colorB);
  if (!rgbA || !rgbB) {
    return null;
  }

  const l1 = luminance(rgbA);
  const l2 = luminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function validateSettings(config: TenantConfig): void {
  const language = config.i18n?.defaultLanguage;
  if (language && !["zh-CN", "en-US", "zh", "en"].includes(language)) {
    throw new TenantSettingsValidationError("Unsupported default language", {
      path: "i18n.defaultLanguage",
      language,
    });
  }

  if (config.webhook?.enabled) {
    if (!config.webhook.url || !config.webhook.signingSecret) {
      throw new TenantSettingsValidationError("Webhook requires url and signing secret when enabled", {
        path: "webhook",
      });
    }
  }

  const primary = config.branding?.primaryColor;
  const secondary = config.branding?.secondaryColor;
  if (primary && secondary) {
    const contrast = computeContrastRatio(primary, secondary);
    if (contrast === null) {
      throw new TenantSettingsValidationError("Brand colors must be valid 6-digit hex values", {
        path: "branding",
      });
    }
    if (contrast < 4.5) {
      throw new TenantSettingsValidationError("Brand colors must satisfy WCAG AA contrast ratio >= 4.5", {
        path: "branding",
        contrast,
      });
    }
  }
}

export function resolveEffectiveTenantSettings(
  customConfig: TenantConfig | null | undefined,
  platformDefaults: TenantConfig = DEFAULT_TENANT_SETTINGS
): TenantConfig {
  const merged = deepMerge(platformDefaults as PlainObject, (customConfig ?? {}) as PlainObject);
  return merged as TenantConfig;
}

export class TenantSettingsService {
  constructor(
    private readonly repository: TenantSettingsRepository,
    private readonly auditWriter?: TenantSettingsAuditWriter,
    private readonly platformDefaults: TenantConfig = DEFAULT_TENANT_SETTINGS
  ) {}

  async getEffectiveSettings(tenantId: string): Promise<{ config: TenantConfig; configVersion: number }> {
    const tenant = await this.repository.findById(tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    return {
      config: resolveEffectiveTenantSettings(tenant.customConfig, this.platformDefaults),
      configVersion: tenant.configVersion,
    };
  }

  async updateSettings(input: {
    tenantId: string;
    patch: Partial<TenantConfig>;
    actorUserId?: string;
  }): Promise<{ config: TenantConfig; configVersion: number; changedKeys: string[] }> {
    const tenant = await this.repository.findById(input.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const before = resolveEffectiveTenantSettings(tenant.customConfig, this.platformDefaults);
    const after = deepMerge(before as PlainObject, input.patch as PlainObject) as TenantConfig;
    validateSettings(after);

    const changedKeys = topLevelChangedKeys(before, after);
    const configVersion = tenant.configVersion + 1;

    await this.repository.updateConfig({
      tenantId: input.tenantId,
      customConfig: after,
      configVersion,
    });

    if (this.auditWriter && changedKeys.length > 0) {
      await this.auditWriter.writeConfigDiff({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        before,
        after,
        changedKeys,
      });
    }

    return { config: after, configVersion, changedKeys };
  }
}
