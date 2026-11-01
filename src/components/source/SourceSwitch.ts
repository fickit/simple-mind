import { Notice, TextFileView, type TFile, type WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_MAP } from "../../config/constants";
import { t } from "../../config/i18n";
import { clearSourceMode, markSourceMode } from "./SourceModeGuard";

/**
 * Saves a leaf-backed text view before switching its view type.
 *
 * @param leaf Leaf whose current view may contain unsaved text.
 * @returns True when the content is safe to switch away from.
 */
async function saveBeforeSwitch(leaf: WorkspaceLeaf): Promise<boolean> {
  const view = leaf.view;
  if (!(view instanceof TextFileView)) return true;

  try {
    await view.save();
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    new Notice(`Simple Mind: ${t("notice.saveFailed", { reason })}`);
    return false;
  }
}

/**
 * Switches the current leaf to Obsidian's native Markdown source editor.
 *
 * @param leaf Leaf that currently shows the map view.
 * @param file Mind map file bound to the leaf.
 */
export async function switchToSource(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
  if (!(await saveBeforeSwitch(leaf))) return;

  markSourceMode(leaf, file.path);
  await leaf.setViewState({
    ...leaf.getViewState(),
    type: "markdown",
    state: { file: file.path, mode: "source" },
  });
}

/**
 * Switches the current leaf to the Simple Mind map view.
 *
 * @param leaf Leaf that currently shows the native editor.
 * @param file Mind map file bound to the leaf.
 */
export async function switchToMap(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
  if (!(await saveBeforeSwitch(leaf))) return;

  clearSourceMode(leaf);
  await leaf.setViewState({
    ...leaf.getViewState(),
    type: VIEW_TYPE_MAP,
    state: { file: file.path },
  });
}
