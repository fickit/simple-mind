import {
  COLOR_INPUT_FALLBACK,
  LIMITS,
  NEW_NODE_EDITOR_WIDTH,
  NODE_CONTROL_GAP,
  NODE_CONTROL_SIZE,
  NODE_CONTROL_SPACING,
} from "../../config/constants";
import { DEFAULT_MINDMAP_META, DEFAULT_SETTINGS, metaFromSettings } from "../../config/defaults";
import { t } from "../../config/i18n";
import type { BranchSide, LayoutKind, MindMapMeta, MindNode, NodeStyle } from "../../types/mindmap";
import type { SimpleMindSettings } from "../../types/settings";
import type {
  ConnectorStyle,
  NodeShape,
  TextAlign,
  ThemeDefinition,
  ThemeTokens,
} from "../../types/theme";
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
import { type IconName, setIcon } from "./engine/render/icons";
import { type AddSide, MapRenderer } from "./engine/render/MapRenderer";
import { applyTheme, tokensForMode } from "./themes/applyTheme";
import { type NodeVisual, nodeVisual } from "./themes/nodeVisual";
import { applyMetaOverrides } from "./themes/overrides";
import { BUILT_IN_THEMES, OBSIDIAN_THEME, resolveTheme } from "./themes/presets";

/** Callbacks supplied by the host view. */
export interface MapCanvasOptions {
  onSource: () => void;
  onChange?: (source: string) => void;
  onNotice?: (message: string) => void;
  onOpenSettings?: () => void;
  settings?: SimpleMindSettings;
}

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** A color picker paired with a reset button. */
interface SidebarColorControl {
  input: HTMLInputElement;
  reset: HTMLButtonElement;
}

/** Options for a sidebar stepper. */
interface SidebarStepperOptions {
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

/** A numeric field with stacked step buttons. */
interface SidebarStepper {
  input: HTMLInputElement;
  up: HTMLButtonElement;
  down: HTMLButtonElement;
  value: number;
}

/** One tile inside an icon group. */
interface SidebarTileItem {
  value: string;
  icon: IconName;
  title: string;
}

/** Canvas component that owns the renderer, controller, toolbar, and editing. */
export class MapCanvas {
  private readonly rootEl: HTMLElement;
  private readonly contentRow: HTMLElement;
  private readonly canvasEl: HTMLElement;
  private readonly sidebarEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly renderer: MapRenderer;
  private readonly editor: InlineEditor;
  private readonly drag: DragController;
  private theme: ThemeDefinition = OBSIDIAN_THEME;
  private settings: SimpleMindSettings;
  private readonly onSource: () => void;
  private readonly onChangeSource: (source: string) => void;
  private readonly onNotice: (message: string) => void;
  private readonly onOpenSettings?: () => void;
  private readonly fitButton: HTMLButtonElement;
  private readonly sourceButton: HTMLButtonElement;
  private readonly styleButton: HTMLButtonElement;
  private sidebarPane!: HTMLElement;
  private sidebarSelectMirror!: HTMLSpanElement;
  private sidebarThemeSelect!: HTMLSelectElement;
  private sidebarLayoutButtons!: HTMLButtonElement[];
  private sidebarNodeHint!: HTMLElement;
  private sidebarTextHint!: HTMLElement;
  private sidebarShapeButtons!: HTMLButtonElement[];
  private sidebarNodeFill!: SidebarColorControl;
  private sidebarNodeBorder!: SidebarColorControl;
  private sidebarNodeBorderWidth!: SidebarStepper;
  private sidebarConnectorButtons!: HTMLButtonElement[];
  private sidebarFontSize!: SidebarStepper;
  private sidebarTextColor!: SidebarColorControl;
  private sidebarBoldButton!: HTMLButtonElement;
  private sidebarItalicButton!: HTMLButtonElement;
  private sidebarUnderlineButton!: HTMLButtonElement;
  private sidebarTextAlignButtons!: HTMLButtonElement[];
  private sidebarLineHeight!: SidebarStepper;
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
  private renderFrame: number | null = null;

  /**
   * @param container Element that receives the map UI.
   * @param options Host callbacks.
   */
  constructor(container: HTMLElement, options: MapCanvasOptions) {
    const doc = container.ownerDocument;
    this.onSource = options.onSource;
    this.onChangeSource = options.onChange ?? (() => {});
    this.onNotice = options.onNotice ?? (() => {});
    this.onOpenSettings = options.onOpenSettings;
    this.settings = options.settings ?? DEFAULT_SETTINGS;
    this.dark = isDarkDocument(doc);

    this.rootEl = doc.createElement("div");
    this.rootEl.className = "simple-mind-map";
    this.rootEl.style.setProperty("--sm-control-size", `${NODE_CONTROL_SIZE}px`);
    this.rootEl.style.setProperty("--sm-control-gap", `${NODE_CONTROL_GAP}px`);
    this.rootEl.style.setProperty("--sm-control-spacing", `${NODE_CONTROL_SPACING}px`);
    container.replaceChildren(this.rootEl);

    this.bannerEl = doc.createElement("div");
    this.bannerEl.className = "simple-mind-banner";
    this.bannerEl.hidden = true;
    this.bannerEl.setAttribute("role", "alert");
    this.rootEl.appendChild(this.bannerEl);

    this.contentRow = doc.createElement("div");
    this.contentRow.className = "simple-mind-content";
    this.rootEl.appendChild(this.contentRow);

    const canvasHost = doc.createElement("div");
    canvasHost.className = "simple-mind-canvas-host";
    this.contentRow.appendChild(canvasHost);

    this.canvasEl = doc.createElement("div");
    this.canvasEl.className = "simple-mind-canvas";
    canvasHost.appendChild(this.canvasEl);

    this.sidebarEl = doc.createElement("aside");
    this.sidebarEl.className = "simple-mind-sidebar";
    this.contentRow.appendChild(this.sidebarEl);

    applyTheme(this.rootEl, this.theme, this.dark);
    this.renderer = new MapRenderer(this.canvasEl, this.theme, this.dark, {
      onToggleCollapse: (nodeId, side) => this.toggleCollapse(nodeId, side),
      onAddRequest: (nodeId, side) => this.addChildFrom(nodeId, side),
      onEditRequest: (nodeId) => this.startEdit(nodeId),
      onSelectionChange: (nodeId) => {
        this.selectedId = nodeId;
        this.syncSidebar();
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

    const menu = doc.createElement("div");
    menu.className = "simple-mind-menu";
    canvasHost.appendChild(menu);
    this.fitButton = this.createToolbarButton(menu, t("toolbar.fit"), "fit", () =>
      this.renderer.fit(),
    );
    this.styleButton = this.createToolbarButton(menu, t("toolbar.style"), "style", () =>
      this.toggleSidebar(),
    );
    this.sourceButton = this.createToolbarButton(
      menu,
      t("toolbar.source"),
      "source",
      this.onSource,
    );

    this.keydownHandler = (event) => this.handleKeydown(event);
    this.canvasEl.addEventListener("keydown", this.keydownHandler);
    this.buildSidebar();
    this.syncSidebar();
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

    const result = parseSource(source, metaFromSettings(this.settings));
    this.readOnly = result.errors.length > 0;

    if (result.errors.length > 0) {
      const first = result.errors[0];
      const more =
        result.errors.length > 1 ? t("banner.moreErrors", { count: result.errors.length - 1 }) : "";
      this.showBanner(
        t("banner.sourceError", {
          line: first.line,
          message: first.message,
          more,
        }),
      );
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
      this.applyCurrentTheme();
      this.renderer.render(result.document, { fit: true });
      this.renderer.selectNode(null);
      this.syncSidebar();
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

  /**
   * Applies new plugin defaults and custom themes, then reparses the file.
   *
   * @param settings Updated plugin settings.
   */
  updateSettings(settings: SimpleMindSettings): void {
    this.settings = settings;
    this.dark = isDarkDocument(this.rootEl.ownerDocument);
    this.refreshLanguage();
    if (this.sourceText) {
      this.setSource(this.getSource());
    } else {
      this.refreshTheme();
      this.syncSidebar();
    }
  }

  /** Updates menu labels after a language change. */
  refreshLanguage(): void {
    this.fitButton.setAttribute("aria-label", t("toolbar.fit"));
    this.styleButton.setAttribute("aria-label", t("toolbar.style"));
    this.sourceButton.setAttribute("aria-label", t("toolbar.source"));
    this.buildSidebar();
    this.syncSidebar();
    if (this.controller) this.rerender(false);
  }

  /** Rebuilds sidebar controls so labels follow the active language. */
  private buildSidebar(): void {
    const doc = this.sidebarEl.ownerDocument;
    this.sidebarEl.replaceChildren();

    const header = doc.createElement("div");
    header.className = "simple-mind-sidebar-header";
    const title = doc.createElement("span");
    title.textContent = t("sidebar.style");
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "simple-mind-sidebar-close";
    close.setAttribute("aria-label", t("sidebar.close"));
    setIcon(close, "close");
    close.addEventListener("click", () => this.toggleSidebar());
    header.append(title, close);
    this.sidebarEl.appendChild(header);

    this.sidebarSelectMirror = doc.createElement("span");
    this.sidebarSelectMirror.className = "simple-mind-sidebar-select-mirror";
    this.sidebarEl.appendChild(this.sidebarSelectMirror);

    this.sidebarPane = doc.createElement("div");
    this.sidebarPane.className = "simple-mind-sidebar-pane";
    this.sidebarEl.appendChild(this.sidebarPane);

    const themeSection = this.createSidebarSection(this.sidebarPane);
    const themeRow = doc.createElement("div");
    themeRow.className = "simple-mind-sidebar-theme-row";
    const themeTitle = doc.createElement("span");
    themeTitle.className = "simple-mind-sidebar-section-title";
    themeTitle.textContent = t("sidebar.theme");
    themeRow.appendChild(themeTitle);

    this.sidebarThemeSelect = doc.createElement("select");
    this.sidebarThemeSelect.className = "simple-mind-sidebar-select simple-mind-sidebar-theme";
    this.sidebarThemeSelect.setAttribute("aria-label", t("sidebar.theme"));
    this.sidebarThemeSelect.addEventListener("change", () => {
      this.changeTheme(this.sidebarThemeSelect.value);
    });
    themeRow.appendChild(this.sidebarThemeSelect);

    if (this.onOpenSettings) {
      const gear = doc.createElement("button");
      gear.type = "button";
      gear.className = "simple-mind-sidebar-gear";
      gear.setAttribute("aria-label", t("sidebar.openSettings"));
      setIcon(gear, "settings");
      gear.addEventListener("click", () => this.onOpenSettings?.());
      themeRow.appendChild(gear);
    }
    themeSection.appendChild(themeRow);

    const layoutSection = this.createSidebarSection(this.sidebarPane, t("sidebar.layout"));
    this.sidebarLayoutButtons = this.createSidebarTiles(
      layoutSection,
      t("sidebar.layoutType"),
      [
        { value: "mindmap", icon: "layout-mindmap", title: t("settings.layout.mindmap") },
        { value: "tree-right", icon: "layout-tree-right", title: t("settings.layout.treeRight") },
        { value: "tree-left", icon: "layout-tree-left", title: t("settings.layout.treeLeft") },
        { value: "org", icon: "layout-org", title: t("settings.layout.org") },
      ],
      (value) => this.updateMetaAndRender({ layout: value as LayoutKind }),
    );

    const nodeSection = this.createSidebarSection(this.sidebarPane, t("sidebar.node"));
    this.sidebarNodeHint = this.createSidebarHint(nodeSection, t("sidebar.selectNode"));
    this.sidebarShapeButtons = this.createSidebarTiles(
      nodeSection,
      t("sidebar.nodeShape"),
      [
        { value: "rounded", icon: "shape-rounded", title: t("themeEditor.shape.rounded") },
        { value: "pill", icon: "shape-pill", title: t("themeEditor.shape.pill") },
        { value: "underline", icon: "shape-underline", title: t("themeEditor.shape.underline") },
        { value: "plain", icon: "shape-plain", title: t("themeEditor.shape.plain") },
      ],
      (value) =>
        this.updateSelectedNodeStyle({
          shape: this.withoutOverride(value as NodeShape, this.effectiveVisual().shape),
        }),
    );
    this.sidebarNodeFill = this.createSidebarColor(nodeSection, t("sidebar.fill"), (value) =>
      this.updateSelectedNodeStyle({ fill: value }),
    );
    this.sidebarNodeFill.input.classList.add("simple-mind-sidebar-node-fill");
    this.sidebarNodeBorder = this.createSidebarColor(
      nodeSection,
      t("sidebar.borderColor"),
      (value) => this.updateSelectedNodeStyle({ borderColor: value }),
    );
    this.sidebarNodeBorder.input.classList.add("simple-mind-sidebar-node-border");
    this.sidebarNodeBorderWidth = this.createSidebarStepper(nodeSection, t("sidebar.borderWidth"), {
      min: LIMITS.nodeBorderWidth.min,
      max: LIMITS.nodeBorderWidth.max,
      step: 1,
      onChange: (value) =>
        this.updateSelectedNodeStyle({
          borderWidth: this.withoutOverride(value, this.effectiveVisual().borderWidth),
        }),
    });
    this.sidebarNodeBorderWidth.input.classList.add("simple-mind-sidebar-node-border-width");

    const connectorSection = this.createSidebarSection(this.sidebarPane, t("sidebar.connector"));
    this.sidebarConnectorButtons = this.createSidebarTiles(
      connectorSection,
      t("sidebar.connectorShape"),
      [
        { value: "curve", icon: "connector-curve", title: t("themeEditor.connector.curve") },
        {
          value: "orthogonal",
          icon: "connector-orthogonal",
          title: t("themeEditor.connector.orthogonal"),
        },
      ],
      (value) =>
        this.updateMetaAndRender({
          connectorStyle: this.withoutOverride(
            value as ConnectorStyle,
            this.activeTokens().branch.style,
          ),
        }),
    );

    const textSection = this.createSidebarSection(this.sidebarPane, t("sidebar.text"));
    this.sidebarTextHint = this.createSidebarHint(textSection, t("sidebar.selectNode"));
    this.sidebarTextColor = this.createSidebarColor(textSection, t("sidebar.textColor"), (value) =>
      this.updateSelectedNodeStyle({ textColor: value }),
    );
    this.sidebarTextColor.input.classList.add("simple-mind-sidebar-text-color");
    this.sidebarFontSize = this.createSidebarStepper(textSection, t("themeEditor.fontSize"), {
      min: LIMITS.fontSize.min,
      max: LIMITS.fontSize.max,
      step: 1,
      onChange: (value) =>
        this.updateSelectedNodeStyle({
          fontSize: this.withoutOverride(value, this.effectiveVisual().fontSize),
        }),
    });
    this.sidebarFontSize.input.classList.add("simple-mind-sidebar-font-size");
    this.sidebarLineHeight = this.createSidebarStepper(textSection, t("sidebar.lineHeight"), {
      min: LIMITS.lineHeight.min,
      max: LIMITS.lineHeight.max,
      step: 0.1,
      onChange: (value) =>
        this.updateSelectedNodeStyle({
          lineHeight: this.withoutOverride(value, this.effectiveVisual().lineHeight),
        }),
    });
    this.sidebarLineHeight.input.classList.add("simple-mind-sidebar-line-height");

    const textStyleStack = doc.createElement("span");
    textStyleStack.className = "simple-mind-sidebar-stack";
    const [bold, italic, underline] = this.createSidebarToggles(
      textStyleStack,
      t("sidebar.textStyle"),
      [
        { value: "bold", icon: "bold", title: t("sidebar.bold") },
        { value: "italic", icon: "italic", title: t("sidebar.italic") },
        { value: "underline", icon: "underline", title: t("sidebar.underline") },
      ],
      (value, active) => {
        if (value === "bold") this.updateSelectedNodeStyle({ bold: active });
        else if (value === "italic") this.updateSelectedNodeStyle({ italic: active });
        else this.updateSelectedNodeStyle({ underline: active });
      },
    );
    this.sidebarBoldButton = bold;
    this.sidebarItalicButton = italic;
    this.sidebarUnderlineButton = underline;
    this.sidebarTextAlignButtons = this.createSidebarTiles(
      textStyleStack,
      t("sidebar.textAlign"),
      [
        { value: "left", icon: "align-left", title: t("sidebar.textAlign.left") },
        { value: "center", icon: "align-center", title: t("sidebar.textAlign.center") },
        { value: "right", icon: "align-right", title: t("sidebar.textAlign.right") },
      ],
      (value) =>
        this.updateSelectedNodeStyle({
          textAlign: value ? (value as TextAlign) : undefined,
        }),
      { clearable: true, row: false },
    );
    this.createSidebarRow(textSection, t("sidebar.textStyle"), textStyleStack);
  }

  /** Creates a sidebar section; without a title the heading row is left out. */
  private createSidebarSection(parent: HTMLElement, title?: string): HTMLElement {
    const doc = this.sidebarEl.ownerDocument;
    const section = doc.createElement("section");
    section.className = "simple-mind-sidebar-section";
    if (title) {
      const heading = doc.createElement("h4");
      heading.textContent = title;
      section.appendChild(heading);
    }
    parent.appendChild(section);
    return section;
  }

  /** Adds a muted hint inside a section. */
  private createSidebarHint(parent: HTMLElement, text: string): HTMLElement {
    const hint = this.sidebarEl.ownerDocument.createElement("p");
    hint.className = "simple-mind-sidebar-hint";
    hint.textContent = text;
    parent.appendChild(hint);
    return hint;
  }

  /** Appends a label/control row and returns the control. */
  private createSidebarRow(section: HTMLElement, label: string, control: HTMLElement): void {
    const doc = this.sidebarEl.ownerDocument;
    const row = doc.createElement("div");
    row.className = "simple-mind-sidebar-row";
    const span = doc.createElement("span");
    span.textContent = label;
    row.append(span, control);
    section.appendChild(row);
  }

  /**
   * Sets a select's width to its current label, measured by the hidden mirror.
   *
   * @param select The select to size.
   */
  private sizeSelect(select: HTMLSelectElement): void {
    if (!this.sidebarSelectMirror) return;
    this.sidebarSelectMirror.textContent = select.options[select.selectedIndex]?.text ?? "";
    select.style.width = `${this.sidebarSelectMirror.offsetWidth}px`;
  }

  /** Adds a numeric field with stacked step buttons to the theme value. */
  private createSidebarStepper(
    section: HTMLElement,
    label: string,
    options: SidebarStepperOptions,
  ): SidebarStepper {
    const doc = this.sidebarEl.ownerDocument;
    const wrap = doc.createElement("span");
    wrap.className = "simple-mind-sidebar-stepper";

    const input = doc.createElement("input");
    input.type = "number";
    input.min = String(options.min);
    input.max = String(options.max);
    input.step = String(options.step);
    input.className = "simple-mind-sidebar-number";
    input.setAttribute("aria-label", label);

    const arrows = doc.createElement("span");
    arrows.className = "simple-mind-sidebar-arrows";
    const up = this.createSidebarStepButton(t("sidebar.stepUp"), "chevron-up");
    const down = this.createSidebarStepButton(t("sidebar.stepDown"), "chevron-down");
    arrows.append(up, down);

    const stepper: SidebarStepper = { input, up, down, value: options.min };

    const commit = (value: number): void => {
      const clamped = Math.min(options.max, Math.max(options.min, value));
      stepper.value = roundToStep(clamped, options.step);
      input.value = formatNumber(stepper.value);
      options.onChange(stepper.value);
    };

    const step = (direction: number): void => {
      const current = Number(input.value);
      const base = input.value.trim() === "" || !Number.isFinite(current) ? null : current;
      commit(base === null ? options.min : base + direction * options.step);
    };

    down.addEventListener("click", () => step(-1));
    up.addEventListener("click", () => step(1));
    input.addEventListener("change", () => {
      const value = Number(input.value);
      if (input.value.trim() === "" || !Number.isFinite(value)) {
        input.value = formatNumber(stepper.value);
        return;
      }
      commit(value);
    });

    wrap.append(input, arrows);
    this.createSidebarRow(section, label, wrap);
    return stepper;
  }

  /** Creates one arrow button inside a stepper. */
  private createSidebarStepButton(label: string, icon: IconName): HTMLButtonElement {
    const button = this.sidebarEl.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "simple-mind-sidebar-step";
    button.setAttribute("aria-label", label);
    setIcon(button, icon);
    return button;
  }

  /**
   * Adds one row of independent icon toggles without a frame or label row.
   *
   * @param parent Section or stack that receives the group.
   * @param label Group label for assistive tech.
   * @param items Toggles in display order.
   * @param onChange Receives the toggled value and its new state.
   */
  private createSidebarToggles(
    parent: HTMLElement,
    label: string,
    items: SidebarTileItem[],
    onChange: (value: string, active: boolean) => void,
  ): HTMLButtonElement[] {
    const buttons = this.createSidebarSegment(parent, label, items, { row: false });
    for (const button of buttons) {
      button.addEventListener("click", () => {
        onChange(button.dataset.value ?? "", !button.classList.contains("is-active"));
      });
    }
    return buttons;
  }

  /**
   * Adds a row of icon tiles where at most one is active.
   *
   * @param parent Section or stack that receives the group.
   * @param label Group label.
   * @param items Tiles in display order.
   * @param onChange Receives the picked value.
   * @param options `clearable` returns to the theme value when the active tile
   * is clicked again; `row: false` appends a frameless group.
   */
  private createSidebarTiles(
    parent: HTMLElement,
    label: string,
    items: SidebarTileItem[],
    onChange: (value: string) => void,
    options: { clearable?: boolean; row?: boolean } = {},
  ): HTMLButtonElement[] {
    const buttons = this.createSidebarSegment(parent, label, items, options);
    for (const button of buttons) {
      button.addEventListener("click", () => {
        if (options.clearable && button.classList.contains("is-active")) {
          onChange("");
          return;
        }
        onChange(button.dataset.value ?? "");
      });
    }
    return buttons;
  }

  /**
   * Builds a tile group, labeled on its own row or frameless inside a parent.
   *
   * @param parent Section or stack that receives the group.
   * @param label Group label for assistive tech.
   * @param items Tiles in display order.
   * @param options `row: false` appends a frameless group instead of a labeled row.
   */
  private createSidebarSegment(
    parent: HTMLElement,
    label: string,
    items: SidebarTileItem[],
    options: { row?: boolean } = {},
  ): HTMLButtonElement[] {
    const doc = this.sidebarEl.ownerDocument;
    const wrap = doc.createElement("div");
    wrap.className =
      options.row === false ? "simple-mind-sidebar-segment is-bare" : "simple-mind-sidebar-segment";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", label);

    const buttons = items.map((item) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "simple-mind-sidebar-segment-item";
      button.dataset.value = item.value;
      button.setAttribute("aria-label", item.title);
      button.setAttribute("aria-pressed", "false");
      setIcon(button, item.icon);
      wrap.appendChild(button);
      return button;
    });

    if (options.row === false) parent.appendChild(wrap);
    else this.createSidebarRow(parent, label, wrap);
    return buttons;
  }

  /** Adds a color picker with a reset-to-theme button. */
  private createSidebarColor(
    section: HTMLElement,
    label: string,
    onChange: (value: string | undefined) => void,
  ): SidebarColorControl {
    const doc = this.sidebarEl.ownerDocument;
    const wrap = doc.createElement("span");
    wrap.className = "simple-mind-sidebar-colors";

    const input = doc.createElement("input");
    input.type = "color";
    input.className = "simple-mind-sidebar-color";
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => onChange(input.value));

    const reset = doc.createElement("button");
    reset.type = "button";
    reset.className = "simple-mind-sidebar-reset";
    reset.setAttribute("aria-label", t("sidebar.resetColor"));
    setIcon(reset, "reset");
    reset.addEventListener("click", () => onChange(undefined));

    wrap.append(input, reset);
    this.createSidebarRow(section, label, wrap);
    return { input, reset };
  }

  /** Rebuilds the theme choices in the sidebar. */
  private syncThemeOptions(): void {
    if (!this.sidebarThemeSelect) return;
    const options = [...BUILT_IN_THEMES, ...this.settings.customThemes];
    const current = this.controller?.getDocument().meta.theme ?? this.settings.defaultTheme;
    this.sidebarThemeSelect.replaceChildren();
    for (const theme of options) {
      const option = this.sidebarEl.ownerDocument.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      this.sidebarThemeSelect.appendChild(option);
    }
    this.sidebarThemeSelect.value = options.some((theme) => theme.id === current)
      ? current
      : DEFAULT_MINDMAP_META.theme;
    this.sizeSelect(this.sidebarThemeSelect);
  }

  /** Synchronizes sidebar controls with the file metadata and selected node. */
  private syncSidebar(): void {
    if (!this.sidebarThemeSelect) return;
    const meta = this.controller?.getDocument().meta;
    const tokens = this.activeTokens();
    const node = this.getSelectedNode();
    const isRoot = node ? this.controller?.isRoot(node.id) === true : false;
    const visual = nodeVisual(tokens, node?.style, isRoot);
    const style = node?.style ?? {};
    const hasSelection = node !== null;

    this.syncThemeOptions();
    this.setTileActive(this.sidebarLayoutButtons, meta?.layout ?? this.settings.defaultLayout);
    this.setTileActive(this.sidebarConnectorButtons, meta?.connectorStyle ?? tokens.branch.style);

    this.setTileActive(this.sidebarShapeButtons, visual.shape);
    this.syncColorControl(this.sidebarNodeFill, hasSelection, style.fill, visual.background);
    this.syncColorControl(this.sidebarNodeBorder, hasSelection, style.borderColor, visual.border);
    this.syncStepper(this.sidebarNodeBorderWidth, visual.borderWidth);
    this.syncStepper(this.sidebarFontSize, visual.fontSize);
    this.syncColorControl(this.sidebarTextColor, hasSelection, style.textColor, visual.text);
    this.syncToggle(this.sidebarBoldButton, style.bold, visual.fontWeight >= 600);
    this.syncToggle(this.sidebarItalicButton, style.italic, visual.fontStyle === "italic");
    this.syncToggle(
      this.sidebarUnderlineButton,
      style.underline,
      visual.textDecoration === "underline",
    );
    this.setTileActive(this.sidebarTextAlignButtons, visual.textAlign);
    this.syncStepper(this.sidebarLineHeight, visual.lineHeight);

    this.setNodeStyleControlsEnabled(hasSelection);
    this.sidebarNodeHint.hidden = hasSelection;
    this.sidebarTextHint.hidden = hasSelection;
  }

  /** Returns the base theme tokens, without the file's own overrides. */
  private activeTokens(): ThemeTokens {
    return tokensForMode(this.theme, this.dark);
  }

  /** Returns the values the selected node would get without any override. */
  private effectiveVisual(): NodeVisual {
    const node = this.getSelectedNode();
    const isRoot = node ? this.controller?.isRoot(node.id) === true : false;
    return nodeVisual(this.activeTokens(), undefined, isRoot);
  }

  /** Drops an override when the new value matches what the theme already gives. */
  private withoutOverride<T extends string | number>(value: T, themeValue: T): T | undefined {
    return value === themeValue ? undefined : value;
  }

  /** Marks the tile that matches the effective value. */
  private setTileActive(buttons: HTMLButtonElement[], value: string): void {
    for (const button of buttons) {
      const active = button.dataset.value === value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  /** Shows the effective value in a numeric field. */
  private syncStepper(stepper: SidebarStepper, value: number): void {
    stepper.value = value;
    stepper.input.value = formatNumber(value);
  }

  /** Shows an on/off state that follows the override, then the theme. */
  private syncToggle(
    button: HTMLButtonElement,
    override: boolean | undefined,
    effective: boolean,
  ): void {
    const active = override ?? effective;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  /** Returns the selected live node, if any. */
  private getSelectedNode(): MindNode | null {
    if (!this.controller || !this.selectedId) return null;
    return this.controller.findNode(this.selectedId);
  }

  /** Enables or disables controls that require a selected node. */
  private setNodeStyleControlsEnabled(enabled: boolean): void {
    const buttons = [...this.sidebarShapeButtons, ...this.sidebarTextAlignButtons];
    buttons.push(this.sidebarBoldButton, this.sidebarItalicButton, this.sidebarUnderlineButton);
    for (const button of buttons) button.disabled = !enabled;

    for (const stepper of [
      this.sidebarNodeBorderWidth,
      this.sidebarFontSize,
      this.sidebarLineHeight,
    ]) {
      stepper.input.disabled = !enabled;
      stepper.up.disabled = !enabled;
      stepper.down.disabled = !enabled;
    }
  }

  /** Shows the effective color and enables reset only for an available override. */
  private syncColorControl(
    control: SidebarColorControl,
    enabled: boolean,
    override: string | undefined,
    fallback: string,
  ): void {
    control.input.disabled = !enabled;
    control.input.value = resolveColorInput(override ?? fallback, this.rootEl);
    control.reset.disabled = !enabled || override === undefined;
  }

  /** Applies per-file metadata changes and redraws. */
  private updateMetaAndRender(patch: Partial<MindMapMeta>): void {
    const controller = this.controller;
    if (!controller || !controller.updateMeta(patch)) return;
    this.applyCurrentTheme();
    this.rerenderSoon();
    this.syncSidebar();
    this.updateToolbar();
  }

  /** Applies a style patch to the selected node and redraws. */
  private updateSelectedNodeStyle(patch: Partial<NodeStyle>): void {
    const controller = this.controller;
    const nodeId = this.selectedId;
    if (!controller || !nodeId) return;
    if (!controller.updateNodeStyle(nodeId, patch)) {
      this.syncSidebar();
      return;
    }

    this.rerenderSoon();
    this.syncSidebar();
    this.updateToolbar();
  }

  /** Resolves the base theme plus connector shape and global style defaults. */
  private applyCurrentTheme(): void {
    const document = this.controller?.getDocument();
    const base = resolveTheme(
      document?.meta.theme ?? this.settings.defaultTheme,
      this.settings.customThemes,
    );
    this.theme = base;
    const effective = document ? applyMetaOverrides(base, document.meta, this.settings) : base;
    this.dark = isDarkDocument(this.rootEl.ownerDocument);
    applyTheme(this.rootEl, effective, this.dark);
    this.renderer.setTheme(effective, this.dark);
  }

  /** Switches the file theme and saves the new frontmatter. */
  private changeTheme(themeId: string): void {
    const controller = this.controller;
    if (!controller || !controller.updateMeta({ theme: themeId })) return;

    this.applyCurrentTheme();
    this.rerender(false);
    this.syncSidebar();
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Reapplies the theme after Obsidian changes its light/dark mode. */
  refreshTheme(): void {
    this.applyCurrentTheme();
    this.rerender(false);
    this.syncSidebar();
    this.updateToolbar();
  }

  /** Shows or hides the style sidebar. */
  private toggleSidebar(): void {
    this.sidebarEl.hidden = !this.sidebarEl.hidden;
    this.updateToolbar();
  }

  /** Removes the renderer and map DOM. */
  destroy(): void {
    this.cancelEditorLayout();
    this.cancelRender();
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
      this.onNotice(t("notice.rootDelete"));
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
      this.onNotice(t("notice.rootCut"));
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
      this.onNotice(t("notice.clipboardEmpty"));
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
      style: node.style ? { ...node.style } : undefined,
      side: node.side,
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

  /** Fits the map into the canvas. */
  fit(): void {
    this.renderer.fit();
  }

  /** Returns true when editing commands are allowed. */
  canEdit(): boolean {
    return !this.readOnly && !!this.controller && !this.editor.isOpen();
  }

  /** Returns true when the current selection can be deleted. */
  canDeleteSelected(): boolean {
    return (
      this.canEdit() && !!this.selectedId && this.controller?.isRoot(this.selectedId) === false
    );
  }

  /** Returns true when undo is available. */
  canUndo(): boolean {
    return this.canEdit() && this.controller?.canUndo() === true;
  }

  /** Returns true when redo is available. */
  canRedo(): boolean {
    return this.canEdit() && this.controller?.canRedo() === true;
  }

  /**
   * Creates one icon button in the floating menu.
   *
   * @param menu Menu element that receives the button.
   * @param label Accessible label.
   * @param icon Icon to draw.
   * @param action Click action.
   */
  private createToolbarButton(
    menu: HTMLElement,
    label: string,
    icon: IconName,
    action: () => void,
  ): HTMLButtonElement {
    const button = menu.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "simple-mind-menu-button";
    button.setAttribute("aria-label", label);
    setIcon(button, icon);
    button.addEventListener("click", action);
    menu.appendChild(button);
    return button;
  }

  /** Adds a child from a floating button on either the root side or a branch. */
  private addChildFrom(nodeId: string, side: AddSide): void {
    this.beginAdd("child", nodeId, side === "down" ? undefined : side);
  }

  /** Starts a pending insertion and opens the inline editor. */
  private beginAdd(
    kind: AddKind,
    targetId: string | null = this.selectedId,
    preferredSide?: BranchSide,
  ): void {
    if (!this.canEdit() || !this.controller || !targetId) return;

    const pending = this.controller.beginAdd(kind, targetId, preferredSide);
    if (!pending) return;
    this.pendingAdd = pending;
    this.rerender(false);
    this.renderer.selectNode(pending.node.id);
    this.openEditor(pending.node.id, "", true);
  }

  /** Opens the inline editor for an existing node. */
  private startEdit(nodeId: string): void {
    if (this.readOnly || !this.controller) {
      this.onNotice(t("notice.fixErrors"));
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
      this.onNotice(t("notice.emptyLabel"));
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

  /** Toggles collapse for one node or one side of a mind-map root. */
  private toggleCollapse(nodeId: string, side: AddSide): void {
    if (!this.controller || !this.controller.toggleCollapse(nodeId, side)) return;
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
      this.onNotice(t("notice.fixErrors"));
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

  /** Mirrors the sidebar state on the style toggle. */
  private updateToolbar(): void {
    const open = !this.sidebarEl.hidden;
    this.styleButton.classList.toggle("is-active", open);
    this.styleButton.setAttribute("aria-pressed", String(open));
  }

  /** Re-renders the controller document. */
  private rerender(fit: boolean): void {
    const document = this.controller?.getDocument();
    if (document) this.renderer.render(document, { fit });
    else this.renderer.clear();
    this.updateToolbar();
  }

  /**
   * Redraws once per animation frame with whatever the source says by then.
   * Used by continuous input such as color pickers and number fields.
   */
  private rerenderSoon(): void {
    if (this.renderFrame !== null) return;
    const view = this.rootEl.ownerDocument.defaultView;
    if (!view || typeof view.requestAnimationFrame !== "function") {
      this.rerender(false);
      return;
    }
    this.renderFrame = view.requestAnimationFrame(() => {
      this.renderFrame = null;
      this.rerender(false);
    });
  }

  /** Cancels a queued frame draw. */
  private cancelRender(): void {
    if (this.renderFrame === null) return;
    this.rootEl.ownerDocument.defaultView?.cancelAnimationFrame?.(this.renderFrame);
    this.renderFrame = null;
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

/** Formats a numeric value for a sidebar input. */
function formatNumber(value: number): string {
  return String(roundToStep(value, 0.01));
}

/** Rounds a stepped value so decimal steps keep exact labels. */
function roundToStep(value: number, step: number): number {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number(value.toFixed(decimals));
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i;

/** Expands a hex color into the six-digit form required by color inputs. */
function normalizeHex(value: string): string | null {
  if (!HEX_COLOR.test(value)) return null;
  if (value.length === 7) return value.toLowerCase();
  const [, r, g, b] = value;
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
}

/** Resolves a token color, including CSS variables, into a color input value. */
function resolveColorInput(value: string, host: HTMLElement): string {
  const direct = normalizeHex(value);
  if (direct) return direct;

  const win = host.ownerDocument.defaultView;
  if (!win) return COLOR_INPUT_FALLBACK;
  const probe = host.ownerDocument.createElement("span");
  probe.style.display = "none";
  probe.style.color = value;
  host.appendChild(probe);
  const computed = win.getComputedStyle(probe).color;
  probe.remove();

  const match = RGB_COLOR.exec(computed);
  if (!match) return COLOR_INPUT_FALLBACK;
  const hex = match
    .slice(1)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}
