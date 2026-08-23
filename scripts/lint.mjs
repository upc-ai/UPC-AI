// Runs eslint with flat-config mode forced on.
// eslint 8 only auto-uses eslint.config.mjs when ESLINT_USE_FLAT_CONFIG is set
// (v9 flips the default). Setting it here instead of the package.json script
// keeps the command cross-platform — no `VAR=x` shell syntax, no cross-env dep.
import { spawnSync } from "node:child_process";
import path from "node:path";

const eslintBin = path.resolve(import.meta.dirname, "../node_modules/eslint/bin/eslint.js");
const result = spawnSync(process.execPath, [eslintBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ESLINT_USE_FLAT_CONFIG: "true" },
});
process.exit(result.status ?? 1);
