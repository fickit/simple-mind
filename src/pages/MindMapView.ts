import { Notice, TextFileView, type WorkspaceLeaf } from "obsidian";
import { MapCanvas } from "../components/map/MapCanvas";
import { switchToSource } from "../components/source/SourceSwitch";
import { VIEW_TYPE_MAP } from "../config/constants";
import { DEFAULT_SETTINGS } from "../config/defaults";
import type { SimpleMindSettings } from "../types/settings";

/** Obsidian view that renders a `.mindmap` file as an interactive canvas. */
export class MindMapView extends TextFileView {
  private canvas: MapCanvas | null = null;
  private readonly getSettings: () => SimpleMindSettings;

  /**
   * @param leaf Workspace leaf that owns this view.
   * @param getSettings Reads the current plugin settings.
   */
  constructor(leaf: WorkspaceLeaf, getSettings: () => SimpleMindSettings = () => DEFAULT_SETTINGS) {
    super(leaf);
    this.getSettings = getSettings;
  }

  /** Returns the custom view type. */
  getViewType(): string {
    return VIEW_TYPE_MAP;
  }

  /** Returns the tab title. */
  getDisplayText(): string {
    return this.file?.basename ?? "Mind map";
  }

  /** Returns the tab icon. */
  getIcon(): string {
    return "network";
  }

  /** Builds the map canvas and theme-change listener. */
  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("simple-mind-view");
    this.canvas = new MapCanvas(this.contentEl, {
      onSource: () => {
        void this.openSource();
      },
      onChange: (source) => {
        this.data = source;
        this.requestSave();
      },
      onNotice: (message) => {
        new Notice(`Simple Mind: ${message}`);
      },
      settings: this.getSettings(),
    });
    if (this.data) {
      this.canvas.setSource(this.data);
    }
    this.registerEvent(this.app.workspace.on("css-change", () => this.canvas?.refreshTheme()));

    let frame: number | null = null;
    const body = this.contentEl.ownerDocument.body;
    let lastDark = body.classList.contains("theme-dark");
    const observer = new MutationObserver(() => {
      const dark = body.classList.contains("theme-dark");
      if (dark === lastDark) return;
      lastDark = dark;
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        this.canvas?.refreshTheme();
      });
    });
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    this.register(() => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    });
  }

  /** Releases the renderer and DOM. */
  async onClose(): Promise<void> {
    this.canvas?.destroy();
    this.canvas = null;
    this.contentEl.empty();
  }

  /**
   * Loads file content into the canvas.
   *
   * @param data Current file content.
   * @param clear Whether a different file is being loaded.
   */
  setViewData(data: string, clear: boolean): void {
    this.data = data;
    if (clear) this.contentEl.scrollTop = 0;
    if (!clear && data === this.canvas?.getSource()) return;
    this.canvas?.setSource(data);
  }

  /** Returns the source text to save. */
  getViewData(): string {
    return this.canvas?.getSource() ?? this.data ?? "";
  }

  /** Resets the view for an empty file. */
  clear(): void {
    this.data = "";
    this.canvas?.setSource("");
  }

  /** Reapplies plugin defaults and custom themes. */
  refreshSettings(): void {
    this.canvas?.updateSettings(this.getSettings());
  }

  /** Adds a child to the selected node. */
  addChildNode(): void {
    this.canvas?.addChild();
  }

  /** Adds a sibling after the selected node. */
  addSibling(): void {
    this.canvas?.addSibling();
  }

  /** Deletes the selected node. */
  deleteSelected(): void {
    this.canvas?.deleteSelected();
  }

  /** Edits the selected node. */
  editSelected(): void {
    this.canvas?.editSelected();
  }

  /** Undoes the last map command. */
  undo(): void {
    this.canvas?.undo();
  }

  /** Redoes the last undone map command. */
  redo(): void {
    this.canvas?.redo();
  }

  /** Fits the map into the view. */
  fit(): void {
    this.canvas?.fit();
  }

  /** Returns true when editing commands are available. */
  canEdit(): boolean {
    return this.canvas?.canEdit() ?? false;
  }

  /** Returns true when the selected node can be deleted. */
  canDeleteSelected(): boolean {
    return this.canvas?.canDeleteSelected() ?? false;
  }

  /** Returns true when undo is available. */
  canUndo(): boolean {
    return this.canvas?.canUndo() ?? false;
  }

  /** Returns true when redo is available. */
  canRedo(): boolean {
    return this.canvas?.canRedo() ?? false;
  }

  /** Returns the selected node id. */
  getSelectedId(): string | null {
    return this.canvas?.getSelectedId() ?? null;
  }

  /** Switches the same leaf to Obsidian's native Markdown editor. */
  private async openSource(): Promise<void> {
    const file = this.file;
    if (!file) return;
    await switchToSource(this.leaf, file);
  }
}
