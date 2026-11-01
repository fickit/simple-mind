import { ZOOM_MAX, ZOOM_MIN } from "../../../../config/constants";
import { DEFAULT_MINDMAP_META } from "../../../../config/defaults";
import type { MindMapDocument, MindNode } from "../../../../types/mindmap";
import type { ThemeDefinition, ThemeTokens } from "../../../../types/theme";
import { tokensForMode } from "../../themes/applyTheme";
import { layoutDocument } from "../layout/layout";
import type { LayoutBounds, LayoutResult, PositionedNode } from "../layout/types";
import { connectorPath } from "./connectors";
import { renderInlineMarkdown } from "./inlineMarkdown";
import { DomNodeMeasurer } from "./measure";

const SVG_NS = "http://www.w3.org/2000/svg";
const FIT_PADDING = 48;
const SVG_PADDING = 80;

/** Optional callbacks supplied by the canvas component. */
export interface MapRendererOptions {
  onToggleCollapse?: (nodeId: string) => void;
  onEditRequest?: (nodeId: string) => void;
  onSelectionChange?: (nodeId: string | null) => void;
}

/** Renders a document as HTML nodes and SVG connectors. */
export class MapRenderer {
  private readonly canvas: HTMLElement;
  private readonly world: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly nodesLayer: HTMLElement;
  private readonly nodeEls = new Map<string, HTMLElement>();
  private readonly edgeEls = new Map<string, SVGPathElement>();
  private readonly renderedText = new Map<string, string>();
  private readonly colors = new Map<string, string>();
  private readonly disposers: Array<() => void> = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly onToggleCollapse?: (nodeId: string) => void;
  private readonly onEditRequest?: (nodeId: string) => void;
  private readonly onSelectionChange?: (nodeId: string | null) => void;
  private measurer: DomNodeMeasurer;
  private theme: ThemeDefinition;
  private dark: boolean;
  private document: MindMapDocument | null = null;
  private layout: LayoutResult | null = null;
  private selectedId: string | null = null;
  private editingNodeId: string | null = null;
  private scale = 1;
  private translateX = 0;
  private translateY = 0;
  private pendingFit = true;

  /**
   * @param canvas Element that holds the world layer.
   * @param theme Active theme.
   * @param dark Whether Obsidian is in dark mode.
   * @param options Renderer callbacks.
   */
  constructor(
    canvas: HTMLElement,
    theme: ThemeDefinition,
    dark: boolean,
    options: MapRendererOptions = {},
  ) {
    const doc = canvas.ownerDocument;
    this.canvas = canvas;
    this.theme = theme;
    this.dark = dark;
    this.onToggleCollapse = options.onToggleCollapse;
    this.onEditRequest = options.onEditRequest;
    this.onSelectionChange = options.onSelectionChange;

    this.canvas.classList.add("simple-mind-canvas");
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "tree");

    this.world = doc.createElement("div");
    this.world.className = "simple-mind-world";
    this.svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    this.svg.classList.add("simple-mind-edges");
    this.svg.setAttribute("aria-hidden", "true");
    this.nodesLayer = doc.createElement("div");
    this.nodesLayer.className = "simple-mind-nodes";
    this.world.append(this.svg, this.nodesLayer);
    this.canvas.appendChild(this.world);

    this.measurer = new DomNodeMeasurer(
      this.canvas,
      DEFAULT_MINDMAP_META,
      tokensForMode(theme, dark),
    );
    this.bindPanZoom();
    this.resizeObserver = new ResizeObserver(() => {
      if (this.pendingFit) this.fit();
    });
    this.resizeObserver.observe(this.canvas);
  }

  /**
   * Applies a new theme and redraws the current document.
   *
   * @param theme Active theme.
   * @param dark Whether Obsidian is in dark mode.
   */
  setTheme(theme: ThemeDefinition, dark: boolean): void {
    this.theme = theme;
    this.dark = dark;
    if (this.document) {
      this.render(this.document, { fit: false });
    }
  }

  /**
   * Renders a document.
   *
   * @param document Parsed document.
   * @param options Fit behavior after rendering.
   */
  render(document: MindMapDocument, options: { fit?: boolean } = {}): void {
    this.document = document;
    const tokens = tokensForMode(this.theme, this.dark);
    this.measurer.update(document.meta, tokens);
    this.layout = layoutDocument(
      document.root,
      document.meta,
      this.measurer.createMeasurer(document.root.id),
    );
    this.updateSvgBounds(this.layout.bounds);
    this.updateNodes(document, this.layout, tokens);
    this.updateEdges(this.layout, tokens);
    if (options.fit ?? this.pendingFit) {
      this.fit();
    }
  }

  /** Removes all rendered content. */
  clear(): void {
    this.document = null;
    this.layout = null;
    this.selectedId = null;
    this.nodeEls.clear();
    this.edgeEls.clear();
    this.renderedText.clear();
    this.colors.clear();
    this.nodesLayer.replaceChildren();
    this.svg.replaceChildren();
  }

  /** Fits the map into the canvas. */
  fit(): void {
    if (!this.layout) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      this.pendingFit = true;
      return;
    }

    const { bounds } = this.layout;
    const availableWidth = Math.max(1, rect.width - FIT_PADDING * 2);
    const availableHeight = Math.max(1, rect.height - FIT_PADDING * 2);
    const widthScale = bounds.width > 0 ? availableWidth / bounds.width : 1;
    const heightScale = bounds.height > 0 ? availableHeight / bounds.height : 1;
    this.scale = clamp(Math.min(widthScale, heightScale, 1.2), ZOOM_MIN, ZOOM_MAX);
    this.translateX = (rect.width - bounds.width * this.scale) / 2 - bounds.x1 * this.scale;
    this.translateY = (rect.height - bounds.height * this.scale) / 2 - bounds.y1 * this.scale;
    this.pendingFit = false;
    this.applyTransform();
  }

  /**
   * Zooms around a canvas-relative point.
   *
   * @param factor Scale multiplier.
   * @param centerX Canvas-relative x coordinate.
   * @param centerY Canvas-relative y coordinate.
   */
  zoomBy(factor: number, centerX?: number, centerY?: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = centerX ?? rect.width / 2;
    const y = centerY ?? rect.height / 2;
    const worldX = (x - this.translateX) / this.scale;
    const worldY = (y - this.translateY) / this.scale;
    const nextScale = clamp(this.scale * factor, ZOOM_MIN, ZOOM_MAX);
    this.translateX = x - worldX * nextScale;
    this.translateY = y - worldY * nextScale;
    this.scale = nextScale;
    this.applyTransform();
  }

  /**
   * Pans the map.
   *
   * @param dx Horizontal delta in screen pixels.
   * @param dy Vertical delta in screen pixels.
   */
  panBy(dx: number, dy: number): void {
    this.translateX += dx;
    this.translateY += dy;
    this.applyTransform();
  }

  /** Removes listeners and rendered DOM. */
  destroy(): void {
    this.resizeObserver.disconnect();
    for (const dispose of this.disposers) dispose();
    this.measurer.destroy();
    this.world.remove();
    this.nodeEls.clear();
    this.edgeEls.clear();
    this.renderedText.clear();
  }

  /** Returns the selected node id. */
  getSelectedId(): string | null {
    return this.selectedId;
  }

  /** Returns the current positioned nodes. */
  getLayoutNodes(): PositionedNode[] {
    return this.layout?.nodes ?? [];
  }

  /** Returns one node's layout position. */
  getNodePosition(nodeId: string): PositionedNode | null {
    return this.layout?.nodes.find((node) => node.node.id === nodeId) ?? null;
  }

  /** Returns one node's rendered element. */
  getNodeElement(nodeId: string): HTMLElement | null {
    return this.nodeEls.get(nodeId) ?? null;
  }

  /** Returns the transformed world layer. */
  getWorldElement(): HTMLElement {
    return this.world;
  }

  /** Focuses the canvas for keyboard interaction. */
  focus(): void {
    this.canvas.focus();
  }

  /** Selects one node or clears the selection. */
  selectNode(nodeId: string | null): void {
    if (this.selectedId === nodeId) return;
    if (this.selectedId) {
      this.nodeEls.get(this.selectedId)?.classList.remove("is-selected");
      this.nodeEls.get(this.selectedId)?.setAttribute("aria-selected", "false");
    }
    this.selectedId = nodeId;
    if (nodeId) {
      this.nodeEls.get(nodeId)?.classList.add("is-selected");
      this.nodeEls.get(nodeId)?.setAttribute("aria-selected", "true");
    }
    this.onSelectionChange?.(nodeId);
  }

  /**
   * Hides the node that is currently represented by the inline editor.
   *
   * @param nodeId Node being edited, or null when editing ends.
   */
  setEditingNode(nodeId: string | null): void {
    if (this.editingNodeId === nodeId) return;
    if (this.editingNodeId) {
      this.nodeEls.get(this.editingNodeId)?.classList.remove("is-editing");
    }
    this.editingNodeId = nodeId;
    if (nodeId) this.nodeEls.get(nodeId)?.classList.add("is-editing");
  }

  /** Applies the world transform. */
  private applyTransform(): void {
    this.world.style.transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.scale})`;
  }

  /** Updates the SVG coordinate space to cover the current layout. */
  private updateSvgBounds(bounds: LayoutBounds): void {
    const x = bounds.x1 - SVG_PADDING;
    const y = bounds.y1 - SVG_PADDING;
    const width = Math.max(1, bounds.width + SVG_PADDING * 2);
    const height = Math.max(1, bounds.height + SVG_PADDING * 2);
    this.svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    this.svg.style.left = `${x}px`;
    this.svg.style.top = `${y}px`;
    this.svg.style.width = `${width}px`;
    this.svg.style.height = `${height}px`;
  }

  /** Updates the keyed node elements. */
  private updateNodes(document: MindMapDocument, layout: LayoutResult, tokens: ThemeTokens): void {
    this.assignColors(document);
    const seen = new Set<string>();

    for (const positioned of layout.nodes) {
      const nodeId = positioned.node.id;
      seen.add(nodeId);
      const element = this.ensureNodeElement(nodeId);
      this.updateNodeElement(
        element,
        positioned,
        nodeId === document.root.id,
        this.colors.get(nodeId) ?? tokens.selection.outline,
      );
    }

    for (const [nodeId, element] of this.nodeEls) {
      if (!seen.has(nodeId)) {
        element.remove();
        this.nodeEls.delete(nodeId);
        this.renderedText.delete(nodeId);
      }
    }

    if (this.selectedId && !seen.has(this.selectedId)) {
      this.selectedId = null;
      this.onSelectionChange?.(null);
    }
    if (this.editingNodeId && !seen.has(this.editingNodeId)) {
      this.editingNodeId = null;
    }
  }

  /** Updates the keyed edge elements. */
  private updateEdges(layout: LayoutResult, tokens: ThemeTokens): void {
    const positions = new Map(layout.nodes.map((node) => [node.node.id, node]));
    const seen = new Set<string>();

    for (const edge of layout.edges) {
      const parent = positions.get(edge.parentId);
      const child = positions.get(edge.childId);
      if (!parent || !child) continue;

      seen.add(edge.childId);
      const path = this.ensureEdgeElement(edge.childId);
      path.setAttribute("d", connectorPath(parent, child, edge.side, tokens.branch.style));
      path.setAttribute("stroke", this.colors.get(edge.childId) ?? tokens.selection.outline);
      path.setAttribute("stroke-width", String(tokens.branch.lineWidth));
      path.setAttribute("stroke-opacity", String(tokens.branch.opacity));
    }

    for (const [childId, path] of this.edgeEls) {
      if (!seen.has(childId)) {
        path.remove();
        this.edgeEls.delete(childId);
      }
    }
  }

  /** Creates a node element and its stable children. */
  private ensureNodeElement(nodeId: string): HTMLElement {
    const existing = this.nodeEls.get(nodeId);
    if (existing) return existing;

    const doc = this.canvas.ownerDocument;
    const element = doc.createElement("div");
    element.className = "simple-mind-node";
    element.dataset.nodeId = nodeId;
    element.setAttribute("role", "treeitem");
    element.setAttribute("aria-selected", "false");

    const label = doc.createElement("div");
    label.className = "simple-mind-node-label";
    element.appendChild(label);

    const collapse = doc.createElement("button");
    collapse.type = "button";
    collapse.className = "simple-mind-collapse";
    collapse.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onToggleCollapse?.(nodeId);
    });
    element.appendChild(collapse);

    element.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("a")) return;
      this.canvas.focus();
      this.selectNode(nodeId);
    });

    element.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      this.canvas.focus();
      this.selectNode(nodeId);
      this.onEditRequest?.(nodeId);
    });

    this.nodesLayer.appendChild(element);
    this.nodeEls.set(nodeId, element);
    return element;
  }

  /** Updates one node element from its layout result. */
  private updateNodeElement(
    element: HTMLElement,
    positioned: PositionedNode,
    isRoot: boolean,
    color: string,
  ): void {
    const node = positioned.node;
    const shape = isRoot ? this.themeTokens().root.shape : this.themeTokens().node.shape;
    const selected = this.selectedId === node.id;
    element.className = [
      "simple-mind-node",
      `side-${positioned.side}`,
      `shape-${shape}`,
      isRoot ? "is-root" : "",
      selected ? "is-selected" : "",
      this.editingNodeId === node.id ? "is-editing" : "",
    ]
      .filter(Boolean)
      .join(" ");

    element.style.width = `${positioned.width}px`;
    element.style.height = `${positioned.height}px`;
    element.style.transform = `translate3d(${positioned.x}px, ${positioned.y}px, 0)`;
    element.style.setProperty("--sm-branch-color", color);
    element.setAttribute("aria-level", String(positioned.depth + 1));
    element.setAttribute("aria-selected", String(selected));
    if (node.children.length > 0) {
      element.setAttribute("aria-expanded", String(!node.collapsed));
    } else {
      element.removeAttribute("aria-expanded");
    }

    const label = element.querySelector<HTMLElement>(".simple-mind-node-label");
    if (label && this.renderedText.get(node.id) !== node.text) {
      label.replaceChildren(renderInlineMarkdown(node.text, this.canvas.ownerDocument));
      this.renderedText.set(node.id, node.text);
    }

    const collapse = element.querySelector<HTMLButtonElement>(".simple-mind-collapse");
    if (collapse) {
      const hasChildren = node.children.length > 0;
      collapse.hidden = !hasChildren;
      collapse.textContent = node.collapsed ? "+" : "−";
      collapse.setAttribute("aria-label", node.collapsed ? "Expand node" : "Collapse node");
      collapse.setAttribute("aria-expanded", String(!node.collapsed && hasChildren));
    }
  }

  /** Creates an edge element for a child id. */
  private ensureEdgeElement(childId: string): SVGPathElement {
    const existing = this.edgeEls.get(childId);
    if (existing) return existing;

    const path = this.canvas.ownerDocument.createElementNS(SVG_NS, "path") as SVGPathElement;
    path.classList.add("simple-mind-edge");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    this.svg.appendChild(path);
    this.edgeEls.set(childId, path);
    return path;
  }

  /** Assigns branch colors by top-level branch order. */
  private assignColors(document: MindMapDocument): void {
    this.colors.clear();
    const palette = this.themeTokens().branch.palette;
    this.colors.set(document.root.id, this.themeTokens().selection.outline);

    const assign = (node: MindNode, color: string): void => {
      this.colors.set(node.id, color);
      for (const child of node.children) assign(child, color);
    };

    document.root.children.forEach((child, index) => {
      assign(child, palette[index % palette.length] ?? this.themeTokens().selection.outline);
    });
  }

  /** Returns the active tokens. */
  private themeTokens(): ThemeTokens {
    return tokensForMode(this.theme, this.dark);
  }

  /** Binds wheel, pointer pan, and background selection. */
  private bindPanZoom(): void {
    let panning = false;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let startTranslateX = 0;
    let startTranslateY = 0;

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomBy(
          Math.exp(-event.deltaY * 0.002),
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        return;
      }
      this.panBy(-event.deltaX, -event.deltaY);
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest(".simple-mind-node, .simple-mind-inline-editor")) return;
      panning = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startTranslateX = this.translateX;
      startTranslateY = this.translateY;
      this.canvas.classList.add("is-panning");
      this.canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!panning || event.pointerId !== pointerId) return;
      this.translateX = startTranslateX + (event.clientX - startX);
      this.translateY = startTranslateY + (event.clientY - startY);
      this.applyTransform();
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (!panning || event.pointerId !== pointerId) return;
      panning = false;
      pointerId = -1;
      this.canvas.classList.remove("is-panning");
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    };

    const onClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      if (!target.closest(".simple-mind-node, .simple-mind-inline-editor")) {
        this.selectNode(null);
      }
    };

    this.canvas.addEventListener("wheel", onWheel, { passive: false });
    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointermove", onPointerMove);
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", onPointerUp);
    this.canvas.addEventListener("click", onClick);

    this.disposers.push(
      () => this.canvas.removeEventListener("wheel", onWheel),
      () => this.canvas.removeEventListener("pointerdown", onPointerDown),
      () => this.canvas.removeEventListener("pointermove", onPointerMove),
      () => this.canvas.removeEventListener("pointerup", onPointerUp),
      () => this.canvas.removeEventListener("pointercancel", onPointerUp),
      () => this.canvas.removeEventListener("click", onClick),
    );
  }
}

/** Clamps a number into a range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
