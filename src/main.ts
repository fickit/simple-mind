import { Notice, Plugin, type TFile } from "obsidian";
import { loadSettings } from "./api/obsidian/settings";
import { isSourceMode } from "./components/source/SourceModeGuard";
import { switchToMap, switchToSource } from "./components/source/SourceSwitch";
import { FILE_EXTENSION, VIEW_TYPE_MAP } from "./config/constants";
import { DEFAULT_SETTINGS } from "./config/defaults";
import { MindMapView } from "./pages/MindMapView";
import type { SimpleMindSettings } from "./types/settings";

/** Main Obsidian plugin entry point. */
export default class SimpleMindPlugin extends Plugin {
  /** Current plugin settings. */
  settings: SimpleMindSettings = DEFAULT_SETTINGS;

  private statusBarEl: HTMLElement | null = null;

  /** Registers the map view, commands, and file-open fallbacks. */
  async onload(): Promise<void> {
    this.settings = await loadSettings(this);

    this.registerView(VIEW_TYPE_MAP, (leaf) => new MindMapView(leaf));
    this.registerCommands();
    this.registerStatusBar();
    this.registerRibbon();
    this.registerFileHandlers();
    this.registerFileExtension();
    this.updateStatusBar();
  }

  /** Closes plugin views when the plugin is disabled. */
  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_MAP);
  }

  /** Registers the map/source toggle command. */
  private registerCommands(): void {
    this.addCommand({
      id: "toggle-map-source",
      name: "Toggle mind map and source",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== FILE_EXTENSION) return false;
        if (!checking) void this.toggleActiveLeaf();
        return true;
      },
    });
  }

  /** Registers the clickable status bar action for source-mode files. */
  private registerStatusBar(): void {
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("mod-clickable");
    this.statusBarEl.setText("Simple Mind: open map");
    this.statusBarEl.addEventListener("click", () => {
      void this.toggleActiveLeaf(true);
    });
  }

  /** Registers a visible ribbon action as a manual fallback. */
  private registerRibbon(): void {
    this.addRibbonIcon("network", "Open as mind map", () => {
      void this.toggleActiveLeaf(true);
    });
  }

  /** Re-opens `.mindmap` files in the map view when Obsidian uses Markdown. */
  private registerFileHandlers(): void {
    this.registerEvent(this.app.workspace.on("file-open", (file) => this.scheduleMapOpen(file)));
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () =>
        this.scheduleMapOpen(this.app.workspace.getActiveFile()),
      ),
    );
  }

  /**
   * Maps `.mindmap` to the custom view without breaking plugin load when the
   * extension is already claimed.
   */
  private registerFileExtension(): void {
    try {
      this.registerExtensions([FILE_EXTENSION], VIEW_TYPE_MAP);
    } catch (error) {
      console.warn(
        `Simple Mind: .${FILE_EXTENSION} is already registered. The map view opens through the ribbon, command, or file-open fallback.`,
        error,
      );
    }
  }

  /**
   * Defers the view check until Obsidian finishes opening the file.
   *
   * @param file File reported by the workspace event.
   */
  private scheduleMapOpen(file: TFile | null): void {
    if (!file || file.extension !== FILE_EXTENSION) {
      this.updateStatusBar();
      return;
    }

    window.setTimeout(() => {
      void this.openMapIfNeeded(file);
    }, 0);
  }

  /**
   * Switches a Markdown view to the map view unless source mode was requested.
   *
   * @param file File that was opened.
   */
  private async openMapIfNeeded(file: TFile): Promise<void> {
    const leaf = this.app.workspace.activeLeaf;
    const activeFile = this.app.workspace.getActiveFile();
    if (!leaf || !activeFile || activeFile.path !== file.path) return;
    if (leaf.view.getViewType() !== "markdown") {
      this.updateStatusBar();
      return;
    }
    if (isSourceMode(leaf, activeFile.path)) {
      this.updateStatusBar();
      return;
    }

    await switchToMap(leaf, activeFile);
    this.updateStatusBar();
  }

  /**
   * Toggles the active leaf between the map view and the native editor.
   *
   * @param showNotice Whether to explain why nothing happened when no map file is active.
   */
  private async toggleActiveLeaf(showNotice = false): Promise<void> {
    const leaf = this.app.workspace.activeLeaf;
    const file = this.app.workspace.getActiveFile();
    if (!leaf || !file || file.extension !== FILE_EXTENSION) {
      if (showNotice) new Notice("Open a .mindmap file first.");
      return;
    }

    const viewType = leaf.view.getViewType();
    if (viewType === VIEW_TYPE_MAP) {
      await switchToSource(leaf, file);
    } else if (viewType === "markdown") {
      await switchToMap(leaf, file);
    } else if (showNotice) {
      new Notice("This file is not open in a supported view.");
    }
    this.updateStatusBar();
  }

  /** Shows the status bar action only for `.mindmap` files in source mode. */
  private updateStatusBar(): void {
    if (!this.statusBarEl) return;

    const leaf = this.app.workspace.activeLeaf;
    const file = this.app.workspace.getActiveFile();
    const visible =
      !!file && file.extension === FILE_EXTENSION && leaf?.view.getViewType() === "markdown";
    this.statusBarEl.style.display = visible ? "" : "none";
  }
}
