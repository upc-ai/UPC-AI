/**
 * Build a valid one-line AI_CUSTOM_PROVIDERS value by answering questions —
 * no hand-edited JSON to break.
 *
 * Usage:  node scripts/make-providers.mjs        (from apps/web)
 * Copy the printed AI_CUSTOM_PROVIDERS=[…] line into:
 *   1. apps/web/.env.local   (then: node scripts/check-providers.mjs)
 *   2. Vercel → Settings → Environment Variables → AI_CUSTOM_PROVIDERS
 *   3. Redeploy.
 * The key is only ever printed inside the JSON you copy — the script never
 * stores it anywhere.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = createInterface({ input, output });

const tiers = ["fast", "standard", "frontier"];
const ask = async (q, fallback = "") => {
  const hint = fallback ? ` (${fallback})` : "";
  const a = (await rl.question(`${q}${hint}: `)).trim();
  return a || fallback;
};

console.log("Build your AI_CUSTOM_PROVIDERS — one entry per model slot.\n");
const count = Number(await ask("How many providers? (e.g. 3 = UPC-1, Plus, Pro)", "3"));

const entries = [];
for (let i = 1; i <= count; i++) {
  console.log(`\n— Entry ${i} of ${count} —`);
  entries.push({
    name: await ask("  name (label, anything)", `provider-${i}`),
    tier: await ask("  tier: fast | standard | frontier", "standard"),
    baseUrl: await ask("  baseUrl (OpenAI-compatible, from the provider's docs)"),
    apiKey: await ask("  apiKey (paste the key)"),
    model: await ask("  model (exact string from the provider's model list)"),
  });
}
rl.close();

const line = `AI_CUSTOM_PROVIDERS=${JSON.stringify(entries)}`;
console.log("\n✅ Copy this single line — the whole thing, nothing else:\n");
console.log(line);
console.log(
  "\nNext:\n" +
    "  1. Replace the AI_CUSTOM_PROVIDERS= line in apps/web/.env.local with it\n" +
    "  2. Validate:  node scripts/check-providers.mjs\n" +
    "  3. Paste the same line into Vercel → Settings → Environment Variables\n" +
    "  4. Deployments → ⋯ → Redeploy   (env changes need a fresh deployment)\n" +
    "  5. Test one question on each tier + one photo",
);
