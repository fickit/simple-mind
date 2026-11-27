/** Drop position relative to a target node. */
export type DropPosition = "child" | "before" | "after";

/** Callbacks and queries used by the drag controller. */
export interface DragCallbacks {
  isDraggable: (nodeId: string) => boolean;
  canDrop: (sourceId: string, targetId: string) => boolean;
  isRoot: (nodeId: string) => boolean;
  isCollapsed: (nodeId: string) => boolean;
  expand: (nodeId: string) => void;
  drop: (sourceId: string, targetId: string, position: DropPosition) => void;
  /** Pans the canvas while the root is dragged. */
  panBy: (dx: number, dy: number) => void;
}

interface DragCandidate {
  nodeId: string;
  element: HTMLElement;
  startX: number;
  startY: number;
  pointerId: number;
}

interface DropTarget {
  nodeId: string;
  element: HTMLElement;
  position: DropPosition;
}

interface PanCandidate {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  pointerId: number;
}

const DRAG_THRESHOLD = 4;
const EXPAND_DELAY = 500;

/**
 * Resolves whether a pointer is over a node's top, bottom, or center area.
 *
 * @param clientY Pointer y in screen coordinates.
 * @param rect Target client rectangle.
 */
export function resolveDropPosition(
  clientY: number,
  rect: { top: number; height: number },
): DropPosition {
  if (rect.height <= 0) return "child";
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "child";
}

/** Handles pointer-based node dragging and drop indicators. */
export class DragController {
  private readonly canvas: HTMLElement;
  private readonly callbacks: DragCallbacks;
  private candidate: DragCandidate | null = null;
  private panCandidate: PanCandidate | null = null;
  private source: { nodeId: string; element: HTMLElement } | null = null;
  private target: DropTarget | null = null;
  private ghost: HTMLElement | null = null;
  private ghostOffsetX = 0;
  private ghostOffsetY = 0;
  private expandTimer: number | null = null;
  private hoverTargetId: string | null = null;
  private windowBound = false;
  private readonly onPointerDown = (event: PointerEvent): void => this.handlePointerDown(event);
  private readonly onPointerMove = (event: PointerEvent): void => this.handlePointerMove(event);
  private readonly onPointerUp = (event: PointerEvent): void => this.handlePointerUp(event);
  private readonly onPointerCancel = (): void => this.cancel();

  /**
   * @param canvas Canvas that contains the map nodes.
   * @param callbacks Drag queries and drop actions.
   */
  constructor(canvas: HTMLElement, callbacks: DragCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  /** Cancels any active drag and removes visual state. */
  cancel(): void {
    this.clearExpandTimer();
    if (this.source) {
      this.source.element.classList.remove("is-dragging");
      this.canvas.classList.remove("is-dragging-node");
    }
    this.clearTarget();
    this.candidate = null;
    this.panCandidate = null;
    this.ghost?.remove();
    this.ghost = null;
    this.canvas.classList.remove("is-panning");
    this.source = null;
    this.unbindWindow();
  }

  /** Removes the canvas listener. */
  destroy(): void {
    this.cancel();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
  }

  /** Starts a potential drag from a node. */
  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".simple-mind-inline-editor, button, a")) return;

    const element = target.closest<HTMLElement>(".simple-mind-node");
    const nodeId = element?.dataset.nodeId;
    if (!element || !nodeId) return;

    if (this.callbacks.isRoot(nodeId)) {
      event.preventDefault();
      this.panCandidate = {
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        pointerId: event.pointerId,
      };
      this.bindWindow();
      return;
    }

    if (!this.callbacks.isDraggable(nodeId)) return;

    this.candidate = {
      nodeId,
      element,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    };
    this.bindWindow();
  }

  /** Starts the drag after the movement threshold or updates the drop target. */
  private handlePointerMove(event: PointerEvent): void {
    if (this.panCandidate) {
      const moved =
        Math.hypot(
          event.clientX - this.panCandidate.startX,
          event.clientY - this.panCandidate.startY,
        ) >= DRAG_THRESHOLD;
      if (!moved) return;
      event.preventDefault();
      this.callbacks.panBy(
        event.clientX - this.panCandidate.lastX,
        event.clientY - this.panCandidate.lastY,
      );
      this.panCandidate.lastX = event.clientX;
      this.panCandidate.lastY = event.clientY;
      this.canvas.classList.add("is-panning");
      return;
    }

    if (this.candidate) {
      const dx = event.clientX - this.candidate.startX;
      const dy = event.clientY - this.candidate.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      this.source = {
        nodeId: this.candidate.nodeId,
        element: this.candidate.element,
      };
      this.candidate = null;
      this.source.element.classList.add("is-dragging");
      this.canvas.classList.add("is-dragging-node");
      this.canvas.focus();
      this.createGhost(event);
    }

    if (!this.source) return;
    event.preventDefault();
    this.moveGhost(event.clientX, event.clientY);
    this.updateTarget(event.clientX, event.clientY);
  }

  /** Completes a drag and requests the move. */
  private handlePointerUp(event: PointerEvent): void {
    if (this.panCandidate) {
      this.suppressNextClick();
      this.cancel();
      event.preventDefault();
      return;
    }

    const wasDragging = !!this.source;
    const source = this.source;
    const target = this.target;

    if (source && target && this.callbacks.canDrop(source.nodeId, target.nodeId)) {
      this.callbacks.drop(source.nodeId, target.nodeId, target.position);
    }

    if (wasDragging) this.suppressNextClick();
    this.cancel();
    if (wasDragging) event.preventDefault();
  }

  /** Keeps the click that follows a drag from opening a link or image. */
  private suppressNextClick(): void {
    const suppress = (event: Event): void => event.stopImmediatePropagation();
    this.canvas.addEventListener("click", suppress, true);
    this.canvas.ownerDocument.defaultView?.setTimeout(() => {
      this.canvas.removeEventListener("click", suppress, true);
    }, 0);
  }

  /** Creates a floating copy of the node that follows the pointer. */
  private createGhost(event: PointerEvent): void {
    if (!this.source) return;
    const element = this.source.element;
    const rect = element.getBoundingClientRect();
    const ghost = element.cloneNode(true) as HTMLElement;
    for (const control of ghost.querySelectorAll(".simple-mind-add, .simple-mind-collapse")) {
      control.remove();
    }
    ghost.classList.remove("is-selected", "is-dragging", "is-editing");
    ghost.classList.add("simple-mind-drag-ghost");
    ghost.removeAttribute("id");
    ghost.removeAttribute("aria-labelledby");
    ghost.setAttribute("aria-hidden", "true");
    for (const node of ghost.querySelectorAll("[id]")) {
      node.removeAttribute("id");
    }
    ghost.setCssStyles({
      position: "fixed",
      margin: "0",
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      transform: "none",
      pointerEvents: "none",
    });
    this.ghostOffsetX = event.clientX - rect.left;
    this.ghostOffsetY = event.clientY - rect.top;
    this.canvas.ownerDocument.body.appendChild(ghost);
    this.ghost = ghost;
    this.moveGhost(event.clientX, event.clientY);
  }

  /** Places the drag ghost under the pointer. */
  private moveGhost(clientX: number, clientY: number): void {
    if (!this.ghost) return;
    this.ghost.setCssStyles({
      left: `${clientX - this.ghostOffsetX}px`,
      top: `${clientY - this.ghostOffsetY}px`,
    });
  }

  /** Finds the node under the pointer and updates the indicator. */
  private updateTarget(clientX: number, clientY: number): void {
    if (!this.source) return;
    const elements = this.canvas.ownerDocument.elementsFromPoint(clientX, clientY);
    const element = elements
      .map((item) => item as HTMLElement)
      .map((item) => item.closest<HTMLElement>(".simple-mind-node"))
      .find((node) => {
        const id = node?.dataset.nodeId;
        return !!node && !!id && id !== this.source?.nodeId;
      });

    const nodeId = element?.dataset.nodeId;
    if (!element || !nodeId || !this.callbacks.canDrop(this.source.nodeId, nodeId)) {
      this.clearTarget();
      return;
    }

    let position = this.callbacks.isRoot(nodeId)
      ? "child"
      : resolveDropPosition(clientY, element.getBoundingClientRect());
    if (position !== "child" && this.callbacks.isRoot(nodeId)) {
      position = "child";
    }

    const changed = this.target?.nodeId !== nodeId || this.target.position !== position;
    if (changed) {
      this.clearTarget();
      this.target = { nodeId, element, position };
      this.scheduleExpand();
    }

    this.applyIndicator();
  }

  /** Applies the current drop indicator classes. */
  private applyIndicator(): void {
    if (!this.target) return;
    const { element, position } = this.target;
    element.classList.add("is-drop-target");
    element.classList.toggle("is-drop-before", position === "before");
    element.classList.toggle("is-drop-after", position === "after");
    if (this.source) this.source.element.classList.add("is-dragging");
  }

  /** Schedules expansion when hovering a collapsed child target. */
  private scheduleExpand(): void {
    this.clearExpandTimer();
    if (!this.target || this.target.position !== "child") {
      this.hoverTargetId = null;
      return;
    }

    const targetId = this.target.nodeId;
    if (!this.callbacks.isCollapsed(targetId) || this.hoverTargetId === targetId) {
      this.hoverTargetId = targetId;
      return;
    }

    this.hoverTargetId = targetId;
    const win = this.canvas.ownerDocument.defaultView;
    if (!win) return;
    this.expandTimer = win.setTimeout(() => {
      this.expandTimer = null;
      this.callbacks.expand(targetId);
      this.applyIndicator();
    }, EXPAND_DELAY);
  }

  /** Removes the drop indicator and expansion timer. */
  private clearTarget(): void {
    this.clearExpandTimer();
    if (this.target) {
      this.target.element.classList.remove("is-drop-target", "is-drop-before", "is-drop-after");
    }
    this.target = null;
    this.hoverTargetId = null;
  }

  /** Clears the expansion timer. */
  private clearExpandTimer(): void {
    if (this.expandTimer === null) return;
    this.canvas.ownerDocument.defaultView?.clearTimeout(this.expandTimer);
    this.expandTimer = null;
  }

  /** Adds temporary window listeners for drag movement. */
  private bindWindow(): void {
    if (this.windowBound) return;
    const win = this.canvas.ownerDocument.defaultView;
    if (!win) return;
    win.addEventListener("pointermove", this.onPointerMove, true);
    win.addEventListener("pointerup", this.onPointerUp, true);
    win.addEventListener("pointercancel", this.onPointerCancel, true);
    this.windowBound = true;
  }

  /** Removes temporary window listeners. */
  private unbindWindow(): void {
    if (!this.windowBound) return;
    const win = this.canvas.ownerDocument.defaultView;
    if (!win) return;
    win.removeEventListener("pointermove", this.onPointerMove, true);
    win.removeEventListener("pointerup", this.onPointerUp, true);
    win.removeEventListener("pointercancel", this.onPointerCancel, true);
    this.windowBound = false;
  }
}
