import type { Plugin } from "obsidian";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../config/defaults";
import { loadPluginData, savePluginData } from "./settings";

/** Builds a plugin stub backed by one in-memory data object. */
function makePlugin(initial: unknown): { plugin: Plugin; saved: () => unknown } {
  let data = initial;
  const plugin = {
    loadData: async () => data,
    saveData: async (next: unknown) => {
      data = next;
    },
  } as unknown as Plugin;
  return { plugin, saved: () => data };
}

describe("plugin data", () => {
  it("falls back to defaults when data.json is empty", async () => {
    const { plugin } = makePlugin(null);
    const data = await loadPluginData(plugin);

    expect(data.settings).toEqual(DEFAULT_SETTINGS);
    expect(data.viewStates).toEqual({});
  });

  it("keeps settings from the flat legacy shape and drops malformed states", async () => {
    const { plugin } = makePlugin({
      language: "zh",
      defaultLayout: "org",
      viewStates: {
        "notes/a.mindmap": { x: 12, y: -8, scale: 1.5, selectedId: "n3" },
        "notes/b.mindmap": { x: "12", y: 0, scale: 1, selectedId: null },
        "notes/c.mindmap": { x: 1, y: 2, scale: Number.NaN, selectedId: null },
        "notes/d.mindmap": "nope",
      },
    });
    const data = await loadPluginData(plugin);

    expect(data.settings.language).toBe("zh");
    expect(data.settings.defaultLayout).toBe("org");
    expect("viewStates" in data.settings).toBe(false);
    expect(data.viewStates).toEqual({
      "notes/a.mindmap": { x: 12, y: -8, scale: 1.5, selectedId: "n3" },
    });
  });

  it("writes settings and view states into one flat object", async () => {
    const { plugin, saved } = makePlugin(null);
    await savePluginData(plugin, {
      settings: { ...DEFAULT_SETTINGS, language: "zh" },
      viewStates: { "a.mindmap": { x: 1, y: 2, scale: 1, selectedId: null } },
    });

    expect(saved()).toEqual({
      ...DEFAULT_SETTINGS,
      language: "zh",
      viewStates: { "a.mindmap": { x: 1, y: 2, scale: 1, selectedId: null } },
    });
  });
});
