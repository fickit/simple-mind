/** Obsidian plugin id. */
export const PLUGIN_ID = "simple-mind";

/** Custom view type used by the map view. */
export const VIEW_TYPE_MAP = "simple-mind-map";

/** File extension handled by the plugin, without the leading dot. */
export const FILE_EXTENSION = "mindmap";

/** Frontmatter key owned by the plugin. */
export const FRONTMATTER_KEY = "mindmap";

/** Canonical source indentation width. */
export const INDENT_WIDTH = 2;

/** Canonical unordered list marker. */
export const LIST_MARKER = "-";

/** Maximum number of source snapshots kept for undo. */
export const HISTORY_LIMIT = 100;

/** Minimum and maximum zoom scale. */
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 2.5;

/** Node count above which the renderer may enable viewport culling. */
export const CULLING_THRESHOLD = 1200;

/** Initial inline-editor width for a new, empty node. */
export const NEW_NODE_EDITOR_WIDTH = 120;

/** Numeric bounds for per-file layout settings. */
export const LIMITS = {
  spacingX: { min: 8, max: 240 },
  spacingY: { min: 4, max: 120 },
  maxWidth: { min: 120, max: 600 },
  fontSize: { min: 8, max: 32 },
  lineWidth: { min: 1, max: 6 },
} as const;
