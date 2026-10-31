import type { PositionedNode } from "../layout/types";

/** Callbacks for one inline editing session. */
export interface InlineEditorCallbacks {
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/** Positions a single-line input over a node inside the world layer. */
export class InlineEditor {
  private readonly world: HTMLElement;
  private input: HTMLInputElement | null = null;
  private callbacks: InlineEditorCallbacks | null = null;
  private composing = false;
  private finished = false;

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
   * @param placeholder Placeholder for a new node.
   */
  open(
    position: PositionedNode,
    text: string,
    callbacks: InlineEditorCallbacks,
    placeholder = "",
  ): void {
    this.close();

    const doc = this.world.ownerDocument;
    const input = doc.createElement("input");
    input.type = "text";
    input.className = "simple-mind-inline-editor";
    input.value = text;
    input.placeholder = placeholder;
    input.setAttribute("aria-label", "Edit node label");
    input.style.left = `${position.x}px`;
    input.style.top = `${position.y}px`;
    input.style.width = `${Math.max(position.width, 180)}px`;
    input.style.height = `${Math.max(position.height, 30)}px`;

    this.composing = false;
    this.finished = false;
    this.callbacks = callbacks;
    this.input = input;

    input.addEventListener("compositionstart", () => {
      this.composing = true;
    });
    input.addEventListener("compositionend", () => {
      this.composing = false;
    });
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

    this.world.appendChild(input);
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

  /** Removes the input element. */
  private remove(): void {
    this.input?.remove();
    this.input = null;
    this.callbacks = null;
  }
}
