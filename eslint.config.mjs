import tseslint from "typescript-eslint";

// Shared flat config for core/ui/worker (web lints separately via
// `next lint` + next/core-web-vitals). Deliberately lean: typecheck is the
// real type gate; this catches what tsc won't — dead code, suspicious
// patterns, accidental `any`s.
export default tseslint.config(
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/"] },
  ...tseslint.configs.recommended,
);
