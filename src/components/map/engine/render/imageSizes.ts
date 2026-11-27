import {
  INLINE_IMAGE_MAX_HEIGHT,
  INLINE_IMAGE_PLACEHOLDER_HEIGHT,
  INLINE_IMAGE_PLACEHOLDER_WIDTH,
  LIMITS,
} from "../../../../config/constants";
import type { InlineImageSize, InlineImageSizes } from "../../../../types/inline";

/** One cached image source while it loads, after it loads, or after it fails. */
type ImageEntry = InlineImageSize | "pending" | "failed";

/**
 * Computes the box an image occupies inside a node.
 *
 * A requested width wins but never exceeds the node's width cap. Without one,
 * the image is capped at the default height and then at the width cap, always
 * keeping its aspect ratio. Unknown images use a fixed placeholder box.
 *
 * @param natural Natural image size, or null while unknown.
 * @param requestedWidth Width from a `|width` suffix, or null.
 * @param maxWidth Node width cap for the current file.
 */
export function imageDisplayBox(
  natural: InlineImageSize | null,
  requestedWidth: number | null,
  maxWidth: number = LIMITS.maxWidth.max,
): InlineImageSize {
  const cap = Math.max(1, maxWidth);
  if (!natural || natural.width <= 0 || natural.height <= 0) {
    const width = Math.min(requestedWidth ?? INLINE_IMAGE_PLACEHOLDER_WIDTH, cap);
    const height = requestedWidth
      ? Math.round((width * INLINE_IMAGE_PLACEHOLDER_HEIGHT) / INLINE_IMAGE_PLACEHOLDER_WIDTH)
      : INLINE_IMAGE_PLACEHOLDER_HEIGHT;
    return { width, height };
  }

  if (requestedWidth) {
    const width = Math.min(requestedWidth, cap);
    return {
      width,
      height: Math.max(1, Math.round((width * natural.height) / natural.width)),
    };
  }

  let width = natural.width;
  let height = natural.height;
  if (height > INLINE_IMAGE_MAX_HEIGHT) {
    width = Math.round((width * INLINE_IMAGE_MAX_HEIGHT) / height);
    height = INLINE_IMAGE_MAX_HEIGHT;
  }
  if (width > cap) {
    height = Math.round((height * cap) / width);
    width = cap;
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

/** Caches natural image sizes and deduplicates in-flight loads. */
export class ImageSizeCache implements InlineImageSizes {
  private readonly entries = new Map<string, ImageEntry>();
  private readonly waiters = new Map<string, Array<() => void>>();
  private readonly createImage: () => HTMLImageElement;

  /**
   * @param createImage Factory used to load a source; overridable in tests.
   */
  constructor(createImage?: () => HTMLImageElement) {
    this.createImage = createImage ?? (() => new Image());
  }

  /** Returns the cached size, a 0×0 failure, or null while unknown. */
  size(src: string): InlineImageSize | null {
    const entry = this.entries.get(src);
    if (!entry) return null;
    if (entry === "pending") return null;
    if (entry === "failed") return { width: 0, height: 0 };
    return entry;
  }

  /**
   * Loads a source once and calls back when it resolves or fails.
   *
   * Known and failed sources are ignored because the renderer already has a
   * size for them.
   *
   * @param src Image source.
   * @param onReady Callback run once the source is known.
   */
  request(src: string, onReady: () => void): void {
    const entry = this.entries.get(src);
    if (entry === "pending") {
      this.waiters.get(src)?.push(onReady);
      return;
    }
    if (entry) return;

    this.entries.set(src, "pending");
    this.waiters.set(src, [onReady]);
    const image = this.createImage();
    const finish = (next: ImageEntry): void => {
      this.entries.set(src, next);
      const callbacks = this.waiters.get(src) ?? [];
      this.waiters.delete(src);
      for (const callback of callbacks) callback();
    };
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      finish(width > 0 && height > 0 ? { width, height } : "failed");
    };
    image.onerror = () => finish("failed");
    image.src = src;
  }
}
