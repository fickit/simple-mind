// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderInlineMarkdown } from "./inlineMarkdown";

function render(text: string): HTMLElement {
  const host = document.createElement("div");
  host.appendChild(renderInlineMarkdown(text, document));
  return host;
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
});
