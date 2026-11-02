/** Pan, zoom, and selection captured for one map file. */
export interface MapViewState {
  /** Horizontal world offset in screen pixels. */
  x: number;
  /** Vertical world offset in screen pixels. */
  y: number;
  /** Zoom factor. */
  scale: number;
  /** Selected node id, or null when nothing is selected. */
  selectedId: string | null;
}
