import { t } from "../../../../config/i18n";
import type { InlineImageSizes, InlineResourceHost } from "../../../../types/inline";
import { imageDisplayBox } from "./imageSizes";

/** Optional resource resolution used while rendering a node label. */
export interface InlineMarkdownOptions {
  /** Resolves notes and vault images, opens and previews notes. */
  host?: InlineResourceHost;
  /** Natural image sizes plus a loader for unknown sources. */
  images?: InlineImageSizes;
  /** Width cap shared with the node layout. */
  maxWidth?: number;
  /** Called once when an image source resolves or fails. */
  onImageReady?: () => void;
}

/**
 * Renders the supported inline Markdown subset into DOM nodes.
 *
 * Raw HTML is never interpreted. Only text nodes and a small set of elements are
 * created, which keeps user-authored labels safe from HTML injection.
 *
 * Supported: bold, italic, strikethrough, inline code, external links,
 * Obsidian wikilinks, image embeds, and Markdown images.
 *
 * @param text Raw node label.
 * @param doc Document used to create nodes.
 * @param options Resource resolution and image sizing.
 */
export function renderInlineMarkdown(
  text: string,
  doc: Document = document,
  options: InlineMarkdownOptions = {},
): DocumentFragment {
  const fragment = createFragment();
  appendInline(text, fragment, doc, options);
  return fragment;
}

/** Matches an embed or Markdown image, capturing its target pieces. */
const IMAGE_TOKEN = /!\[\[([^\]]*)\]\]|!\[([^\]]*)\]\(([^)]*)\)/g;

/** Returns true when a URL is an image the renderer will accept. */
function isRenderableImageTarget(target: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(target) || isExternalImage(target);
}

/**
 * Returns true when a label contains only image tokens and whitespace.
 *
 * Such a node drops its card background and padding so the image group becomes
 * the node itself. Escapes, code, links, and invalid image schemes keep the
 * normal card.
 *
 * @param text Raw node label.
 */
export function isMediaOnlyLabel(text: string): boolean {
  let images = 0;
  const rest = text.replace(
    IMAGE_TOKEN,
    (match: string, embed: string | undefined, _alt: string, url: string | undefined) => {
      const target = embed !== undefined ? embed.trim() : (url ?? "").trim();
      if (!target || !isRenderableImageTarget(target)) return match;
      images += 1;
      return " ";
    },
  );
  return images > 0 && rest.trim() === "";
}

/** Returns true when a URL is an external image source. */
function isExternalImage(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Returns true when a URL carries any scheme. */
function hasScheme(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url.trim());
}

/** Returns true when a link target uses a safe external scheme. */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^(https?:|mailto:)/i.test(trimmed);
}

/** Returns the display label for a wikilink target. */
function noteLabel(target: string): string {
  return target.replace(/\.md$/i, "");
}

/** Parses a `target|suffix` embed body and an optional numeric width. */
function parseEmbedBody(inner: string): { target: string; width: number | null } {
  const split = inner.indexOf("|");
  const rawTarget = split >= 0 ? inner.slice(0, split) : inner;
  const suffix = split >= 0 ? inner.slice(split + 1).trim() : "";
  const widthMatch = /^(\d+)(?:x\d+)?$/i.exec(suffix);
  const width = widthMatch ? Number(widthMatch[1]) : null;
  return {
    target: rawTarget.trim(),
    width: width && width > 0 ? width : null,
  };
}

/**
 * Scans one inline Markdown string and appends the parsed nodes.
 *
 * @param text Remaining text to scan.
 * @param parent Fragment or element receiving the parsed content.
 * @param doc Document used to create nodes.
 * @param options Resource resolution and image sizing.
 */
function appendInline(
  text: string,
  parent: Node,
  doc: Document,
  options: InlineMarkdownOptions,
): void {
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === "\\" && index + 1 < text.length) {
      parent.appendChild(doc.createTextNode(text[index + 1]));
      index += 2;
      continue;
    }

    if (char === "`") {
      const end = text.indexOf("`", index + 1);
      if (end > index + 1) {
        const code = createEl("code");
        code.textContent = text.slice(index + 1, end);
        parent.appendChild(code);
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end > index + 2) {
        const strong = createEl("strong");
        appendInline(text.slice(index + 2, end), strong, doc, options);
        parent.appendChild(strong);
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith("~~", index)) {
      const end = text.indexOf("~~", index + 2);
      if (end > index + 2) {
        const del = createEl("del");
        appendInline(text.slice(index + 2, end), del, doc, options);
        parent.appendChild(del);
        index = end + 2;
        continue;
      }
    }

    if (char === "*" || char === "_") {
      const end = text.indexOf(char, index + 1);
      if (end > index + 1) {
        const em = createEl("em");
        appendInline(text.slice(index + 1, end), em, doc, options);
        parent.appendChild(em);
        index = end + 1;
        continue;
      }
    }

    if (char === "!") {
      if (text.startsWith("![[", index)) {
        const end = text.indexOf("]]", index + 3);
        if (end > index + 3) {
          const body = parseEmbedBody(text.slice(index + 3, end));
          if (body.target && appendEmbed(body.target, body.width, parent, options)) {
            index = end + 2;
            continue;
          }
        }
      }

      if (text.startsWith("![", index)) {
        const labelEnd = text.indexOf("](", index + 2);
        const urlEnd = labelEnd >= 0 ? text.indexOf(")", labelEnd + 2) : -1;
        if (labelEnd > index + 1 && urlEnd > labelEnd + 2) {
          const alt = text.slice(index + 2, labelEnd).trim();
          const url = text.slice(labelEnd + 2, urlEnd).trim();
          if (url && appendMarkdownImage(url, alt, parent, options)) {
            index = urlEnd + 1;
            continue;
          }
        }
      }
    }

    if (char === "[") {
      if (text.startsWith("[[", index)) {
        const end = text.indexOf("]]", index + 2);
        if (end > index + 2) {
          const label = appendNoteLink(text.slice(index + 2, end), parent, options);
          if (label) {
            index = end + 2;
            continue;
          }
        }
      }

      const labelEnd = text.indexOf("](", index + 1);
      const urlEnd = labelEnd >= 0 ? text.indexOf(")", labelEnd + 2) : -1;
      if (labelEnd > index && urlEnd > labelEnd + 2) {
        const label = text.slice(index + 1, labelEnd);
        const url = text.slice(labelEnd + 2, urlEnd).trim();
        if (isSafeUrl(url)) {
          const link = createEl("a");
          link.className = "simple-mind-inline-link is-external";
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          appendInline(label, link, doc, options);
          parent.appendChild(link);
          index = urlEnd + 1;
          continue;
        }
      }
    }

    parent.appendChild(doc.createTextNode(char));
    index += 1;
  }
}

/**
 * Appends a note link for a `[[target|alias]]` body.
 *
 * @param inner Embed body without brackets.
 * @param parent Element receiving the link.
 * @param options Resource resolution.
 * @returns True when a link was appended.
 */
function appendNoteLink(inner: string, parent: Node, options: InlineMarkdownOptions): boolean {
  const split = inner.indexOf("|");
  const target = (split >= 0 ? inner.slice(0, split) : inner).trim();
  const alias = split >= 0 ? inner.slice(split + 1).trim() : "";
  if (!target) return false;

  const exists = options.host?.noteExists(target) ?? false;
  const link = createEl("a");
  link.className = `simple-mind-inline-link${exists ? "" : " is-unresolved"}`;
  link.dataset.link = target;
  link.setAttribute("role", "link");
  link.setAttribute("tabindex", "0");
  link.textContent = alias || noteLabel(target);
  if (!exists) link.setAttribute("aria-description", t("inline.noteMissing", { name: target }));
  parent.appendChild(link);
  return true;
}

/**
 * Appends a vault image for a `![[target|width]]` body.
 *
 * @param target Vault image target.
 * @param width Requested display width, or null.
 * @param parent Element receiving the image or placeholder.
 * @param options Resource resolution and image sizing.
 * @returns True when the embed was consumed.
 */
function appendEmbed(
  target: string,
  width: number | null,
  parent: Node,
  options: InlineMarkdownOptions,
): boolean {
  const src = options.host?.imageSource(target) ?? null;
  if (!src) {
    appendMissing(target, false, parent);
    return true;
  }
  appendImage(src, target, width, parent, options);
  return true;
}

/**
 * Appends a Markdown image from `![alt](url)`.
 *
 * @param url External URL or vault-relative path.
 * @param alt Alt text.
 * @param parent Element receiving the image or placeholder.
 * @param options Resource resolution and image sizing.
 * @returns True when the image syntax was consumed.
 */
function appendMarkdownImage(
  url: string,
  alt: string,
  parent: Node,
  options: InlineMarkdownOptions,
): boolean {
  if (isExternalImage(url)) {
    appendImage(url.trim(), alt || url, null, parent, options);
    return true;
  }
  if (hasScheme(url)) return false;
  const src = options.host?.imageSource(url.trim()) ?? null;
  if (!src) {
    appendMissing(url.trim(), false, parent);
    return true;
  }
  appendImage(src, alt || url, null, parent, options);
  return true;
}

/**
 * Appends one sized image and requests its natural size when unknown.
 *
 * @param src Image source.
 * @param name File name or alt text.
 * @param width Requested display width, or null.
 * @param parent Element receiving the image.
 * @param options Image sizing.
 */
function appendImage(
  src: string,
  name: string,
  width: number | null,
  parent: Node,
  options: InlineMarkdownOptions,
): void {
  const size = options.images?.size(src) ?? null;
  if (size && size.width === 0) {
    appendMissing(name, true, parent);
    return;
  }

  const box = imageDisplayBox(size, width, options.maxWidth);
  const image = createEl("img");
  image.className = "simple-mind-inline-image";
  image.src = src;
  image.width = box.width;
  image.height = box.height;
  image.alt = name;
  image.draggable = false;
  image.dataset.imageName = name;
  parent.appendChild(image);

  if (!size && options.images) {
    options.images.request(src, () => options.onImageReady?.());
  }
}

/**
 * Appends a dashed placeholder for a missing or failed image.
 *
 * @param name File name or alt text.
 * @param failed Whether the source failed to load.
 * @param parent Element receiving the placeholder.
 */
function appendMissing(name: string, failed: boolean, parent: Node): void {
  const placeholder = createSpan();
  placeholder.className = `simple-mind-inline-missing${failed ? " is-failed" : ""}`;
  placeholder.textContent = name;
  placeholder.setAttribute(
    "aria-description",
    failed ? t("inline.imageFailed", { name }) : t("inline.imageMissing", { name }),
  );
  placeholder.dataset.missing = name;
  parent.appendChild(placeholder);
}
