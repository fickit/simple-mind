import { Notice, TextFileView, type WorkspaceLeaf } from "obsidian";
import { MapCanvas } from "../components/map/MapCanvas";
import { switchToSource } from "../components/source/SourceSwitch";
import { VIEW_TYPE_MAP } from "../config/constants";

/** Obsidian view that renders a `.mindmap` file as an interactive canvas. */
export class MindMapView extends TextFileView {
  private canvas: MapCanvas | null = null;

  /**
   * @param leaf Workspace leaf that owns this view.
   */
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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
    });
    if (this.data) {
      this.canvas.setSource(this.data);
    }
    this.registerEvent(this.app.workspace.on("css-change", () => this.canvas?.refreshTheme()));
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

  /** Switches the same leaf to Obsidian's native Markdown editor. */
  private async openSource(): Promise<void> {
    const file = this.file;
    if (!file) return;
    await switchToSource(this.leaf, file);
  }
}
