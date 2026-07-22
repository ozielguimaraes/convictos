import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    {
      // Mesmo rewrite do server/index.js: /rifa/<id> abre a página do ranking.
      name: "rifa-rest-path",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (/^\/rifa\/[0-9a-f-]{36}\/?$/i.test(req.url.split("?")[0])) req.url = "/rifa/";
          next();
        });
      },
    },
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        links: resolve(__dirname, "links/index.html"),
        avisos: resolve(__dirname, "avisos/index.html"),
        rifa: resolve(__dirname, "rifa/index.html"),
        admin: resolve(__dirname, "admin/index.html"),
        cardapio: resolve(__dirname, "cardapio/index.html"),
        cardapioAdmin: resolve(__dirname, "cardapio/admin/index.html"),
      },
    },
  },
});
