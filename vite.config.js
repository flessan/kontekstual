import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        coba: "coba/index.html",
        docs: "docs/index.html",
        grammar: "docs/grammar/index.html",
        reference: "docs/reference/index.html",
        tutorial: "docs/tutorial/index.html",
        agent: "agent/index.html"
      }
    }
  }
});
