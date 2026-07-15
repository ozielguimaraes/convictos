/* Cenários de fundo da página inicial. O tema salvo no perfil é
   { scenario, text_color, button_color, button_text_color } — cores vazias
   caem no padrão do cenário. */
export const SCENARIOS = {
  noite: {
    label: "Noite",
    bg: "linear-gradient(160deg, #0f0c29 0%, #1a1a2e 50%, #24243e 100%)",
    text: "#f5f5f7",
    button: "rgba(255,255,255,0.12)",
    buttonText: "#ffffff",
  },
  aurora: {
    label: "Aurora",
    bg: "linear-gradient(160deg, #42275a 0%, #734b6d 60%, #b06ab3 100%)",
    text: "#fdf4ff",
    button: "rgba(255,255,255,0.16)",
    buttonText: "#ffffff",
  },
  oceano: {
    label: "Oceano",
    bg: "linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    text: "#e8f7fa",
    button: "rgba(255,255,255,0.14)",
    buttonText: "#ffffff",
  },
  floresta: {
    label: "Floresta",
    bg: "linear-gradient(160deg, #11998e 0%, #0b5345 100%)",
    text: "#f0fff8",
    button: "rgba(255,255,255,0.16)",
    buttonText: "#ffffff",
  },
  "por-do-sol": {
    label: "Pôr do sol",
    bg: "linear-gradient(160deg, #ff512f 0%, #dd2476 100%)",
    text: "#fff8f5",
    button: "rgba(255,255,255,0.2)",
    buttonText: "#ffffff",
  },
  claro: {
    label: "Claro",
    bg: "linear-gradient(160deg, #f5f7fa 0%, #e4e9f0 100%)",
    text: "#1f2937",
    button: "#1f2937",
    buttonText: "#ffffff",
  },
};

export const DEFAULT_SCENARIO = "noite";

export function resolveTheme(theme) {
  const scenario = SCENARIOS[theme?.scenario] ? theme.scenario : DEFAULT_SCENARIO;
  const base = SCENARIOS[scenario];
  return {
    scenario,
    bg: base.bg,
    text: theme?.text_color || base.text,
    button: theme?.button_color || base.button,
    buttonText: theme?.button_text_color || base.buttonText,
  };
}

export function applyTheme(theme) {
  const t = resolveTheme(theme);
  const root = document.documentElement;
  root.style.setProperty("--bg", t.bg);
  root.style.setProperty("--text", t.text);
  root.style.setProperty("--button", t.button);
  root.style.setProperty("--button-text", t.buttonText);
}
