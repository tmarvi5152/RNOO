import { useEffect } from "react";

const JUKEBOX_THEME = `
:root {
  --juke-bg: #d7ead9;
  --juke-mint: #c8e7d7;
  --juke-ink: #2f2b27;
  --juke-neon-pink: #ff47ad;
  --juke-neon-cyan: #67f4ff;
  --juke-red: #b1262b;
  --juke-red-deep: #7d161a;
  --juke-accent: #b1262b;
  --juke-paper: #fcf8ec;
  --juke-chrome-1: #e9edf0;
  --juke-chrome-2: #a7afb6;
  --juke-chrome-3: #5d646b;
}

.juke-shell {
  min-height: 100vh;
  color: var(--juke-ink);
  background:
    radial-gradient(circle at 10% -10%, rgba(255, 255, 255, 0.5), transparent 38%),
    radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.35), transparent 30%),
    var(--juke-bg);
}

.juke-hero {
  border: 2px solid #6c7480;
  background:
    radial-gradient(circle at 50% -40%, rgba(104, 39, 89, 0.5), transparent 65%),
    linear-gradient(180deg, #1f2631 0%, #161b22 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -2px 0 rgba(0, 0, 0, 0.46),
    0 12px 24px rgba(0, 0, 0, 0.35);
}

.juke-neon {
  font-family: "Pacifico", "Lobster", "Brush Script MT", cursive;
  color: #ffb9df;
  text-shadow:
    0 0 4px rgba(255, 255, 255, 0.95),
    0 0 10px rgba(255, 71, 173, 0.95),
    0 0 22px rgba(255, 71, 173, 0.85),
    0 0 36px rgba(103, 244, 255, 0.5);
  animation: juke-neon-flicker 4.6s infinite;
}

@keyframes juke-neon-flicker {
  0%, 18%, 22%, 58%, 62%, 100% { opacity: 1; }
  20%, 60% { opacity: 0.86; }
  61% { opacity: 0.93; }
}

.juke-chrome-edge {
  border: 2px solid #5f666d;
  background:
    linear-gradient(180deg, var(--juke-chrome-1) 0%, var(--juke-chrome-2) 52%, var(--juke-chrome-3) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.juke-checker {
  height: 12px;
  background:
    linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111),
    linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111);
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
}

.juke-cat-btn {
  border: 2px solid #6d6f72;
  background: linear-gradient(180deg, #f5f0e4, #ddd6c8);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  font-family: "Lobster", "Pacifico", "Brush Script MT", cursive;
  text-transform: none;
  letter-spacing: 0.01em;
}

.juke-cat-btn.active {
  color: #fff;
  border-color: #7d161a;
  background: linear-gradient(180deg, #d4454c, #9b2229);
}

.juke-item-card {
  border: 2px solid #d8d0bf;
  border-bottom-width: 5px;
  border-radius: 10px;
  background: var(--juke-paper);
  box-shadow:
    0 6px 15px rgba(63, 49, 36, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.juke-polaroid {
  position: relative;
  padding: 6px 6px 12px;
  border: 1px solid rgba(75, 58, 43, 0.18);
  border-radius: 6px;
  background: #fffdf8;
  box-shadow:
    0 6px 14px rgba(49, 35, 21, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  transform: rotate(-2deg);
}

.juke-polaroid::after {
  content: "";
  position: absolute;
  top: 7px;
  left: 50%;
  width: 32px;
  height: 10px;
  transform: translateX(-50%) rotate(1deg);
  background: rgba(255, 245, 195, 0.75);
  border: 1px solid rgba(110, 97, 73, 0.12);
}

.juke-no-photo-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid rgba(125, 22, 26, 0.18);
  border-radius: 999px;
  background: rgba(177, 38, 43, 0.08);
  color: var(--juke-red-deep);
}

.juke-item-title {
  font-family: "Lobster", "Pacifico", "Brush Script MT", cursive;
}

.juke-add-btn {
  border: 1px solid #5f0c12;
  border-radius: 999px;
  color: #fff8f8;
  font-family: "Arial Narrow", Arial, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: linear-gradient(180deg, #d8454d 0%, #a21f27 54%, #7a1319 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.38),
    0 4px 10px rgba(0, 0, 0, 0.3);
}

.juke-modal {
  border: 3px solid #5f676d;
  background:
    linear-gradient(145deg, rgba(234, 238, 242, 0.98), rgba(179, 186, 194, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 -1px 0 rgba(0, 0, 0, 0.28),
    0 30px 40px rgba(0, 0, 0, 0.42);
}

.juke-modal-inner {
  border: 2px solid #8ea5a0;
  background: linear-gradient(180deg, #f6f2e7, #ece4d5);
}

.juke-choice {
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 2px solid #656a70;
  background: linear-gradient(180deg, #f0f3f5, #cfd7de);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.juke-choice:checked {
  background: radial-gradient(circle at 50% 45%, #f26c6f 0 34%, #9f1d24 35% 100%);
}

.juke-pad {
  border: 2px solid #9ca9a1;
  background:
    linear-gradient(180deg, #d7efe3 0%, #c5e1d2 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    0 12px 24px rgba(0, 0, 0, 0.22);
}

.juke-clipboard {
  height: 26px;
  border: 1px solid #8a8f94;
  background:
    radial-gradient(circle at 10px 12px, #666 3px, transparent 4px) 0 0 / 18px 26px,
    linear-gradient(180deg, #dddfe2, #b8bec5);
}

.juke-pad-item {
  border-bottom: 1px dotted rgba(64, 83, 74, 0.38);
}

.juke-pad-item-name {
  font-family: "Segoe Print", "Segoe Script", "Brush Script MT", cursive;
  font-size: 18px;
}

.juke-pad-item-price {
  font-family: "Courier New", monospace;
}

.juke-ring-btn {
  border: 1px solid #3f3530;
  border-radius: 8px;
  color: #fff9f7;
  font-family: "Arial Narrow", Arial, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: linear-gradient(180deg, #4e4a45, #262321);
}

.juke-register {
  border: 3px solid #6f767b;
  background: linear-gradient(180deg, #e1efe6, #d3e2d9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.juke-register-input {
  border: 3px solid #5f666d;
  background: #f9f7f1;
  box-shadow: inset 0 2px 0 rgba(0, 0, 0, 0.08);
}

.juke-checkout-input {
  border: 2px solid #6a7177;
  border-radius: 10px;
  background: linear-gradient(180deg, #fffef7 0%, #f1e8d8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 0 rgba(0, 0, 0, 0.14),
    0 2px 6px rgba(44, 30, 20, 0.12);
}

.juke-checkout-input:focus {
  outline: none;
  border-color: #9d2027;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 0 0 2px rgba(157, 32, 39, 0.2),
    0 2px 8px rgba(44, 30, 20, 0.16);
}

.juke-checkout-btn {
  border: 2px solid #5b6168;
  border-radius: 10px;
  background: linear-gradient(180deg, #f8f2e6 0%, #ded5c2 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 3px 7px rgba(0, 0, 0, 0.16);
  color: #3f352e;
  font-family: "Arial Narrow", Arial, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.juke-checkout-btn.active {
  color: #fff7f7;
  border-color: #6e1118;
  background: linear-gradient(180deg, #d84b53 0%, #b1262b 50%, #7f171d 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 5px 10px rgba(110, 17, 24, 0.3);
}

.juke-checkout-chip {
  border: 2px solid #575e64;
  border-radius: 999px;
  background: linear-gradient(180deg, #fbf7ef 0%, #e9decb 100%);
  color: #3c332d;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.juke-checkout-chip.active {
  border-color: #6e1118;
  color: #fff7f7;
  background: linear-gradient(180deg, #d94a52 0%, #ae2229 100%);
}

.juke-ticket-card {
  border: 3px solid #a22a2d;
  border-radius: 8px;
  background: repeating-linear-gradient(90deg, #c8393a 0 10px, #b0282c 10px 20px);
  color: #fff;
}

.juke-route {
  border: 2px solid #6f6a5e;
  background: #f9f2df;
}

.juke-route-line {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: repeating-linear-gradient(
    90deg,
    #443e37 0 10px,
    #f9f2df 10px 20px
  );
}

.juke-route-car {
  position: absolute;
  top: -14px;
  transform: translateX(-50%);
  transition: left 240ms ease;
}
`;

export function useJukeboxTheme() {
  useEffect(() => {
    const id = "jukebox-vintage-diner-theme";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = JUKEBOX_THEME;
      document.head.appendChild(style);
    }
  }, []);
}
