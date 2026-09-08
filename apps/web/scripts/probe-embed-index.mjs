// Probe: is Gemini's OpenAI-compat /embeddings index field 1-based?
// Embeds 3 distinct texts and prints the raw data[].index values.
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

// Grab the Gemini key from AI_CUSTOM_PROVIDERS
const providers = JSON.parse(process.env.AI_CUSTOM_PROVIDERS ?? "[]");
const gemini = providers.find((p) => /generativelanguage/.test(p.baseUrl));
if (!gemini) throw new Error("no gemini provider in AI_CUSTOM_PROVIDERS");

const res = await fetch(`${gemini.baseUrl}/embeddings`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${gemini.apiKey}` },
  body: JSON.stringify({
    model: "gemini-embedding-001",
    input: ["The fee for BSc first year", "Hostel curfew timing", "Scholarship application deadline"],
    dimensions: 1536,
  }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const json = await res.json();

console.log("data array length:", json.data.length);
for (const d of json.data) {
  const emb = d.embedding ?? d.values;
  console.log(`  index=${d.index} dims=${emb.length} head=[${emb.slice(0, 3).map((x) => x.toFixed(4)).join(", ")}]`);
}

// Also: what does chunk 0 of a synced doc actually contain (empty-text hypothesis)?
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const rows = await sql`
  select c.chunk_index, c.content, (e.chunk_id is not null) as has_vector
  from chunks c
  left join embeddings e on e.chunk_id = c.id
  join documents d on d.id = c.document_id
  where d.source_url = 'https://www.upcollege.ac.in/entrance/session2627'
  order by c.chunk_index limit 3
`;
console.log("\nentrance-page chunks 0-2:");
for (const r of rows) {
  console.log(`  idx=${r.chunk_index} hasVector=${r.hasVector} len=${r.content.length} "${r.content.slice(0, 60).replace(/\n/g, " ")}"`);
}
await sql.end();
