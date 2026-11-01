import { COLOR_INPUT_FALLBACK, LIMITS, NEW_NODE_EDITOR_WIDTH } from "../../config/constants";
import { DEFAULT_SETTINGS, metaFromSettings } from "../../config/defaults";
import { t } from "../../config/i18n";
import type {
  BranchSide,
  LayoutKind,
  MindMapMeta,
  MindNode,
  NodeAlignment,
  NodeStyle,
  TreeDirection,
} from "../../types/mindmap";
import type { SimpleMindSettings } from "../../types/settings";
import type { ConnectorStyle, NodeShape, TextAlign, ThemeDefinition } from "../../types/theme";
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
import { type AddSide, MapRenderer } from "./engine/render/MapRenderer";
import { applyTheme, tokensForMode } from "./themes/applyTheme";
import { nodeVisual } from "./themes/nodeVisual";
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

/** Sidebar tabs. */
type SidebarTab = "style" | "text";

/** A color picker paired with a reset button. */
interface SidebarColorControl {
  input: HTMLInputElement;
  reset: HTMLButtonElement;
}

/** Options for a sidebar number input. */
interface SidebarNumberOptions {
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  step?: number;
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
  private effectiveTheme: ThemeDefinition = OBSIDIAN_THEME;
  private activeTab: SidebarTab = "style";
  private settings: SimpleMindSettings;
  private readonly onSource: () => void;
  private readonly onChangeSource: (source: string) => void;
  private readonly onNotice: (message: string) => void;
  private readonly onOpenSettings?: () => void;
  private readonly childButton: HTMLButtonElement;
  private readonly siblingButton: HTMLButtonElement;
  private readonly deleteButton: HTMLButtonElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private readonly fitButton: HTMLButtonElement;
  private readonly sourceButton: HTMLButtonElement;
  private readonly zoomInButton: HTMLButtonElement;
  private readonly zoomOutButton: HTMLButtonElement;
  private readonly styleButton: HTMLButtonElement;
  private sidebarStylePane!: HTMLElement;
  private sidebarTextPane!: HTMLElement;
  private readonly sidebarTabs = new Map<SidebarTab, HTMLButtonElement>();
  private sidebarThemeSelect!: HTMLSelectElement;
  private sidebarLayoutSelect!: HTMLSelectElement;
  private sidebarDirectionSelect!: HTMLSelectElement;
  private sidebarAlignSelect!: HTMLSelectElement;
  private sidebarCompactInput!: HTMLInputElement;
  private sidebarNodeHint!: HTMLElement;
  private sidebarTextHint!: HTMLElement;
  private sidebarNodeShapeSelect!: HTMLSelectElement;
  private sidebarNodeFill!: SidebarColorControl;
  private sidebarNodeBorder!: SidebarColorControl;
  private sidebarNodeBorderWidthInput!: HTMLInputElement;
  private sidebarConnectorSelect!: HTMLSelectElement;
  private sidebarFontFamilyInput!: HTMLInputElement;
  private sidebarFontSizeInput!: HTMLInputElement;
  private sidebarTextColor!: SidebarColorControl;
  private sidebarBoldInput!: HTMLInputElement;
  private sidebarItalicInput!: HTMLInputElement;
  private sidebarUnderlineInput!: HTMLInputElement;
  private sidebarTextAlignSelect!: HTMLSelectElement;
  private sidebarLineHeightInput!: HTMLInputElement;
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
    container.replaceChildren(this.rootEl);

    const toolbar = doc.createElement("div");
    toolbar.className = "simple-mind-toolbar";
    this.rootEl.appendChild(toolbar);

    this.bannerEl = doc.createElement("div");
    this.bannerEl.className = "simple-mind-banner";
    this.bannerEl.hidden = true;
    this.bannerEl.setAttribute("role", "alert");
    this.rootEl.appendChild(this.bannerEl);

    this.contentRow = doc.createElement("div");
    this.contentRow.className = "simple-mind-content";
    this.rootEl.appendChild(this.contentRow);

    this.canvasEl = doc.createElement("div");
    this.canvasEl.className = "simple-mind-canvas-host";
    this.contentRow.appendChild(this.canvasEl);

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

    this.fitButton = this.createToolbarButton(toolbar, t("toolbar.fit"), () => this.renderer.fit());
    this.zoomOutButton = this.createToolbarButton(toolbar, "−", () => this.renderer.zoomBy(0.8));
    this.zoomInButton = this.createToolbarButton(toolbar, "+", () => this.renderer.zoomBy(1.2));
    this.zoomOutButton.setAttribute("aria-label", t("toolbar.zoomOut"));
    this.zoomInButton.setAttribute("aria-label", t("toolbar.zoomIn"));
    this.createToolbarDivider(toolbar);
    this.childButton = this.createToolbarButton(toolbar, t("toolbar.addChild"), () =>
      this.addChild(),
    );
    this.siblingButton = this.createToolbarButton(toolbar, t("toolbar.addSibling"), () =>
      this.addSibling(),
    );
    this.deleteButton = this.createToolbarButton(toolbar, t("toolbar.delete"), () =>
      this.deleteSelected(),
    );
    this.createToolbarDivider(toolbar);
    this.undoButton = this.createToolbarButton(toolbar, t("toolbar.undo"), () => this.undo());
    this.redoButton = this.createToolbarButton(toolbar, t("toolbar.redo"), () => this.redo());
    this.createToolbarDivider(toolbar);
    this.styleButton = this.createToolbarButton(toolbar, t("toolbar.style"), () =>
      this.toggleSidebar(),
    );
    const spacer = doc.createElement("span");
    spacer.className = "simple-mind-toolbar-spacer";
    toolbar.appendChild(spacer);
    this.sourceButton = this.createToolbarButton(toolbar, t("toolbar.source"), this.onSource);

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

  /** Updates toolbar labels after a language change. */
  refreshLanguage(): void {
    this.fitButton.textContent = t("toolbar.fit");
    this.zoomOutButton.setAttribute("aria-label", t("toolbar.zoomOut"));
    this.zoomInButton.setAttribute("aria-label", t("toolbar.zoomIn"));
    this.childButton.textContent = t("toolbar.addChild");
    this.siblingButton.textContent = t("toolbar.addSibling");
    this.deleteButton.textContent = t("toolbar.delete");
    this.undoButton.textContent = t("toolbar.undo");
    this.redoButton.textContent = t("toolbar.redo");
    this.sourceButton.textContent = t("toolbar.source");
    this.styleButton.textContent = t("toolbar.style");
    this.buildSidebar();
    this.syncSidebar();
    if (this.controller) this.rerender(false);
  }

  /** Rebuilds sidebar controls so labels follow the active language. */
  private buildSidebar(): void {
    const doc = this.sidebarEl.ownerDocument;
    this.sidebarEl.replaceChildren();
    this.sidebarTabs.clear();

    const header = doc.createElement("div");
    header.className = "simple-mind-sidebar-header";
    const title = doc.createElement("span");
    title.textContent = t("sidebar.style");
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "simple-mind-sidebar-close";
    close.textContent = "×";
    close.setAttribute("aria-label", t("sidebar.close"));
    close.addEventListener("click", () => this.toggleSidebar());
    header.append(title, close);
    this.sidebarEl.appendChild(header);

    const tabs = doc.createElement("div");
    tabs.className = "simple-mind-sidebar-tabs";
    tabs.setAttribute("role", "tablist");
    const definitions: Array<{ id: SidebarTab; label: string }> = [
      { id: "style", label: t("sidebar.style") },
      { id: "text", label: t("sidebar.text") },
    ];
    for (const definition of definitions) {
      const tab = doc.createElement("button");
      tab.type = "button";
      tab.className = "simple-mind-sidebar-tab";
      tab.textContent = definition.label;
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => this.setSidebarTab(definition.id));
      this.sidebarTabs.set(definition.id, tab);
      tabs.appendChild(tab);
    }
    this.sidebarEl.appendChild(tabs);

    this.sidebarStylePane = this.createSidebarPane("style");
    this.sidebarTextPane = this.createSidebarPane("text");

    const themeSection = this.createSidebarSection(this.sidebarStylePane, t("sidebar.theme"));
    this.sidebarThemeSelect = doc.createElement("select");
    this.sidebarThemeSelect.className = "simple-mind-sidebar-select simple-mind-sidebar-theme";
    this.sidebarThemeSelect.setAttribute("aria-label", t("sidebar.theme"));
    this.sidebarThemeSelect.addEventListener("change", () => {
      this.changeTheme(this.sidebarThemeSelect.value);
    });
    themeSection.appendChild(this.sidebarThemeSelect);
    if (this.onOpenSettings) {
      const manage = doc.createElement("button");
      manage.type = "button";
      manage.className = "simple-mind-sidebar-button";
      manage.textContent = t("sidebar.manageThemes");
      manage.addEventListener("click", () => this.onOpenSettings?.());
      themeSection.appendChild(manage);
    }

    const layoutSection = this.createSidebarSection(this.sidebarStylePane, t("sidebar.layout"));
    this.sidebarLayoutSelect = this.createSidebarSelect(
      layoutSection,
      t("sidebar.layoutType"),
      [
        { value: "mindmap", label: t("settings.layout.mindmap") },
        { value: "tree", label: t("settings.layout.tree") },
        { value: "org", label: t("settings.layout.org") },
      ],
      (value) => this.updateMetaAndRender({ layout: value as LayoutKind }),
    );
    this.sidebarLayoutSelect.classList.add("simple-mind-sidebar-layout");
    this.sidebarDirectionSelect = this.createSidebarSelect(
      layoutSection,
      t("settings.direction"),
      [
        { value: "right", label: t("settings.direction.right") },
        { value: "left", label: t("settings.direction.left") },
      ],
      (value) => this.updateMetaAndRender({ direction: value as TreeDirection }),
    );
    this.sidebarAlignSelect = this.createSidebarSelect(
      layoutSection,
      t("settings.align"),
      [
        { value: "center", label: t("settings.align.center") },
        { value: "start", label: t("settings.align.start") },
      ],
      (value) => this.updateMetaAndRender({ align: value as NodeAlignment }),
    );
    this.sidebarCompactInput = this.createSidebarCheckbox(
      layoutSection,
      t("settings.compact"),
      (value) => this.updateMetaAndRender({ compact: value }),
    );

    const nodeSection = this.createSidebarSection(this.sidebarStylePane, t("sidebar.node"));
    this.sidebarNodeHint = this.createSidebarHint(nodeSection, t("sidebar.selectNode"));
    this.sidebarNodeShapeSelect = this.createSidebarSelect(
      nodeSection,
      t("sidebar.nodeShape"),
      [
        { value: "", label: t("sidebar.themeDefault") },
        { value: "rounded", label: t("themeEditor.shape.rounded") },
        { value: "pill", label: t("themeEditor.shape.pill") },
        { value: "underline", label: t("themeEditor.shape.underline") },
        { value: "plain", label: t("themeEditor.shape.plain") },
      ],
      (value) => this.updateSelectedNodeStyle({ shape: value ? (value as NodeShape) : undefined }),
    );
    this.sidebarNodeShapeSelect.classList.add("simple-mind-sidebar-node-shape");
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
    this.sidebarNodeBorderWidthInput = this.createSidebarNumber(
      nodeSection,
      t("sidebar.borderWidth"),
      {
        min: LIMITS.nodeBorderWidth.min,
        max: LIMITS.nodeBorderWidth.max,
        placeholder: t("sidebar.defaultValue"),
        onChange: (value) => this.updateSelectedNodeStyle({ borderWidth: value }),
      },
    );
    this.sidebarNodeBorderWidthInput.classList.add("simple-mind-sidebar-node-border-width");

    const connectorSection = this.createSidebarSection(
      this.sidebarStylePane,
      t("sidebar.connector"),
    );
    this.sidebarConnectorSelect = this.createSidebarSelect(
      connectorSection,
      t("sidebar.connectorShape"),
      [
        { value: "", label: t("sidebar.themeDefault") },
        { value: "curve", label: t("themeEditor.connector.curve") },
        { value: "orthogonal", label: t("themeEditor.connector.orthogonal") },
        { value: "straight", label: t("themeEditor.connector.straight") },
      ],
      (value) =>
        this.updateMetaAndRender({
          connectorStyle: value ? (value as ConnectorStyle) : undefined,
        }),
    );
    this.sidebarConnectorSelect.classList.add("simple-mind-sidebar-connector");

    const fontSection = this.createSidebarSection(this.sidebarTextPane, t("sidebar.font"));
    this.sidebarTextHint = this.createSidebarHint(fontSection, t("sidebar.selectNode"));
    this.sidebarFontFamilyInput = this.createSidebarText(
      fontSection,
      t("themeEditor.fontFamily"),
      t("sidebar.defaultValue"),
      (value) => this.updateSelectedNodeStyle({ fontFamily: value.trim() || undefined }),
    );
    this.sidebarFontFamilyInput.classList.add("simple-mind-sidebar-font-family");
    this.sidebarFontSizeInput = this.createSidebarNumber(fontSection, t("themeEditor.fontSize"), {
      min: LIMITS.fontSize.min,
      max: LIMITS.fontSize.max,
      placeholder: t("sidebar.defaultValue"),
      onChange: (value) => this.updateSelectedNodeStyle({ fontSize: value }),
    });
    this.sidebarFontSizeInput.classList.add("simple-mind-sidebar-font-size");

    const textSection = this.createSidebarSection(this.sidebarTextPane, t("sidebar.text"));
    this.sidebarTextColor = this.createSidebarColor(textSection, t("sidebar.textColor"), (value) =>
      this.updateSelectedNodeStyle({ textColor: value }),
    );
    this.sidebarTextColor.input.classList.add("simple-mind-sidebar-text-color");
    this.sidebarBoldInput = this.createSidebarCheckbox(textSection, t("sidebar.bold"), (value) =>
      this.updateSelectedNodeStyle({ bold: value }),
    );
    this.sidebarBoldInput.classList.add("simple-mind-sidebar-bold");
    this.sidebarItalicInput = this.createSidebarCheckbox(
      textSection,
      t("sidebar.italic"),
      (value) => this.updateSelectedNodeStyle({ italic: value }),
    );
    this.sidebarItalicInput.classList.add("simple-mind-sidebar-italic");
    this.sidebarUnderlineInput = this.createSidebarCheckbox(
      textSection,
      t("sidebar.underline"),
      (value) => this.updateSelectedNodeStyle({ underline: value }),
    );
    this.sidebarUnderlineInput.classList.add("simple-mind-sidebar-underline");
    this.sidebarTextAlignSelect = this.createSidebarSelect(
      textSection,
      t("sidebar.textAlign"),
      [
        { value: "", label: t("sidebar.themeDefault") },
        { value: "left", label: t("sidebar.textAlign.left") },
        { value: "center", label: t("sidebar.textAlign.center") },
        { value: "right", label: t("sidebar.textAlign.right") },
      ],
      (value) =>
        this.updateSelectedNodeStyle({
          textAlign: value ? (value as TextAlign) : undefined,
        }),
    );
    this.sidebarTextAlignSelect.classList.add("simple-mind-sidebar-text-align");
    this.sidebarLineHeightInput = this.createSidebarNumber(textSection, t("sidebar.lineHeight"), {
      min: LIMITS.lineHeight.min,
      max: LIMITS.lineHeight.max,
      step: 0.1,
      placeholder: t("sidebar.defaultValue"),
      onChange: (value) => this.updateSelectedNodeStyle({ lineHeight: value }),
    });
    this.sidebarLineHeightInput.classList.add("simple-mind-sidebar-line-height");

    this.setSidebarTab(this.activeTab);
  }

  /** Creates one tab pane. */
  private createSidebarPane(tab: SidebarTab): HTMLElement {
    const pane = this.sidebarEl.ownerDocument.createElement("div");
    pane.className = "simple-mind-sidebar-pane";
    pane.dataset.tab = tab;
    pane.setAttribute("role", "tabpanel");
    this.sidebarEl.appendChild(pane);
    return pane;
  }

  /** Shows one sidebar tab and hides the other. */
  private setSidebarTab(tab: SidebarTab): void {
    this.activeTab = tab;
    for (const [id, button] of this.sidebarTabs) {
      const active = id === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }
    this.sidebarStylePane.hidden = tab !== "style";
    this.sidebarTextPane.hidden = tab !== "text";
  }

  /** Creates a labeled sidebar section inside a pane. */
  private createSidebarSection(parent: HTMLElement, title: string): HTMLElement {
    const doc = this.sidebarEl.ownerDocument;
    const section = doc.createElement("section");
    section.className = "simple-mind-sidebar-section";
    const heading = doc.createElement("h4");
    heading.textContent = title;
    section.appendChild(heading);
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

  /** Adds a select control. */
  private createSidebarSelect(
    section: HTMLElement,
    label: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
  ): HTMLSelectElement {
    const select = this.sidebarEl.ownerDocument.createElement("select");
    select.className = "simple-mind-sidebar-select";
    select.setAttribute("aria-label", label);
    for (const option of options) {
      const item = this.sidebarEl.ownerDocument.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    }
    select.addEventListener("change", () => onChange(select.value));
    this.createSidebarRow(section, label, select);
    return select;
  }

  /** Adds a number control that clears its override when emptied. */
  private createSidebarNumber(
    section: HTMLElement,
    label: string,
    options: SidebarNumberOptions,
  ): HTMLInputElement {
    const input = this.sidebarEl.ownerDocument.createElement("input");
    input.type = "number";
    input.min = String(options.min);
    input.max = String(options.max);
    input.placeholder = options.placeholder ?? "";
    if (options.step !== undefined) input.step = String(options.step);
    input.className = "simple-mind-sidebar-number";
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => {
      if (input.value.trim() === "") {
        options.onChange(undefined);
        return;
      }
      const value = Number(input.value);
      if (!Number.isFinite(value)) {
        options.onChange(undefined);
        return;
      }
      options.onChange(Math.min(options.max, Math.max(options.min, value)));
    });
    this.createSidebarRow(section, label, input);
    return input;
  }

  /** Adds a text control. */
  private createSidebarText(
    section: HTMLElement,
    label: string,
    placeholder: string,
    onChange: (value: string) => void,
  ): HTMLInputElement {
    const input = this.sidebarEl.ownerDocument.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.className = "simple-mind-sidebar-text";
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => onChange(input.value));
    this.createSidebarRow(section, label, input);
    return input;
  }

  /** Adds a checkbox control. */
  private createSidebarCheckbox(
    section: HTMLElement,
    label: string,
    onChange: (value: boolean) => void,
  ): HTMLInputElement {
    const input = this.sidebarEl.ownerDocument.createElement("input");
    input.type = "checkbox";
    input.className = "simple-mind-sidebar-checkbox";
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => onChange(input.checked));
    this.createSidebarRow(section, label, input);
    return input;
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
    reset.textContent = "×";
    reset.setAttribute("aria-label", t("sidebar.resetColor"));
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
      : "obsidian";
  }

  /** Synchronizes sidebar controls with the file metadata and selected node. */
  private syncSidebar(): void {
    if (!this.sidebarThemeSelect) return;
    const meta = this.controller?.getDocument().meta;
    const tokens = tokensForMode(this.effectiveTheme, this.dark);
    const node = this.getSelectedNode();
    const isRoot = node ? this.controller?.isRoot(node.id) === true : false;
    const visual = nodeVisual(tokens, node?.style, isRoot);
    const style = node?.style ?? {};
    const hasSelection = node !== null;

    this.syncThemeOptions();
    this.sidebarLayoutSelect.value = meta?.layout ?? this.settings.defaultLayout;
    this.sidebarDirectionSelect.value = meta?.direction ?? this.settings.defaultDirection;
    this.sidebarAlignSelect.value = meta?.align ?? this.settings.defaultAlign;
    this.sidebarCompactInput.checked = meta?.compact ?? this.settings.defaultCompact;
    this.sidebarConnectorSelect.value = meta?.connectorStyle ?? "";

    this.sidebarNodeShapeSelect.value = style.shape ?? "";
    this.syncColorControl(this.sidebarNodeFill, hasSelection, style.fill, visual.background);
    this.syncColorControl(this.sidebarNodeBorder, hasSelection, style.borderColor, visual.border);
    this.sidebarNodeBorderWidthInput.value = optionalNumber(style.borderWidth);
    this.sidebarFontFamilyInput.value = style.fontFamily ?? "";
    this.sidebarFontSizeInput.value = optionalNumber(style.fontSize);
    this.syncColorControl(this.sidebarTextColor, hasSelection, style.textColor, visual.text);
    this.sidebarBoldInput.checked = style.bold ?? visual.fontWeight >= 600;
    this.sidebarItalicInput.checked = style.italic ?? visual.fontStyle === "italic";
    this.sidebarUnderlineInput.checked = style.underline ?? visual.textDecoration === "underline";
    this.sidebarTextAlignSelect.value = style.textAlign ?? "";
    this.sidebarLineHeightInput.value = optionalNumber(style.lineHeight);

    this.setNodeStyleControlsEnabled(hasSelection);
    this.sidebarNodeHint.hidden = hasSelection;
    this.sidebarTextHint.hidden = hasSelection;
  }

  /** Returns the selected live node, if any. */
  private getSelectedNode(): MindNode | null {
    if (!this.controller || !this.selectedId) return null;
    return this.controller.findNode(this.selectedId);
  }

  /** Enables or disables controls that require a selected node. */
  private setNodeStyleControlsEnabled(enabled: boolean): void {
    const controls: Array<HTMLInputElement | HTMLSelectElement> = [
      this.sidebarNodeShapeSelect,
      this.sidebarNodeBorderWidthInput,
      this.sidebarFontFamilyInput,
      this.sidebarFontSizeInput,
      this.sidebarBoldInput,
      this.sidebarItalicInput,
      this.sidebarUnderlineInput,
      this.sidebarTextAlignSelect,
      this.sidebarLineHeightInput,
    ];
    for (const control of controls) control.disabled = !enabled;
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
    this.rerender(false);
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

    this.rerender(false);
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
    this.effectiveTheme = effective;
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
    this.updateToolbar();
  }

  /** Shows or hides the style sidebar. */
  private toggleSidebar(): void {
    this.sidebarEl.hidden = !this.sidebarEl.hidden;
  }

  /** Removes the renderer and map DOM. */
  destroy(): void {
    this.cancelEditorLayout();
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
   * Creates a toolbar button.
   *
   * @param toolbar Toolbar element.
   * @param label Visible label.
   * @param action Click action.
   */
  private createToolbarButton(
    toolbar: HTMLElement,
    label: string,
    action: () => void,
  ): HTMLButtonElement {
    const button = toolbar.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "simple-mind-toolbar-button";
    button.textContent = label;
    button.addEventListener("click", action);
    toolbar.appendChild(button);
    return button;
  }

  /** Adds a visual separator to the toolbar. */
  private createToolbarDivider(toolbar: HTMLElement): void {
    const divider = toolbar.ownerDocument.createElement("span");
    divider.className = "simple-mind-toolbar-divider";
    toolbar.appendChild(divider);
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

  /** Updates toolbar disabled states. */
  private updateToolbar(): void {
    const hasSelection = !!this.selectedId;
    const canEdit = this.canEdit();
    const selectedRoot = hasSelection && this.controller?.isRoot(this.selectedId ?? "") === true;

    this.childButton.disabled = !canEdit || !hasSelection;
    this.siblingButton.disabled = !canEdit || !hasSelection;
    this.deleteButton.disabled = !canEdit || !hasSelection || selectedRoot;
    this.undoButton.disabled = !canEdit || this.controller?.canUndo() !== true;
    this.redoButton.disabled = !canEdit || this.controller?.canRedo() !== true;
  }

  /** Re-renders the controller document. */
  private rerender(fit: boolean): void {
    const document = this.controller?.getDocument();
    if (document) this.renderer.render(document, { fit });
    else this.renderer.clear();
    this.updateToolbar();
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

/** Formats an optional numeric override for a sidebar input. */
function optionalNumber(value: number | undefined): string {
  return value === undefined ? "" : String(value);
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
