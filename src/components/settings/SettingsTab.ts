import {
  type App,
  Modal,
  Notice,
  type Plugin,
  PluginSettingTab,
  Setting,
  type SettingDefinitionItem,
  type SettingDefinitionRender,
} from "obsidian";
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

  /** Declarative settings rendered by Obsidian 1.13 and newer. */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.host.settings;
    return [
      {
        type: "group",
        heading: t("settings.general"),
        items: [
          {
            name: t("settings.language"),
            desc: t("settings.languageDesc"),
            render: (setting) => {
              setting.addDropdown((dropdown) =>
                dropdown
                  .addOption("en", t("settings.english"))
                  .addOption("zh", t("settings.chinese"))
                  .setValue(settings.language)
                  .onChange((value) => {
                    settings.language = value as Language;
                    setLanguage(settings.language);
                    void this.host.saveSettings().then(() => {
                      this.host.refreshLanguage();
                      this.update();
                    });
                  }),
              );
            },
          },
          {
            name: t("settings.defaultTheme"),
            desc: t("settings.defaultThemeDesc"),
            render: (setting) => {
              setting.addDropdown((dropdown) => {
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
            },
          },
          {
            name: t("settings.defaultFont"),
            desc: t("settings.defaultFontDesc"),
            render: (setting) => {
              setting.addText((text) => {
                text.setPlaceholder(t("sidebar.defaultValue"));
                text.setValue(settings.defaultFontFamily);
                text.onChange((value) => {
                  settings.defaultFontFamily = value.trim();
                  this.schedulePersist();
                });
              });
            },
          },
          {
            name: t("settings.connectorColor"),
            desc: t("settings.connectorColorDesc"),
            render: (setting) => {
              setting
                .addColorPicker((picker) => {
                  picker.setValue(
                    settings.defaultConnectorColor || toHexColor("var(--interactive-accent)"),
                  );
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
                    this.update();
                  });
                });
            },
          },
          {
            name: t("settings.lineWidth"),
            desc: t("settings.lineWidthDesc"),
            render: (setting) => {
              setting.addSlider((slider) =>
                slider
                  .setLimits(LIMITS.lineWidth.min, LIMITS.lineWidth.max, 1)
                  .setValue(settings.defaultLineWidth)
                  .onChange((value) => {
                    settings.defaultLineWidth = value;
                    this.schedulePersist();
                  }),
              );
            },
          },
          {
            name: t("settings.defaultLayout"),
            desc: t("settings.defaultLayoutDesc"),
            render: (setting) => {
              setting.addDropdown((dropdown) =>
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
            },
          },
          {
            name: t("settings.spacingX"),
            render: (setting) => {
              setting.addSlider((slider) =>
                slider
                  .setLimits(LIMITS.spacingX.min, LIMITS.spacingX.max, 1)
                  .setValue(settings.defaultSpacingX)
                  .onChange((value) => {
                    settings.defaultSpacingX = value;
                    this.schedulePersist();
                  }),
              );
            },
          },
          {
            name: t("settings.spacingY"),
            render: (setting) => {
              setting.addSlider((slider) =>
                slider
                  .setLimits(LIMITS.spacingY.min, LIMITS.spacingY.max, 1)
                  .setValue(settings.defaultSpacingY)
                  .onChange((value) => {
                    settings.defaultSpacingY = value;
                    this.schedulePersist();
                  }),
              );
            },
          },
          {
            name: t("settings.maxWidth"),
            desc: t("settings.maxWidthDesc"),
            render: (setting) => {
              setting.addText((text) => {
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
            },
          },
          {
            name: t("settings.reset"),
            desc: t("settings.resetDesc"),
            render: (setting) => {
              setting.addButton((button) =>
                button.setButtonText(t("settings.resetButton")).onClick(async () => {
                  settings.defaultTheme = DEFAULT_SETTINGS.defaultTheme;
                  settings.defaultFontFamily = DEFAULT_SETTINGS.defaultFontFamily;
                  settings.defaultConnectorColor = DEFAULT_SETTINGS.defaultConnectorColor;
                  settings.defaultLineWidth = DEFAULT_SETTINGS.defaultLineWidth;
                  settings.defaultLayout = DEFAULT_SETTINGS.defaultLayout;
                  settings.defaultSpacingX = DEFAULT_SETTINGS.defaultSpacingX;
                  settings.defaultSpacingY = DEFAULT_SETTINGS.defaultSpacingY;
                  settings.defaultMaxWidth = DEFAULT_SETTINGS.defaultMaxWidth;
                  await this.persist();
                  this.update();
                }),
              );
            },
          },
        ],
      },
      {
        type: "group",
        heading: t("settings.themes"),
        items: [
          {
            name: t("settings.themesDesc"),
            render: (setting) => {
              setting.settingEl.empty();
              setting.settingEl.createEl("p", {
                cls: "setting-item-description",
                text: t("settings.themesDesc"),
              });
            },
          },
          ...BUILT_IN_THEMES.map(
            (theme): SettingDefinitionRender => ({
              name: theme.name,
              desc: t("settings.builtIn"),
              render: (setting) => {
                setting.addButton((button) =>
                  button
                    .setButtonText(t("settings.duplicate"))
                    .onClick(() => this.openNewTheme(theme)),
                );
                setting.addButton((button) =>
                  button.setButtonText(t("settings.export")).onClick(() => {
                    void this.exportTheme(theme);
                  }),
                );
              },
            }),
          ),
          ...settings.customThemes.map(
            (theme): SettingDefinitionRender => ({
              name: theme.name,
              desc: t("settings.custom"),
              render: (setting) => {
                setting.addButton((button) =>
                  button.setButtonText(t("settings.edit")).onClick(() => this.editTheme(theme)),
                );
                setting.addButton((button) =>
                  button
                    .setButtonText(t("settings.duplicate"))
                    .onClick(() => this.duplicateTheme(theme)),
                );
                setting.addButton((button) =>
                  button.setButtonText(t("settings.export")).onClick(() => {
                    void this.exportTheme(theme);
                  }),
                );
                setting.addButton((button) => {
                  button.buttonEl.addClass("mod-warning");
                  button
                    .setButtonText(t("settings.delete"))
                    .onClick(() => this.confirmDeleteTheme(theme));
                });
              },
            }),
          ),
          {
            name: t("settings.newTheme"),
            render: (setting) => {
              setting.addButton((button) =>
                button
                  .setButtonText(t("settings.newTheme"))
                  .setCta()
                  .onClick(() => this.openNewTheme(null)),
              );
            },
          },
          {
            name: t("settings.importTheme"),
            render: (setting) => {
              setting.addButton((button) =>
                button.setButtonText(t("settings.importTheme")).onClick(() => this.importTheme()),
              );
            },
          },
        ],
      },
    ];
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
        this.update();
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
        this.update();
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
        this.update();
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
    const link = createEl("a");
    link.href = url;
    link.download = `${theme.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Opens a file picker and imports a valid theme JSON. */
  private importTheme(): void {
    const input = createEl("input");
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
    this.update();
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
