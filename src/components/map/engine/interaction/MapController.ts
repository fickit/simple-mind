import type { MindMapDocument, MindNode } from "../../../../types/mindmap";
import { SourceHistory } from "../history/SourceHistory";
import { containsNode, findNodeById, findParentById, type ParentMatch } from "../model/tree";
import { parseSource } from "../parser/parser";
import { serializeDocument } from "../parser/serializer";

/** Kind of node insertion. */
export type AddKind = "child" | "sibling";

/** Drop position for a move command. */
export type MovePosition = "child" | "before" | "after";

/** State captured while a new node is being edited. */
export interface PendingAdd {
  node: MindNode;
  parentId: string;
  previousSource: string;
}

let editNodeId = 1;

/** Creates a node id that cannot collide with parser ids. */
function createNodeId(): string {
  const id = `e${editNodeId}`;
  editNodeId += 1;
  return id;
}

/** Creates an empty node for inline editing. */
function createNode(): MindNode {
  return {
    id: createNodeId(),
    text: "",
    children: [],
    collapsed: false,
  };
}

/** Applies map commands to a document and keeps source/history in sync. */
export class MapController {
  private document: MindMapDocument;
  private source: string;
  private readonly history = new SourceHistory();
  private readonly onChange: (source: string) => void;

  /**
   * @param document Parsed document.
   * @param source Original source text.
   * @param onChange Called after a command produces new source.
   */
  constructor(document: MindMapDocument, source: string, onChange: (source: string) => void) {
    this.document = document;
    this.source = source;
    this.onChange = onChange;
  }

  /** Returns the current document. */
  getDocument(): MindMapDocument {
    return this.document;
  }

  /** Returns the current source. */
  getSource(): string {
    return this.source;
  }

  /** Returns true when undo is available. */
  canUndo(): boolean {
    return this.history.canUndo();
  }

  /** Returns true when redo is available. */
  canRedo(): boolean {
    return this.history.canRedo();
  }

  /** Returns true when the id belongs to the root. */
  isRoot(nodeId: string): boolean {
    return this.document.root.id === nodeId;
  }

  /** Finds a node by id. */
  findNode(nodeId: string): MindNode | null {
    return findNodeById(this.document.root, nodeId);
  }

  /** Finds a node's parent and index. */
  findParent(nodeId: string): ParentMatch | null {
    return findParentById(this.document.root, nodeId);
  }

  /**
   * Adds an empty node and leaves it pending until inline editing commits.
   *
   * @param kind Insert as a child or as the next sibling.
   * @param targetId Selected node.
   */
  beginAdd(kind: AddKind, targetId: string): PendingAdd | null {
    const target = this.findNode(targetId);
    if (!target) return null;

    let parent: MindNode;
    let index: number;
    if (kind === "child" || this.isRoot(targetId)) {
      target.collapsed = false;
      parent = target;
      index = parent.children.length;
    } else {
      const match = this.findParent(targetId);
      if (!match) return null;
      parent = match.parent;
      index = match.index + 1;
    }

    const node = createNode();
    parent.children.splice(index, 0, node);
    return {
      node,
      parentId: parent.id,
      previousSource: this.source,
    };
  }

  /**
   * Commits an edited new node or removes it when the label is empty.
   *
   * @param nodeId New node id.
   * @param text Committed label.
   * @param previousSource Source captured by `beginAdd`.
   */
  commitAdd(nodeId: string, text: string, previousSource: string): boolean {
    const node = this.findNode(nodeId);
    if (!node) return false;

    const label = text.trim();
    if (label === "") {
      this.removeNode(nodeId);
      return false;
    }

    node.text = label;
    return this.serializeAndCommit(previousSource);
  }

  /**
   * Removes a pending new node without changing source or history.
   *
   * @param nodeId New node id.
   */
  cancelAdd(nodeId: string): void {
    this.removeNode(nodeId);
  }

  /**
   * Renames an existing node.
   *
   * @param nodeId Node to rename.
   * @param text New label.
   */
  rename(nodeId: string, text: string): boolean {
    const node = this.findNode(nodeId);
    const label = text.trim();
    if (!node || label === "" || node.text === label) return false;

    const previousSource = this.source;
    node.text = label;
    return this.serializeAndCommit(previousSource);
  }

  /**
   * Deletes a node. The root is protected.
   *
   * @param nodeId Node to delete.
   * @returns The previous parent match, or null when rejected.
   */
  deleteNode(nodeId: string): ParentMatch | null {
    if (this.isRoot(nodeId)) return null;
    const match = this.findParent(nodeId);
    if (!match) return null;

    const previousSource = this.source;
    match.parent.children.splice(match.index, 1);
    this.serializeAndCommit(previousSource);
    return match;
  }

  /**
   * Moves a node under or beside another node.
   *
   * @param nodeId Node to move.
   * @param targetId Destination node.
   * @param position Child, before, or after the destination.
   */
  moveNode(nodeId: string, targetId: string, position: MovePosition): boolean {
    if (nodeId === targetId || this.isRoot(nodeId)) return false;
    const node = this.findNode(nodeId);
    const target = this.findNode(targetId);
    if (!node || !target || containsNode(node, targetId)) return false;

    const previousSource = this.source;
    const oldParent = this.findParent(nodeId);
    if (!oldParent) return false;
    oldParent.parent.children.splice(oldParent.index, 1);

    if (position === "child") {
      target.collapsed = false;
      target.children.push(node);
    } else {
      const targetParent = this.findParent(targetId);
      if (!targetParent) {
        this.document.root.children.push(node);
      } else {
        const index = targetParent.index + (position === "after" ? 1 : 0);
        targetParent.parent.children.splice(index, 0, node);
      }
    }

    return this.serializeAndCommit(previousSource);
  }

  /**
   * Toggles runtime collapse state. This does not change source.
   *
   * @param nodeId Node to toggle.
   */
  toggleCollapse(nodeId: string): boolean {
    const node = this.findNode(nodeId);
    if (!node || node.children.length === 0) return false;
    node.collapsed = !node.collapsed;
    return true;
  }

  /** Restores the previous source snapshot. */
  undo(): boolean {
    const previous = this.history.undo(this.source);
    if (previous === null) return false;
    const parsed = parseSource(previous);
    if (!parsed.document || parsed.errors.length > 0) return false;

    this.source = previous;
    this.document = parsed.document;
    this.onChange(this.source);
    return true;
  }

  /** Restores the next source snapshot. */
  redo(): boolean {
    const next = this.history.redo(this.source);
    if (next === null) return false;
    const parsed = parseSource(next);
    if (!parsed.document || parsed.errors.length > 0) return false;

    this.source = next;
    this.document = parsed.document;
    this.onChange(this.source);
    return true;
  }

  /** Removes a node from its parent without touching source. */
  private removeNode(nodeId: string): boolean {
    const match = this.findParent(nodeId);
    if (!match) return false;
    match.parent.children.splice(match.index, 1);
    return true;
  }

  /** Serializes the document and records one history entry. */
  private serializeAndCommit(previousSource: string): boolean {
    const next = serializeDocument(this.document);
    if (next === this.source) return false;

    this.source = next;
    this.history.push(previousSource);
    this.onChange(next);
    return true;
  }
}
