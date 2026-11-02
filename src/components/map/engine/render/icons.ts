/** Names of the inline icons the map chrome and floating controls draw. */
export type IconName =
  | "align-center"
  | "align-left"
  | "align-right"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "close"
  | "minus"
  | "plus";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Stroke paths per icon on a 16 by 16 grid. */
const PATHS: Record<IconName, string[]> = {
  "align-left": ["M3 4.5h10", "M3 8h6.5", "M3 11.5h8.5"],
  "align-center": ["M3 4.5h10", "M4.75 8h6.5", "M3.75 11.5h8.5"],
  "align-right": ["M3 4.5h10", "M6.5 8h6.5", "M4.5 11.5h8.5"],
  "chevron-down": ["M3.75 5.75 8 10l4.25-4.25"],
  "chevron-left": ["M10.25 3.5 5.75 8l4.5 4.5"],
  "chevron-right": ["M5.75 3.5 10.25 8l-4.5 4.5"],
  "chevron-up": ["M3.75 10.25 8 6l4.25 4.25"],
  close: ["M4.5 4.5l7 7", "M11.5 4.5l-7 7"],
  minus: ["M3.5 8h9"],
  plus: ["M8 3.5v9", "M3.5 8h9"],
};

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

  for (const d of PATHS[name]) {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
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
