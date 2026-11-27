import { describe, expect, it } from "vitest";
import { insertSuggestion, matchInlineTrigger } from "./inlineSuggest";

describe("matchInlineTrigger", () => {
  it("matches an open note link before the caret", () => {
    expect(matchInlineTrigger("See [[Pla", 9)).toEqual({
      kind: "link",
      start: 4,
      query: "Pla",
    });
  });

  it("matches an open image embed and includes the leading bang", () => {
    expect(matchInlineTrigger("![[pho", 7)).toEqual({
      kind: "image",
      start: 0,
      query: "pho",
    });
  });

  it("ignores closed links and typed aliases", () => {
    expect(matchInlineTrigger("[[Plan]] and ", 13)).toBeNull();
    expect(matchInlineTrigger("[[Plan|Road", 11)).toBeNull();
  });

  it("ignores newlines and missing brackets", () => {
    expect(matchInlineTrigger("no link", 7)).toBeNull();
    expect(matchInlineTrigger("[[one\ntwo", 9)).toBeNull();
  });
});

describe("insertSuggestion", () => {
  it("replaces a note trigger and places the caret after it", () => {
    const value = "See [[Pla rest";
    const trigger = matchInlineTrigger(value, 9);
    expect(trigger).not.toBeNull();
    const result = insertSuggestion(value, 9, trigger!, "Plan");

    expect(result.value).toBe("See [[Plan]] rest");
    expect(result.caret).toBe(12);
  });

  it("replaces an image trigger with a complete embed", () => {
    const value = "![[pho";
    const trigger = matchInlineTrigger(value, value.length);
    const result = insertSuggestion(value, value.length, trigger!, "photo.png");

    expect(result.value).toBe("![[photo.png]]");
    expect(result.caret).toBe(14);
  });
});
