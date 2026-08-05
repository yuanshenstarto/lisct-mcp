/**
 * REST client for the lisct agent API. Every op is one POST to
 * /api/v1/<op> with `Authorization: Bearer <api key>`; the response is
 * `{ ok, text, data }`. Methods are generated from the op table, so a new
 * server op only needs an entry in ops.ts.
 */
import {
  type Camel,
  camel,
  OP_NAMES,
  type OpInputs,
  type OpName,
} from "./ops.js";

export const DEFAULT_BASE_URL = "https://lisct.com";

export interface LisctResult<T = unknown> {
  /** Human/LLM-facing rendering — indented expand text, id lines, … */
  text: string;
  /** Structured payload when the op has one (ids, counts, …) */
  data: T;
}

export class LisctError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = "LisctError";
  }
}

export interface ClientOptions {
  /** defaults to process.env.LISCT_API_KEY */
  apiKey?: string;
  /** defaults to process.env.LISCT_URL, else https://lisct.com */
  baseUrl?: string;
  /** injectable for tests / custom agents */
  fetch?: typeof globalThis.fetch;
}

type OpMethods = {
  [N in OpName]: (input: OpInputs[N]) => Promise<LisctResult>;
} & {
  [N in OpName as Camel<N>]: (input: OpInputs[N]) => Promise<LisctResult>;
};

export type LisctClient = OpMethods & {
  readonly baseUrl: string;
  call<N extends OpName>(op: N, input: OpInputs[N]): Promise<LisctResult>;
  /** GET /api/v1 — the self-describing op index (no auth) */
  describe(): Promise<unknown>;
};

const trimSlash = (u: string) => u.replace(/\/+$/, "");

const asError = (body: unknown, status: number): LisctError => {
  const err = (body as { error?: unknown } | null)?.error;
  return new LisctError(
    typeof err === "string" ? err : JSON.stringify(err ?? body),
    status,
  );
};

export const createLisctClient = (opts: ClientOptions = {}): LisctClient => {
  const apiKey = opts.apiKey ?? process.env.LISCT_API_KEY;
  if (!apiKey) {
    throw new LisctError("missing api key — pass apiKey or set LISCT_API_KEY");
  }
  const baseUrl = trimSlash(
    opts.baseUrl ?? process.env.LISCT_URL ?? DEFAULT_BASE_URL,
  );
  const doFetch = opts.fetch ?? globalThis.fetch;

  const call = async <N extends OpName>(
    op: N,
    input: OpInputs[N],
  ): Promise<LisctResult> => {
    const res = await doFetch(`${baseUrl}/api/v1/${op}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(input ?? {}),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok || !(body as { ok?: boolean } | null)?.ok) {
      throw asError(body, res.status);
    }
    const { text, data } = body as LisctResult;
    return { text, data };
  };

  const describe = async (): Promise<unknown> => {
    const res = await doFetch(`${baseUrl}/api/v1`);
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw asError(body, res.status);
    return body;
  };

  const methods = Object.fromEntries(
    OP_NAMES.flatMap((op) => {
      const bound = (input: OpInputs[OpName]) => call(op, input as never);
      return [
        [op, bound],
        [camel(op), bound],
      ];
    }),
  ) as OpMethods;

  return { ...methods, baseUrl, call, describe };
};
