import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    // Leading dot allows every Cloudflare Quick Tunnel subdomain, which changes on each tunnel restart.
    allowedHosts: [".trycloudflare.com"],
    proxy: { "/ws": { target: "ws://127.0.0.1:8080", ws: true } },
  },
  build: {
    rollupOptions: {
      input: { host: "apps/host/index.html", controller: "apps/controller/index.html" },
    },
  },
});
