import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The public landing page and authenticated application have separate HTML entries.
function applicationEntry() {
  function route(request, _response, next) {
    const pathname = request.url?.split("?")[0] || "/";
    if (/^\/(app|workspace|dashboard|saved|profile)(\/|$)/.test(pathname)) {
      request.url = "/app.html";
    }
    next();
  }
  return {
    name: "application-entry",
    configureServer(server) { server.middlewares.use(route); },
    configurePreviewServer(server) { server.middlewares.use(route); },
  };
}

export default defineConfig({
  plugins: [applicationEntry(), react()],
  build: {
    rollupOptions: {
      input: {
        landing: path.resolve(__dirname, "index.html"),
        application: path.resolve(__dirname, "app.html"),
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
