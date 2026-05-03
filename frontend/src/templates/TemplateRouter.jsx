/**
 * TemplateRouter
 * Resolves the correct template page for the current merchant slug.
 *
 * - For slug-based routes (/order/:slug, /order/:slug/cart, /checkout/:slug),
 *   the slug is read from useParams and the merchant's frontend_template is fetched.
 * - For non-slug routes (/track/:orderId, /order-confirmation), the last-visited
 *   merchant slug is read from sessionStorage.
 * - Cached template values are used only as fallback if the fetch fails.
 */
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../context/AppContext";
import { TEMPLATES, DEFAULT_TEMPLATE } from "./registry";

// Module-level in-memory cache (cleared on page refresh, supplements sessionStorage)
const _cache = {};
const DEFAULT_PRESENTATION = {
  template: DEFAULT_TEMPLATE,
};

async function resolvePresentation(slug) {
  if (!slug) {
    // Fallback: read last visited merchant slug from sessionStorage
    const lastSlug = sessionStorage.getItem("rnoo_last_slug");
    if (lastSlug) return resolvePresentation(lastSlug);
    return DEFAULT_PRESENTATION;
  }

  let storedPresentation = null;
  const stored = sessionStorage.getItem(`rnoo_presentation_${slug}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.template && TEMPLATES[parsed.template]) {
        storedPresentation = {
          template: parsed.template,
        };
      }
    } catch {
      sessionStorage.removeItem(`rnoo_presentation_${slug}`);
    }
  }

  try {
    // Always fetch latest so admin template changes apply without a frontend restart.
    const res = await api.get(`/merchants/slug/${slug}`, {
      params: { _ts: Date.now() },
    });
    const tmpl = res.data?.frontend_template || DEFAULT_TEMPLATE;
    const resolved = TEMPLATES[tmpl] ? tmpl : DEFAULT_TEMPLATE;
    const presentation = {
      template: resolved,
    };
    _cache[slug] = presentation;
    sessionStorage.setItem(
      `rnoo_presentation_${slug}`,
      JSON.stringify(presentation),
    );
    sessionStorage.setItem("rnoo_last_slug", slug);
    return presentation;
  } catch {
    if (_cache[slug]) return _cache[slug];
    if (storedPresentation) return storedPresentation;
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

    useEffect(() => {
      let cancelled = false;
      resolvePresentation(slug).then((presentation) => {
        if (cancelled) return;
        const templateKey = presentation.template || DEFAULT_TEMPLATE;
        const pages = TEMPLATES[templateKey] || TEMPLATES[DEFAULT_TEMPLATE];
        setPage(() => pages[pageKey] || defaultPage);
      });
      return () => {
        cancelled = true;
      };
    }, [slug]);

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
