/**
 * Internationalization configuration shared by next-intl request setup.
 */

import { getRequestConfig } from "next-intl/server";
import { normalizeLocale } from "./language";

export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh";

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = (await requestLocale) ?? defaultLocale;
  const normalized = normalizeLocale(requestedLocale);
  const resolvedLocale: Locale = normalized ?? defaultLocale;

  return {
    locale: resolvedLocale,
    messages: (await import(`../../messages/${resolvedLocale}.json`)).default,
    timeZone: "UTC",
    now: new Date(),
  };
});

export const languageNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

export function getLocaleFromPathname(pathname: string): Locale {
  const segments = pathname.split("/");
  const localeSegment = segments[1];

  if (locales.includes(localeSegment as Locale)) {
    return localeSegment as Locale;
  }

  return defaultLocale;
}

export function hasLocalePrefix(pathname: string): boolean {
  const segments = pathname.split("/");
  const localeSegment = segments[1];

  return locales.includes(localeSegment as Locale);
}

export function removeLocalePrefix(pathname: string): string {
  if (!hasLocalePrefix(pathname)) {
    return pathname;
  }

  const segments = pathname.split("/");
  segments.splice(1, 1);

  return segments.join("/") || "/";
}
