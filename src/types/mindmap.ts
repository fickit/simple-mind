/** Supported automatic layout modes. */
export type LayoutKind = "mindmap" | "tree" | "org";

/** Horizontal direction used by the tree layout. */
export type TreeDirection = "right" | "left";

/** Alignment of a parent node relative to its child block. */
export type NodeAlignment = "center" | "start";

/** Per-file map settings stored in the `mindmap` frontmatter block. */
export interface MindMapMeta {
  version: 1;
  theme: string;
  layout: LayoutKind;
  direction: TreeDirection;
  spacingX: number;
  spacingY: number;
  align: NodeAlignment;
  compact: boolean;
  maxWidth: number;
}

/** A live mind map node. */
export interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
  collapsed: boolean;
}

/** Raw source parts preserved for round-trip serialization. */
export interface SourceText {
  frontmatterRaw: string | null;
  frontmatter: Record<string, unknown> | null;
  body: string;
  otherFrontmatterLines: string[];
  mindmapExtraLines: string[];
}

/** A parsed map document plus the source it came from. */
export interface MindMapDocument {
  root: MindNode;
  meta: MindMapMeta;
  source: SourceText;
}

/** A source validation error located by line number. */
export interface ParseError {
  line: number;
  message: string;
}

/** A non-blocking source issue, such as an invalid frontmatter value. */
export interface ParseWarning {
  line: number;
  message: string;
}

/** Parser output. A partial document may be returned alongside errors. */
export interface ParseResult {
  document: MindMapDocument | null;
  errors: ParseError[];
  warnings: ParseWarning[];
}
