// PATH-proof launcher: RAG eval (retrieval metrics). Usage: node run-eval.mjs (apps/web)
import { spawn } from "node:child_process";
import path from "node:path";

const web = "C:\\Users\\x\\Desktop\\upcai\\apps\\web";
const POOLER = "postgresql://postgres.azypdvvcexzykicoucfj:UPCAI9115211488@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";
const env = { ...process.env, DATABASE_URL: POOLER };

const child = spawn(path.join(web, "node_modules", ".bin", "tsx.cmd"), [path.join(web, "scripts", "eval-rag.ts")], {
  cwd: web,
  env,
  shell: true,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
