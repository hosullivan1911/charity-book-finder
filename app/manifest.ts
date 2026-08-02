import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Giveleaf Books",
    short_name: "Giveleaf",
    description: "Find and manage books in participating charity shops.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4ef",
    theme_color: "#153e35",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

