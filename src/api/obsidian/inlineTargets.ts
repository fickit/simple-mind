/** Extensions treated as inline images. */
const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);

/** Returns true when a path ends in a supported image extension. */
export function isImagePath(path: string): boolean {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(extension);
}

/** Returns the file part of a link target without alias, heading, or block. */
export function linkFileTarget(target: string): string {
  return target.split("|")[0].split("#")[0].split("^")[0].trim();
}
