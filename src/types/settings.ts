import type { LayoutKind } from "./mindmap";
import type { ThemeDefinition } from "./theme";

/** UI language codes supported by the plugin. */
export type Language = "en" | "zh";

/** Persistent plugin settings stored in `data.json`. */
export interface SimpleMindSettings {
  language: Language;
  defaultTheme: string;
  defaultLayout: LayoutKind;
  defaultSpacingX: number;
  defaultSpacingY: number;
  defaultMaxWidth: number;
  defaultFontFamily: string;
  defaultConnectorColor: string;
  defaultLineWidth: number;
  customThemes: ThemeDefinition[];
  restoreSourceCursor: boolean;
}

/** Host surface used by the settings tab. */
export interface SimpleMindSettingsHost {
  settings: SimpleMindSettings;
  saveSettings(): Promise<void>;
  refreshMapViews(): void;
  refreshLanguage(): void;
}
