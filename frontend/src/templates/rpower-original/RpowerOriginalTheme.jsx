import { useEffect } from "react";
import rpowerBackground from "../../images/RPOWER_Background.jpg";
import rpowerButtons from "../../images/Rpower_Buttons.png";

const THEME_STYLE_ID = "rpower-original-theme-style";

/*
 * RPOWER Original — Design System
 * Inspired by rpowerpos.com: clean, corporate, professional.
 *
 * Palette
 *   Red      #cc0000   Brand primary / CTAs
 *   Red DK   #a50000   Hover state
 *   Navy     #0f172a   Header background
 *   Text     #1e293b   Body copy
 *   Mid      #475569   Secondary text
 *   Muted    #94a3b8   Placeholder / tertiary
 *   BG       #f8fafc   Page background
 *   Surface  #ffffff   Cards / panels
 *   Border   #e2e8f0   Subtle dividers
 */

const RPOWER_ORIGINAL_CSS = `

@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@500;600;700&display=swap');

/* ── Base ────────────────────────────────────────────────────────────── */
body.rpower-original-theme {
  --ro-red:     #d3ad67;
  --ro-red-dk:  #b28a43;
  --ro-navy:    #0f172a;
  --ro-text:    #f1f5f9;
  --ro-mid:     #cbd5e1;
  --ro-muted:   #94a3b8;
  --ro-bg:      #f8fafc;
  --ro-surface: #0f172a;
  --ro-surface-alt: #111827;
  --ro-border:  rgba(255,255,255,0.16);
  --ro-btn-bg: url('${rpowerButtons}');
  --ro-panel-bg:
    linear-gradient(180deg, rgba(15, 23, 42, 0.56) 0%, rgba(17, 24, 39, 0.66) 100%),
    url('${rpowerButtons}');
  --ro-button-bg: linear-gradient(180deg, #0f172a 0%, #111827 100%);
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
  background: var(--ro-bg) url('${rpowerBackground}') center top / cover fixed no-repeat;
  color: var(--ro-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body.rpower-original-theme h1,
body.rpower-original-theme h2,
body.rpower-original-theme h3,
body.rpower-original-theme .ro-btn-primary,
body.rpower-original-theme .ro-btn-outline,
body.rpower-original-theme .ro-cat-btn,
body.rpower-original-theme .ro-label {
  font-family: 'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif;
}

body.rpower-original-theme,
body.rpower-original-theme * {
  text-shadow: none;
}

/* ── Sticky header (dark navy) ───────────────────────────────────────── */
body.rpower-original-theme .ro-header {
  background: var(--ro-navy);
  border-bottom: 3px solid var(--ro-red);
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
}

/* ── Category strip ──────────────────────────────────────────────────── */
body.rpower-original-theme .ro-cat-strip {
  background: transparent;
  border-bottom: 1px solid var(--ro-border);
  position: sticky;
  top: 0;
  z-index: 40;
  box-shadow: none;
}

body.rpower-original-theme .ro-cat-btn {
  white-space: nowrap;
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--ro-mid);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  background-image: var(--ro-btn-bg);
  background-size: cover;
  background-position: center;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, filter 0.15s;
}

body.rpower-original-theme .ro-cat-btn:hover {
  color: var(--ro-text);
  filter: brightness(1.05);
}

body.rpower-original-theme .ro-cat-btn.ro-cat-active {
  color: #ffffff;
  border-color: var(--ro-red);
  box-shadow: inset 0 -2px 0 var(--ro-red), 0 8px 18px rgba(0,0,0,0.22);
}

/* ── Product card ────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-card {
  background-image:
    linear-gradient(180deg, rgba(15, 23, 42, 0.34) 0%, rgba(17, 24, 39, 0.44) 100%),
    var(--ro-btn-bg);
  background-size: 100% 100%, cover;
  background-position: center;
  border: 1px solid var(--ro-border);
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}

body.rpower-original-theme .ro-card:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.10);
  transform: translateY(-2px);
}

/* ── Panel / surface ─────────────────────────────────────────────────── */
body.rpower-original-theme .ro-panel {
  background-image: var(--ro-panel-bg);
  background-size: 100% 100%, cover;
  background-position: center;
  border: 1px solid var(--ro-border);
  border-radius: 20px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}

body.rpower-original-theme .ro-emphasis-copy {
  font-size: 0.78rem;
  line-height: 1.4;
  font-weight: 500;
}

body.rpower-original-theme .ro-price {
  font-size: 1.3rem;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.01em;
}

body.rpower-original-theme .ro-cta-text {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

/* ── Buttons ─────────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-btn-primary {
  background: var(--ro-button-bg);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.82rem;
  letter-spacing: 0.02em;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  cursor: pointer;
  transition: filter 0.15s, border-color 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  box-shadow: 0 8px 18px rgba(0,0,0,0.24);
}

body.rpower-original-theme .ro-btn-primary:hover:not(:disabled) {
  filter: brightness(0.92);
}

body.rpower-original-theme .ro-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

body.rpower-original-theme .ro-btn-outline {
  background: var(--ro-button-bg);
  color: #ffffff;
  font-weight: 600;
  font-size: 0.82rem;
  letter-spacing: 0.03em;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  cursor: pointer;
  transition: filter 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}

body.rpower-original-theme .ro-btn-outline:hover {
  filter: brightness(0.92);
}

body.rpower-original-theme .ro-btn-ghost {
  background: transparent;
  color: var(--ro-muted);
  font-size: 0.8125rem;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0;
  transition: color 0.15s;
}

body.rpower-original-theme .ro-btn-ghost:hover {
  color: var(--ro-text);
}

/* ── Quantity control ────────────────────────────────────────────────── */
body.rpower-original-theme .ro-qty {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ro-border);
  border-radius: 14px;
  overflow: hidden;
  background-image: var(--ro-panel-bg);
  background-size: cover;
  background-position: center;
}

body.rpower-original-theme .ro-qty button {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15,23,42,0.82);
  border: none;
  cursor: pointer;
  color: var(--ro-text);
  transition: background 0.12s;
}

body.rpower-original-theme .ro-qty button:hover {
  background: rgba(30,41,59,0.92);
}

body.rpower-original-theme .ro-qty button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(211, 173, 103, 0.35);
}

body.rpower-original-theme .ro-qty button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

body.rpower-original-theme .ro-qty span {
  min-width: 44px;
  text-align: center;
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--ro-text);
  border-left: 1px solid var(--ro-border);
  border-right: 1px solid var(--ro-border);
  line-height: 44px;
}

/* ── Inputs ──────────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-input {
  width: 100%;
  background-image: var(--ro-panel-bg);
  background-size: cover;
  background-position: center;
  border: 1px solid var(--ro-border);
  border-radius: 14px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--ro-text);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

body.rpower-original-theme .ro-input:focus {
  border-color: var(--ro-red);
  box-shadow: 0 0 0 3px rgba(204,0,0,0.12);
}

body.rpower-original-theme .ro-input::placeholder {
  color: var(--ro-muted);
}

body.rpower-original-theme .ro-select {
  width: 100%;
  background-image: var(--ro-panel-bg);
  background-size: cover;
  background-position: center;
  border: 1px solid var(--ro-border);
  border-radius: 14px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--ro-text);
  outline: none;
  transition: border-color 0.15s;
}

body.rpower-original-theme .ro-select:focus {
  border-color: var(--ro-red);
  box-shadow: 0 0 0 3px rgba(204,0,0,0.12);
}

body.rpower-original-theme .ro-textarea {
  width: 100%;
  background-image: var(--ro-panel-bg);
  background-size: cover;
  background-position: center;
  border: 1px solid var(--ro-border);
  border-radius: 14px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--ro-text);
  outline: none;
  resize: vertical;
  transition: border-color 0.15s, box-shadow 0.15s;
}

body.rpower-original-theme .ro-textarea:focus {
  border-color: var(--ro-red);
  box-shadow: 0 0 0 3px rgba(204,0,0,0.12);
}

/* ── Section label (micro uppercase) ────────────────────────────────── */
body.rpower-original-theme .ro-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--ro-mid);
}

/* ── Divider ─────────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-divider {
  height: 1px;
  background: var(--ro-border);
}

/* ── Toggle (order type: pickup / delivery) ──────────────────────────── */
body.rpower-original-theme .ro-toggle-wrap {
  display: inline-flex;
  border: 1px solid var(--ro-border);
  border-radius: 16px;
  overflow: hidden;
  background-image: var(--ro-panel-bg);
  background-size: cover;
  background-position: center;
}

body.rpower-original-theme .ro-toggle-btn {
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--ro-mid);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

body.rpower-original-theme .ro-toggle-btn.ro-toggle-active {
  background: var(--ro-button-bg);
  color: #ffffff;
}

/* ── Tip selector ────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-tip-btn {
  padding: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--ro-border);
  border-radius: 14px;
  background-image: var(--ro-panel-bg);
  background-size: cover;
  background-position: center;
  color: var(--ro-text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  text-align: center;
  flex: 1;
}

body.rpower-original-theme .ro-tip-btn.ro-tip-active {
  background: var(--ro-button-bg);
  border-color: var(--ro-red);
  color: #ffffff;
}

body.rpower-original-theme .ro-tip-btn:not(.ro-tip-active):hover {
  border-color: var(--ro-red);
  color: var(--ro-red);
}

/* ── Payment method option ───────────────────────────────────────────── */
body.rpower-original-theme .ro-pay-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--ro-border);
  border-radius: 16px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  background-image: var(--ro-panel-bg);
  background-size: cover;
  background-position: center;
}

body.rpower-original-theme .ro-pay-option:hover {
  border-color: #94a3b8;
}

body.rpower-original-theme .ro-pay-option.ro-pay-active {
  border-color: var(--ro-red);
  background: rgba(204, 0, 0, 0.18);
}

/* ── Radio ───────────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-radio {
  accent-color: var(--ro-red);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ── Skeleton shimmer ────────────────────────────────────────────────── */
@keyframes ro-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}

body.rpower-original-theme .ro-skeleton {
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.18) 25%, rgba(203, 213, 225, 0.26) 50%, rgba(148, 163, 184, 0.18) 75%);
  background-size: 1200px 100%;
  animation: ro-shimmer 1.4s infinite linear;
  border-radius: 16px;
}

/* ── Scrollbar hide ──────────────────────────────────────────────────── */
body.rpower-original-theme .ro-scroll-x {
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
body.rpower-original-theme .ro-scroll-x::-webkit-scrollbar { display: none; }

`;

export const useRpowerOriginalTheme = () => {
  useEffect(() => {
    document.body.classList.add("rpower-original-theme");
    if (!document.getElementById(THEME_STYLE_ID)) {
      const el = document.createElement("style");
      el.id = THEME_STYLE_ID;
      el.textContent = RPOWER_ORIGINAL_CSS;
      document.head.appendChild(el);
    }
    return () => {
      document.body.classList.remove("rpower-original-theme");
    };
  }, []);
};
