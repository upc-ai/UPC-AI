/** CSS Modules type declarations (consumed by tsc; Next/vitest handle the real loading). */
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
