import { useEffect } from "react";

const ROOT_URL = "https://bullionai.digitalmavens.in";

type SeoProps = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  ogUrl?: string;
  ogImage?: string;
  canonical?: string;
};

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function useSeo({
  title = "BullionAI — AI-Powered Market Intelligence for MCX, NSE & BSE",
  description = "AI-driven verified trading signals and terminal for MCX Gold, Silver, Crude Oil and NSE/BSE equities. 14-day free trial, UPI payments. Salem, Tamil Nadu.",
  ogTitle,
  ogDescription,
  ogType = "website",
  ogUrl,
  ogImage,
  canonical,
}: SeoProps = {}) {
  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", ogTitle ?? title);
    setMeta("property", "og:description", ogDescription ?? description);
    setMeta("property", "og:type", ogType);
    setMeta("property", "og:url", ogUrl ?? ROOT_URL + window.location.pathname);
    if (ogImage) setMeta("property", "og:image", ogImage);
    setMeta("name", "twitter:title", ogTitle ?? title);
    setMeta("name", "twitter:description", ogDescription ?? description);

    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonical ?? ROOT_URL + window.location.pathname);

    // BreadcrumbList schema (skip for blog articles which inject their own)
    if (!window.location.pathname.startsWith("/blog/")) {
      const crumbs = [["Home", "/"]];
      const segments = window.location.pathname.split("/").filter(Boolean);
      let path = "";
      for (const seg of segments) {
        path += "/" + seg;
        crumbs.push([seg.replace(/-/g, " "), path]);
      }
      const bc = document.createElement("script");
      bc.type = "application/ld+json";
      bc.setAttribute("data-seo", "breadcrumb");
      bc.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map(([name, p], i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          item: ROOT_URL + p,
        })),
      });
      document.querySelectorAll('script[data-seo="breadcrumb"]').forEach(s => s.remove());
      document.head.appendChild(bc);
    }
  }, [title, description, ogTitle, ogDescription, ogType, ogUrl, ogImage, canonical]);
}