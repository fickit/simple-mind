/** Names of the inline icons the map chrome and floating controls draw. */
export type IconName =
  | "align-center"
  | "align-left"
  | "align-right"
  | "bold"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "close"
  | "connector-curve"
  | "connector-orthogonal"
  | "fit"
  | "italic"
  | "layout-mindmap"
  | "layout-org"
  | "layout-tree-left"
  | "layout-tree-right"
  | "minus"
  | "plus"
  | "reset"
  | "settings"
  | "shape-pill"
  | "shape-plain"
  | "shape-rounded"
  | "shape-underline"
  | "source"
  | "style"
  | "underline";

/** One drawn piece of an icon: a stroke path or a letterform. */
type IconShape =
  | { d: string }
  | { glyph: string; bold?: boolean; italic?: boolean; under?: boolean };

const SVG_NS = "http://www.w3.org/2000/svg";

/** Icon drawings on a 16 by 16 grid. */
const SHAPES: Record<IconName, IconShape[]> = {
  "align-left": [{ d: "M3 4.5h10" }, { d: "M3 8h6.5" }, { d: "M3 11.5h8.5" }],
  "align-center": [{ d: "M3 4.5h10" }, { d: "M4.75 8h6.5" }, { d: "M3.75 11.5h8.5" }],
  "align-right": [{ d: "M3 4.5h10" }, { d: "M6.5 8h6.5" }, { d: "M4.5 11.5h8.5" }],
  bold: [{ glyph: "B", bold: true }],
  "chevron-down": [{ d: "M3.75 5.75 8 10l4.25-4.25" }],
  "chevron-left": [{ d: "M10.25 3.5 5.75 8l4.5 4.5" }],
  "chevron-right": [{ d: "M5.75 3.5 10.25 8l-4.5 4.5" }],
  "chevron-up": [{ d: "M3.75 10.25 8 6l4.25 4.25" }],
  close: [{ d: "M4.5 4.5l7 7" }, { d: "M11.5 4.5l-7 7" }],
  "connector-curve": [{ d: "M2 10.5c4 0 8-5 12-5" }],
  "connector-orthogonal": [{ d: "M2 10.5h5.5V5.5H14" }],
  fit: [{ d: "M3 6V3h3" }, { d: "M10 3h3v3" }, { d: "M13 10v3h-3" }, { d: "M6 13H3v-3" }],
  italic: [{ glyph: "I", italic: true }],
  "layout-mindmap": [
    { d: "M6 6.5h4v3H6Z" },
    { d: "M6 8H3.5" },
    { d: "M10 8h2.5" },
    { d: "M3.5 5.5v5" },
    { d: "M12.5 5.5v5" },
  ],
  "layout-org": [
    { d: "M6 2h4v3H6Z" },
    { d: "M8 5v2" },
    { d: "M3 7h10" },
    { d: "M3 7v3" },
    { d: "M13 7v3" },
    { d: "M1.5 10h3" },
    { d: "M11.5 10h3" },
  ],
  "layout-tree-left": [
    { d: "M10 6.5h4v3h-4Z" },
    { d: "M10 8H8" },
    { d: "M8 4v8" },
    { d: "M2.5 4H8" },
    { d: "M2.5 12H8" },
  ],
  "layout-tree-right": [
    { d: "M2 6.5h4v3H2Z" },
    { d: "M6 8h2" },
    { d: "M8 4v8" },
    { d: "M8 4h5.5" },
    { d: "M8 12h5.5" },
  ],
  minus: [{ d: "M3.5 8h9" }],
  plus: [{ d: "M8 3.5v9" }, { d: "M3.5 8h9" }],
  reset: [{ d: "M12.75 10.5a4.75 4.75 0 1 1 .6-4.9" }, { d: "M13.85 2.75v3.3h-3.3" }],
  settings: [
    { d: "M8 5.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" },
    { d: "M8 1.9v1.9" },
    { d: "M8 12.2v1.9" },
    { d: "M1.9 8h1.9" },
    { d: "M12.2 8h1.9" },
    { d: "M3.6 3.6l1.3 1.3" },
    { d: "M11.1 11.1l1.3 1.3" },
    { d: "M12.4 3.6l-1.3 1.3" },
    { d: "M4.9 11.1l-1.3 1.3" },
  ],
  "shape-pill": [{ d: "M4.5 5h7a3 3 0 0 1 0 6h-7a3 3 0 0 1 0-6Z" }],
  "shape-plain": [{ d: "M4 8h8" }],
  "shape-rounded": [
    {
      d: "M3.75 5h8.5A1.75 1.75 0 0 1 14 6.75v2.5A1.75 1.75 0 0 1 12.25 11h-8.5A1.75 1.75 0 0 1 2 9.25v-2.5A1.75 1.75 0 0 1 3.75 5Z",
    },
  ],
  "shape-underline": [{ d: "M5 4.5h6" }, { d: "M2.5 11h11" }],
  source: [{ d: "M6 4.5 2.5 8 6 11.5" }, { d: "M10 4.5 13.5 8 10 11.5" }],
  style: [
    { d: "M3 4.5h10" },
    { d: "M6 3v3" },
    { d: "M3 8h10" },
    { d: "M10 6.5v3" },
    { d: "M3 11.5h10" },
    { d: "M7 10v3" },
  ],
  underline: [{ glyph: "U", under: true }],
};

/** Returns every icon name this module can draw. */
export function iconNames(): IconName[] {
  return Object.keys(SHAPES) as IconName[];
}

/**
 * Draws one icon inside an element, replacing its content.
 *
 * Repeats are skipped through `data-icon`, so controls refreshed on every frame
 * do not rebuild their SVG.
 *
 * @param element Host element, usually a button.
 * @param name Icon to draw.
 */
export function setIcon(element: HTMLElement, name: IconName): void {
  if (element.dataset.icon === name && element.firstElementChild) return;
  const doc = element.ownerDocument;
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "simple-mind-icon");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const shape of SHAPES[name]) {
    svg.appendChild("d" in shape ? drawPath(doc, shape.d) : drawGlyph(doc, shape));
  }

  element.dataset.icon = name;
  element.replaceChildren(svg);
}

/** Writes text into an element and drops any icon, for count bubbles. */
export function setText(element: HTMLElement, value: string): void {
  if (element.textContent === value && !element.firstElementChild) return;
  delete element.dataset.icon;
  element.replaceChildren(element.ownerDocument.createTextNode(value));
}

/** Creates one stroked path. */
function drawPath(doc: Document, d: string): SVGPathElement {
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  return path;
}

/** Creates one letterform, used for bold, italic, and underline. */
function drawGlyph(
  doc: Document,
  shape: { glyph: string; bold?: boolean; italic?: boolean; under?: boolean },
): SVGTextElement {
  const text = doc.createElementNS(SVG_NS, "text");
  text.setAttribute("class", "simple-mind-icon-glyph");
  text.setAttribute("x", "8");
  text.setAttribute("y", "11.5");
  text.setAttribute("text-anchor", "middle");
  if (shape.bold) text.setAttribute("font-weight", "700");
  if (shape.italic) text.setAttribute("font-style", "italic");
  if (shape.under) text.setAttribute("text-decoration", "underline");
  text.textContent = shape.glyph;
  return text;
}
