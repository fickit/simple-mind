import { INLINE_SUGGESTION_LIMIT } from "../../../../config/constants";
import { t } from "../../../../config/i18n";
import type { InlineSuggestion, InlineSuggestionKind } from "../../../../types/inline";
import type { PositionedNode } from "../layout/types";
import { type InlineTrigger, insertSuggestion, matchInlineTrigger } from "./inlineSuggest";

/** Action to run after a committed edit. */
export type CommitAction = "none" | "child" | "sibling";

/** Callbacks for one inline editing session. */
export interface InlineEditorCallbacks {
  onCommit: (value: string, action: CommitAction) => void;
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
  initialWidth?: number;
  placeholder?: string;
  nodeElement?: HTMLElement | null;
  onResize?: (rect: EditorRect) => void;
  /** Selects the whole label on open; false puts the caret at the end. */
  selectAll?: boolean;
  /** Returns autocomplete candidates for an open link or embed trigger. */
  suggest?: (kind: InlineSuggestionKind, query: string) => InlineSuggestion[];
}

const MIRROR_STYLE_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
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
  private suggest: ((kind: InlineSuggestionKind, query: string) => InlineSuggestion[]) | null =
    null;
  private suggestList: HTMLElement | null = null;
  private suggestions: InlineSuggestion[] = [];
  private suggestionIndex = 0;
  private trigger: InlineTrigger | null = null;

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

    this.position = position;
    this.maxWidth = Math.max(40, options.maxWidth ?? 280);
    this.placeholder = options.placeholder ?? "";
    this.baseWidth =
      options.initialWidth ?? options.nodeElement?.offsetWidth ?? position.width ?? 40;
    this.baseHeight = options.nodeElement?.offsetHeight || position.height || 30;
    this.composing = false;
    this.finished = false;
    this.firstResize = true;
    this.callbacks = callbacks;
    this.onResize = options.onResize ?? null;
    this.suggest = options.suggest ?? null;

    const input = createEl("textarea");
    input.className = "simple-mind-inline-editor";
    input.rows = 1;
    input.wrap = "soft";
    input.value = text;
    input.placeholder = this.placeholder;
    input.spellcheck = false;

    const mirror = createDiv();
    mirror.className = "simple-mind-editor-mirror";

    if (options.nodeElement) {
      copyComputedStyles(options.nodeElement, input);
      copyComputedStyles(options.nodeElement, mirror);
    }

    input.addEventListener("compositionstart", () => {
      this.composing = true;
    });
    input.addEventListener("compositionend", () => {
      this.composing = false;
      this.resize();
    });
    input.addEventListener("input", () => {
      this.resize();
      this.refreshSuggestions();
    });
    input.addEventListener("keydown", (event) => {
      if (event.isComposing || this.composing) return;
      if (this.handleSuggestionKey(event)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        this.commit(event.shiftKey ? "none" : "sibling");
      } else if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        this.commit(event.shiftKey ? "none" : "child");
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.cancel();
      }
    });
    input.addEventListener("keyup", (event) => {
      const movesCaret =
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "Home" ||
        event.key === "End" ||
        ((event.key === "ArrowUp" || event.key === "ArrowDown") && !this.suggestList);
      if (movesCaret) this.refreshSuggestions();
    });
    input.addEventListener("blur", () => {
      if (!this.finished) this.commit("none");
    });
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
    input.addEventListener("click", (event) => {
      event.stopPropagation();
      this.refreshSuggestions();
    });

    this.input = input;
    this.mirror = mirror;
    this.world.append(input, mirror);
    this.resize();
    input.focus();
    if (options.selectAll === false) {
      input.setSelectionRange(input.value.length, input.value.length);
    } else {
      input.select();
    }
  }

  /** Commits the current value and reports the next action. */
  commit(action: CommitAction = "none"): void {
    if (!this.input || this.finished) return;
    const value = this.input.value;
    const callbacks = this.callbacks;
    this.finished = true;
    this.remove();
    callbacks?.onCommit(value, action);
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

    this.mirror.classList.add("is-measuring");
    this.mirror.classList.remove("is-wrapping");
    this.mirror.style.removeProperty("width");
    this.mirror.textContent = displayText;
    const initial = this.firstResize;
    this.firstResize = false;
    const naturalWidth = this.mirror.offsetWidth || this.baseWidth;
    const minimumWidth = initial ? this.baseWidth : 40;
    const width = Math.min(Math.max(minimumWidth, naturalWidth + (initial ? 0 : 1)), this.maxWidth);

    this.mirror.classList.remove("is-measuring");
    this.mirror.classList.add("is-wrapping");
    this.mirror.style.width = `${width}px`;
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

  /** Handles navigation keys while the suggestion list is open. */
  private handleSuggestionKey(event: KeyboardEvent): boolean {
    if (!this.suggestList || this.suggestions.length === 0) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      this.moveSuggestion(event.key === "ArrowDown" ? 1 : -1);
      return true;
    }
    if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      this.applySuggestion(this.suggestionIndex);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.closeSuggestions();
      return true;
    }
    return false;
  }

  /** Recomputes the suggestion list from the text before the caret. */
  private refreshSuggestions(): void {
    if (!this.input || !this.suggest) {
      this.closeSuggestions();
      return;
    }
    const caret = this.input.selectionStart ?? this.input.value.length;
    const trigger = matchInlineTrigger(this.input.value, caret);
    if (!trigger) {
      this.closeSuggestions();
      return;
    }
    const items = this.suggest(trigger.kind, trigger.query).slice(0, INLINE_SUGGESTION_LIMIT);
    if (items.length === 0) {
      this.closeSuggestions();
      return;
    }
    this.trigger = trigger;
    this.suggestions = items;
    this.suggestionIndex = 0;
    this.renderSuggestions();
  }

  /** Draws the popup below the input and marks the active row. */
  private renderSuggestions(): void {
    if (!this.input || !this.trigger) return;

    const list = this.suggestList ?? createDiv();
    list.className = "simple-mind-suggest";
    list.setAttribute("role", "listbox");
    list.setAttribute(
      "aria-description",
      t(this.trigger.kind === "image" ? "suggest.images" : "suggest.notes"),
    );
    list.replaceChildren();

    this.suggestions.forEach((item, index) => {
      const row = createDiv();
      row.className = "simple-mind-suggest-item";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(index === this.suggestionIndex));
      if (index === this.suggestionIndex) row.classList.add("is-active");

      const label = createSpan();
      label.className = "simple-mind-suggest-label";
      label.textContent = item.label;
      const detail = createSpan();
      detail.className = "simple-mind-suggest-detail";
      detail.textContent = item.detail;
      row.append(label, detail);

      row.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      row.addEventListener("pointerenter", () => this.setSuggestionIndex(index));
      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.applySuggestion(index);
      });
      list.appendChild(row);
    });

    if (!this.suggestList) {
      this.world.appendChild(list);
      this.suggestList = list;
    }
    list.style.left = `${this.input.offsetLeft}px`;
    list.style.top = `${this.input.offsetTop + this.input.offsetHeight + 4}px`;
    list.style.width = `${Math.min(Math.max(this.input.offsetWidth, 220), 340)}px`;
  }

  /** Moves the active row, wrapping at both ends. */
  private moveSuggestion(delta: number): void {
    this.setSuggestionIndex(this.suggestionIndex + delta);
  }

  /** Marks one row active and keeps it in view. */
  private setSuggestionIndex(index: number): void {
    const count = this.suggestions.length;
    if (count === 0) return;
    this.suggestionIndex = ((index % count) + count) % count;
    const rows = this.suggestList?.children;
    if (!rows) return;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] as HTMLElement;
      const active = rowIndex === this.suggestionIndex;
      row.classList.toggle("is-active", active);
      row.setAttribute("aria-selected", String(active));
      if (active) row.scrollIntoView?.({ block: "nearest" });
    }
  }

  /** Replaces the open trigger with the chosen candidate. */
  private applySuggestion(index: number): void {
    const item = this.suggestions[index];
    if (!item || !this.input || !this.trigger) return;
    const caret = this.input.selectionStart ?? this.input.value.length;
    const result = insertSuggestion(this.input.value, caret, this.trigger, item.insert);
    this.input.value = result.value;
    this.input.setSelectionRange(result.caret, result.caret);
    this.closeSuggestions();
    this.resize();
    this.input.focus();
  }

  /** Removes the suggestion popup and its state. */
  private closeSuggestions(): void {
    this.suggestList?.remove();
    this.suggestList = null;
    this.suggestions = [];
    this.suggestionIndex = 0;
    this.trigger = null;
  }

  /** Removes the input and mirror elements. */
  private remove(): void {
    this.closeSuggestions();
    this.suggest = null;
    this.input?.remove();
    this.mirror?.remove();
    this.input = null;
    this.mirror = null;
    this.callbacks = null;
    this.position = null;
    this.onResize = null;
  }
}
