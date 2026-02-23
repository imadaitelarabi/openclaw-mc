import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenClaw MC",
    short_name: "OpenClaw MC",
    description: "Real-time agent monitoring dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#252525",
    theme_color: "#252525",
    icons: [
      {
        src: "/images/logos/icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/logos/icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
