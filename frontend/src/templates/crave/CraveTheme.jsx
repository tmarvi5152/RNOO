import { useEffect } from "react";

const CRAVE_STYLE_ID = "crave-theme";

const CRAVE_STYLES = `
  :root {
    --crv-accent: #ef4444;
    --crv-soft: #fff5f5;
    --crv-bg: #f8fafc;
    --crv-card: #ffffff;
    --crv-border: #e5e7eb;
    --crv-text: #0f172a;
  }

  .crv-accent-bg {
    background-color: var(--crv-accent) !important;
    color: #fff !important;
  }
`;

export function useCraveTheme() {
  useEffect(() => {
    if (!document.getElementById(CRAVE_STYLE_ID)) {
      const styleElement = document.createElement("style");
      styleElement.id = CRAVE_STYLE_ID;
      styleElement.textContent = CRAVE_STYLES;
      document.head.appendChild(styleElement);
    }
  }, []);
}
