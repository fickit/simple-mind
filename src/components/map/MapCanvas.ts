import {
  COLOR_INPUT_FALLBACK,
  INLINE_SUGGESTION_LIMIT,
  LIMITS,
  NEW_NODE_EDITOR_WIDTH,
  NODE_CONTROL_GAP,
  NODE_CONTROL_SIZE,
  NODE_CONTROL_SPACING,
} from "../../config/constants";
import { DEFAULT_MINDMAP_META, DEFAULT_SETTINGS, metaFromSettings } from "../../config/defaults";
import { t } from "../../config/i18n";
import type { InlineResourceHost } from "../../types/inline";
import type { BranchSide, LayoutKind, MindMapMeta, MindNode, NodeStyle } from "../../types/mindmap";
import type { SimpleMindSettings } from "../../types/settings";
import type {
  ConnectorStyle,
  NodeShape,
  TextAlign,
  ThemeDefinition,
  ThemeTokens,
} from "../../types/theme";
import type { MapViewState } from "../../types/view";
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
  /** Resolves note links and vault images inside node labels. */
  inlineResources?: InlineResourceHost;
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
  private readonly inlineResources?: InlineResourceHost;
  private lightbox: HTMLElement | null = null;
  private readonly fitButton: HTMLButtonElement;
  private readonly sourceButton: HTMLButtonElement;
  private readonly styleButton: HTMLButtonElement;
  private sidebarPane!: HTMLElement;
  private sidebarLabelSeq = 0;
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
  private marquee: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
    element: HTMLElement;
  } | null = null;
  private altPan: { lastX: number; lastY: number } | null = null;
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
    this.inlineResources = options.inlineResources;
    this.settings = options.settings ?? DEFAULT_SETTINGS;
    this.dark = isDarkDocument(doc);

    this.rootEl = createDiv();
    this.rootEl.className = "simple-mind-map";
    this.rootEl.style.setProperty("--sm-control-size", `${NODE_CONTROL_SIZE}px`);
    this.rootEl.style.setProperty("--sm-control-gap", `${NODE_CONTROL_GAP}px`);
    this.rootEl.style.setProperty("--sm-control-spacing", `${NODE_CONTROL_SPACING}px`);
    container.replaceChildren(this.rootEl);

    this.bannerEl = createDiv();
    this.bannerEl.className = "simple-mind-banner";
    this.bannerEl.hidden = true;
    this.bannerEl.setAttribute("role", "alert");
    this.rootEl.appendChild(this.bannerEl);

    this.contentRow = createDiv();
    this.contentRow.className = "simple-mind-content";
    this.rootEl.appendChild(this.contentRow);

    const canvasHost = createDiv();
    canvasHost.className = "simple-mind-canvas-host";
    this.contentRow.appendChild(canvasHost);

    this.canvasEl = createDiv();
    this.canvasEl.className = "simple-mind-canvas";
    canvasHost.appendChild(this.canvasEl);

    this.sidebarEl = createEl("aside");
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
      inlineResources: options.inlineResources,
      onImageOpen: (src, alt) => this.openImage(src, alt),
    });
    this.editor = new InlineEditor(this.renderer.getWorldElement());
    this.drag = new DragController(this.canvasEl, {
      isDraggable: (nodeId) => this.canEdit() && this.controller?.isRoot(nodeId) === false,
      canDrop: (sourceId, targetId) => this.controller?.canMove(sourceId, targetId) ?? false,
      isRoot: (nodeId) => this.controller?.isRoot(nodeId) ?? true,
      isCollapsed: (nodeId) => this.controller?.findNode(nodeId)?.collapsed ?? false,
      expand: (nodeId) => this.expandNode(nodeId),
      drop: (sourceId, targetId, position) => this.dropNode(sourceId, targetId, position),
      panBy: (dx, dy) => this.renderer.panBy(dx, dy),
    });

    const menu = createDiv();
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
    this.canvasEl.addEventListener("pointerdown", this.onMarqueeDown, true);
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

  /** Applies Ctrl/Cmd+B/I/U and alignment shortcuts to the selected node. */
  private handleTextStyleShortcut(event: KeyboardEvent): boolean {
    if (event.altKey) return false;
    const key = event.key.toLowerCase();
    if (!event.shiftKey) {
      if (key === "b") return this.toggleTextStyle("bold");
      if (key === "i") return this.toggleTextStyle("italic");
      if (key === "u") return this.toggleTextStyle("underline");
      return false;
    }

    const align: TextAlign | null =
      key === "l" ? "left" : key === "e" ? "center" : key === "r" ? "right" : null;
    if (!align) return false;
    this.updateSelectedNodeStyle({ textAlign: align });
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  /** Toggles one text style on the selected node. */
  private toggleTextStyle(kind: "bold" | "italic" | "underline"): boolean {
    const visual = this.selectedNodeVisual();
    if (kind === "bold") this.updateSelectedNodeStyle({ bold: visual.fontWeight < 600 });
    else if (kind === "italic") {
      this.updateSelectedNodeStyle({ italic: visual.fontStyle !== "italic" });
    } else {
      this.updateSelectedNodeStyle({ underline: visual.textDecoration !== "underline" });
    }
    return true;
  }

  /** Appends the platform modifier to an icon tooltip. */
  private shortcutLabel(label: string, keys: string): string {
    const mod = /Mac/i.test(navigator.userAgent) ? "Cmd" : "Ctrl";
    return `${label} (${mod}+${keys})`;
  }

  /** Returns the effective visual of the selected node. */
  private selectedNodeVisual(): NodeVisual {
    const node = this.getSelectedNode();
    const isRoot = node ? this.controller?.isRoot(node.id) === true : false;
    return nodeVisual(this.activeTokens(), node?.style, isRoot);
  }

  /** Returns the selected node id. */
  getSelectedId(): string | null {
    return this.selectedId;
  }

  /** Returns every selected node id. */
  getSelectedIds(): string[] {
    return this.renderer.getSelectedIds();
  }

  /** Returns the pan, zoom, and selection to persist with the file. */
  getViewState(): MapViewState {
    const { x, y, scale } = this.renderer.getTransform();
    return { x, y, scale, selectedId: this.selectedId };
  }

  /**
   * Restores a stored pan, zoom, and selection after the source is rendered.
   *
   * @param state Snapshot previously returned by `getViewState`.
   */
  setViewState(state: MapViewState): void {
    this.renderer.setTransform(state.x, state.y, state.scale);
    const node = state.selectedId ? this.controller?.findNode(state.selectedId) : null;
    if (node) this.renderer.selectNode(node.id);
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
    this.sidebarEl.replaceChildren();

    const inner = createDiv();
    inner.className = "simple-mind-sidebar-inner";
    this.sidebarEl.appendChild(inner);

    const header = createDiv();
    header.className = "simple-mind-sidebar-header";
    const title = createSpan();
    title.textContent = t("sidebar.style");
    const close = createEl("button");
    close.type = "button";
    close.className = "simple-mind-sidebar-close";
    close.setAttribute("aria-label", t("sidebar.close"));
    setIcon(close, "close");
    close.addEventListener("click", () => this.toggleSidebar());
    header.append(title, close);
    inner.appendChild(header);

    this.sidebarSelectMirror = createSpan();
    this.sidebarSelectMirror.className = "simple-mind-sidebar-select-mirror";
    inner.appendChild(this.sidebarSelectMirror);

    this.sidebarPane = createDiv();
    this.sidebarPane.className = "simple-mind-sidebar-pane";
    inner.appendChild(this.sidebarPane);

    const themeSection = this.createSidebarSection(this.sidebarPane);
    const themeRow = createDiv();
    themeRow.className = "simple-mind-sidebar-theme-row";
    const themeTitle = createSpan();
    themeTitle.className = "simple-mind-sidebar-section-title";
    themeTitle.textContent = t("sidebar.theme");
    themeTitle.id = "simple-mind-sidebar-theme-title";
    themeRow.appendChild(themeTitle);

    this.sidebarThemeSelect = createEl("select");
    this.sidebarThemeSelect.className = "simple-mind-sidebar-select simple-mind-sidebar-theme";
    this.sidebarThemeSelect.setAttribute("aria-labelledby", themeTitle.id);
    this.sidebarThemeSelect.addEventListener("change", () => {
      this.changeTheme(this.sidebarThemeSelect.value);
    });
    themeRow.appendChild(this.sidebarThemeSelect);

    if (this.onOpenSettings) {
      const gear = createEl("button");
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
        { value: "underline", icon: "shape-line", title: t("themeEditor.shape.underline") },
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

    const textStyleStack = createSpan();
    textStyleStack.className = "simple-mind-sidebar-stack";
    const [bold, italic, underline] = this.createSidebarToggles(
      textStyleStack,
      t("sidebar.textStyle"),
      [
        { value: "bold", icon: "bold", title: this.shortcutLabel(t("sidebar.bold"), "B") },
        { value: "italic", icon: "italic", title: this.shortcutLabel(t("sidebar.italic"), "I") },
        {
          value: "underline",
          icon: "underline",
          title: this.shortcutLabel(t("sidebar.underline"), "U"),
        },
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
        {
          value: "left",
          icon: "align-left",
          title: this.shortcutLabel(t("sidebar.textAlign.left"), "Shift+L"),
        },
        {
          value: "center",
          icon: "align-center",
          title: this.shortcutLabel(t("sidebar.textAlign.center"), "Shift+E"),
        },
        {
          value: "right",
          icon: "align-right",
          title: this.shortcutLabel(t("sidebar.textAlign.right"), "Shift+R"),
        },
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
    const section = createEl("section");
    section.className = "simple-mind-sidebar-section";
    if (title) {
      const heading = createEl("h4");
      heading.textContent = title;
      section.appendChild(heading);
    }
    parent.appendChild(section);
    return section;
  }

  /** Adds a muted hint inside a section. */
  private createSidebarHint(parent: HTMLElement, text: string): HTMLElement {
    const hint = createEl("p");
    hint.className = "simple-mind-sidebar-hint";
    hint.textContent = text;
    parent.appendChild(hint);
    return hint;
  }

  /** Appends a label/control row and returns the label element. */
  private createSidebarRow(section: HTMLElement, label: string, control: HTMLElement): HTMLElement {
    const row = createDiv();
    row.className = "simple-mind-sidebar-row";
    const span = createSpan();
    span.textContent = label;
    this.sidebarLabelSeq += 1;
    span.id = `simple-mind-sidebar-label-${this.sidebarLabelSeq}`;
    row.append(span, control);
    section.appendChild(row);
    return span;
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
    const wrap = createSpan();
    wrap.className = "simple-mind-sidebar-stepper";

    const input = createEl("input");
    input.type = "number";
    input.min = String(options.min);
    input.max = String(options.max);
    input.step = String(options.step);
    input.className = "simple-mind-sidebar-number";

    const arrows = createSpan();
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
    const labelEl = this.createSidebarRow(section, label, wrap);
    input.setAttribute("aria-labelledby", labelEl.id);
    return stepper;
  }

  /** Creates one arrow button inside a stepper. */
  private createSidebarStepButton(label: string, icon: IconName): HTMLButtonElement {
    const button = createEl("button");
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
    const wrap = createDiv();
    wrap.className =
      options.row === false ? "simple-mind-sidebar-segment is-bare" : "simple-mind-sidebar-segment";
    wrap.setAttribute("role", "group");
    wrap.dataset.group = label;

    const buttons = items.map((item) => {
      const button = createEl("button");
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
    else {
      const labelEl = this.createSidebarRow(parent, label, wrap);
      wrap.setAttribute("aria-labelledby", labelEl.id);
    }
    return buttons;
  }

  /** Hides a labeled row whose control cannot affect the current shape. */
  private setRowHidden(control: HTMLElement, hidden: boolean): void {
    const row = control.closest<HTMLElement>(".simple-mind-sidebar-row");
    if (row) row.hidden = hidden;
  }

  /** Adds a color picker with a reset-to-theme button. */
  private createSidebarColor(
    section: HTMLElement,
    label: string,
    onChange: (value: string | undefined) => void,
  ): SidebarColorControl {
    const wrap = createSpan();
    wrap.className = "simple-mind-sidebar-colors";

    const input = createEl("input");
    input.type = "color";
    input.className = "simple-mind-sidebar-color";
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => onChange(input.value));

    const reset = createEl("button");
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
      const option = createEl("option");
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
    const lineNode = visual.shape === "underline";
    this.setRowHidden(this.sidebarNodeFill.input, lineNode);
    this.setRowHidden(this.sidebarNodeBorder.input, lineNode);
    this.setRowHidden(this.sidebarNodeBorderWidth.input, lineNode);
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
    this.sidebarEl.classList.toggle("is-collapsed");
    this.updateToolbar();
  }

  /** Opens an inline image in the view's lightbox. */
  private openImage(src: string, alt: string): void {
    this.closeImage();
    const overlay = createDiv();
    overlay.className = "simple-mind-lightbox";
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-description", alt || t("lightbox.close"));

    const image = createEl("img");
    image.className = "simple-mind-lightbox-image";
    image.src = src;
    image.alt = alt;

    const close = createEl("button");
    close.type = "button";
    close.className = "simple-mind-lightbox-close";
    close.setAttribute("aria-label", t("lightbox.close"));
    setIcon(close, "close");
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      this.closeImage();
    });

    overlay.append(image, close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeImage();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.closeImage();
    });
    this.rootEl.appendChild(overlay);
    this.lightbox = overlay;
    overlay.focus();
  }

  /** Closes the image lightbox. */
  private closeImage(): void {
    if (!this.lightbox) return;
    this.lightbox.remove();
    this.lightbox = null;
    this.canvasEl.focus();
  }

  /** Removes the renderer and map DOM. */
  destroy(): void {
    this.cancelEditorLayout();
    this.cancelRender();
    this.closeImage();
    this.drag.destroy();
    this.editor.close();
    this.renderer.setEditingNode(null);
    this.canvasEl.removeEventListener("keydown", this.keydownHandler);
    this.canvasEl.removeEventListener("pointerdown", this.onMarqueeDown, true);
    this.cancelCanvasDrag();
    this.cancelAltPan();
    this.renderer.destroy();
    this.rootEl.remove();
  }

  /** Starts a marquee on empty canvas. */
  private readonly onMarqueeDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (event.altKey) {
      this.startAltPan(event, target);
      return;
    }
    if (target?.closest(".simple-mind-node, button, a, input, textarea, select")) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const rect = this.canvasEl.getBoundingClientRect();
    const element = createDiv();
    element.className = "simple-mind-marquee";
    this.canvasEl.appendChild(element);
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    this.marquee = { startX, startY, currentX: startX, currentY: startY, additive, element };
    if (!additive) this.renderer.selectNode(null);
    this.renderer.previewNodes([]);
    this.updateMarquee();

    const view = this.rootEl.ownerDocument.defaultView;
    view?.addEventListener("pointermove", this.onMarqueeMove);
    view?.addEventListener("pointerup", this.onMarqueeUp);
    view?.addEventListener("pointercancel", this.onMarqueeUp);
  };

  /** Resizes the marquee and previews the nodes it covers. */
  private readonly onMarqueeMove = (event: PointerEvent): void => {
    const marquee = this.marquee;
    if (!marquee) return;
    event.preventDefault();
    const rect = this.canvasEl.getBoundingClientRect();
    marquee.currentX = event.clientX - rect.left;
    marquee.currentY = event.clientY - rect.top;
    this.updateMarquee();
    this.renderer.previewNodes(this.marqueeHits(marquee));
  };

  /** Applies a marquee selection and removes the rectangle. */
  private readonly onMarqueeUp = (): void => {
    const marquee = this.marquee;
    if (!marquee) return;
    this.clearCanvasDrag();
    this.renderer.previewNodes([]);

    this.suppressNextClick();

    const width = Math.abs(marquee.currentX - marquee.startX);
    const height = Math.abs(marquee.currentY - marquee.startY);
    if (width < 3 && height < 3) {
      if (!marquee.additive) this.renderer.selectNode(null);
      this.renderer.focus();
      return;
    }
    this.applyMarquee(marquee);
  };

  /** Paints the marquee rectangle from its two corners. */
  private updateMarquee(): void {
    const marquee = this.marquee;
    if (!marquee) return;
    const { startX, startY, currentX, currentY, element } = marquee;
    element.style.left = `${Math.min(startX, currentX)}px`;
    element.style.top = `${Math.min(startY, currentY)}px`;
    element.style.width = `${Math.abs(currentX - startX)}px`;
    element.style.height = `${Math.abs(currentY - startY)}px`;
  }

  /** Returns the visible nodes intersecting the marquee rectangle. */
  private marqueeHits(marquee: NonNullable<MapCanvas["marquee"]>): string[] {
    const transform = this.renderer.getTransform();
    const left = (Math.min(marquee.startX, marquee.currentX) - transform.x) / transform.scale;
    const top = (Math.min(marquee.startY, marquee.currentY) - transform.y) / transform.scale;
    const right = (Math.max(marquee.startX, marquee.currentX) - transform.x) / transform.scale;
    const bottom = (Math.max(marquee.startY, marquee.currentY) - transform.y) / transform.scale;
    return this.renderer
      .getLayoutNodes()
      .filter(
        (node) =>
          node.x < right &&
          node.x + node.width > left &&
          node.y < bottom &&
          node.y + node.height > top,
      )
      .map((node) => node.node.id);
  }

  /** Selects the visible nodes inside the marquee rectangle. */
  private applyMarquee(marquee: NonNullable<MapCanvas["marquee"]>): void {
    const hits = this.marqueeHits(marquee);
    if (hits.length === 0) {
      if (!marquee.additive) this.renderer.selectNode(null);
      return;
    }

    const selected = marquee.additive ? new Set(this.renderer.getSelectedIds()) : new Set<string>();
    for (const nodeId of hits) selected.add(nodeId);
    this.renderer.selectNodes([...selected], hits.at(-1) ?? null);
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Starts an Alt+drag canvas pan. */
  private startAltPan(event: PointerEvent, target: HTMLElement | null): void {
    if (target?.closest("input, textarea, select, button")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.altPan = { lastX: event.clientX, lastY: event.clientY };
    this.canvasEl.classList.add("is-panning");
    const view = this.rootEl.ownerDocument.defaultView;
    view?.addEventListener("pointermove", this.onAltPanMove);
    view?.addEventListener("pointerup", this.onAltPanUp);
    view?.addEventListener("pointercancel", this.onAltPanUp);
  }

  /** Pans with an Alt+drag. */
  private readonly onAltPanMove = (event: PointerEvent): void => {
    if (!this.altPan) return;
    event.preventDefault();
    this.renderer.panBy(event.clientX - this.altPan.lastX, event.clientY - this.altPan.lastY);
    this.altPan.lastX = event.clientX;
    this.altPan.lastY = event.clientY;
  };

  /** Ends an Alt+drag pan and suppresses its trailing click. */
  private readonly onAltPanUp = (): void => {
    if (!this.altPan) return;
    this.cancelAltPan();
    this.suppressNextClick();
    this.renderer.focus();
  };

  /** Removes Alt+drag listeners and state. */
  private cancelAltPan(): void {
    const view = this.rootEl.ownerDocument.defaultView;
    view?.removeEventListener("pointermove", this.onAltPanMove);
    view?.removeEventListener("pointerup", this.onAltPanUp);
    view?.removeEventListener("pointercancel", this.onAltPanUp);
    this.altPan = null;
    this.canvasEl.classList.remove("is-panning");
  }

  /** Stops the click that follows a pan or marquee drag. */
  private suppressNextClick(): void {
    const suppress = (event: Event): void => event.stopImmediatePropagation();
    this.canvasEl.addEventListener("click", suppress, true);
    this.rootEl.ownerDocument.defaultView?.setTimeout(() => {
      this.canvasEl.removeEventListener("click", suppress, true);
    }, 0);
  }

  /** Removes the marquee DOM and its window listeners. */
  private clearCanvasDrag(): void {
    const view = this.rootEl.ownerDocument.defaultView;
    view?.removeEventListener("pointermove", this.onMarqueeMove);
    view?.removeEventListener("pointerup", this.onMarqueeUp);
    view?.removeEventListener("pointercancel", this.onMarqueeUp);
    this.marquee?.element.remove();
    this.marquee = null;
  }

  /** Stops an in-flight canvas drag without applying it. */
  private cancelCanvasDrag(): void {
    this.clearCanvasDrag();
    this.renderer.previewNodes([]);
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
    const controller = this.controller;
    if (!this.canEdit() || !controller) return;
    const ids = this.renderer.getSelectedIds();
    const deletable = ids.filter((nodeId) => !controller.isRoot(nodeId));
    if (deletable.length === 0) {
      if (ids.some((nodeId) => controller.isRoot(nodeId))) {
        this.onNotice(t("notice.rootDelete"));
      }
      return;
    }

    const selected = new Set(deletable);
    let parentId = this.selectedId
      ? (controller.findParent(this.selectedId)?.parent.id ?? null)
      : null;
    while (parentId && selected.has(parentId)) {
      parentId = controller.findParent(parentId)?.parent.id ?? null;
    }

    controller.deleteNodes(deletable);
    this.renderer.setEditingNode(null);
    this.rerender(false);
    this.renderer.selectNode(parentId);
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Deletes one node and selects its parent. */
  private deleteNodeById(nodeId: string): void {
    const controller = this.controller;
    if (!controller) return;
    const parentId = controller.findParent(nodeId)?.parent.id ?? null;
    controller.deleteNode(nodeId);
    this.renderer.setEditingNode(null);
    this.rerender(false);
    this.renderer.selectNode(parentId);
    this.renderer.focus();
    this.updateToolbar();
  }

  /** Edits the selected node. */
  editSelected(): void {
    if (this.selectedId) this.startEdit(this.selectedId);
  }

  /** Copies the selected subtrees into the internal and system clipboards. */
  private copySelected(): void {
    const controller = this.controller;
    if (!controller) return;
    const ids = this.renderer.getSelectedIds();
    if (ids.length === 0) return;

    let copied: CopiedNode[] = [];
    if (ids.length === 1 && controller.isRoot(ids[0])) {
      const root = controller.copySubtree(ids[0]);
      copied = root ? [root] : [];
    } else {
      copied = controller.copySubtrees(ids);
    }
    if (copied.length === 0) return;

    this.clipboard = copied;
    const text = copied.map((item) => this.serializeCopiedText(item)).join("\n");
    const clipboard = this.rootEl.ownerDocument.defaultView?.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      void clipboard.writeText(text).catch(() => {});
    }
  }

  /** Cuts the selected subtrees. The root is protected. */
  private cutSelected(): void {
    const controller = this.controller;
    if (!controller) return;
    const ids = this.renderer.getSelectedIds();
    if (ids.length === 0) return;
    if (ids.every((nodeId) => controller.isRoot(nodeId))) {
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
    const controller = this.controller;
    if (!this.canEdit() || !controller) return false;
    return this.renderer.getSelectedIds().some((nodeId) => !controller.isRoot(nodeId));
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
    const button = createEl("button");
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

  /**
   * Starts editing the selected node from a typed key.
   *
   * Space keeps the label and puts the caret at the end; any other key
   * replaces the label with that character.
   *
   * @param seed Typed character, or null for Space (append mode).
   */
  private startTyping(seed: string | null): void {
    const nodeId = this.selectedId;
    if (!nodeId || this.readOnly || !this.controller) return;
    const node = this.controller.findNode(nodeId);
    if (!node) return;
    this.openEditor(nodeId, seed ?? node.text, false, false);
  }

  /** Positions the input over a node and wires commit/cancel. */
  private openEditor(nodeId: string, text: string, isNew: boolean, selectAll = true): void {
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
        selectAll,
        suggest: (kind, query) =>
          this.inlineResources?.suggest(kind, query, INLINE_SUGGESTION_LIMIT) ?? [],
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
      if (controller.isRoot(nodeId)) {
        this.onNotice(t("notice.emptyLabel"));
        this.renderer.setEditingNode(null);
        this.rerender(false);
        this.renderer.selectNode(nodeId);
        this.renderer.focus();
        return;
      }
      this.deleteNodeById(nodeId);
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

    const focused = event.target as HTMLElement | null;
    const inlineLink = focused?.closest?.<HTMLElement>(".simple-mind-inline-link[data-link]");
    if (inlineLink?.dataset.link && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      this.inlineResources?.openNote(inlineLink.dataset.link);
      return;
    }

    const mod = event.metaKey || event.ctrlKey;
    if (mod && this.handleTextStyleShortcut(event)) return;
    if (mod && event.key.toLowerCase() === "a") {
      event.preventDefault();
      const ids = this.renderer.getLayoutNodes().map((node) => node.node.id);
      this.renderer.selectNodes(ids);
      this.renderer.focus();
      this.updateToolbar();
      return;
    }
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
      return;
    }
    if (this.selectedId !== null && event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      this.startTyping(event.key === " " ? null : event.key);
    }
  }

  /** Mirrors the sidebar state on the style toggle. */
  private updateToolbar(): void {
    const open = !this.sidebarEl.classList.contains("is-collapsed");
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
  const probe = createSpan();
  probe.className = "simple-mind-color-probe";
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
