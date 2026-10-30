import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  const site = getSiteConfig();

  return {
    name: site.title,
    short_name: site.shortName || site.title,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: site.themeColors?.light?.surface || "#e4e4e4",
    theme_color: site.themeColors?.light?.accent || "#2c2c2c",
    icons: site.logo
      ? [
          {
            src: site.logo,
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: site.logo,
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ]
      : [],
  };
}
