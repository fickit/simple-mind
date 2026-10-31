import { HISTORY_LIMIT } from "../../../../config/constants";

/** Bounded source-snapshot history used by map commands. */
export class SourceHistory {
  private readonly undoStack: string[] = [];
  private readonly redoStack: string[] = [];

  /**
   * Records the source before a mutation.
   *
   * @param previousSource Source text before the mutation.
   */
  push(previousSource: string): void {
    this.undoStack.push(previousSource);
    if (this.undoStack.length > HISTORY_LIMIT) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /**
   * Restores the previous snapshot.
   *
   * @param currentSource Current source text.
   * @returns The previous source, or null when no undo entry exists.
   */
  undo(currentSource: string): string | null {
    const previous = this.undoStack.pop();
    if (previous === undefined) return null;
    this.redoStack.push(currentSource);
    return previous;
  }

  /**
   * Restores the next snapshot.
   *
   * @param currentSource Current source text.
   * @returns The next source, or null when no redo entry exists.
   */
  redo(currentSource: string): string | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    this.undoStack.push(currentSource);
    return next;
  }

  /** Returns true when undo has an entry. */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Returns true when redo has an entry. */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Clears all snapshots. */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
