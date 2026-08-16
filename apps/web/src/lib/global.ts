/** Global singletons that must survive Next.js dev HMR reloads. */
export interface Global {
  __db?: ReturnType<typeof import("@upc/db").createDb>;
  __redis?: import("ioredis").default;
}
