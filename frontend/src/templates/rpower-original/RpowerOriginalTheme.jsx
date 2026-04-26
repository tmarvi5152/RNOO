import { useEffect } from "react";

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

/* ── Base ────────────────────────────────────────────────────────────── */
body.rpower-original-theme {
  --ro-red:     #cc0000;
  --ro-red-dk:  #a50000;
  --ro-navy:    #0f172a;
  --ro-text:    #1e293b;
  --ro-mid:     #475569;
  --ro-muted:   #94a3b8;
  --ro-bg:      #f8fafc;
  --ro-surface: #ffffff;
  --ro-border:  #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Helvetica, Arial, sans-serif;
  background: var(--ro-bg);
  color: var(--ro-text);
  -webkit-font-smoothing: antialiased;
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
  background: var(--ro-surface);
  border-bottom: 1px solid var(--ro-border);
  position: sticky;
  top: 67px;
  z-index: 40;
}

body.rpower-original-theme .ro-cat-btn {
  white-space: nowrap;
  padding: 0.8125rem 1.125rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--ro-mid);
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

body.rpower-original-theme .ro-cat-btn:hover {
  color: var(--ro-text);
}

body.rpower-original-theme .ro-cat-btn.ro-cat-active {
  color: var(--ro-red);
  border-bottom-color: var(--ro-red);
}

/* ── Product card ────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-card {
  background: var(--ro-surface);
  border: 1px solid var(--ro-border);
  border-radius: 6px;
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
  background: var(--ro-surface);
  border: 1px solid var(--ro-border);
  border-radius: 8px;
}

/* ── Buttons ─────────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-btn-primary {
  background: var(--ro-red);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.8125rem;
  letter-spacing: 0.05em;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}

body.rpower-original-theme .ro-btn-primary:hover:not(:disabled) {
  background: var(--ro-red-dk);
}

body.rpower-original-theme .ro-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

body.rpower-original-theme .ro-btn-outline {
  background: transparent;
  color: var(--ro-text);
  font-weight: 600;
  font-size: 0.8125rem;
  letter-spacing: 0.03em;
  border: 1px solid var(--ro-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}

body.rpower-original-theme .ro-btn-outline:hover {
  border-color: var(--ro-red);
  color: var(--ro-red);
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
  border-radius: 4px;
  overflow: hidden;
}

body.rpower-original-theme .ro-qty button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ro-bg);
  border: none;
  cursor: pointer;
  color: var(--ro-text);
  transition: background 0.12s;
}

body.rpower-original-theme .ro-qty button:hover {
  background: #e2e8f0;
}

body.rpower-original-theme .ro-qty span {
  min-width: 36px;
  text-align: center;
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--ro-text);
  border-left: 1px solid var(--ro-border);
  border-right: 1px solid var(--ro-border);
  line-height: 32px;
}

/* ── Inputs ──────────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-input {
  width: 100%;
  background: var(--ro-surface);
  border: 1px solid var(--ro-border);
  border-radius: 4px;
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
  background: var(--ro-surface);
  border: 1px solid var(--ro-border);
  border-radius: 4px;
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
  background: var(--ro-surface);
  border: 1px solid var(--ro-border);
  border-radius: 4px;
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
  border-radius: 6px;
  overflow: hidden;
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
  background: var(--ro-red);
  color: #ffffff;
}

/* ── Tip selector ────────────────────────────────────────────────────── */
body.rpower-original-theme .ro-tip-btn {
  padding: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--ro-border);
  border-radius: 4px;
  background: var(--ro-bg);
  color: var(--ro-text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  text-align: center;
  flex: 1;
}

body.rpower-original-theme .ro-tip-btn.ro-tip-active {
  border-color: var(--ro-red);
  background: var(--ro-red);
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
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

body.rpower-original-theme .ro-pay-option:hover {
  border-color: #94a3b8;
}

body.rpower-original-theme .ro-pay-option.ro-pay-active {
  border-color: var(--ro-red);
  background: #fff5f5;
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
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 1200px 100%;
  animation: ro-shimmer 1.4s infinite linear;
  border-radius: 4px;
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
