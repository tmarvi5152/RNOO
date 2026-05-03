/**
 * TemplateRouter
 * Resolves the correct template page for the current merchant slug.
 *
 * - For slug-based routes (/order/:slug, /order/:slug/cart, /checkout/:slug),
 *   the slug is read from useParams and the merchant's frontend_template is fetched.
 * - For non-slug routes (/track/:orderId, /order-confirmation), the last-visited
 *   merchant slug is read from sessionStorage.
 * - Template is cached per-slug in sessionStorage to avoid redundant API calls.
 */
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { TEMPLATES, DEFAULT_TEMPLATE } from "./registry";

// Module-level in-memory cache (cleared on page refresh, supplements sessionStorage)
const _cache = {};
const DEFAULT_PRESENTATION = {
  template: DEFAULT_TEMPLATE,
  themeMode: "system",
};

async function resolvePresentation(slug) {
  if (!slug) {
    // Fallback: read last visited merchant slug from sessionStorage
    const lastSlug = sessionStorage.getItem("rnoo_last_slug");
    if (lastSlug) return resolvePresentation(lastSlug);
    return DEFAULT_PRESENTATION;
  }

  if (_cache[slug]) return _cache[slug];

  const stored = sessionStorage.getItem(`rnoo_presentation_${slug}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.template && TEMPLATES[parsed.template]) {
        _cache[slug] = {
          template: parsed.template,
          themeMode: parsed.themeMode || "system",
        };
        return _cache[slug];
      }
    } catch {
      sessionStorage.removeItem(`rnoo_presentation_${slug}`);
    }
  }

  try {
    const res = await api.get(`/merchants/slug/${slug}`);
    const tmpl = res.data?.frontend_template || DEFAULT_TEMPLATE;
    const resolved = TEMPLATES[tmpl] ? tmpl : DEFAULT_TEMPLATE;
    const presentation = {
      template: resolved,
      themeMode: res.data?.theme_mode || "system",
    };
    _cache[slug] = presentation;
    sessionStorage.setItem(
      `rnoo_presentation_${slug}`,
      JSON.stringify(presentation),
    );
    sessionStorage.setItem("rnoo_last_slug", slug);
    return presentation;
  } catch {
    return DEFAULT_PRESENTATION;
  }
}

/**
 * Higher-order component factory.
 * Usage: export const TemplateMenuPage = withTemplatePage("MenuPage");
 */
function withTemplatePage(pageKey) {
  const defaultPage = TEMPLATES[DEFAULT_TEMPLATE][pageKey];

  function TemplatePage() {
    const { slug } = useParams();
    const [Page, setPage] = useState(() => defaultPage);
    const { setStorefrontTheme } = useTheme();

    useEffect(() => {
      let cancelled = false;
      resolvePresentation(slug).then((presentation) => {
        if (cancelled) return;
        const templateKey = presentation.template || DEFAULT_TEMPLATE;
        const pages = TEMPLATES[templateKey] || TEMPLATES[DEFAULT_TEMPLATE];
        setStorefrontTheme({
          brand: templateKey,
          mode: presentation.themeMode || "system",
        });
        setPage(() => pages[pageKey] || defaultPage);
      });
      return () => {
        cancelled = true;
      };
    }, [pageKey, setStorefrontTheme, slug]);

    return <Page />;
  }

  TemplatePage.displayName = `Template_${pageKey}`;
  return TemplatePage;
}

export const TemplateMenuPage = withTemplatePage("MenuPage");
export const TemplateCartPage = withTemplatePage("CartPage");
export const TemplateCheckoutPage = withTemplatePage("CheckoutPage");
export const TemplateOrderTrackingPage = withTemplatePage("OrderTrackingPage");
export const TemplateOrderConfirmationPage = withTemplatePage(
  "OrderConfirmationPage",
);
