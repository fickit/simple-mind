import { type App, Modal, Notice, Setting } from "obsidian";
import { t } from "../../config/i18n";
import type { ConnectorStyle, NodeShape, ThemeDefinition, ThemeTokens } from "../../types/theme";
import { applyTheme } from "../map/themes/applyTheme";
import { toHexColor } from "../map/themes/theme-utils";

/** Options for the theme editor modal. */
export interface ThemeEditorModalOptions {
  title: string;
  theme: ThemeDefinition;
  onSave: (theme: ThemeDefinition) => Promise<void> | void;
}

/** Modal that edits a custom theme's light and dark tokens with a live preview. */
export class ThemeEditorModal extends Modal {
  private readonly options: ThemeEditorModalOptions;
  private readonly draft: ThemeDefinition;
  private variant: "light" | "dark" = "light";
  private fieldsEl!: HTMLElement;
  private previewEl!: HTMLElement;
  private lightButton!: HTMLButtonElement;
  private darkButton!: HTMLButtonElement;

  /**
   * @param app Obsidian application.
   * @param options Initial theme and save callback.
   */
  constructor(app: App, options: ThemeEditorModalOptions) {
    super(app);
    this.options = options;
    this.draft = JSON.parse(JSON.stringify(options.theme)) as ThemeDefinition;
    this.draft.builtIn = false;
  }

  /** Builds the editor UI. */
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("simple-mind-theme-editor");
    this.contentEl.createEl("h2", { text: this.options.title });

    new Setting(this.contentEl).setName(t("themeEditor.name")).addText((text) => {
      text.setValue(this.draft.name);
      text.onChange((value) => {
        this.draft.name = value;
      });
    });

    const tabs = this.contentEl.createDiv({ cls: "simple-mind-theme-tabs" });
    this.lightButton = tabs.createEl("button", {
      text: t("themeEditor.light"),
      cls: "simple-mind-theme-tab",
    });
    this.darkButton = tabs.createEl("button", {
      text: t("themeEditor.dark"),
      cls: "simple-mind-theme-tab",
    });
    this.lightButton.type = "button";
    this.darkButton.type = "button";
    this.lightButton.addEventListener("click", () => this.setVariant("light"));
    this.darkButton.addEventListener("click", () => this.setVariant("dark"));

    this.previewEl = this.contentEl.createDiv({ cls: "simple-mind-theme-preview" });
    this.fieldsEl = this.contentEl.createDiv({ cls: "simple-mind-theme-fields" });
    this.render();
  }

  /** Clears modal content. */
  onClose(): void {
    this.contentEl.empty();
  }

  /** Returns the token set for the active variant. */
  private get tokens(): ThemeTokens {
    return this.variant === "light" ? this.draft.light : this.draft.dark;
  }

  /** Switches the edited variant. */
  private setVariant(variant: "light" | "dark"): void {
    this.variant = variant;
    this.render();
  }

  /** Rebuilds the tab state, fields, and preview. */
  private render(): void {
    this.lightButton.classList.toggle("is-active", this.variant === "light");
    this.darkButton.classList.toggle("is-active", this.variant === "dark");
    this.renderFields();
    this.updatePreview();
  }

  /** Rebuilds the variant-specific fields. */
  private renderFields(): void {
    this.fieldsEl.empty();
    this.addColor(
      t("themeEditor.canvas"),
      () => this.tokens.canvasBackground,
      (value) => {
        this.tokens.canvasBackground = value;
        this.tokens.collapse.background = value;
      },
    );
    this.addColor(
      t("themeEditor.nodeBg"),
      () => this.tokens.node.background,
      (value) => {
        this.tokens.node.background = value;
      },
    );
    this.addColor(
      t("themeEditor.nodeText"),
      () => this.tokens.node.text,
      (value) => {
        this.tokens.node.text = value;
        this.tokens.collapse.text = value;
      },
    );
    this.addColor(
      t("themeEditor.nodeBorder"),
      () => this.tokens.node.border,
      (value) => {
        this.tokens.node.border = value;
      },
    );
    this.addColor(
      t("themeEditor.rootBg"),
      () => this.tokens.root.background,
      (value) => {
        this.tokens.root.background = value;
      },
    );
    this.addColor(
      t("themeEditor.rootText"),
      () => this.tokens.root.text,
      (value) => {
        this.tokens.root.text = value;
      },
    );
    this.addColor(
      t("themeEditor.accent"),
      () => this.tokens.selection.outline,
      (value) => {
        this.tokens.selection.outline = value;
      },
    );

    new Setting(this.fieldsEl)
      .setName(t("themeEditor.palette"))
      .setDesc(t("themeEditor.paletteDesc"))
      .addText((text) => {
        text.setValue(this.tokens.branch.palette.join(", "));
        text.onChange((value) => {
          const colors = value
            .split(",")
            .map((color) => color.trim())
            .filter(Boolean);
          if (colors.length > 0) this.tokens.branch.palette = colors;
          this.updatePreview();
        });
      });

    new Setting(this.fieldsEl).setName(t("themeEditor.shape")).addDropdown((dropdown) => {
      dropdown
        .addOption("rounded", t("themeEditor.shape.rounded"))
        .addOption("pill", t("themeEditor.shape.pill"))
        .addOption("underline", t("themeEditor.shape.underline"))
        .addOption("plain", t("themeEditor.shape.plain"))
        .setValue(this.tokens.node.shape)
        .onChange((value) => {
          this.tokens.node.shape = value as NodeShape;
          this.tokens.root.shape = value as NodeShape;
          this.updatePreview();
        });
    });

    new Setting(this.fieldsEl).setName(t("themeEditor.connector")).addDropdown((dropdown) => {
      dropdown
        .addOption("curve", t("themeEditor.connector.curve"))
        .addOption("orthogonal", t("themeEditor.connector.orthogonal"))
        .setValue(this.tokens.branch.style)
        .onChange((value) => {
          this.tokens.branch.style = value as ConnectorStyle;
          this.updatePreview();
        });
    });

    new Setting(this.fieldsEl).setName(t("themeEditor.fontFamily")).addText((text) => {
      text.setValue(this.tokens.typography.family);
      text.onChange((value) => {
        this.tokens.typography.family = value;
        this.updatePreview();
      });
    });

    new Setting(this.fieldsEl).setName(t("themeEditor.fontSize")).addText((text) => {
      text.inputEl.type = "number";
      text.setValue(String(this.tokens.typography.size));
      text.onChange((value) => {
        const size = Number(value);
        if (Number.isFinite(size) && size >= 8) {
          this.tokens.typography.size = size;
          this.updatePreview();
        }
      });
    });

    new Setting(this.fieldsEl).setName(t("themeEditor.lineWidth")).addText((text) => {
      text.inputEl.type = "number";
      text.setValue(String(this.tokens.branch.lineWidth));
      text.onChange((value) => {
        const width = Number(value);
        if (Number.isFinite(width) && width > 0) {
          this.tokens.branch.lineWidth = width;
          this.updatePreview();
        }
      });
    });

    new Setting(this.fieldsEl)
      .addButton((button) =>
        button
          .setButtonText(t("themeEditor.save"))
          .setCta()
          .onClick(() => {
            void this.save();
          }),
      )
      .addButton((button) =>
        button.setButtonText(t("themeEditor.cancel")).onClick(() => this.close()),
      );
  }

  /** Adds one color setting bound to the active tokens. */
  private addColor(name: string, getValue: () => string, setValue: (value: string) => void): void {
    new Setting(this.fieldsEl).setName(name).addText((text) => {
      text.inputEl.type = "color";
      text.setValue(toHexColor(getValue()));
      text.onChange((value) => {
        setValue(value);
        this.updatePreview();
      });
    });
  }

  /** Redraws a small sample root, branches, and connector. */
  private updatePreview(): void {
    this.previewEl.empty();
    applyTheme(this.previewEl, this.draft, this.variant === "dark");

    const svg = createSvg("svg");
    svg.setAttribute("viewBox", "0 0 360 190");
    svg.classList.add("simple-mind-theme-preview-svg");
    const path = createSvg("path");
    path.setAttribute("d", "M 110 95 C 150 95 160 48 210 48 M 110 95 C 150 95 160 142 210 142");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", this.tokens.branch.palette[0] ?? this.tokens.selection.outline);
    path.setAttribute("stroke-width", String(this.tokens.branch.lineWidth));
    path.setAttribute("stroke-opacity", String(this.tokens.branch.opacity));
    svg.appendChild(path);
    this.previewEl.appendChild(svg);

    this.previewEl.createDiv({
      cls: `simple-mind-node is-root shape-${this.tokens.root.shape} simple-mind-preview-root`,
      text: t("themeEditor.previewRoot"),
    });

    this.previewEl.createDiv({
      cls: `simple-mind-node shape-${this.tokens.node.shape} simple-mind-preview-child-a`,
      text: t("themeEditor.previewBranch"),
    });

    this.previewEl.createDiv({
      cls: `simple-mind-node shape-${this.tokens.node.shape} simple-mind-preview-child-b`,
      text: t("themeEditor.previewBranch"),
    });
  }

  /** Saves the draft theme. */
  private async save(): Promise<void> {
    if (this.draft.name.trim() === "") {
      new Notice(t("themeEditor.nameRequired"));
      return;
    }
    this.draft.name = this.draft.name.trim();
    await this.options.onSave(this.draft);
    this.close();
  }
}
