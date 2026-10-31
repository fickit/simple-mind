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

## Call flow

`main.ts` loads settings through this module. Later phases add vault file access, view switching, and
theme-change adapters here.
