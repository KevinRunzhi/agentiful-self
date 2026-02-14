import { describe, expect, it } from "vitest";
import { normalizeLocale, parseAcceptLanguage, resolveLocalePreference } from "../../src/lib/language";

describe("language resolution", () => {
  it("normalizes locale aliases", () => {
    expect(normalizeLocale("zh-CN")).toBe("zh");
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("fr-FR")).toBeNull();
  });

  it("parses browser Accept-Language", () => {
    expect(parseAcceptLanguage("fr-FR,zh-CN;q=0.9,en-US;q=0.8")).toBe("zh");
    expect(parseAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
  });

  it("applies precedence user > tenant > browser > fallback", () => {
    expect(
      resolveLocalePreference({
        userPreference: "en-US",
        tenantDefault: "zh-CN",
        browserLanguage: "zh-CN,zh;q=0.8",
      })
    ).toBe("en");

    expect(
      resolveLocalePreference({
        tenantDefault: "en-US",
        browserLanguage: "zh-CN,zh;q=0.8",
      })
    ).toBe("en");

    expect(
      resolveLocalePreference({
        browserLanguage: "zh-CN,zh;q=0.8",
      })
    ).toBe("zh");
  });
});
