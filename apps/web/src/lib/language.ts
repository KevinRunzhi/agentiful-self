export type AppLocale = "zh" | "en";

const LOCALE_ALIASES: Record<string, AppLocale> = {
  zh: "zh",
  "zh-cn": "zh",
  "zh-hans": "zh",
  en: "en",
  "en-us": "en",
  "en-gb": "en",
};

export function normalizeLocale(input: string | null | undefined): AppLocale | null {
  if (!input) {
    return null;
  }
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return LOCALE_ALIASES[normalized] ?? null;
}

export function parseAcceptLanguage(acceptLanguage: string | null | undefined): AppLocale | null {
  if (!acceptLanguage) {
    return null;
  }

  const candidates = acceptLanguage
    .split(",")
    .map((item) => item.trim().split(";")[0]?.trim() ?? "")
    .filter(Boolean);

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) {
      return locale;
    }
  }

  return null;
}

export function resolveLocalePreference(input: {
  userPreference?: string | null;
  tenantDefault?: string | null;
  browserLanguage?: string | null;
  fallback?: AppLocale;
}): AppLocale {
  const fallback = input.fallback ?? "zh";
  return (
    normalizeLocale(input.userPreference) ??
    normalizeLocale(input.tenantDefault) ??
    parseAcceptLanguage(input.browserLanguage) ??
    fallback
  );
}
