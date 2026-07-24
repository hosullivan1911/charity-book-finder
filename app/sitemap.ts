import type { MetadataRoute } from "next";
import { siteConfig } from "../config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms", "/accessibility", "/support"].map(
    (path) => ({
      url: `${siteConfig.publicUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: path ? "monthly" : "daily",
      priority: path ? 0.4 : 1,
    }),
  );
}

