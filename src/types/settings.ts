import type { LayoutKind, NodeAlignment, TreeDirection } from "./mindmap";
import type { ThemeDefinition } from "./theme";

/** UI language codes supported by the plugin. */
export type Language = "en" | "zh";

/** Persistent plugin settings stored in `data.json`. */
export interface SimpleMindSettings {
  language: Language;
  defaultTheme: string;
  defaultLayout: LayoutKind;
  defaultDirection: TreeDirection;
  defaultSpacingX: number;
  defaultSpacingY: number;
  defaultAlign: NodeAlignment;
  defaultCompact: boolean;
  defaultMaxWidth: number;
  customThemes: ThemeDefinition[];
  restoreSourceCursor: boolean;
}
