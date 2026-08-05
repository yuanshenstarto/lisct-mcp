#!/usr/bin/env node
/**
 * lisct-mcp — MCP server (stdio) for lisct, authenticated with an API key.
 *
 *   lisct-mcp                 # stdio MCP server, key from LISCT_API_KEY
 *   lisct-mcp --check         # verify key + endpoint, print the op table
 *   lisct-mcp --url http://localhost:3000
 *
 * stdout is the JSON-RPC channel: every diagnostic goes to stderr.
 */
import { runBridge, mcpEndpoint } from "./bridge.js";
import { createLisctClient, DEFAULT_BASE_URL, LisctError } from "./client.js";
import { OP_NAMES } from "./ops.js";

interface Args {
  apiKey?: string;
  baseUrl: string;
  check: boolean;
  help: boolean;
}

const HELP = `lisct-mcp — MCP server for lisct (https://lisct.com)

usage:
  lisct-mcp [--api-key <key>] [--url <base>]   run the stdio MCP server
  lisct-mcp --check                            verify credentials, list ops

env:
  LISCT_API_KEY   api key (lisct_…) — required
  LISCT_URL       base url (default ${DEFAULT_BASE_URL})

MCP host config:
  { "mcpServers": { "lisct": { "command": "npx", "args": ["-y", "lisct-mcp"],
      "env": { "LISCT_API_KEY": "lisct_…" } } } }`;

const parse = (argv: readonly string[]): Args =>
  argv.reduce<Args>(
    (acc, arg, i) => {
      const next = argv[i + 1];
      if (arg === "--api-key" || arg === "-k") return { ...acc, apiKey: next };
      if (arg === "--url" || arg === "-u")
        return { ...acc, baseUrl: next ?? acc.baseUrl };
      if (arg === "--check") return { ...acc, check: true };
      if (arg === "--help" || arg === "-h") return { ...acc, help: true };
      return acc;
    },
    {
      apiKey: process.env.LISCT_API_KEY,
      baseUrl: process.env.LISCT_URL ?? DEFAULT_BASE_URL,
      check: false,
      help: false,
    },
  );

const check = async (args: Args): Promise<void> => {
  const client = createLisctClient({
    apiKey: args.apiKey,
    baseUrl: args.baseUrl,
  });
  const { text } = await client.expand({ depth: 1 });
  console.log(`endpoint  ${args.baseUrl}`);
  console.log(`mcp       ${mcpEndpoint(args.baseUrl)}`);
  console.log(`ops       ${OP_NAMES.join(" ")}`);
  console.log(`sidebar\n${text || "  (empty)"}`);
};

const main = async (): Promise<void> => {
  const args = parse(process.argv.slice(2));
  if (args.help) return void console.log(HELP);
  if (!args.apiKey) {
    console.error("lisct-mcp: no api key — set LISCT_API_KEY or --api-key\n");
    console.error(HELP);
    process.exitCode = 2;
    return;
  }
  if (args.check) return check(args);
  await runBridge({ apiKey: args.apiKey, baseUrl: args.baseUrl });
};

main().catch((e: unknown) => {
  const msg = e instanceof LisctError ? `${e.message} (${e.status})` : e;
  console.error("lisct-mcp:", msg);
  process.exit(1);
});
