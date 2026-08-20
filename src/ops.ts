/**
 * The op table, mirrored from the server registry (src/server/agent/registry.ts).
 * Names and shapes are the contract both faces share: REST /api/v1/<op> and the
 * MCP tools at /api/mcp.
 */

export interface OpInputs {
  expand: { root?: string; depth?: number };
  get_set: { set: string };
  search: { query: string; limit?: number };
  neighbors: { ref: string; limit?: number };
  create_set: { expression: string; parent?: string };
  create_tree: { outline: string; parent?: string };
  add_elements: { set: string; expression: string };
  remove_elements: { set: string; elements: string[] };
  rename_element: { set: string; element: string; to: string };
  set_status: { set: string; status: "todo" | "next" | "done" | "none" };
  delete_set: { set: string };
  reorder: { set: string; parent?: string; before?: string; after?: string };
}

export type OpName = keyof OpInputs;

export const READ_OPS = ["expand", "get_set", "search", "neighbors"] as const;

export const WRITE_OPS = [
  "create_set",
  "create_tree",
  "add_elements",
  "remove_elements",
  "rename_element",
  "set_status",
  "delete_set",
  "reorder",
] as const;

export const OP_NAMES = [...READ_OPS, ...WRITE_OPS] as ReadonlyArray<OpName>;

export type Camel<S extends string> = S extends `${infer H}_${infer T}`
  ? `${H}${Capitalize<Camel<T>>}`
  : S;

export const camel = <S extends string>(s: S): Camel<S> =>
  s.replace(/_(.)/g, (_, c: string) => c.toUpperCase()) as Camel<S>;
