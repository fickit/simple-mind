import { NEW_NODE_EDITOR_WIDTH } from "../../config/constants";
import type { MindNode } from "../../types/mindmap";
import { DragController, type DropPosition } from "./engine/interaction/DragController";
import { type CommitAction, InlineEditor } from "./engine/interaction/InlineEditor";
import {
  type AddKind,
  type CopiedNode,
  MapController,
  type PendingAdd,
} from "./engine/interaction/MapController";
import type { PositionedNode } from "./engine/layout/types";
import { parseSource } from "./engine/parser/parser";
import { MapRenderer } from "./engine/render/MapRenderer";
import { applyTheme } from "./themes/applyTheme";
import { OBSIDIAN_THEME } from "./themes/presets";

/** Callbacks supplied by the host view. */
export interface MapCanvasOptions {
  onSource: () => void;
  onChange?: (source: string) => void;
  onNotice?: (message: string) => void;
}

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** Canvas component that owns the renderer, controller, toolbar, and editing. */
export class MapCanvas {
  private readonly rootEl: HTMLElement;
  private readonly canvasEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly renderer: MapRenderer;
  private readonly editor: InlineEditor;
  private readonly drag: DragController;
  private readonly theme = OBSIDIAN_THEME;
  private readonly onSource: () => void;
  private readonly onChangeSource: (source: string) => void;
  private readonly onNotice: (message: string) => void;
  private readonly childButton: HTMLButtonElement;
  private readonly siblingButton: HTMLButtonElement;
  private readonly deleteButton: HTMLButtonElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private readonly keydownHandler: (event: KeyboardEvent) => void;
  private controller: MapController | null = null;
  private pendingAdd: PendingAdd | null = null;
  private selectedId: string | null = null;
  private clipboard: CopiedNode[] = [];
  private sourceText = "";
  private readOnly = false;
  private dark = false;
  private pendingEditorLayout: {
    nodeId: string;
    rect: { x: number; y: number; width: number; height: number };
  } | null = null;
  private editorLayoutFrame: number | null = null;

  /**
   * @param container Element that receives the map UI.
   * @param options Host callbacks.
   */
  constructor(container: HTMLElement, options: MapCanvasOptions) {
    const doc = container.ownerDocument;
    this.onSource = options.onSource;
    this.onChangeSource = options.onChange ?? (() => {});
    this.onNotice = options.onNotice ?? (() => {});
    this.dark = isDarkDocument(doc);

    this.rootEl = doc.createElement("div");
    this.rootEl.className = "simple-mind-map";
    container.replaceChildren(this.rootEl);

    const toolbar = doc.createElement("div");
    toolbar.className = "simple-mind-toolbar";
    this.rootEl.appendChild(toolbar);

    this.bannerEl = doc.createElement("div");
    this.bannerEl.className = "simple-mind-banner";
    this.bannerEl.hidden = true;
    this.bannerEl.setAttribute("role", "alert");
    this.rootEl.appendChild(this.bannerEl);

    this.canvasEl = doc.createElement("div");
    this.canvasEl.className = "simple-mind-canvas-host";
    this.rootEl.appendChild(this.canvasEl);

    applyTheme(this.rootEl, this.theme, this.dark);
    this.renderer = new MapRenderer(this.canvasEl, this.theme, this.dark, {
      onToggleCollapse: (nodeId) => this.toggleCollapse(nodeId),
      onEditRequest: (nodeId) => this.startEdit(nodeId),
      onSelectionChange: (nodeId) => {
        this.selectedId = nodeId;
        this.updateToolbar();
      },
    });
    this.editor = new InlineEditor(this.renderer.getWorldElement());
    this.drag = new DragController(this.canvasEl, {
      isDraggable: (nodeId) => this.canEdit() && this.controller?.isRoot(nodeId) === false,
      canDrop: (sourceId, targetId) => this.controller?.canMove(sourceId, targetId) ?? false,
      isRoot: (nodeId) => this.controller?.isRoot(nodeId) ?? true,
      isCollapsed: (nodeId) => this.controller?.findNode(nodeId)?.collapsed ?? false,
      expand: (nodeId) => this.expandNode(nodeId),
      drop: (sourceId, targetId, position) => this.dropNode(sourceId, targetId, position),
    });

    this.createToolbarButton(toolbar, "Fit", () => this.renderer.fit());
    this.createToolbarButton(toolbar, "−", () => this.renderer.zoomBy(0.8));
    this.createToolbarButton(toolbar, "+", () => this.renderer.zoomBy(1.2));
    this.createToolbarDivider(toolbar);
    this.childButton = this.createToolbarButton(toolbar, "+ Child", () => this.addChild());
    this.siblingButton = this.createToolbarButton(toolbar, "+ Sibling", () => this.addSibling());
    this.deleteButton = this.createToolbarButton(toolbar, "Delete", () => this.deleteSelected());
    this.createToolbarDivider(toolbar);
    this.undoButton = this.createToolbarButton(toolbar, "Undo", () => this.undo());
    this.redoButton = this.createToolbarButton(toolbar, "Redo", () => this.redo());
    const spacer = doc.createElement("span");
    spacer.className = "simple-mind-toolbar-spacer";
    toolbar.appendChild(spacer);
    this.createToolbarButton(toolbar, "Source", this.onSource);

    this.keydownHandler = (event) => this.handleKeydown(event);
    this.canvasEl.addEventListener("keydown", this.keydownHandler);
    this.updateToolbar();
  }

  /**
   * Parses and renders source text.
   *
   * @param source `.mindmap` file content.
   */
  setSource(source: string): void {
    this.cancelEditorLayout();
    this.drag.cancel();
    this.editor.close();
    this.renderer.setEditingNode(null);
    this.pendingAdd = null;
    this.selectedId = null;
    this.sourceText = source;

    const result = parseSource(source);
    this.readOnly = result.errors.length > 0;

    if (result.errors.length > 0) {
      const first = result.errors[0];
      const more = result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : "";
      this.showBanner(`Source error at line ${first.line}: ${first.message}${more}`);
    } else {
      this.hideBanner();
    }

    if (result.warnings.length > 0) {
      console.warn(
        "Simple Mind frontmatter warnings:",
        result.warnings.map((warning) => `line ${warning.line}: ${warning.message}`),
      );
    }

    if (result.document) {
      this.controller = new MapController(result.document, source, (next) => {
        this.sourceText = next;
        this.onChangeSource(next);
      });
      this.renderer.render(result.document, { fit: true });
      this.renderer.selectNode(null);
    } else {
      this.controller = null;
      this.renderer.clear();
    }
    this.updateToolbar();
  }

  /** Returns the current source text. */
  getSource(): string {
    return this.controller?.getSource() ?? this.sourceText;
  }

  /** Returns the selected node id. */
  getSelectedId(): string | null {
    return this.selectedId;
  }

  /** Reapplies the theme after Obsidian changes its light/dark mode. */
  refreshTheme(): void {
    this.dark = isDarkDocument(this.rootEl.ownerDocument);
    applyTheme(this.rootEl, this.theme, this.dark);
    this.renderer.setTheme(this.theme, this.dark);
    this.updateToolbar();
  }

  /** Removes the renderer and map DOM. */
  destroy(): void {
    this.cancelEditorLayout();
    this.drag.destroy();
    this.editor.close();
    this.renderer.setEditingNode(null);
    this.canvasEl.removeEventListener("keydown", this.keydownHandler);
    this.renderer.destroy();
    this.rootEl.remove();
  }

  /** Adds a child to the selected node. */
  addChild(): void {
    this.beginAdd("child");
  }

  /** Adds a sibling after the selected node. */
  addSibling(): void {
    this.beginAdd("sibling");
  }

  /** Deletes the selected node. */
  deleteSelected(): void {
    if (!this.canEdit() || !this.controller || !this.selectedId) return;
    if (this.controller.isRoot(this.selectedId)) {
      this.onNotice("The root node cannot be deleted.");
      return;
    }

    const parentId = this.controller.findParent(this.selectedId)?.parent.id ?? null;
    this.controller.deleteNode(this.selectedId);
    this.rerender(false);
    this.renderer.selectNode(parentId);
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Edits the selected node. */
  editSelected(): void {
    if (this.selectedId) this.startEdit(this.selectedId);
  }

  /** Copies the selected subtree into the internal and system clipboards. */
  private copySelected(): void {
    if (!this.controller || !this.selectedId) return;
    const copied = this.controller.copySubtree(this.selectedId);
    if (!copied) return;

    this.clipboard = [copied];
    const text = this.serializeCopiedText(copied);
    const clipboard = this.rootEl.ownerDocument.defaultView?.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      void clipboard.writeText(text).catch(() => {});
    }
  }

  /** Cuts the selected subtree. The root is protected. */
  private cutSelected(): void {
    if (!this.controller || !this.selectedId) return;
    if (this.controller.isRoot(this.selectedId)) {
      this.onNotice("The root node cannot be cut.");
      return;
    }
    this.copySelected();
    this.deleteSelected();
  }

  /**
   * Pastes the internal subtree, or parses system clipboard text as an outline.
   */
  private async pasteSelected(): Promise<void> {
    const controller = this.controller;
    if (!controller || this.editor.isOpen() || this.readOnly) return;

    const parentId = this.selectedId ?? controller.getDocument().root.id;
    let subtrees = this.clipboard;
    if (subtrees.length === 0) {
      subtrees = await this.readSystemClipboard();
    }
    if (subtrees.length === 0) {
      this.onNotice("The clipboard is empty or unavailable.");
      return;
    }

    const ids = controller.pasteSubtree(parentId, subtrees);
    if (ids.length === 0) return;

    this.rerender(false);
    this.renderer.selectNode(ids[0]);
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Reads and parses text from the system clipboard. */
  private async readSystemClipboard(): Promise<CopiedNode[]> {
    const clipboard = this.rootEl.ownerDocument.defaultView?.navigator.clipboard;
    if (!clipboard) return [];
    try {
      return this.parseClipboardText(await clipboard.readText());
    } catch {
      return [];
    }
  }

  /**
   * Parses clipboard text as a full outline, an indented list, or a single label.
   *
   * @param text Clipboard text.
   */
  private parseClipboardText(text: string): CopiedNode[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const full = parseSource(trimmed);
    if (full.document && full.errors.length === 0) {
      return [this.copyNodeData(full.document.root)];
    }

    const list = parseSource(`# Pasted\n${trimmed}`);
    if (list.document && list.errors.length === 0 && list.document.root.children.length > 0) {
      return list.document.root.children.map((child) => this.copyNodeData(child));
    }

    return [{ text: trimmed.replace(/\s*\n\s*/g, " "), children: [] }];
  }

  /** Converts a live node into clipboard data. */
  private copyNodeData(node: MindNode): CopiedNode {
    return {
      text: node.text,
      children: node.children.map((child) => this.copyNodeData(child)),
    };
  }

  /** Serializes clipboard data as a nested bullet list. */
  private serializeCopiedText(node: CopiedNode): string {
    const lines: string[] = [];
    const walk = (item: CopiedNode, depth: number): void => {
      lines.push(`${" ".repeat(depth * 2)}- ${item.text}`);
      for (const child of item.children) walk(child, depth + 1);
    };
    walk(node, 0);
    return lines.join("\n");
  }

  /** Undoes the last map command. */
  undo(): void {
    if (!this.canEdit() || !this.controller) return;
    if (!this.controller.undo()) return;
    this.pendingAdd = null;
    this.rerender(false);
    this.renderer.selectNode(null);
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Redoes the last undone map command. */
  redo(): void {
    if (!this.canEdit() || !this.controller) return;
    if (!this.controller.redo()) return;
    this.pendingAdd = null;
    this.rerender(false);
    this.renderer.selectNode(null);
    this.renderer.focus();
    this.updateToolbar();
  }

  /**
   * Creates a toolbar button.
   *
   * @param toolbar Toolbar element.
   * @param label Visible label.
   * @param action Click action.
   */
  private createToolbarButton(
    toolbar: HTMLElement,
    label: string,
    action: () => void,
  ): HTMLButtonElement {
    const button = toolbar.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "simple-mind-toolbar-button";
    button.textContent = label;
    button.addEventListener("click", action);
    toolbar.appendChild(button);
    return button;
  }

  /** Adds a visual separator to the toolbar. */
  private createToolbarDivider(toolbar: HTMLElement): void {
    const divider = toolbar.ownerDocument.createElement("span");
    divider.className = "simple-mind-toolbar-divider";
    toolbar.appendChild(divider);
  }

  /** Starts a pending insertion and opens the inline editor. */
  private beginAdd(kind: AddKind): void {
    if (!this.canEdit() || !this.controller || !this.selectedId) return;
    if (this.editor.isOpen()) return;

    const pending = this.controller.beginAdd(kind, this.selectedId);
    if (!pending) return;
    this.pendingAdd = pending;
    this.rerender(false);
    this.renderer.selectNode(pending.node.id);
    this.openEditor(pending.node.id, "", true);
  }

  /** Opens the inline editor for an existing node. */
  private startEdit(nodeId: string): void {
    if (this.readOnly || !this.controller) {
      this.onNotice("Fix the source errors before editing.");
      return;
    }
    if (this.editor.isOpen()) this.editor.commit();

    const node = this.controller.findNode(nodeId);
    if (!node) return;
    this.openEditor(nodeId, node.text, false);
  }

  /** Positions the input over a node and wires commit/cancel. */
  private openEditor(nodeId: string, text: string, isNew: boolean): void {
    this.drag.cancel();
    this.renderer.selectNode(nodeId);
    this.renderer.setEditingNode(nodeId);
    const position = this.renderer.getNodePosition(nodeId);
    if (!position) {
      this.renderer.setEditingNode(null);
      return;
    }

    const meta = this.controller?.getDocument().meta;
    this.editor.open(
      position,
      text,
      {
        onCommit: (value, action) => this.commitEdit(nodeId, value, isNew, action),
        onCancel: () => this.cancelEdit(nodeId, isNew),
      },
      {
        maxWidth: meta?.maxWidth ?? 280,
        initialWidth: isNew ? NEW_NODE_EDITOR_WIDTH : undefined,
        nodeElement: this.renderer.getNodeElement(nodeId),
        onResize: (rect) => this.scheduleEditorLayout(nodeId, rect),
      },
    );
    this.updateToolbar();
  }

  /** Schedules a live reflow with the latest editor rectangle. */
  private scheduleEditorLayout(
    nodeId: string,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    this.pendingEditorLayout = { nodeId, rect };
    if (this.editorLayoutFrame !== null) return;

    const win = this.rootEl.ownerDocument.defaultView;
    if (!win || typeof win.requestAnimationFrame !== "function") {
      this.flushEditorLayout();
      return;
    }
    this.editorLayoutFrame = win.requestAnimationFrame(() => {
      this.editorLayoutFrame = null;
      this.flushEditorLayout();
    });
  }

  /** Applies the pending editor size and moves the input to the new node position. */
  private flushEditorLayout(): void {
    const pending = this.pendingEditorLayout;
    this.pendingEditorLayout = null;
    if (!pending || !this.editor.isOpen()) return;

    this.renderer.setEditingRect(pending.nodeId, pending.rect);
    const position = this.renderer.getNodePosition(pending.nodeId);
    if (position) this.editor.reposition(position.x, position.y);
  }

  /** Cancels a pending live reflow. */
  private cancelEditorLayout(): void {
    if (this.editorLayoutFrame !== null) {
      this.rootEl.ownerDocument.defaultView?.cancelAnimationFrame(this.editorLayoutFrame);
      this.editorLayoutFrame = null;
    }
    this.pendingEditorLayout = null;
  }

  /** Commits an inline edit into the controller. */
  private commitEdit(nodeId: string, value: string, isNew: boolean, action: CommitAction): void {
    this.cancelEditorLayout();
    const controller = this.controller;
    if (!controller) {
      this.renderer.setEditingNode(null);
      return;
    }

    if (isNew && this.pendingAdd?.node.id === nodeId) {
      if (value.trim() === "") {
        controller.cancelAdd(nodeId);
        this.pendingAdd = null;
        this.renderer.setEditingNode(null);
        this.rerender(false);
        this.renderer.selectNode(null);
        this.renderer.focus();
        this.updateToolbar();
        return;
      }

      controller.commitAdd(nodeId, value, this.pendingAdd.previousSource);
      this.pendingAdd = null;
      this.renderer.setEditingNode(null);
      this.rerender(false);
      this.renderer.selectNode(nodeId);
      this.updateToolbar();
      this.afterCommit(action);
      return;
    }

    if (value.trim() === "") {
      this.onNotice("A node label cannot be empty.");
      this.renderer.setEditingNode(null);
      this.rerender(false);
      this.renderer.selectNode(nodeId);
      this.renderer.focus();
      return;
    }

    controller.rename(nodeId, value);
    this.renderer.setEditingNode(null);
    this.rerender(false);
    this.renderer.selectNode(nodeId);
    this.updateToolbar();
    this.afterCommit(action);
  }

  /** Starts the next insertion requested by Enter or Tab, or focuses the canvas. */
  private afterCommit(action: CommitAction): void {
    if (action === "child") {
      this.addChild();
    } else if (action === "sibling") {
      this.addSibling();
    }
    if (!this.editor.isOpen()) this.renderer.focus();
  }

  /** Cancels an inline edit. */
  private cancelEdit(nodeId: string, isNew: boolean): void {
    this.cancelEditorLayout();
    const controller = this.controller;
    if (isNew && this.pendingAdd?.node.id === nodeId) {
      const parentId = this.pendingAdd.parentId;
      controller?.cancelAdd(nodeId);
      this.pendingAdd = null;
      this.renderer.setEditingNode(null);
      this.rerender(false);
      this.renderer.selectNode(parentId);
    } else {
      this.renderer.setEditingNode(null);
      this.renderer.selectNode(nodeId);
    }
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Toggles collapse for one node. */
  private toggleCollapse(nodeId: string): void {
    if (!this.controller || !this.controller.toggleCollapse(nodeId)) return;
    this.rerender(false);
    this.updateToolbar();
  }

  /** Expands a collapsed drop target without changing source. */
  private expandNode(nodeId: string): void {
    const controller = this.controller;
    const node = controller?.findNode(nodeId);
    if (!controller || !node || !node.collapsed || node.children.length === 0) return;
    controller.toggleCollapse(nodeId);
    this.rerender(false);
  }

  /** Applies a drag-and-drop move through the controller. */
  private dropNode(sourceId: string, targetId: string, position: DropPosition): void {
    const controller = this.controller;
    if (!controller || !controller.canMove(sourceId, targetId)) return;
    if (!controller.moveNode(sourceId, targetId, position)) return;

    this.rerender(false);
    this.renderer.selectNode(sourceId);
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Selects the parent of the selected node. */
  private selectParent(): void {
    if (!this.controller || !this.selectedId) return;
    const parentId = this.controller.findParent(this.selectedId)?.parent.id ?? null;
    this.renderer.selectNode(parentId);
    this.renderer.focus();
  }

  /** Moves the selection spatially. */
  private moveSelection(key: ArrowKey): void {
    const nodes = this.renderer.getLayoutNodes();
    if (nodes.length === 0) return;

    const currentId = this.renderer.getSelectedId();
    if (!currentId) {
      const root = nodes.find((node) => node.parentId === null) ?? nodes[0];
      this.renderer.selectNode(root.node.id);
      this.renderer.focus();
      return;
    }

    const current = this.renderer.getNodePosition(currentId);
    if (!current) return;
    const currentX = current.x + current.width / 2;
    const currentY = current.y + current.height / 2;
    let best: PositionedNode | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of nodes) {
      if (candidate.node.id === currentId) continue;
      const x = candidate.x + candidate.width / 2;
      const y = candidate.y + candidate.height / 2;
      const dx = x - currentX;
      const dy = y - currentY;
      const primary =
        key === "ArrowRight" ? dx : key === "ArrowLeft" ? -dx : key === "ArrowDown" ? dy : -dy;
      if (primary <= 4) continue;
      const secondary = key === "ArrowRight" || key === "ArrowLeft" ? Math.abs(dy) : Math.abs(dx);
      const score = primary + secondary * 2;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best) {
      this.renderer.selectNode(best.node.id);
      this.renderer.focus();
    }
  }

  /** Handles map keyboard shortcuts. */
  private handleKeydown(event: KeyboardEvent): void {
    if (this.editor.isOpen()) return;

    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      this.redo();
      return;
    }
    if (mod && event.key.toLowerCase() === "c") {
      event.preventDefault();
      this.copySelected();
      return;
    }
    if (mod && event.key.toLowerCase() === "x") {
      event.preventDefault();
      this.cutSelected();
      return;
    }
    if (mod && event.key.toLowerCase() === "v") {
      event.preventDefault();
      void this.pasteSelected();
      return;
    }
    if (mod) return;

    const editingKey =
      event.key === "Tab" ||
      event.key === "Enter" ||
      event.key === "F2" ||
      event.key === "Delete" ||
      event.key === "Backspace";
    if (this.readOnly && editingKey) {
      event.preventDefault();
      this.onNotice("Fix the source errors before editing.");
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) this.selectParent();
      else this.addChild();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.addSibling();
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      this.editSelected();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.deleteSelected();
      return;
    }
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    ) {
      event.preventDefault();
      this.moveSelection(event.key);
    }
  }

  /** Returns true when editing commands are allowed. */
  private canEdit(): boolean {
    return !this.readOnly && !!this.controller && !this.editor.isOpen();
  }

  /** Updates toolbar disabled states. */
  private updateToolbar(): void {
    const hasSelection = !!this.selectedId;
    const canEdit = this.canEdit();
    const selectedRoot = hasSelection && this.controller?.isRoot(this.selectedId ?? "") === true;

    this.childButton.disabled = !canEdit || !hasSelection;
    this.siblingButton.disabled = !canEdit || !hasSelection;
    this.deleteButton.disabled = !canEdit || !hasSelection || selectedRoot;
    this.undoButton.disabled = !canEdit || this.controller?.canUndo() !== true;
    this.redoButton.disabled = !canEdit || this.controller?.canRedo() !== true;
  }

  /** Re-renders the controller document. */
  private rerender(fit: boolean): void {
    const document = this.controller?.getDocument();
    if (document) this.renderer.render(document, { fit });
    else this.renderer.clear();
    this.updateToolbar();
  }

  /**
   * Shows the error banner.
   *
   * @param message Banner text.
   */
  private showBanner(message: string): void {
    this.bannerEl.textContent = message;
    this.bannerEl.hidden = false;
  }

  /** Hides the error banner. */
  private hideBanner(): void {
    this.bannerEl.textContent = "";
    this.bannerEl.hidden = true;
  }
}

/** Returns true when Obsidian's document is in dark mode. */
function isDarkDocument(doc: Document): boolean {
  return doc.body.classList.contains("theme-dark");
}
