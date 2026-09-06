/**
 * Temporary Astro 7 compatibility bridge for `astro db shell --remote`.
 * See push-db-schema.mjs for the migration plan away from Astro DB.
 */
import { resolveConfig } from "../node_modules/astro/dist/core/config/config.js";
import { cli } from "../node_modules/@astrojs/db/dist/core/cli/index.js";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error("Usage: npm run db:query -- '<SQL query>'");
  process.exit(1);
}

const { astroConfig } = await resolveConfig({ root: process.cwd() }, "build");
await cli({
  flags: { _: ["node", "db", "shell"], query, remote: true },
  config: astroConfig,
});
