import type { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "../../config/defaults";
import type { LayoutKind } from "../../types/mindmap";
import type { SimpleMindSettings } from "../../types/settings";
import type { MapViewState } from "../../types/view";

const LAYOUT_KINDS: LayoutKind[] = ["mindmap", "tree-left", "tree-right", "org"];

/** Everything the plugin persists in `data.json`. */
export interface PluginData {
  settings: SimpleMindSettings;
  /** Pan, zoom, and selection per file path; cleared when a file is deleted. */
  viewStates: Record<string, MapViewState>;
}

/**
 * Loads settings and per-file view states, filling missing settings with defaults.
 *
 * @param plugin Host plugin used to read `data.json`.
 */
export async function loadPluginData(plugin: Plugin): Promise<PluginData> {
  const stored = ((await plugin.loadData()) ?? {}) as Record<string, unknown>;
  const { viewStates, ...settingsData } = stored;
  const settings: SimpleMindSettings = {
    ...DEFAULT_SETTINGS,
    ...(settingsData as Partial<SimpleMindSettings>),
  };
  if (!LAYOUT_KINDS.includes(settings.defaultLayout)) {
    settings.defaultLayout = DEFAULT_SETTINGS.defaultLayout;
  }
  return { settings, viewStates: readViewStates(viewStates) };
}

/**
 * Persists settings and per-file view states.
 *
 * @param plugin Host plugin used to write `data.json`.
 * @param data Settings and view states to store.
 */
export async function savePluginData(plugin: Plugin, data: PluginData): Promise<void> {
  await plugin.saveData({ ...data.settings, viewStates: data.viewStates });
}

/**
 * Reads stored view states, dropping entries that are not finite numbers.
 *
 * @param raw Value read from `data.json`.
 */
function readViewStates(raw: unknown): Record<string, MapViewState> {
  const states: Record<string, MapViewState> = {};
  if (typeof raw !== "object" || raw === null) return states;
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const { x, y, scale, selectedId } = value as Record<string, unknown>;
    if (typeof x !== "number" || typeof y !== "number" || typeof scale !== "number") continue;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) continue;
    states[path] = { x, y, scale, selectedId: typeof selectedId === "string" ? selectedId : null };
  }
  return states;
}
