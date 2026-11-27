import { describe, expect, it } from "vitest";
import { isImagePath, linkFileTarget } from "./inlineTargets";

describe("inline resource helpers", () => {
  it("recognizes image extensions case-insensitively", () => {
    expect(isImagePath("attachments/photo.PNG")).toBe(true);
    expect(isImagePath("diagram.svg")).toBe(true);
    expect(isImagePath("note.md")).toBe(false);
    expect(isImagePath("archive.tar.gz")).toBe(false);
  });

  it("strips aliases, headings, and blocks from a link target", () => {
    expect(linkFileTarget("Plan|Roadmap")).toBe("Plan");
    expect(linkFileTarget("Plan#Steps")).toBe("Plan");
    expect(linkFileTarget("Plan#Steps|Roadmap")).toBe("Plan");
    expect(linkFileTarget("Plan^block")).toBe("Plan");
    expect(linkFileTarget("  Plan  ")).toBe("Plan");
  });
});
