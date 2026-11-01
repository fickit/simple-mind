import type { MindMapMeta, MindNode } from "../../../../types/mindmap";
import type { NodeShape, ThemeTokens } from "../../../../types/theme";
import type { NodeMeasurer, NodeSize } from "../layout/types";
import { renderInlineMarkdown } from "./inlineMarkdown";

/** Returns the border width that participates in measurement. */
function measurementBorderWidth(shape: NodeShape, borderWidth: number): number {
  if (shape === "rounded" || shape === "pill") return borderWidth;
  if (shape === "underline") return 2;
  return 0;
}

/** Measures rendered node labels with a hidden DOM element and caches the result. */
export class DomNodeMeasurer {
  private readonly host: HTMLElement;
  private readonly inner: HTMLElement;
  private readonly cache = new Map<string, NodeSize>();
  private tokens: ThemeTokens;
  private signature = "";

  /**
   * @param container Map canvas that owns the hidden measurement element.
   * @param meta Current per-file settings.
   * @param tokens Active theme tokens.
   */
  constructor(container: HTMLElement, meta: MindMapMeta, tokens: ThemeTokens) {
    const doc = container.ownerDocument;
    this.host = doc.createElement("div");
    this.host.className = "simple-mind-measure";
    this.inner = doc.createElement("div");
    this.inner.className = "simple-mind-measure-inner";
    this.host.appendChild(this.inner);
    container.appendChild(this.host);
    this.tokens = tokens;
    this.update(meta, tokens);
  }

  /**
   * Updates typography and wrapping settings, clearing the cache on change.
   *
   * @param meta Current per-file settings.
   * @param tokens Active theme tokens.
   */
  update(meta: MindMapMeta, tokens: ThemeTokens): void {
    const nextSignature = JSON.stringify({
      maxWidth: meta.maxWidth,
      paddingX: tokens.node.paddingX,
      paddingY: tokens.node.paddingY,
      borderWidth: tokens.node.borderWidth,
      rootBorderWidth: tokens.root.borderWidth,
      font: tokens.typography,
      nodeShape: tokens.node.shape,
      rootShape: tokens.root.shape,
    });
    if (nextSignature === this.signature) return;

    this.signature = nextSignature;
    this.tokens = tokens;
    this.cache.clear();
    this.inner.style.maxWidth = `${meta.maxWidth}px`;
    this.inner.style.padding = `${tokens.node.paddingY}px ${tokens.node.paddingX}px`;
    this.inner.style.fontFamily = tokens.typography.family;
    this.inner.style.fontSize = `${tokens.typography.size}px`;
    this.inner.style.fontStyle = tokens.typography.fontStyle ?? "normal";
    this.inner.style.lineHeight = String(tokens.typography.lineHeight);
  }

  /**
   * Measures one node and caches the result by text and root/branch role.
   *
   * @param node Node to measure.
   * @param isRoot Whether the node uses root tokens.
   */
  measure(node: MindNode, isRoot: boolean): NodeSize {
    const key = `${isRoot ? "root" : "node"}\u0000${node.text}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const shape = isRoot ? this.tokens.root.shape : this.tokens.node.shape;
    const borderWidth = measurementBorderWidth(
      shape,
      isRoot ? this.tokens.root.borderWidth : this.tokens.node.borderWidth,
    );
    this.inner.style.fontWeight = isRoot ? "600" : String(this.tokens.typography.weight);
    this.inner.style.border = borderWidth > 0 ? `${borderWidth}px solid transparent` : "none";
    this.inner.style.borderBottom =
      shape === "underline" ? `${borderWidth}px solid transparent` : "";
    this.inner.replaceChildren(renderInlineMarkdown(node.text, this.inner.ownerDocument));

    const width = this.inner.offsetWidth;
    const height = this.inner.offsetHeight;
    const size =
      width > 0 && height > 0
        ? { width: Math.max(40, Math.ceil(width) + 2), height: Math.ceil(height) }
        : {
            width: Math.min(280, 40 + node.text.length * 8),
            height: 30,
          };

    this.cache.set(key, size);
    return size;
  }

  /**
   * Returns a layout measurer bound to the current root id.
   *
   * @param rootId Root node id.
   */
  createMeasurer(rootId: string): NodeMeasurer {
    return (node) => this.measure(node, node.id === rootId);
  }

  /** Removes the hidden measurement element. */
  destroy(): void {
    this.host.remove();
    this.cache.clear();
  }
}
