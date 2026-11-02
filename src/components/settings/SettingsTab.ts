import { type App, Modal, Notice, type Plugin, PluginSettingTab, Setting } from "obsidian";
import { LIMITS } from "../../config/constants";
import { DEFAULT_SETTINGS } from "../../config/defaults";
import { setLanguage, t } from "../../config/i18n";
import type { LayoutKind } from "../../types/mindmap";
import type { Language, SimpleMindSettingsHost } from "../../types/settings";
import type { ThemeDefinition } from "../../types/theme";
import { BUILT_IN_THEMES, createObsidianCustomTheme } from "../map/themes/presets";
import {
  cloneTheme,
  createCustomThemeId,
  themeFromJson,
  toHexColor,
} from "../map/themes/theme-utils";
import { ThemeEditorModal } from "./ThemeEditorModal";

/** Settings tab for defaults, language, and themes. */
export class SettingsTab extends PluginSettingTab {
  // Kept as the narrow host type so `settings` never resolves to Plugin.settings (Obsidian 1.13+).
  private readonly host: SimpleMindSettingsHost;
  private saveTimer: number | null = null;

  /**
   * @param app Obsidian application.
   * @param host Plugin settings host.
   */
  constructor(app: App, host: SimpleMindSettingsHost & Plugin) {
    super(app, host);
    this.host = host;
  }

  /** Rebuilds the settings UI. */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("simple-mind-settings");
    new Setting(containerEl).setName(t("settings.title")).setHeading();
    this.renderGeneral(containerEl);
    this.renderThemes(containerEl);
  }

  /** Renders general defaults. */
  private renderGeneral(containerEl: HTMLElement): void {
    const settings = this.host.settings;
    new Setting(containerEl).setName(t("settings.general")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.language"))
      .setDesc(t("settings.languageDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("en", t("settings.english"))
          .addOption("zh", t("settings.chinese"))
          .setValue(settings.language)
          .onChange((value) => {
            settings.language = value as Language;
            setLanguage(settings.language);
            void this.host.saveSettings().then(() => {
              this.host.refreshLanguage();
              this.display();
            });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.defaultTheme"))
      .setDesc(t("settings.defaultThemeDesc"))
      .addDropdown((dropdown) => {
        for (const theme of this.allThemes()) {
          dropdown.addOption(theme.id, theme.name);
        }
        const exists = this.allThemes().some((theme) => theme.id === settings.defaultTheme);
        if (!exists) settings.defaultTheme = "obsidian";
        dropdown.setValue(settings.defaultTheme).onChange((value) => {
          settings.defaultTheme = value;
          void this.persist();
        });
      });

    new Setting(containerEl)
      .setName(t("settings.defaultFont"))
      .setDesc(t("settings.defaultFontDesc"))
      .addText((text) => {
        text.setPlaceholder(t("sidebar.defaultValue"));
        text.setValue(settings.defaultFontFamily);
        text.onChange((value) => {
          settings.defaultFontFamily = value.trim();
          this.schedulePersist();
        });
      });

    new Setting(containerEl)
      .setName(t("settings.connectorColor"))
      .setDesc(t("settings.connectorColorDesc"))
      .addColorPicker((picker) => {
        picker.setValue(settings.defaultConnectorColor || toHexColor("var(--interactive-accent)"));
        picker.onChange((value) => {
          settings.defaultConnectorColor = value;
          this.schedulePersist();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("rotate-ccw");
        button.setTooltip(t("settings.useThemeColors"));
        button.onClick(async () => {
          settings.defaultConnectorColor = "";
          await this.persist();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName(t("settings.lineWidth"))
      .setDesc(t("settings.lineWidthDesc"))
      .addSlider((slider) =>
        slider
          .setLimits(LIMITS.lineWidth.min, LIMITS.lineWidth.max, 1)
          .setValue(settings.defaultLineWidth)

          .onChange((value) => {
            settings.defaultLineWidth = value;
            this.schedulePersist();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.defaultLayout"))
      .setDesc(t("settings.defaultLayoutDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("mindmap", t("settings.layout.mindmap"))
          .addOption("tree-right", t("settings.layout.treeRight"))
          .addOption("tree-left", t("settings.layout.treeLeft"))
          .addOption("org", t("settings.layout.org"))
          .setValue(settings.defaultLayout)
          .onChange((value) => {
            settings.defaultLayout = value as LayoutKind;
            void this.persist();
          }),
      );

    new Setting(containerEl).setName(t("settings.spacingX")).addSlider((slider) =>
      slider
        .setLimits(LIMITS.spacingX.min, LIMITS.spacingX.max, 1)
        .setValue(settings.defaultSpacingX)

        .onChange((value) => {
          settings.defaultSpacingX = value;
          this.schedulePersist();
        }),
    );

    new Setting(containerEl).setName(t("settings.spacingY")).addSlider((slider) =>
      slider
        .setLimits(LIMITS.spacingY.min, LIMITS.spacingY.max, 1)
        .setValue(settings.defaultSpacingY)

        .onChange((value) => {
          settings.defaultSpacingY = value;
          this.schedulePersist();
        }),
    );

    new Setting(containerEl)
      .setName(t("settings.maxWidth"))
      .setDesc(t("settings.maxWidthDesc"))
      .addText((text) => {
        text.inputEl.type = "number";
        text.setValue(String(settings.defaultMaxWidth));
        text.onChange((value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return;
          settings.defaultMaxWidth = Math.min(
            LIMITS.maxWidth.max,
            Math.max(LIMITS.maxWidth.min, parsed),
          );
          this.schedulePersist();
        });
      });

    new Setting(containerEl)
      .setName(t("settings.reset"))
      .setDesc(t("settings.resetDesc"))
      .addButton((button) =>
        button.setButtonText(t("settings.resetButton")).onClick(async () => {
          this.host.settings.defaultTheme = DEFAULT_SETTINGS.defaultTheme;
          this.host.settings.defaultFontFamily = DEFAULT_SETTINGS.defaultFontFamily;
          this.host.settings.defaultConnectorColor = DEFAULT_SETTINGS.defaultConnectorColor;
          this.host.settings.defaultLineWidth = DEFAULT_SETTINGS.defaultLineWidth;
          this.host.settings.defaultLayout = DEFAULT_SETTINGS.defaultLayout;
          this.host.settings.defaultSpacingX = DEFAULT_SETTINGS.defaultSpacingX;
          this.host.settings.defaultSpacingY = DEFAULT_SETTINGS.defaultSpacingY;
          this.host.settings.defaultMaxWidth = DEFAULT_SETTINGS.defaultMaxWidth;
          await this.persist();
          this.display();
        }),
      );
  }

  /** Renders built-in and custom theme management. */
  private renderThemes(containerEl: HTMLElement): void {
    new Setting(containerEl).setName(t("settings.themes")).setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: t("settings.themesDesc"),
    });

    for (const theme of BUILT_IN_THEMES) {
      new Setting(containerEl)
        .setName(theme.name)
        .setDesc(t("settings.builtIn"))
        .addButton((button) =>
          button.setButtonText(t("settings.duplicate")).onClick(() => this.openNewTheme(theme)),
        )
        .addButton((button) =>
          button.setButtonText(t("settings.export")).onClick(() => {
            void this.exportTheme(theme);
          }),
        );
    }

    for (const theme of this.host.settings.customThemes) {
      new Setting(containerEl)
        .setName(theme.name)
        .setDesc(t("settings.custom"))
        .addButton((button) =>
          button.setButtonText(t("settings.edit")).onClick(() => this.editTheme(theme)),
        )
        .addButton((button) =>
          button.setButtonText(t("settings.duplicate")).onClick(() => this.duplicateTheme(theme)),
        )
        .addButton((button) =>
          button.setButtonText(t("settings.export")).onClick(() => {
            void this.exportTheme(theme);
          }),
        )
        .addButton((button) => {
          button.buttonEl.addClass("mod-warning");
          button.setButtonText(t("settings.delete")).onClick(() => this.confirmDeleteTheme(theme));
        });
    }

    new Setting(containerEl)
      .addButton((button) =>
        button
          .setButtonText(t("settings.newTheme"))
          .setCta()
          .onClick(() => this.openNewTheme(null)),
      )
      .addButton((button) =>
        button.setButtonText(t("settings.importTheme")).onClick(() => this.importTheme()),
      );
  }

  /** Returns all built-in and custom themes. */
  private allThemes(): ThemeDefinition[] {
    return [...BUILT_IN_THEMES, ...this.host.settings.customThemes];
  }

  /** Saves settings and refreshes open maps. */
  private async persist(): Promise<void> {
    await this.host.saveSettings();
    this.host.refreshMapViews();
  }

  /** Debounces slider saves. */
  private schedulePersist(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.persist();
    }, 150);
  }

  /** Opens the editor for a new or duplicated theme. */
  private openNewTheme(base: ThemeDefinition | null): void {
    const source = base ?? BUILT_IN_THEMES[0];
    const id = createCustomThemeId(this.allThemes());
    const name = base === null ? t("settings.newTheme") : `${base.name} ${t("settings.duplicate")}`;
    const theme =
      source.id === "obsidian" ? createObsidianCustomTheme(id, name) : cloneTheme(source, id, name);
    new ThemeEditorModal(this.app, {
      title: t("themeEditor.newTitle"),
      theme,
      onSave: async (saved) => {
        this.host.settings.customThemes.push(saved);
        await this.persist();
        new Notice(t("settings.themeSaved"));
        this.display();
      },
    }).open();
  }

  /** Opens the editor for an existing custom theme. */
  private editTheme(theme: ThemeDefinition): void {
    const draft = cloneTheme(theme);
    new ThemeEditorModal(this.app, {
      title: t("themeEditor.editTitle"),
      theme: draft,
      onSave: async (saved) => {
        const themes = this.host.settings.customThemes;
        const index = themes.findIndex((item) => item.id === saved.id);
        if (index >= 0) themes[index] = saved;
        else themes.push(saved);
        await this.persist();
        new Notice(t("settings.themeSaved"));
        this.display();
      },
    }).open();
  }

  /** Duplicates any theme into a new custom theme. */
  private duplicateTheme(theme: ThemeDefinition): void {
    this.openNewTheme(theme);
  }

  /** Confirms deletion of a custom theme. */
  private confirmDeleteTheme(theme: ThemeDefinition): void {
    new ConfirmDeleteModal(
      this.app,
      t("settings.deleteThemeTitle"),
      t("settings.deleteThemeMessage", { name: theme.name }),
      async () => {
        this.host.settings.customThemes = this.host.settings.customThemes.filter(
          (item) => item.id !== theme.id,
        );
        if (this.host.settings.defaultTheme === theme.id) {
          this.host.settings.defaultTheme = DEFAULT_SETTINGS.defaultTheme;
        }
        await this.persist();
        new Notice(t("settings.themeDeleted"));
        this.display();
      },
    ).open();
  }

  /** Copies theme JSON to the clipboard or downloads it. */
  private async exportTheme(theme: ThemeDefinition): Promise<void> {
    const data = JSON.stringify({ ...theme, builtIn: false }, null, 2);
    const clipboard = navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      try {
        await clipboard.writeText(data);
        new Notice(t("settings.themeExported"));
        return;
      } catch {
        // Fall through to a file download.
      }
    }
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${theme.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Opens a file picker and imports a valid theme JSON. */
  private importTheme(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void this.importThemeFile(file);
    });
    input.click();
  }

  /** Adds a theme from a picked JSON file. */
  private async importThemeFile(file: File): Promise<void> {
    const imported = themeFromJson(await file.text());
    if (!imported) {
      new Notice(t("settings.themeImportError"));
      return;
    }
    imported.id = createCustomThemeId(this.allThemes());
    imported.name = imported.name.trim() || t("settings.newTheme");
    this.host.settings.customThemes.push(imported);
    await this.persist();
    new Notice(t("settings.themeSaved"));
    this.display();
  }
}

/** Confirmation modal for destructive theme deletion. */
class ConfirmDeleteModal extends Modal {
  private readonly title: string;
  private readonly message: string;
  private readonly onConfirm: () => Promise<void> | void;

  /**
   * @param app Obsidian application.
   * @param title Modal title.
   * @param message Confirmation copy.
   * @param onConfirm Action to run after confirmation.
   */
  constructor(app: App, title: string, message: string, onConfirm: () => Promise<void> | void) {
    super(app);
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
  }

  /** Builds the confirmation UI. */
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: this.title });
    this.contentEl.createEl("p", { text: this.message });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t("settings.cancel")).onClick(() => this.close()))
      .addButton((button) => {
        button.buttonEl.addClass("mod-warning");
        button.setButtonText(t("settings.confirmDelete")).onClick(async () => {
          await this.onConfirm();
          this.close();
        });
      });
  }

  /** Clears modal content. */
  onClose(): void {
    this.contentEl.empty();
  }
}
