// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { InlineImageSizes, InlineResourceHost } from "../../../../types/inline";
import { type InlineMarkdownOptions, renderInlineMarkdown } from "./inlineMarkdown";

const host: InlineResourceHost = {
  noteExists: (target) => target === "Plan" || target.startsWith("Plan#"),
  imageSource: (target) => (target === "missing.png" ? null : `vault://${target}`),
  openNote: vi.fn(),
  previewNote: vi.fn(),
  suggest: () => [],
};

function imagesWith(sizes: Record<string, { width: number; height: number }>): InlineImageSizes {
  return {
    size: (src) => sizes[src] ?? null,
    request: vi.fn(),
  };
}

const sizes = imagesWith({ "vault://photo.png": { width: 600, height: 300 } });

function render(text: string, options: InlineMarkdownOptions = {}): HTMLElement {
  const container = document.createElement("div");
  container.appendChild(
    renderInlineMarkdown(text, document, { host, images: sizes, maxWidth: 400, ...options }),
  );
  return container;
}

describe("renderInlineMarkdown", () => {
  it("renders plain text", () => {
    expect(render("Hello node").textContent).toBe("Hello node");
  });

  it("renders bold, italic, strikethrough, and code", () => {
    const host = render("**bold** *italic* ~~gone~~ `code`");

    expect(host.querySelector("strong")?.textContent).toBe("bold");
    expect(host.querySelector("em")?.textContent).toBe("italic");
    expect(host.querySelector("del")?.textContent).toBe("gone");
    expect(host.querySelector("code")?.textContent).toBe("code");
  });

  it("renders independent emphasis spans", () => {
    const host = render("**bold** and *italic*");

    expect(host.querySelector("strong")?.textContent).toBe("bold");
    expect(host.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders safe links", () => {
    const link = render("[OpenAI](https://openai.com)").querySelector("a");

    expect(link?.textContent).toBe("OpenAI");
    expect(link?.getAttribute("href")).toBe("https://openai.com");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("rejects unsafe link schemes", () => {
    const host = render("[bad](javascript:alert(1))");

    expect(host.querySelector("a")).toBeNull();
    expect(host.textContent).toBe("[bad](javascript:alert(1))");
  });

  it("does not interpret raw HTML", () => {
    const host = render('<img src=x onerror="alert(1)">');

    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe('<img src=x onerror="alert(1)">');
  });

  it("supports escapes and code without nested parsing", () => {
    const host = render("\\*literal\\* and `**not bold**`");

    expect(host.textContent).toBe("*literal* and **not bold**");
    expect(host.querySelector("strong")).toBeNull();
  });

  it("leaves unmatched markers as text", () => {
    expect(render("**unclosed").textContent).toBe("**unclosed");
    expect(render("`unclosed").textContent).toBe("`unclosed");
  });

  it("renders note links with aliases and resolved state", () => {
    const link = render("See [[Plan|Roadmap]]").querySelector("a");

    expect(link?.textContent).toBe("Roadmap");
    expect(link?.dataset.link).toBe("Plan");
    expect(link?.classList.contains("is-unresolved")).toBe(false);
    expect(link?.getAttribute("role")).toBe("link");
    expect(link?.getAttribute("tabindex")).toBe("0");
  });

  it("keeps heading targets and marks missing notes", () => {
    const target = render("[[Plan#Steps]]").querySelector("a");
    const missing = render("[[Ghost]]").querySelector("a");

    expect(target?.dataset.link).toBe("Plan#Steps");
    expect(target?.textContent).toBe("Plan#Steps");
    expect(missing?.classList.contains("is-unresolved")).toBe(true);
    expect(missing?.title).toContain("Ghost");
  });

  it("renders a vault image capped at 140 px high", () => {
    const image = render("![[photo.png]]").querySelector("img");

    expect(image?.getAttribute("src")).toBe("vault://photo.png");
    expect(image?.width).toBe(280);
    expect(image?.height).toBe(140);
    expect(image?.getAttribute("draggable")).toBe("false");
  });

  it("honours a requested width and the node width cap", () => {
    const sized = render("![[photo.png|300]]").querySelector("img");
    const capped = render("![[photo.png|500]]").querySelector("img");

    expect(sized?.width).toBe(300);
    expect(sized?.height).toBe(150);
    expect(capped?.width).toBe(400);
    expect(capped?.height).toBe(200);
  });

  it("renders missing vault images as placeholders", () => {
    const host = render("![[missing.png]]");
    const placeholder = host.querySelector(".simple-mind-inline-missing");

    expect(host.querySelector("img")).toBeNull();
    expect(placeholder?.textContent).toBe("missing.png");
    expect(placeholder?.classList.contains("is-failed")).toBe(false);
  });

  it("renders external images and requests their natural size", () => {
    const host = render("![banner](https://example.com/a.png)");
    const image = host.querySelector("img");

    expect(image?.getAttribute("src")).toBe("https://example.com/a.png");
    expect(image?.alt).toBe("banner");
    expect(image?.width).toBe(200);
    expect(image?.height).toBe(120);
    expect(sizes.request).toHaveBeenCalledWith("https://example.com/a.png", expect.any(Function));
  });

  it("rejects unsafe image schemes", () => {
    const host = render("![bad](file:///etc/passwd)");

    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toContain("file:///etc/passwd");
  });

  it("renders a failed image as a failed placeholder", () => {
    const failed = imagesWith({ "vault://broken.png": { width: 0, height: 0 } });
    const host = render("![[broken.png]]", { images: failed });

    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector(".simple-mind-inline-missing.is-failed")?.textContent).toBe(
      "broken.png",
    );
  });

  it("mixes text, note links, and images", () => {
    const host = render("See [[Plan]] and ![[photo.png]]");

    expect(host.querySelector("a")?.textContent).toBe("Plan");
    expect(host.querySelector("img")?.getAttribute("src")).toBe("vault://photo.png");
    expect(host.textContent).toContain("See");
    expect(host.textContent).toContain("and");
  });

  it("keeps escaped wikilinks literal", () => {
    const host = render("\\[[Plan]]");

    expect(host.querySelector("a")).toBeNull();
    expect(host.textContent).toBe("[[Plan]]");
  });
});
