import type { WorkspaceLeaf } from "obsidian";

const sourceLeaves = new WeakMap<WorkspaceLeaf, string>();

/**
 * Remembers that a leaf is intentionally showing the native source editor.
 *
 * @param leaf Leaf that was switched to source mode.
 * @param filePath Path of the file shown in that leaf.
 */
export function markSourceMode(leaf: WorkspaceLeaf, filePath: string): void {
  sourceLeaves.set(leaf, filePath);
}

/**
 * Clears the source-mode guard for a leaf.
 *
 * @param leaf Leaf that returns to the map view or opens another file.
 */
export function clearSourceMode(leaf: WorkspaceLeaf): void {
  sourceLeaves.delete(leaf);
}

/**
 * Returns true when the leaf is intentionally showing source mode for the file.
 *
 * @param leaf Leaf to inspect.
 * @param filePath Path of the file currently open in the leaf.
 */
export function isSourceMode(leaf: WorkspaceLeaf, filePath: string): boolean {
  return sourceLeaves.get(leaf) === filePath;
}
