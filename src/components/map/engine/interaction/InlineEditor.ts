import type { PositionedNode } from "../layout/types";

/** Callbacks for one inline editing session. */
export interface InlineEditorCallbacks {
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/** World-space rectangle of the inline editor. */
export interface EditorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Optional visual context for the editor. */
export interface InlineEditorOptions {
  maxWidth?: number;
  placeholder?: string;
  nodeElement?: HTMLElement | null;
  onResize?: (rect: EditorRect) => void;
}

const MIRROR_STYLE_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderTopStyle",
  "borderTopColor",
  "borderRightWidth",
  "borderRightStyle",
  "borderRightColor",
  "borderBottomWidth",
  "borderBottomStyle",
  "borderBottomColor",
  "borderLeftWidth",
  "borderLeftStyle",
  "borderLeftColor",
  "borderRadius",
  "boxShadow",
  "backgroundColor",
  "color",
];

/** Copies computed text/box styles so the editor looks like the node. */
function copyComputedStyles(source: HTMLElement, target: HTMLElement): void {
  const view = source.ownerDocument.defaultView;
  if (!view) return;
  const style = view.getComputedStyle(source);
  for (const property of MIRROR_STYLE_PROPS) {
    target.style.setProperty(kebab(property), style.getPropertyValue(kebab(property)));
  }
  target.style.boxSizing = "border-box";
}

/** Converts a camelCase CSS property to kebab-case. */
function kebab(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Positions a single-line textarea over a node inside the world layer. */
export class InlineEditor {
  private readonly world: HTMLElement;
  private input: HTMLTextAreaElement | null = null;
  private mirror: HTMLElement | null = null;
  private callbacks: InlineEditorCallbacks | null = null;
  private position: PositionedNode | null = null;
  private maxWidth = 280;
  private baseWidth = 40;
  private baseHeight = 30;
  private placeholder = "";
  private composing = false;
  private finished = false;
  private firstResize = true;
  private onResize: ((rect: EditorRect) => void) | null = null;

  /**
   * @param world Transformed map world that hosts the input.
   */
  constructor(world: HTMLElement) {
    this.world = world;
  }

  /** Returns true while the input is mounted. */
  isOpen(): boolean {
    return this.input !== null;
  }

  /**
   * Opens the editor over a node.
   *
   * @param position Node position in world coordinates.
   * @param text Current label.
   * @param callbacks Commit and cancel handlers.
   * @param options Sizing and placeholder context.
   */
  open(
    position: PositionedNode,
    text: string,
    callbacks: InlineEditorCallbacks,
    options: InlineEditorOptions = {},
  ): void {
    this.close();

    const doc = this.world.ownerDocument;
    this.position = position;
    this.maxWidth = Math.max(40, options.maxWidth ?? 280);
    this.placeholder = options.placeholder ?? "";
    this.baseWidth = options.nodeElement?.offsetWidth || position.width || 40;
    this.baseHeight = options.nodeElement?.offsetHeight || position.height || 30;
    this.composing = false;
    this.finished = false;
    this.firstResize = true;
    this.callbacks = callbacks;
    this.onResize = options.onResize ?? null;

    const input = doc.createElement("textarea");
    input.className = "simple-mind-inline-editor";
    input.rows = 1;
    input.wrap = "soft";
    input.value = text;
    input.placeholder = this.placeholder;
    input.spellcheck = false;

    const mirror = doc.createElement("div");
    mirror.className = "simple-mind-editor-mirror";

    if (options.nodeElement) {
      copyComputedStyles(options.nodeElement, input);
      copyComputedStyles(options.nodeElement, mirror);
    }
    input.style.textAlign = "center";
    mirror.style.textAlign = "center";

    input.addEventListener("compositionstart", () => {
      this.composing = true;
    });
    input.addEventListener("compositionend", () => {
      this.composing = false;
      this.resize();
    });
    input.addEventListener("input", () => this.resize());
    input.addEventListener("keydown", (event) => {
      if (event.isComposing || this.composing) return;
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        this.commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.cancel();
      }
    });
    input.addEventListener("blur", () => {
      if (!this.finished) this.commit();
    });
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
    input.addEventListener("click", (event) => event.stopPropagation());

    this.input = input;
    this.mirror = mirror;
    this.world.append(input, mirror);
    this.resize();
    input.focus();
    input.select();
  }

  /** Commits the current value. */
  commit(): void {
    if (!this.input || this.finished) return;
    const value = this.input.value;
    const callbacks = this.callbacks;
    this.finished = true;
    this.remove();
    callbacks?.onCommit(value);
  }

  /** Discards the edit. */
  cancel(): void {
    if (!this.input || this.finished) return;
    const callbacks = this.callbacks;
    this.finished = true;
    this.remove();
    callbacks?.onCancel();
  }

  /** Removes the editor without running callbacks. */
  close(): void {
    this.finished = true;
    this.remove();
  }

  /** Resizes the input to the longest line, capped by maxWidth. */
  private resize(): void {
    if (!this.input || !this.mirror || !this.position) return;
    const value = this.input.value;
    const displayText = value || this.placeholder || " ";

    this.mirror.style.whiteSpace = "pre";
    this.mirror.style.width = "max-content";
    this.mirror.style.maxWidth = "none";
    this.mirror.textContent = displayText;
    const initial = this.firstResize;
    this.firstResize = false;
    const naturalWidth = this.mirror.offsetWidth || this.baseWidth;
    const minimumWidth = initial ? this.baseWidth : 40;
    const width = Math.min(Math.max(minimumWidth, naturalWidth + (initial ? 0 : 1)), this.maxWidth);

    this.mirror.style.whiteSpace = "pre-wrap";
    this.mirror.style.width = `${width}px`;
    this.mirror.style.maxWidth = "none";
    const naturalHeight = this.mirror.offsetHeight || this.baseHeight;
    const height = Math.max(initial ? this.baseHeight : 30, naturalHeight);

    this.input.style.width = `${width}px`;
    this.input.style.height = `${height}px`;
    this.positionInput(width, height);
  }

  /** Moves the input to a new node position without changing its size. */
  reposition(x: number, y: number): void {
    if (!this.input || !this.position) return;
    this.position = { ...this.position, x, y };
    this.input.style.left = `${x}px`;
    this.input.style.top = `${y}px`;
  }

  /** Anchors the input at the node's current position. */
  private positionInput(width: number, height: number): void {
    if (!this.input || !this.position) return;
    const x = this.position.x;
    const y = this.position.y;
    this.input.style.left = `${x}px`;
    this.input.style.top = `${y}px`;
    this.onResize?.({ x, y, width, height });
  }

  /** Removes the input and mirror elements. */
  private remove(): void {
    this.input?.remove();
    this.mirror?.remove();
    this.input = null;
    this.mirror = null;
    this.callbacks = null;
    this.position = null;
    this.onResize = null;
  }
}
