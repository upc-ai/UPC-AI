/**
 * Direct provider test — bypasses the app to prove where a hang comes from.
 * Usage:  node scripts/test-provider.mjs [entryNumber]   (from apps/web)
 *   e.g. node scripts/test-provider.mjs 1     → tests the 1st entry
 *        node scripts/test-provider.mjs       → tests all entries
 * Reads AI_CUSTOM_PROVIDERS from .env.local; NEVER prints the key.
 */
import { readFileSync } from "node:fs";

const arg1 = process.argv[2] ?? "";
const pick = Number(arg1 || 0);

const withTimeout = (ms) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

// Models mode: node scripts/test-provider.mjs models [filter]
// → lists every model id the key can access on the router.
if (arg1 === "models") {
  const filter = (process.argv[3] ?? "").toLowerCase();
  const raw2 = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const l2 = raw2.split(/\r?\n/).find((l) => l.trim().startsWith("AI_CUSTOM_PROVIDERS="));
  if (!l2) {
    console.log("AI_CUSTOM_PROVIDERS not found in .env.local");
    process.exit(1);
  }
  const e = JSON.parse(l2.slice(l2.indexOf("=") + 1).trim())[0];
  const res = await fetch(`${e.baseUrl.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${e.apiKey}` },
  });
  const body = await res.text();
  if (!res.ok) {
    console.log(`❌ ${res.status} → ${body.slice(0, 300)}`);
    process.exit(1);
  }
  const ids = (JSON.parse(body).data ?? []).map((m) => m.id).sort();
  const shown = filter ? ids.filter((id) => id.toLowerCase().includes(filter)) : ids;
  console.log(`✅ ${shown.length}${filter ? ` of ${ids.length}` : ""} models available on ${new URL(e.baseUrl).host}:`);
  for (const id of shown) console.log(`  ${id}`);
  if (filter && shown.length === 0) console.log(`(none matched "${filter}" — try another search or drop the filter)`);
  process.exit(0);
}

// Image mode: node scripts/test-provider.mjs image [entryNumber]
// → sends a tiny image in the exact OpenAI wire format the app uses, so we
//   learn whether the model can SEE pictures (text-only models hang/error here).
if (arg1 === "image") {
  const raw2 = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const l2 = raw2.split(/\r?\n/).find((l) => l.trim().startsWith("AI_CUSTOM_PROVIDERS="));
  if (!l2) {
    console.log("AI_CUSTOM_PROVIDERS not found in .env.local");
    process.exit(1);
  }
  const entries2 = JSON.parse(l2.slice(l2.indexOf("=") + 1).trim());
  const e = entries2[Number(process.argv[3] ?? 1) - 1] ?? entries2[0];
  if (!e) {
    console.log("No such entry");
    process.exit(1);
  }
  console.log(`=== ${e.name} | model=${e.model} | image test ===`);
  // 1x1 red PNG
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const t3 = withTimeout(45_000);
  try {
    const started = Date.now();
    const res = await fetch(`${e.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${e.apiKey}` },
      body: JSON.stringify({
        model: e.model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "What color is this image? Answer in one word." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${tinyPng}` } },
          ],
        }],
        max_tokens: 20,
      }),
      signal: t3.signal,
    });
    const body = await res.text();
    t3.done();
    if (res.ok) {
      let text = "";
      try {
        text = JSON.parse(body).choices?.[0]?.message?.content ?? body.slice(0, 200);
      } catch {
        text = body.slice(0, 200);
      }
      console.log(`  ✅ VISION WORKS (${res.status} in ${Date.now() - started}ms) → "${String(text).slice(0, 120)}"`);
    } else {
      console.log(`  ❌ ${res.status} in ${Date.now() - started}ms → ${body.slice(0, 260)}`);
      console.log(`  → if the error mentions image/multimodal/content, this model CANNOT see pictures — pick a vision-capable model (run: node scripts/test-provider.mjs models and look for vision variants)`);
    }
  } catch (err) {
    t3.done();
    console.log(`  ❌ ${err.name === "AbortError" ? "NO RESPONSE in 45s — the router hangs on image payloads (this is your thinking-forever cause)" : err.message}`);
  }
  process.exit(0);
}

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith("AI_CUSTOM_PROVIDERS="));
if (!line) {
  console.log("AI_CUSTOM_PROVIDERS not found in .env.local");
  process.exit(1);
}
let entries;
try {
  entries = JSON.parse(line.slice(line.indexOf("=") + 1).trim());
} catch (err) {
  console.log(`❌ AI_CUSTOM_PROVIDERS is not valid JSON: ${err.message}`);
  process.exit(1);
}
const list = pick ? [entries[pick - 1]].filter(Boolean) : entries;
if (!list.length) {
  console.log(`No entry #${pick} (you have ${entries.length})`);
  process.exit(1);
}

for (const e of list) {
  const host = new URL(e.baseUrl).host;
  console.log(`\n=== ${e.name} | tier=${e.tier} | model=${e.model} | ${host} ===`);

  // ---- Test 1: plain (non-streaming) chat completion ----
  const t1 = withTimeout(30_000);
  try {
    const started = Date.now();
    const res = await fetch(`${e.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${e.apiKey}` },
      body: JSON.stringify({ model: e.model, messages: [{ role: "user", content: "Say OK." }], max_tokens: 20 }),
      signal: t1.signal,
    });
    const body = await res.text();
    t1.done();
    if (res.ok) {
      let text = "";
      try {
        const j = JSON.parse(body);
        text = j.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0, 200);
      } catch {
        text = body.slice(0, 200);
      }
      console.log(`  non-stream: ✅ ${res.status} in ${Date.now() - started}ms → "${String(text).slice(0, 120)}"`);
    } else {
      console.log(`  non-stream: ❌ ${res.status} → ${body.slice(0, 220)}`);
    }
  } catch (err) {
    t1.done();
    console.log(`  non-stream: ❌ ${err.name === "AbortError" ? "timed out after 30s" : err.message}`);
  }

  // ---- Test 2: STREAMING (what the app uses) ----
  const t2 = withTimeout(15_000);
  try {
    const started = Date.now();
    const res = await fetch(`${e.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${e.apiKey}` },
      body: JSON.stringify({ model: e.model, stream: true, messages: [{ role: "user", content: "Count 1 to 5." }], max_tokens: 40 }),
      signal: t2.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      t2.done();
      console.log(`  stream: ❌ ${res.status} → ${body.slice(0, 220)}`);
      continue;
    }
    let firstChunkAt = null;
    let chunks = 0;
    let sawDone = false;
    let firstLine = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const l = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (l.startsWith("data:")) {
          if (firstChunkAt === null) firstChunkAt = Date.now() - started;
          chunks++;
          if (!firstLine) firstLine = l.slice(0, 200);
          if (l.includes("[DONE]")) sawDone = true;
        }
      }
      if (chunks > 60) break;
    }
    t2.done();
    if (chunks === 0) {
      console.log(`  stream: ❌ response ended with ZERO stream chunks — this endpoint does not stream properly (the app would hang "Thinking…")`);
    } else {
      console.log(`  stream: ✅ first chunk in ${firstChunkAt}ms, ${chunks} chunks, [DONE]: ${sawDone}`);
      console.log(`  first chunk: ${firstLine}`);
    }
  } catch (err) {
    t2.done();
    console.log(`  stream: ❌ ${err.name === "AbortError" ? "no stream data within 15s — this is the hang" : err.message}`);
  }
}
console.log("\nInterpretation:");
console.log("  non-stream ❌  → key / model id / URL problem (read the error)");
console.log("  non-stream ✅ + stream ❌  → the provider doesn't stream properly; the app needs stream:false mode for it");
console.log("  both ✅  → the provider is fine; the problem is elsewhere in the app — tell me and I'll dig");
