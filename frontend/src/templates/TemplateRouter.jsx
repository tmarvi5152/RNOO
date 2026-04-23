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
import { TEMPLATES, DEFAULT_TEMPLATE } from "./registry";

// Module-level in-memory cache (cleared on page refresh, supplements sessionStorage)
const _cache = {};

async function resolveTemplate(slug) {
  if (!slug) {
    // Fallback: read last visited merchant slug from sessionStorage
    const lastSlug = sessionStorage.getItem("rnoo_last_slug");
    if (lastSlug) return resolveTemplate(lastSlug);
    return DEFAULT_TEMPLATE;
  }

  if (_cache[slug]) return _cache[slug];

  const stored = sessionStorage.getItem(`rnoo_tmpl_${slug}`);
  if (stored && TEMPLATES[stored]) {
    _cache[slug] = stored;
    return stored;
  }

  try {
    const res = await api.get(`/merchants/slug/${slug}`);
    const tmpl = res.data?.frontend_template || DEFAULT_TEMPLATE;
    const resolved = TEMPLATES[tmpl] ? tmpl : DEFAULT_TEMPLATE;
    _cache[slug] = resolved;
    sessionStorage.setItem(`rnoo_tmpl_${slug}`, resolved);
    sessionStorage.setItem("rnoo_last_slug", slug);
    return resolved;
  } catch {
    return DEFAULT_TEMPLATE;
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
      resolveTemplate(slug).then((tmpl) => {
        if (cancelled) return;
        const pages = TEMPLATES[tmpl] || TEMPLATES[DEFAULT_TEMPLATE];
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
