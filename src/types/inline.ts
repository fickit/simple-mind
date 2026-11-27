/** File-kind filter used by the inline autocomplete. */
export type InlineSuggestionKind = "link" | "image";

/** One item offered while typing an inline link or embed. */
export interface InlineSuggestion {
  /** Display name, usually the file basename. */
  label: string;
  /** Secondary line, usually the vault path. */
  detail: string;
  /** Link text inserted between the brackets. */
  insert: string;
}

/** Resolves inline resource syntax against the vault and opens notes. */
export interface InlineResourceHost {
  /** Returns true when a note target resolves inside the vault. */
  noteExists(target: string): boolean;
  /** Returns a resource URL for a vault image, or null when it is missing. */
  imageSource(target: string): string | null;
  /** Opens a note target in a new tab. */
  openNote(target: string): void;
  /** Shows Obsidian's page preview for a hovered note link. */
  previewNote(event: PointerEvent, anchor: HTMLElement, target: string): void;
  /** Returns autocomplete candidates for a link or image query. */
  suggest(kind: InlineSuggestionKind, query: string, limit: number): InlineSuggestion[];
}

/** Natural pixel size of one image. */
export interface InlineImageSize {
  width: number;
  height: number;
}

/** Caches natural image sizes and reports when a source resolves. */
export interface InlineImageSizes {
  /** Returns the cached size, a 0×0 failure, or null while unknown. */
  size(src: string): InlineImageSize | null;
  /** Loads a source once and calls back when it resolves or fails. */
  request(src: string, onReady: () => void): void;
}
