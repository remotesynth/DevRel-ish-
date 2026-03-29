import { defineConfig } from "astro/config";
import db from "@astrojs/db";
import node from "@astrojs/node";
import react from "@astrojs/react";

import netlify from "@astrojs/netlify";

export default defineConfig({
  output: "server",
  adapter: netlify(),
  integrations: [db(), react()],
});