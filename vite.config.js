import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Allow the sandbox preview host (and any other host) to reach the dev server.
    allowedHosts: true
  },
  preview: {
    allowedHosts: true
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        coba: "coba/index.html",
        docs: "docs/index.html",
        grammar: "docs/grammar/index.html",
        reference: "docs/reference/index.html",
        tutorial: "docs/tutorial/index.html",
        agent: "agent/index.html",
        try: "try/index.html"
      }
    }
  }
});
