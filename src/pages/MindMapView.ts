import { TextFileView, type TFile, type WorkspaceLeaf } from "obsidian";
import { switchToSource } from "../components/source/SourceSwitch";
import { VIEW_TYPE_MAP } from "../config/constants";

/**
 * Temporary feasibility view for the native editor spike.
 *
 * It loads and saves the `.mindmap` file through Obsidian's TextFileView and
 * renders the raw source, so the Map/Source round trip can be tested before the
 * real canvas lands.
 */
export class MindMapView extends TextFileView {
  // Do not name these `titleEl`: ItemView already owns that field for the tab header.
  private headerTitleEl: HTMLElement | null = null;
  private rawPreviewEl: HTMLElement | null = null;

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

  /** Builds the temporary source preview and Source action. */
  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("simple-mind-view");

    const header = this.contentEl.createDiv({ cls: "simple-mind-spike-header" });
    this.headerTitleEl = header.createEl("h2", { cls: "simple-mind-spike-title" });
    const sourceButton = header.createEl("button", {
      cls: "simple-mind-spike-source-button",
      text: "Source",
    });
    sourceButton.setAttribute("type", "button");
    sourceButton.addEventListener("click", () => {
      void this.openSource();
    });

    this.rawPreviewEl = this.contentEl.createEl("pre", {
      cls: "simple-mind-spike-source",
    });
    this.updateHeader();
    this.updatePreview();
  }

  /** Clears view references when the leaf closes. */
  async onClose(): Promise<void> {
    this.headerTitleEl = null;
    this.rawPreviewEl = null;
    this.contentEl.empty();
  }

  /**
   * Stores file content and refreshes the temporary preview.
   *
   * @param data Current file content.
   * @param clear Whether a different file is being loaded.
   */
  setViewData(data: string, clear: boolean): void {
    this.data = data;
    if (clear) this.contentEl.scrollTop = 0;
    this.updateHeader();
    this.updatePreview();
  }

  /** Returns the file content for saving. */
  getViewData(): string {
    return this.data;
  }

  /** Resets view data when the file is cleared. */
  clear(): void {
    this.data = "";
    this.updatePreview();
  }

  /**
   * Refreshes the header after Obsidian binds a file to the view.
   *
   * @param file File being loaded.
   */
  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.updateHeader();
    this.updatePreview();
  }

  /** Updates the displayed file name. */
  private updateHeader(): void {
    this.headerTitleEl?.setText(this.file?.basename ?? "Mind map");
  }

  /** Shows the current raw source in the temporary preview. */
  private updatePreview(): void {
    this.rawPreviewEl?.setText(this.data ?? "");
  }

  /** Switches the same leaf to Obsidian's native Markdown editor. */
  private async openSource(): Promise<void> {
    const file = this.file;
    if (!file) return;
    await switchToSource(this.leaf, file);
  }
}
