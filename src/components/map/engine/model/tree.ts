import type { MindNode } from "../../../../types/mindmap";

/** Parent and child index of a matched node. */
export interface ParentMatch {
  parent: MindNode;
  index: number;
}

/**
 * Finds a node by id in a tree.
 *
 * @param root Tree root.
 * @param id Node id to find.
 */
export function findNodeById(root: MindNode, id: string): MindNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Finds a node's parent and index.
 *
 * @param root Tree root.
 * @param id Node id to find.
 */
export function findParentById(root: MindNode, id: string): ParentMatch | null {
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === id) return { parent: root, index };
    const found = findParentById(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Returns true when `ancestor` contains `id` anywhere in its subtree.
 *
 * @param ancestor Candidate ancestor.
 * @param id Node id to look for.
 */
export function containsNode(ancestor: MindNode, id: string): boolean {
  if (ancestor.id === id) return true;
  return ancestor.children.some((child) => containsNode(child, id));
}
