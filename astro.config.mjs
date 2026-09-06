import { defineConfig } from "astro/config";
import db from "@astrojs/db";
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";

export default defineConfig({
  output: "server",
  adapter: netlify(),
  integrations: [db(), react()],
  vite: {
    ssr: {
      // sanitize-html@2.17.5+ bridges CommonJS to ESM-only htmlparser2. Keep
      // that bridge in the ESM server bundle so Netlify's function loader does
      // not attempt its own incompatible CommonJS require at runtime.
      noExternal: ["sanitize-html", "htmlparser2"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client"],
    },
  },
});
