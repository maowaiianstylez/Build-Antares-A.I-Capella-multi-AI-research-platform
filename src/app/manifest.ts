import type { MetadataRoute } from "next";

// Lets people install Antares on their phone, tablet, computer, or car screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Antares A.I Capella",
    short_name: "Antares",
    description: "Every major AI. One answer you can trust.",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#05070d",
    theme_color: "#05070d",
    categories: ["productivity", "education", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New Deep Dive", url: "/chat", description: "Start a new question" },
      { name: "Account", url: "/account" },
    ],
  };
}
