import type { MindNode } from "../../../../types/mindmap";

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
