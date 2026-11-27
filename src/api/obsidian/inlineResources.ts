import { type App, prepareFuzzySearch, type TFile } from "obsidian";
import type {
  InlineResourceHost,
  InlineSuggestion,
  InlineSuggestionKind,
} from "../../types/inline";
import { isImagePath, linkFileTarget } from "./inlineTargets";

/**
 * Creates the Obsidian-backed resource host for inline labels.
 *
 * @param app Obsidian app.
 * @param sourcePath Returns the open map's path, used to resolve relative links.
 */
export function createInlineResourceHost(app: App, sourcePath: () => string): InlineResourceHost {
  const resolveFile = (target: string): TFile | null => {
    const path = linkFileTarget(target);
    if (!path) return null;
    return app.metadataCache.getFirstLinkpathDest(path, sourcePath());
  };

  return {
    noteExists(target) {
      return resolveFile(target) !== null;
    },

    imageSource(target) {
      const trimmed = target.trim();
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      const file = resolveFile(trimmed);
      return file && isImagePath(file.path) ? app.vault.getResourcePath(file) : null;
    },

    openNote(target) {
      void app.workspace.openLinkText(target, sourcePath(), true);
    },

    previewNote(event, anchor, target) {
      app.workspace.trigger("hover-link", {
        event,
        source: "simple-mind",
        hoverParent: anchor.parentElement ?? anchor,
        targetEl: anchor,
        linktext: target,
        sourcePath: sourcePath(),
      });
    },

    suggest(kind: InlineSuggestionKind, query: string, limit: number) {
      return suggestFiles(app, sourcePath(), kind, query, limit);
    },
  };
}

/**
 * Ranks vault files for the inline editor.
 *
 * @param app Obsidian app.
 * @param sourcePath Open map path.
 * @param kind Link or image filter.
 * @param query Typed text after the brackets.
 * @param limit Maximum candidates to return.
 */
function suggestFiles(
  app: App,
  sourcePath: string,
  kind: InlineSuggestionKind,
  query: string,
  limit: number,
): InlineSuggestion[] {
  const trimmed = query.trim();
  const search = trimmed ? prepareFuzzySearch(trimmed) : null;
  const scored: Array<{ score: number; path: string; file: TFile }> = [];

  for (const file of app.vault.getFiles()) {
    if (kind === "image" && !isImagePath(file.path)) continue;
    const result = search ? search(file.path) : null;
    if (search && !result) continue;
    scored.push({ score: result?.score ?? 0, path: file.path, file });
  }

  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return scored.slice(0, limit).map(({ file }) => ({
    label: file.basename,
    detail: file.path,
    insert: app.metadataCache.fileToLinktext(file, sourcePath, kind === "link"),
  }));
}
