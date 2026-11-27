import type { InlineSuggestionKind } from "../../../../types/inline";

/** An unclosed `[[` or `![[` before the caret. */
export interface InlineTrigger {
  kind: InlineSuggestionKind;
  /** Index where the replacement starts, including the leading `!` for embeds. */
  start: number;
  /** Text typed between the brackets. */
  query: string;
}

/**
 * Finds the unclosed link trigger immediately before the caret.
 *
 * Closed links, aliases, sizes, and line breaks stop the trigger.
 *
 * @param value Full editor text.
 * @param caret Caret offset.
 */
export function matchInlineTrigger(value: string, caret: number): InlineTrigger | null {
  const before = value.slice(0, Math.max(0, Math.min(caret, value.length)));
  const open = before.lastIndexOf("[[");
  if (open < 0) return null;

  const closed = before.indexOf("]]", open + 2);
  if (closed >= 0) return null;

  const query = before.slice(open + 2);
  if (query.includes("|") || /[\r\n]/.test(query)) return null;

  const embedded = open > 0 && before[open - 1] === "!";
  return {
    kind: embedded ? "image" : "link",
    start: embedded ? open - 1 : open,
    query,
  };
}

/**
 * Replaces an open trigger with a complete link or embed.
 *
 * @param value Full editor text.
 * @param caret Caret offset.
 * @param trigger Open trigger to replace.
 * @param insert Link text between the brackets.
 */
export function insertSuggestion(
  value: string,
  caret: number,
  trigger: InlineTrigger,
  insert: string,
): { value: string; caret: number } {
  const token = trigger.kind === "image" ? `![[${insert}]]` : `[[${insert}]]`;
  const next = value.slice(0, trigger.start) + token + value.slice(caret);
  return { value: next, caret: trigger.start + token.length };
}
