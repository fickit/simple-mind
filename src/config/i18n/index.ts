import type { Language } from "../../types/settings";
import { en, type MessageKey } from "./en";
import { zh } from "./zh";

let language: Language = "en";

/** Sets the active UI language. */
export function setLanguage(next: Language): void {
  language = next;
}

/** Returns the active UI language. */
export function getLanguage(): Language {
  return language;
}

/**
 * Resolves a translated message and interpolates `{name}` placeholders.
 *
 * @param key Message key.
 * @param params Placeholder values.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = (language === "zh" ? zh : en)[key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}
