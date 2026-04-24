import { useEffect } from "react";

const STYLE_ID = "rpower-jim-baldridge-theme";
const LEGACY_CLASS = "rpower-jim-baldridge-legacy-win98";
const LEGACY_STORAGE_KEY = "rnoo_jim_legacy_mode";

const CSS = `
body.rpower-jim-baldridge-theme {
  --rjb-bg: #0b0e12;
  --rjb-bg-alt: #11161d;
  --rjb-surface: #151b24;
  --rjb-surface-alt: #1b2330;
  --rjb-ink: #f5f7fb;
  --rjb-muted: #b6becb;
  --rjb-accent: #cf2030;
  --rjb-accent-strong: #b11928;
  --rjb-accent-soft: #e8ba53;
  --rjb-border: rgba(232, 186, 83, 0.24);
  background: var(--rjb-bg);
  color: var(--rjb-ink);
  font-family: "Segoe UI Variable", "Segoe UI", Tahoma, sans-serif;
  background-image:
    radial-gradient(1200px 540px at 8% -12%, rgba(207, 32, 48, 0.14), transparent 60%),
    radial-gradient(900px 460px at 100% 0%, rgba(232, 186, 83, 0.08), transparent 58%),
    linear-gradient(180deg, var(--rjb-bg) 0%, var(--rjb-bg-alt) 100%);
}

body.rpower-jim-baldridge-theme h1,
body.rpower-jim-baldridge-theme h2,
body.rpower-jim-baldridge-theme h3,
body.rpower-jim-baldridge-theme h4 {
  font-family: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
  letter-spacing: 0.01em;
}

body.rpower-jim-baldridge-theme .rjb-surface {
  background: linear-gradient(160deg, var(--rjb-surface) 0%, var(--rjb-surface-alt) 100%);
  border: 1px solid var(--rjb-border);
  border-radius: 18px;
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.34);
}

body.rpower-jim-baldridge-theme .rjb-pill {
  border-radius: 9999px;
  border: 1px solid var(--rjb-border);
  background: rgba(232, 186, 83, 0.1);
}

body.rpower-jim-baldridge-theme .rjb-accent {
  color: var(--rjb-accent-soft);
}

body.rpower-jim-baldridge-theme .rjb-cta {
  background: linear-gradient(180deg, var(--rjb-accent) 0%, var(--rjb-accent-strong) 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

body.rpower-jim-baldridge-theme .rjb-cta:hover {
  filter: brightness(1.04);
}

body.rpower-jim-baldridge-theme .rjb-card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

body.rpower-jim-baldridge-theme .rjb-card-hover:hover {
  transform: translateY(-2px);
  border-color: rgba(246, 196, 83, 0.45);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.35);
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 {
  --rjb-bg: #008080;
  --rjb-bg-alt: #0a6f6f;
  --rjb-surface: #c0c0c0;
  --rjb-surface-alt: #d4d0c8;
  --rjb-ink: #111111;
  --rjb-muted: #3f3f3f;
  --rjb-accent: #000080;
  --rjb-accent-strong: #000060;
  --rjb-accent-soft: #000080;
  --rjb-border: #808080;
  color: #111111;
  font-family: "Tahoma", "MS Sans Serif", "Verdana", "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.35;
  background-image:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 32%),
    linear-gradient(180deg, #008080 0%, #0a6f6f 100%);
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 h1,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 h2,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 h3,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 h4,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 h5,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 h6 {
  font-family: "Tahoma", "MS Sans Serif", "Verdana", "Segoe UI", sans-serif;
  letter-spacing: 0;
  font-weight: 700;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 p,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 span,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 label,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 li {
  color: #111111;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-surface {
  background: linear-gradient(180deg, #d4d0c8 0%, #c0c0c0 100%);
  border-width: 2px;
  border-style: solid;
  border-color: #ffffff #404040 #404040 #ffffff;
  border-radius: 0;
  box-shadow: none;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-pill {
  border-radius: 2px;
  border-width: 2px;
  border-style: solid;
  border-color: #ffffff #808080 #808080 #ffffff;
  background: #c0c0c0;
  color: #111111;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-card-hover {
  transition: none;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-card-hover:hover {
  transform: none;
  border-color: #000080;
  box-shadow: inset -1px -1px 0 #ffffff, inset 1px 1px 0 #808080;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 button,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-cta {
  border-radius: 0;
  border: 2px solid;
  border-color: #ffffff #404040 #404040 #ffffff;
  background: linear-gradient(180deg, #dfdfdf 0%, #c8c8c8 100%);
  color: #111111;
  box-shadow: none;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 button:active,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-cta:active {
  border-color: #404040 #ffffff #ffffff #404040;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 input,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 select,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 textarea {
  border-radius: 0;
  border: 2px solid;
  border-color: #808080 #ffffff #ffffff #808080;
  background: #ffffff;
  color: #111111;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 input::placeholder,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 textarea::placeholder {
  color: #505050;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 [class*="bg-[#0f1115]"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 [class*="bg-[#11151b]"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 [class*="bg-[#1a2028]"] {
  background: #008080 !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 [class*="border-[#f6c453"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 [class*="border-[#e8ba53"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 [class*="border-[#cf2030"] {
  border-color: #000080 !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-legacy-lockup {
  color: #111111;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-legacy-lockup span {
  color: #000080;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 header h1,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 header p,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 header span,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 header [class*="text-white"] {
  color: #f7f7f7 !important;
  text-shadow: 1px 1px 0 #000000;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-shell .rjb-modal-title,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-shell .rjb-modal-desc {
  color: #f7f7f7 !important;
  text-shadow: 1px 1px 0 #000000;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-surface [class*="text-white"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 [class*="bg-[#c0c0c0"] [class*="text-white"] {
  color: #111111 !important;
  text-shadow: none;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-toggle,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-drawer {
  background: linear-gradient(180deg, #d4d0c8 0%, #c0c0c0 100%) !important;
  border: 2px solid !important;
  border-color: #ffffff #404040 #404040 #ffffff !important;
  box-shadow: none !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart [class*="text-white"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart [class*="text-[#e8ba53"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart [class*="text-white/"] {
  color: #111111 !important;
  text-shadow: none;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart [class*="bg-black"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart [class*="bg-[#0d1219]"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart [class*="bg-[#1d2633]"] {
  background: #ece9d8 !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart [class*="border-[#e8ba53"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart [class*="bg-[#cf2030"] {
  border-color: #000080 !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart .rjb-cta,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-floating-cart button[class*="bg-[#cf2030"] {
  background: linear-gradient(180deg, #dfdfdf 0%, #c8c8c8 100%) !important;
  color: #111111 !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-shell {
  background: linear-gradient(180deg, #d4d0c8 0%, #c0c0c0 100%) !important;
  border: 2px solid !important;
  border-color: #ffffff #404040 #404040 #ffffff !important;
  box-shadow: none !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-close {
  background: #d4d0c8 !important;
  color: #111111 !important;
  border: 2px solid !important;
  border-color: #ffffff #404040 #404040 #ffffff !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-content,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-content [class*="text-white"],
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-content [class*="text-white/"] {
  color: #111111 !important;
  text-shadow: none;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modifier-group {
  background: #ece9d8;
  border: 2px solid #000080;
  border-radius: 0;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modifier-header {
  background: #c0c0c0 !important;
  color: #111111 !important;
  border-bottom: 2px solid #808080;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-prefix-option,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-option-button {
  background: #f4f1e6 !important;
  border: 2px solid #000080 !important;
  color: #111111 !important;
  border-radius: 0;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-notes {
  background: #ffffff !important;
  color: #111111 !important;
  border: 2px solid #000080 !important;
  border-radius: 0;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-footer {
  background: #c0c0c0 !important;
  border-top: 2px solid #808080 !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-qty-wrap {
  background: #d4d0c8 !important;
  border: 2px solid #808080 !important;
}

body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-qty-btn,
body.rpower-jim-baldridge-theme.rpower-jim-baldridge-legacy-win98 .rjb-modal-submit {
  background: linear-gradient(180deg, #dfdfdf 0%, #c8c8c8 100%) !important;
  border: 2px solid #000080 !important;
  color: #111111 !important;
  border-radius: 0;
}
`;

export const persistRpowerJimBaldridgeLegacyMode = (enabled) => {
  sessionStorage.setItem(LEGACY_STORAGE_KEY, enabled ? "true" : "false");
};

export const getPersistedRpowerJimBaldridgeLegacyMode = () => {
  return sessionStorage.getItem(LEGACY_STORAGE_KEY) === "true";
};

export const useRpowerJimBaldridgeTheme = (legacyMode) => {
  useEffect(() => {
    document.body.classList.add("rpower-jim-baldridge-theme");

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    return () => {
      document.body.classList.remove("rpower-jim-baldridge-theme");
      document.body.classList.remove(LEGACY_CLASS);
    };
  }, []);

  useEffect(() => {
    const effectiveLegacy =
      typeof legacyMode === "boolean"
        ? legacyMode
        : getPersistedRpowerJimBaldridgeLegacyMode();
    document.body.classList.toggle(LEGACY_CLASS, effectiveLegacy);
  }, [legacyMode]);
};
