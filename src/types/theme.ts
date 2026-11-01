/** Node background shape. */
export type NodeShape = "rounded" | "pill" | "underline" | "plain";

/** Connector geometry. */
export type ConnectorStyle = "curve" | "orthogonal";

/** Horizontal text alignment. */
export type TextAlign = "left" | "center" | "right";

/** Visual tokens for one light or dark theme variant. */
export interface ThemeTokens {
  canvasBackground: string;
  node: {
    background: string;
    text: string;
    border: string;
    borderWidth: number;
    radius: number;
    paddingX: number;
    paddingY: number;
    shadow: string;
    shape: NodeShape;
  };
  root: {
    background: string;
    text: string;
    border: string;
    borderWidth: number;
    radius: number;
    shadow: string;
    shape: NodeShape;
  };
  branch: {
    palette: string[];
    lineWidth: number;
    opacity: number;
    style: ConnectorStyle;
    overrideColor?: string;
  };
  typography: {
    family: string;
    size: number;
    weight: number;
    lineHeight: number;
    fontStyle: "normal" | "italic";
    textAlign: TextAlign;
    textDecoration: "none" | "underline";
  };
  selection: {
    outline: string;
    background: string;
  };
  collapse: {
    background: string;
    text: string;
  };
}

/** A complete theme with light and dark variants. */
export interface ThemeDefinition {
  id: string;
  name: string;
  builtIn: boolean;
  light: ThemeTokens;
  dark: ThemeTokens;
}
