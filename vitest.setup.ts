/** Element options accepted by Obsidian's DOM creation helpers. */
type HelperInfo =
  | string
  | {
      cls?: string | string[];
      text?: string;
      attr?: Record<string, string | number | boolean | null>;
      parent?: Node;
    };

/** Applies the class, text, attribute, and parent options of one helper call. */
function applyInfo(element: Element, info?: HelperInfo): void {
  if (!info) return;
  if (typeof info === "string") {
    element.classList.add(info);
    return;
  }
  for (const name of info.cls ? (Array.isArray(info.cls) ? info.cls : [info.cls]) : []) {
    element.classList.add(name);
  }
  if (info.text !== undefined) element.textContent = info.text;
  for (const [name, value] of Object.entries(info.attr ?? {})) {
    if (value === null) continue;
    element.setAttribute(name, String(value));
  }
  info.parent?.appendChild(element);
}

/** Creates one detached element through the DOM API. */
function makeElement(
  tag: string,
  info?: HelperInfo,
  callback?: (element: Element) => void,
): Element {
  const element = document.createElement(tag);
  applyInfo(element, info);
  callback?.(element);
  return element;
}

/** Creates one detached SVG element in the SVG namespace. */
function makeSvgElement(
  tag: string,
  info?: HelperInfo,
  callback?: (element: Element) => void,
): Element {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  applyInfo(element, info);
  callback?.(element);
  return element;
}

// jsdom lacks Obsidian's global DOM helpers, which the components use at runtime.
if (typeof document !== "undefined" && typeof globalThis.createEl !== "function") {
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.createEl = makeElement;
  globals.createDiv = (info?: HelperInfo, callback?: (element: Element) => void): Element =>
    makeElement("div", info, callback);
  globals.createSpan = (info?: HelperInfo, callback?: (element: Element) => void): Element =>
    makeElement("span", info, callback);
  globals.createSvg = makeSvgElement;
  globals.createFragment = (): DocumentFragment => document.createDocumentFragment();
}
