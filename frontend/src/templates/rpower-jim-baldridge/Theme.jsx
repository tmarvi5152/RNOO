import { useEffect } from "react";

const STYLE_ID = "rpower-jim-baldridge-theme";

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
`;

export const useRpowerJimBaldridgeTheme = () => {
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
    };
  }, []);
};
