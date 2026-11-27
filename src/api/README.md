# API

## Purpose

Contains adapters between plugin logic and Obsidian APIs. The rest of the codebase should depend on
small functions in this module rather than calling `app`, `vault`, or `workspace` from arbitrary
places.

## Why it exists

The map engine must be testable without Obsidian. Keeping file, workspace, and settings access behind
this boundary makes the engine deterministic and keeps Obsidian-specific behavior in one layer.

## Files

- `obsidian/settings.ts`: load and save plugin settings through the host plugin.
- `obsidian/inlineResources.ts`: resolve note links and vault images, open notes in a new tab, trigger
  page preview, and rank files for the inline editor.
- `obsidian/inlineTargets.ts`: pure link-target and image-extension helpers shared by the adapter.

## Call flow

`main.ts` loads settings through this module. `pages/MindMapView` creates the inline resource host with
its app and current file path, then passes it to `MapCanvas`, so the map engine stays independent of
Obsidian.
