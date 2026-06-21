import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "favicon.ico"],
      manifest: {
        name: "Habitdashery",
        short_name: "Habitdashery",
        description: "4-week habit reinforcement: build do/don't habits, keep streaks, earn stars.",
        theme_color: "#6d28d9",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,png,woff2}"]
      },
      devOptions: { enabled: true }
    })
  ],
  test: {
    environment: "node"
  }
});
