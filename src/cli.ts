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
import { mcpEndpoint, probeBridge, runBridge } from "./bridge.js";
import { createLisctClient, DEFAULT_BASE_URL, LisctError } from "./client.js";
import { OP_NAMES, type OpName } from "./ops.js";

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

Claude Code:
  claude mcp add --scope user lisct -- npx -y lisct-mcp
  (an mcpServers block in ~/.claude/settings.json is NOT read — the server
   never starts and the host just reports "not connected")

Other MCP hosts (claude_desktop_config.json, .mcp.json, …):
  { "mcpServers": { "lisct": { "command": "npx", "args": ["-y", "lisct-mcp"],
      "env": { "LISCT_API_KEY": "lisct_…" } } } }`;

/** A missing value — or the next flag — is not a value; the env must survive it. */
const value = (v: string | undefined): string | undefined =>
  v && !v.startsWith("-") ? v : undefined;

const parse = (argv: readonly string[]): Args =>
  argv.reduce<Args>(
    (acc, arg, i) => {
      const next = value(argv[i + 1]);
      if (arg === "--api-key" || arg === "-k")
        return next ? { ...acc, apiKey: next } : acc;
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

/**
 * Probes both faces the package exposes, MCP first: a REST-only check can pass
 * while the endpoint the bridge actually speaks to is broken.
 */
const check = async (args: Args): Promise<void> => {
  const { apiKey = "", baseUrl } = args;
  console.log(`endpoint  ${baseUrl}`);
  console.log(`mcp       ${mcpEndpoint(baseUrl)}`);
  const tools = await probeBridge({ apiKey, baseUrl });
  console.log(`tools     ${tools.join(" ")}`);
  // The bridge proxies whatever the server offers, but the REST client face is
  // a local table — say so when it has fallen behind.
  const drift = tools.filter((t) => !OP_NAMES.includes(t as OpName));
  if (drift.length) console.log(`drift     client lacks: ${drift.join(" ")}`);
  const { text } = await createLisctClient({ apiKey, baseUrl }).expand({
    depth: 1,
  });
  console.log(`rest      ${baseUrl}/api/v1 ok`);
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
