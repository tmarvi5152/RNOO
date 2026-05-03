import { useEffect } from "react";

const VELOCITY_STYLE_ID = "velocity-theme";

const VELOCITY_STYLES = `
  :root {
    --vel-accent: #ff4405;
    --vel-accent-light: #fff1ed;
    --vel-bg: #f4f4f4;
    --vel-card: #ffffff;
    --vel-border: #e8e8e8;
    --vel-text: #111111;
  }

  .vel-accent-bg {
    background-color: var(--vel-accent) !important;
    color: #fff !important;
  }

  .vel-required-bg {
    background-color: #fff1ee;
    border: 1.5px solid #ffc4b8;
  }
`;

export function useVelocityTheme() {
  useEffect(() => {
    if (!document.getElementById(VELOCITY_STYLE_ID)) {
      const styleElement = document.createElement("style");
      styleElement.id = VELOCITY_STYLE_ID;
      styleElement.textContent = VELOCITY_STYLES;
      document.head.appendChild(styleElement);
    }
  }, []);
}
