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

/** Diameter of a floating node control. */
export const NODE_CONTROL_SIZE = 20;

/** Gap between a node edge and its nearest floating control. */
export const NODE_CONTROL_GAP = 8;

/** Gap between the collapse and add controls. */
export const NODE_CONTROL_SPACING = 4;

/** Distance from a node edge to the center of its collapse control. */
export const NODE_CONTROL_CENTER = NODE_CONTROL_GAP + NODE_CONTROL_SIZE / 2;

/** Distance from a node edge to the outer edge of its farthest floating control. */
export const NODE_CONTROL_EXTENT = NODE_CONTROL_GAP + NODE_CONTROL_SIZE * 2 + NODE_CONTROL_SPACING;

/** Distance a connector travels before branching toward its children. */
export const CONNECTOR_LEAD = NODE_CONTROL_CENTER;

/** Minimum parent-child gap that keeps node controls clear. */
export const CONNECTOR_CLEARANCE = NODE_CONTROL_EXTENT + NODE_CONTROL_GAP + 2;

/** Numeric bounds for per-file layout and style settings. */
export const LIMITS = {
  spacingX: { min: 8, max: 240 },
  spacingY: { min: 4, max: 120 },
  maxWidth: { min: 120, max: 600 },
  fontSize: { min: 8, max: 32 },
  lineWidth: { min: 0, max: 6 },
  nodeBorderWidth: { min: 0, max: 8 },
  lineHeight: { min: 1, max: 3 },
} as const;

/** Display value for color inputs when the active token is not a hex color. */
export const COLOR_INPUT_FALLBACK = "#888888";
