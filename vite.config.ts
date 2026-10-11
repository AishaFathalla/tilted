import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: [".trycloudflare.com"],
    proxy: { "/ws": { target: "ws://127.0.0.1:8080", ws: true } },
  },
  build: {
    rollupOptions: {
      input: { main: "index.html", host: "apps/host/index.html", controller: "apps/controller/index.html" },
    },
  },
});
