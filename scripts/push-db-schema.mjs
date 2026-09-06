/**
 * Temporary Astro 7 compatibility bridge for the legacy Astro DB migration
 * engine. Astro 7 removed the `astro db` command but the installed integration
 * still supplies the schema and migration implementation used by this app.
 *
 * Replace this with project-owned Drizzle/libSQL migrations when moving away
 * from the removed @astrojs/db integration.
 */
import { resolveConfig } from "../node_modules/astro/dist/core/config/config.js";
import { cli } from "../node_modules/@astrojs/db/dist/core/cli/index.js";

// `astro db` used to load .env before reading the remote connection settings.
// Keep that local-developer behavior; Netlify supplies its variables directly.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const { astroConfig } = await resolveConfig({ root: process.cwd() }, "build");
await cli({
  flags: { _: ["node", "db", "push"] },
  config: astroConfig,
});
