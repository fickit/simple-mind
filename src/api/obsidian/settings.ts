import type { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "../../config/defaults";
import type { SimpleMindSettings } from "../../types/settings";

/**
 * Loads plugin settings and fills missing keys with defaults.
 *
 * @param plugin Host plugin used to read `data.json`.
 */
export async function loadSettings(plugin: Plugin): Promise<SimpleMindSettings> {
  const stored = (await plugin.loadData()) as Partial<SimpleMindSettings> | null;
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

/**
 * Persists plugin settings.
 *
 * @param plugin Host plugin used to write `data.json`.
 * @param settings Complete settings object.
 */
export async function saveSettings(plugin: Plugin, settings: SimpleMindSettings): Promise<void> {
  await plugin.saveData(settings);
}
