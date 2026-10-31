import type { MindMapDocument } from "../../types/mindmap";
import { findNodeById } from "./engine/model/tree";
import { parseSource } from "./engine/parser/parser";
import { MapRenderer } from "./engine/render/MapRenderer";
import { applyTheme } from "./themes/applyTheme";
import { OBSIDIAN_THEME } from "./themes/presets";

/** Callbacks supplied by the host view. */
export interface MapCanvasOptions {
  onSource: () => void;
}

/** Canvas component that owns the renderer, toolbar, and error banner. */
export class MapCanvas {
  private readonly rootEl: HTMLElement;
  private readonly canvasEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly renderer: MapRenderer;
  private readonly theme = OBSIDIAN_THEME;
  private readonly onSource: () => void;
  private document: MindMapDocument | null = null;
  private sourceText = "";
  private dark = false;

  /**
   * @param container Element that receives the map UI.
   * @param options Host callbacks.
   */
  constructor(container: HTMLElement, options: MapCanvasOptions) {
    const doc = container.ownerDocument;
    this.onSource = options.onSource;
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

    this.canvasEl = doc.createElement("div");
    this.canvasEl.className = "simple-mind-canvas-host";
    this.rootEl.appendChild(this.canvasEl);

    applyTheme(this.rootEl, this.theme, this.dark);
    this.renderer = new MapRenderer(this.canvasEl, this.theme, this.dark, {
      onToggleCollapse: (nodeId) => this.toggleCollapse(nodeId),
    });

    this.createToolbarButton(toolbar, "Fit", () => this.renderer.fit());
    this.createToolbarButton(toolbar, "−", () => this.renderer.zoomBy(0.8));
    this.createToolbarButton(toolbar, "+", () => this.renderer.zoomBy(1.2));
    const spacer = doc.createElement("span");
    spacer.className = "simple-mind-toolbar-spacer";
    toolbar.appendChild(spacer);
    this.createToolbarButton(toolbar, "Source", this.onSource);
  }

  /**
   * Parses and renders source text.
   *
   * @param source `.mindmap` file content.
   */
  setSource(source: string): void {
    this.sourceText = source;
    const result = parseSource(source);
    this.document = result.document;

    if (result.errors.length > 0) {
      const first = result.errors[0];
      const more = result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : "";
      this.showBanner(`Source error at line ${first.line}: ${first.message}${more}`);
    } else {
      this.hideBanner();
    }

    if (result.warnings.length > 0) {
      console.warn(
        "Simple Mind frontmatter warnings:",
        result.warnings.map((warning) => `line ${warning.line}: ${warning.message}`),
      );
    }

    if (this.document) {
      this.renderer.render(this.document, { fit: true });
    } else {
      this.renderer.clear();
    }
  }

  /** Returns the current source text. */
  getSource(): string {
    return this.sourceText;
  }

  /** Reapplies the theme after Obsidian changes its light/dark mode. */
  refreshTheme(): void {
    this.dark = isDarkDocument(this.rootEl.ownerDocument);
    applyTheme(this.rootEl, this.theme, this.dark);
    this.renderer.setTheme(this.theme, this.dark);
  }

  /** Removes the renderer and map DOM. */
  destroy(): void {
    this.renderer.destroy();
    this.rootEl.remove();
  }

  /**
   * Creates a toolbar button.
   *
   * @param toolbar Toolbar element.
   * @param label Visible label.
   * @param action Click action.
   */
  private createToolbarButton(toolbar: HTMLElement, label: string, action: () => void): void {
    const button = toolbar.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "simple-mind-toolbar-button";
    button.textContent = label;
    button.addEventListener("click", action);
    toolbar.appendChild(button);
  }

  /**
   * Toggles collapse state for a node. Collapse is runtime-only.
   *
   * @param nodeId Node to toggle.
   */
  private toggleCollapse(nodeId: string): void {
    if (!this.document) return;
    const node = findNodeById(this.document.root, nodeId);
    if (!node || node.children.length === 0) return;
    node.collapsed = !node.collapsed;
    this.renderer.render(this.document, { fit: false });
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
