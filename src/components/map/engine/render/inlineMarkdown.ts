/**
 * Renders the supported inline Markdown subset into DOM nodes.
 *
 * Raw HTML is never interpreted. Only text nodes and a small set of elements are
 * created, which keeps user-authored labels safe from HTML injection.
 *
 * Supported: bold, italic, strikethrough, inline code, and links with
 * http/https/mailto schemes.
 *
 * @param text Raw node label.
 * @param doc Document used to create nodes.
 */
export function renderInlineMarkdown(text: string, doc: Document = document): DocumentFragment {
  const fragment = createFragment();
  appendInline(text, fragment, doc);
  return fragment;
}

/** Returns true when a link target uses an allowed scheme. */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^(https?:|mailto:)/i.test(trimmed);
}

/**
 * Scans one inline Markdown string and appends the parsed nodes.
 *
 * @param text Remaining text to scan.
 * @param parent Fragment or element receiving the parsed content.
 * @param doc Document used to create nodes.
 */
function appendInline(text: string, parent: Node, doc: Document): void {
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
        appendInline(text.slice(index + 2, end), strong, doc);
        parent.appendChild(strong);
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith("~~", index)) {
      const end = text.indexOf("~~", index + 2);
      if (end > index + 2) {
        const del = createEl("del");
        appendInline(text.slice(index + 2, end), del, doc);
        parent.appendChild(del);
        index = end + 2;
        continue;
      }
    }

    if (char === "*" || char === "_") {
      const end = text.indexOf(char, index + 1);
      if (end > index + 1) {
        const em = createEl("em");
        appendInline(text.slice(index + 1, end), em, doc);
        parent.appendChild(em);
        index = end + 1;
        continue;
      }
    }

    if (char === "[") {
      const labelEnd = text.indexOf("](", index + 1);
      const urlEnd = labelEnd >= 0 ? text.indexOf(")", labelEnd + 2) : -1;
      if (labelEnd > index && urlEnd > labelEnd + 2) {
        const label = text.slice(index + 1, labelEnd);
        const url = text.slice(labelEnd + 2, urlEnd).trim();
        if (isSafeUrl(url)) {
          const link = createEl("a");
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          appendInline(label, link, doc);
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
