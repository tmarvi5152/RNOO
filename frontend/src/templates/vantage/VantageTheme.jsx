import { useEffect } from "react";

const VANTAGE_STYLE_ID = "vantage-theme-style";

const VANTAGE_CSS = `
body.vantage-theme {
  --vantage-bg: #f4f1ea;
  --vantage-paper: #fffdf8;
  --vantage-ink: #1a1a1a;
  --vantage-muted: #6f6a62;
  --vantage-accent: #8b5e3c;
  --vantage-border: rgba(26, 26, 26, 0.12);
  background: var(--vantage-bg);
  color: var(--vantage-ink);
  font-family: "Avenir Next", "Segoe UI Variable", "Gill Sans", "Trebuchet MS", sans-serif;
}

body.vantage-theme h1,
body.vantage-theme h2,
body.vantage-theme h3,
body.vantage-theme h4 {
  letter-spacing: 0.01em;
  font-family: "Bodoni MT", "Didot", "Times New Roman", serif;
}

body.vantage-theme .vantage-surface {
  background: var(--vantage-paper);
  border: 1px solid var(--vantage-border);
  border-radius: 20px;
}

body.vantage-theme .vantage-pill {
  border-radius: 9999px;
  border: 1px solid var(--vantage-border);
}

body.vantage-theme .vantage-accent {
  color: var(--vantage-accent);
}

body.vantage-theme .vantage-card-hover {
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

body.vantage-theme .vantage-card-hover:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 30px rgba(15, 15, 15, 0.14);
}
`;

export const useVantageTheme = () => {
  useEffect(() => {
    document.body.classList.add("vantage-theme");

    if (!document.getElementById(VANTAGE_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = VANTAGE_STYLE_ID;
      style.textContent = VANTAGE_CSS;
      document.head.appendChild(style);
    }

    return () => {
      document.body.classList.remove("vantage-theme");
    };
  }, []);
};
