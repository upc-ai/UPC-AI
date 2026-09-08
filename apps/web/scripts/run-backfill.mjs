// PATH-proof launcher: spawns the backfill script through the web package's
// own node_modules tsx, then the audit. Usage: node run-backfill.mjs (apps/web)
import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";

const web = "C:\\Users\\x\\Desktop\\upcai\\apps\\web";
const tsxCmd = path.join(web, "node_modules", ".bin", "tsx.cmd");
const tsxSh = path.join(web, "node_modules", ".bin", "tsx");
const tsxJs = path.join(web, "node_modules", "tsx", "dist", "cli.mjs");

const POOLER = "postgresql://postgres.azypdvvcexzykicoucfj:UPCAI9115211488@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";
const env = { ...process.env, DATABASE_URL: POOLER };

function pickTsxCmd() {
  if (existsSync(tsxCmd)) return { cmd: tsxCmd, shell: true };
  if (existsSync(tsxSh)) return { cmd: tsxSh, shell: false };
  if (existsSync(tsxJs)) return { cmd: process.execPath, shell: false, prefix: [tsxJs] };
  throw new Error("tsx not found in any expected location");
}

const t = pickTsxCmd();
console.log("using tsx at:", t.cmd);

const child = spawn(t.cmd, [...(t.prefix ?? []), path.join(web, "scripts", "backfill-vectors.ts")], {
  cwd: web,
  env,
  shell: t.shell,
  stdio: "inherit",
});
child.on("exit", async (code) => {
  console.log(`\nbackfill exited ${code}`);
  if (code !== 0) process.exit(code);
  const audit = spawn(process.execPath, [path.join(web, "scripts", "kb-audit.mjs")], { cwd: web, env, stdio: "inherit" });
  audit.on("exit", (c2) => {
    console.log(`\naudit exited ${c2}`);
    process.exit(c2 ?? 0);
  });
});
