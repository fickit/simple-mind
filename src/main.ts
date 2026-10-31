import { Plugin } from "obsidian";
import { loadSettings } from "./api/obsidian/settings";
import { DEFAULT_SETTINGS } from "./config/defaults";
import type { SimpleMindSettings } from "./types/settings";

/** Main Obsidian plugin entry point. */
export default class SimpleMindPlugin extends Plugin {
  /** Current plugin settings. */
  settings: SimpleMindSettings = DEFAULT_SETTINGS;

  /** Loads settings when Obsidian enables the plugin. */
  async onload(): Promise<void> {
    this.settings = await loadSettings(this);
  }
}
