# Model

## Purpose

Holds small, framework-independent tree helpers shared by the engine.

## Why it exists

The renderer and future interaction layer need to find nodes and navigate parents without importing
parser or DOM code.

## Files

- `tree.ts`: `findNodeById`.

## Call flow

`MapCanvas` uses `findNodeById` for collapse toggles and later command handling.
