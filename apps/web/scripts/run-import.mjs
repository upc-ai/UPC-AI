// PATH-proof launcher: curated import (md rows + any not-yet-imported items),
// then a final audit. Usage: node run-import.mjs (apps/web)
import { spawn } from "node:child_process";
import path from "node:path";

const web = "C:\\Users\\x\\Desktop\\upcai\\apps\\web";
const POOLER = "postgresql://postgres.azypdvvcexzykicoucfj:UPCAI9115211488@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";
const env = { ...process.env, DATABASE_URL: POOLER };

const child = spawn(path.join(web, "node_modules", ".bin", "tsx.cmd"), [path.join(web, "scripts", "import-curated.ts")], {
  cwd: web,
  env,
  shell: true,
  stdio: "inherit",
});
child.on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 0);
  const audit = spawn(process.execPath, [path.join(web, "scripts", "kb-audit.mjs")], { cwd: web, env, stdio: "inherit" });
  audit.on("exit", (c2) => process.exit(c2 ?? 0));
});
