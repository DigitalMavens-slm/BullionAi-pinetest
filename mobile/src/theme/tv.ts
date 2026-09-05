// TradingView premium tokens — light/dark
export const light = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E0E3EB",
  text: "#131722",
  muted: "#787B86",
  up: "#089981",
  down: "#F23645",
  accent: "#2962FF",
  nav: "#0F1420",
} as const;

export const dark = {
  bg: "#0F1420",
  card: "#1A1F2E",
  border: "#2A2E39",
  text: "#D1D4DC",
  muted: "#868993",
  up: "#089981",
  down: "#F23645",
  accent: "#2962FF",
  nav: "#0F1420",
} as const;

export type Theme = typeof light;
