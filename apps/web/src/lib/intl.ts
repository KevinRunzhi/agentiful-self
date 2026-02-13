/**
 * Internationalization Configuration
 *
 * next-intl setup for multi-language support
 */

import { getRequestConfig } from "next-intl/server";

/**
 * Supported languages
 */
export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];

/**
 * Default language
 */
export const defaultLocale: Locale = "en";

/**
 * Get request config for next-intl
 */
export default getRequestConfig(async ({ locale }) => {
  return {
    messages: (await import(`../../../messages/${locale}.json`)).default,
    timeZone: "UTC",
    now: new Date(),
  };
});

/**
 * Language names for display
 */
export const languageNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

/**
 * Get locale from pathname
 */
export function getLocaleFromPathname(pathname: string): Locale {
  const segments = pathname.split("/");
  const localeSegment = segments[1];

  if (locales.includes(localeSegment as Locale)) {
    return localeSegment as Locale;
  }

  return defaultLocale;
}

/**
 * Check if pathname has locale prefix
 */
export function hasLocalePrefix(pathname: string): boolean {
  const segments = pathname.split("/");
  const localeSegment = segments[1];

  return locales.includes(localeSegment as Locale);
}

/**
 * Remove locale prefix from pathname
 */
export function removeLocalePrefix(pathname: string): string {
  if (!hasLocalePrefix(pathname)) {
    return pathname;
  }

  const segments = pathname.split("/");
  segments.splice(1, 1); // Remove locale segment

  return segments.join("/") || "/";
}
