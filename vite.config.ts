import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest", // własny SW z obsługą push: pwa/sw.ts
      srcDir: "pwa",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png}"] },
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Domek",
        short_name: "Domek",
        description: "Domowa logistyka: zakupy, zadania, kalendarz, jedzenie.",
        lang: "pl",
        start_url: "/",
        display: "standalone",
        background_color: "#f2f5f3",
        theme_color: "#0f5f5c",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }
    })
  ]
});
