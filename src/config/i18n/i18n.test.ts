import { afterEach, describe, expect, it } from "vitest";
import { setLanguage, t } from "./index";

afterEach(() => {
  setLanguage("en");
});

describe("i18n", () => {
  it("switches between English and Chinese", () => {
    expect(t("toolbar.fit")).toBe("Fit");
    setLanguage("zh");
    expect(t("toolbar.fit")).toBe("适应画布");
  });

  it("interpolates placeholders", () => {
    setLanguage("zh");
    expect(t("banner.moreErrors", { count: 2 })).toContain("2");
    expect(t("notice.saveFailed", { reason: "disk" })).toContain("disk");
  });
});
