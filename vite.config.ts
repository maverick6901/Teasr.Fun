import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async () => ({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID
      ? [
          (await import("@replit/vite-plugin-cartographer")).cartographer(),
          (await import("@replit/vite-plugin-dev-banner")).devBanner(),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./client/src"),
      "@shared": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./shared"),
      "@assets": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./attached_assets"),
      buffer: "buffer",
    },
  },
  root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./client"),
  build: {
    outDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173, // Vite frontend port (different from backend)
    strictPort: false,
    hmr: process.env.REPL_ID
      ? {
          protocol: "wss",
          host: `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`,
        }
      : true, // local dev
    proxy: {
      "/api": "http://localhost:5000", // forward API requests to Express
    },
    fs: {
      strict: false,
      deny: ["**/.*"],
    },
  },
  define: {
    global: "globalThis",
    "process.env": {},
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
}));