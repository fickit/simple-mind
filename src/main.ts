import { Notice, Plugin, type TFile } from "obsidian";
import { loadSettings } from "./api/obsidian/settings";
import { SettingsTab } from "./components/settings/SettingsTab";
import { isSourceMode } from "./components/source/SourceModeGuard";
import { switchToMap, switchToSource } from "./components/source/SourceSwitch";
import { FILE_EXTENSION, VIEW_TYPE_MAP } from "./config/constants";
import { DEFAULT_SETTINGS } from "./config/defaults";
import { setLanguage, t } from "./config/i18n";
import { MindMapView } from "./pages/MindMapView";
import type { SimpleMindSettings, SimpleMindSettingsHost } from "./types/settings";

/** Main Obsidian plugin entry point. */
export default class SimpleMindPlugin extends Plugin implements SimpleMindSettingsHost {
  /** Current plugin settings. */
  settings: SimpleMindSettings = DEFAULT_SETTINGS;

  private statusBarEl: HTMLElement | null = null;
  private ribbonEl: HTMLElement | null = null;
  private newMapRibbonEl: HTMLElement | null = null;
  private readonly commandIds = [
    "toggle-map-source",
    "new-mind-map",
    "add-child",
    "add-sibling",
    "delete-node",
    "edit-node",
    "undo-map",
    "redo-map",
    "fit-map",
  ];

  /** Registers the map view, commands, settings, and file-open fallbacks. */
  async onload(): Promise<void> {
    this.settings = await loadSettings(this);
    setLanguage(this.settings.language);

    this.registerView(VIEW_TYPE_MAP, (leaf) => new MindMapView(leaf, () => this.settings));
    this.registerCommands();
    this.registerStatusBar();
    this.registerRibbon();
    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerFileHandlers();
    this.registerFileExtension();
    this.updateStatusBar();
  }

  /** Closes plugin views when the plugin is disabled. */
  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_MAP);
  }

  /** Persists settings for the settings tab. */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Reapplies settings to every open map view. */
  refreshMapViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MAP)) {
      const view = leaf.view;
      if (view instanceof MindMapView) view.refreshSettings();
    }
  }

  /** Applies a language change to commands, ribbon, status bar, and views. */
  refreshLanguage(): void {
    setLanguage(this.settings.language);
    this.statusBarEl?.setText(t("status.openMap"));
    this.ribbonEl?.setAttribute("aria-label", t("ribbon.openMap"));
    this.newMapRibbonEl?.setAttribute("aria-label", t("ribbon.newMap"));
    this.reRegisterCommands();
    this.refreshMapViews();
    this.updateStatusBar();
  }

  /** Registers command-palette actions for the map. */
  private registerCommands(): void {
    this.addCommand({
      id: "toggle-map-source",
      name: t("command.toggle"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== FILE_EXTENSION) return false;
        if (!checking) void this.toggleActiveLeaf();
        return true;
      },
    });

    this.addCommand({
      id: "new-mind-map",
      name: t("command.newMap"),
      callback: () => {
        void this.createMindMap();
      },
    });

    this.addMapCommand(
      "add-child",
      t("command.addChild"),
      (view) => view.canEdit() && !!view.getSelectedId(),
      (view) => view.addChildNode(),
    );
    this.addMapCommand(
      "add-sibling",
      t("command.addSibling"),
      (view) => view.canEdit() && !!view.getSelectedId(),
      (view) => view.addSibling(),
    );
    this.addMapCommand(
      "delete-node",
      t("command.delete"),
      (view) => view.canDeleteSelected(),
      (view) => view.deleteSelected(),
    );
    this.addMapCommand(
      "edit-node",
      t("command.edit"),
      (view) => view.canEdit() && !!view.getSelectedId(),
      (view) => view.editSelected(),
    );
    this.addMapCommand(
      "undo-map",
      t("command.undo"),
      (view) => view.canUndo(),
      (view) => view.undo(),
    );
    this.addMapCommand(
      "redo-map",
      t("command.redo"),
      (view) => view.canRedo(),
      (view) => view.redo(),
    );
    this.addMapCommand(
      "fit-map",
      t("command.fit"),
      () => true,
      (view) => view.fit(),
    );
  }

  /** Removes and re-adds commands so translated names take effect. */
  private reRegisterCommands(): void {
    for (const id of this.commandIds) this.removeCommand(id);
    this.registerCommands();
  }

  /** Adds one command that only appears when its map predicate passes. */
  private addMapCommand(
    id: string,
    name: string,
    isEnabled: (view: MindMapView) => boolean,
    run: (view: MindMapView) => void,
  ): void {
    this.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const view = this.getActiveMapView();
        if (!view || !isEnabled(view)) return false;
        if (!checking) run(view);
        return true;
      },
    });
  }

  /** Returns the active map view, if any. */
  private getActiveMapView(): MindMapView | null {
    return this.app.workspace.getActiveViewOfType(MindMapView);
  }

  /** Creates and opens a new `.mindmap` file. */
  private async createMindMap(): Promise<void> {
    try {
      const base = t("newMap.defaultName");
      let path = `${base}.mindmap`;
      let index = 2;
      while (this.app.vault.getAbstractFileByPath(path)) {
        path = `${base} ${index}.mindmap`;
        index += 1;
      }
      const file = await this.app.vault.create(path, `# ${t("newMap.root")}\n`);
      await this.app.workspace.getLeaf("tab").openFile(file);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      new Notice(`Simple Mind: ${t("notice.newMapFailed", { reason })}`);
    }
  }

  /** Registers the clickable status bar action for source-mode files. */
  private registerStatusBar(): void {
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("mod-clickable");
    this.statusBarEl.setText(t("status.openMap"));
    this.statusBarEl.addEventListener("click", () => {
      void this.toggleActiveLeaf(true);
    });
  }

  /** Registers visible ribbon actions. */
  private registerRibbon(): void {
    this.ribbonEl = this.addRibbonIcon("network", t("ribbon.openMap"), () => {
      void this.toggleActiveLeaf(true);
    });
    this.newMapRibbonEl = this.addRibbonIcon("file-plus", t("ribbon.newMap"), () => {
      void this.createMindMap();
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
      if (showNotice) new Notice(t("notice.openMapFirst"));
      return;
    }

    const viewType = leaf.view.getViewType();
    if (viewType === VIEW_TYPE_MAP) {
      await switchToSource(leaf, file);
    } else if (viewType === "markdown") {
      await switchToMap(leaf, file);
    } else if (showNotice) {
      new Notice(t("notice.unsupportedView"));
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
