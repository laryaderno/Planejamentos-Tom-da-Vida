/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Guarda o app no navegador para abrir mesmo sem internet (§7).
    // Os dados vêm da cópia local das consultas (src/lib/offline/cache.ts); a API não é guardada aqui.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32.png", "favicon-64.png", "apple-touch-icon.png", "logo-tom-da-vida.png"],
      manifest: {
        name: "Planejamento de Aulas — Escola Tom da Vida",
        short_name: "Tom da Vida",
        lang: "pt-BR",
        start_url: "/",
        display: "standalone",
        background_color: "#F5F5F5",
        theme_color: "#6B9C7A",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "fontes", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts"],
    env: { TZ: "America/Campo_Grande" },
  },
});
