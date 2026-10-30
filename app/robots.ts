import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteConfig();
  const baseUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/site-config", "/api/trending", "/api/series", "/api/posts", "/api/comments"],
      disallow: ["/admin/", "/api/admin/", "/api/auth/", "/api/chat/", "/api/user/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
