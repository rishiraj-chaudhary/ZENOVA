/**
 * Checks that every model in the configured chain actually exists.
 *
 * Config presence proves nothing, and neither does "it served traffic": a
 * failover chain masks a dead primary perfectly. Every request 429s or 404s at
 * the head, falls through, and succeeds on a model nobody chose — while the
 * success rate stays at 100% and any eval result describes a different model
 * than the one you think you are running.
 *
 * This asks the API which models exist, rather than inferring it from whether
 * a request happened to succeed.
 *
 *   npm run verify:models
 */
import config from "../config/environment.js";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const run = async () => {
  const chain = [config.gemini.model, ...config.gemini.fallbackModels];

  const response = await fetch(`${ENDPOINT}?key=${config.gemini.apiKey}&pageSize=200`);
  const body = await response.json();

  if (!body.models) {
    console.error("Could not list models:", JSON.stringify(body).slice(0, 300));
    process.exit(1);
  }

  const available = new Set(body.models.map((model) => model.name.replace("models/", "")));

  console.log(`Configured chain: ${chain.join(" -> ")}\n`);

  const missing = chain.filter((name) => !available.has(name));
  for (const name of chain) {
    console.log(`  ${available.has(name) ? "ok      " : "MISSING "}${name}`);
  }

  if (missing.length > 0) {
    console.error(
      `\n${missing.length} configured model(s) do not exist. Requests to them fail and ` +
        `fall through silently.`
    );
    process.exit(1);
  }

  console.log("\nAll configured models exist.");
};

run().catch((error) => {
  console.error("Model verification failed:", error.message);
  process.exit(1);
});
