/**
 * Validate AI_CUSTOM_PROVIDERS without echoing secrets.
 * Usage: node scripts/check-providers.mjs   (from apps/web)
 * Reads apps/web/.env.local, parses the AI_CUSTOM_PROVIDERS line exactly the
 * way the gateway will, and prints one safe line per entry
 * (name / tier / model / host / key length — never the key itself).
 */
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const line = raw
  .split(/\r?\n/)
  .find((l) => l.trim().startsWith("AI_CUSTOM_PROVIDERS="));

if (!line) {
  console.log("AI_CUSTOM_PROVIDERS not found in .env.local");
  process.exit(0);
}

const value = line.slice("AI_CUSTOM_PROVIDERS=".length).trim();
console.log(`value length: ${value.length}, starts: ${value.slice(0, 2)}, ends: ${value.slice(-2)}`);

let parsed;
try {
  parsed = JSON.parse(value);
} catch (err) {
  console.log(`❌ JSON PARSE FAILED: ${err.message}`);
  // Show a sanitized hint of where it broke (position only, no key content)
  const pos = Number(err.message.match(/position (\d+)/)?.[1] ?? -1);
  if (pos >= 0) {
    const around = value.slice(Math.max(0, pos - 30), pos + 30).replace(/[A-Za-z0-9_-]{20,}/g, "***KEY***");
    console.log(`around position ${pos}: …${around}…`);
  }
  process.exit(1);
}

if (!Array.isArray(parsed)) {
  console.log("❌ Not a JSON array");
  process.exit(1);
}

console.log(`✅ valid JSON array with ${parsed.length} entr${parsed.length === 1 ? "y" : "ies"}`);
for (const e of parsed) {
  const issues = [];
  if (!e.name) issues.push("missing name");
  if (!e.baseUrl) issues.push("missing baseUrl");
  else {
    try { new URL(e.baseUrl); } catch { issues.push("baseUrl not a URL"); }
  }
  if (!e.apiKey) issues.push("missing apiKey");
  if (!e.model) issues.push("missing model");
  if (!["fast", "standard", "frontier"].includes(e.tier)) issues.push(`bad tier "${e.tier}" (fast|standard|frontier)`);
  let host = "";
  try { host = new URL(e.baseUrl).host; } catch { /* reported above */ }
  console.log(
    `· ${e.name ?? "?"} | tier=${e.tier ?? "?"} | model=${e.model ?? "?"} | host=${host} | key=${e.apiKey ? `${e.apiKey.length} chars` : "MISSING"}${issues.length ? ` | ❌ ${issues.join("; ")}` : " | ✅"}`
  );
}
