/**
 * stdio ⇄ streamable-HTTP bridge. lisct already speaks MCP over HTTP at
 * /api/mcp/mcp; this exposes that same server on stdio for hosts that can't
 * send an Authorization header to a remote MCP endpoint.
 *
 * It is a message-level pipe, not a re-implementation: tools, schemas and
 * future capabilities pass through untouched, so the package never drifts
 * from the server's op table.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_BASE_URL } from "./client.js";

export const mcpEndpoint = (baseUrl: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/api/mcp/mcp`;

export interface BridgeOptions {
  apiKey: string;
  baseUrl?: string;
  onError?: (where: "remote" | "stdio", error: Error) => void;
}

/** Implementation-defined JSON-RPC error: the far side of the bridge failed. */
const UPSTREAM_ERROR = -32001;

type Request = JSONRPCMessage & { id: string | number; method: string };

const isRequest = (m: JSONRPCMessage): m is Request =>
  "method" in m && "id" in m && m.id !== null && m.id !== undefined;

const remoteTransport = (apiKey: string, baseUrl: string) =>
  new StreamableHTTPClientTransport(new URL(mcpEndpoint(baseUrl)), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });

const pipe = (
  from: Transport,
  to: Transport,
  onError: (error: Error) => void,
): void => {
  from.onmessage = (message: JSONRPCMessage) => {
    void to.send(message).catch((error: Error) => {
      onError(error);
      // A dropped request is invisible to its sender: the host just waits out
      // its timeout and reports "not connected", with the real cause (bad key,
      // wrong url, server down) buried in stderr. Give the failure a voice on
      // the protocol channel instead.
      if (isRequest(message)) {
        void from
          .send({
            jsonrpc: "2.0",
            id: message.id,
            error: { code: UPSTREAM_ERROR, message: `lisct: ${error.message}` },
          })
          .catch(() => {});
      }
    });
  };
  from.onclose = () => void to.close().catch(() => {});
  from.onerror = onError;
};

/**
 * A real handshake against the MCP endpoint — the exact path the bridge uses,
 * so a green probe means the bridge itself is green. Returns the live tool
 * names as the server advertises them.
 */
export const probeBridge = async ({
  apiKey,
  baseUrl = process.env.LISCT_URL ?? DEFAULT_BASE_URL,
}: Omit<BridgeOptions, "onError">): Promise<string[]> => {
  const client = new Client({ name: "lisct-mcp-check", version: "0.1.2" });
  try {
    await client.connect(remoteTransport(apiKey, baseUrl));
    const { tools } = await client.listTools();
    return tools.map((t) => t.name);
  } finally {
    await client.close().catch(() => {});
  }
};

/** Resolves when either side closes. */
export const runBridge = async ({
  apiKey,
  baseUrl = process.env.LISCT_URL ?? DEFAULT_BASE_URL,
  onError = (where, error) => console.error(`[lisct-mcp:${where}]`, error),
}: BridgeOptions): Promise<void> => {
  const remote = remoteTransport(apiKey, baseUrl);
  const stdio = new StdioServerTransport();

  const closed = new Promise<void>((resolve) => {
    const done = () => resolve();
    pipe(remote, stdio, (e) => onError("remote", e));
    pipe(stdio, remote, (e) => onError("stdio", e));
    const chain = (t: Transport) => {
      const prev = t.onclose;
      t.onclose = () => {
        prev?.();
        done();
      };
    };
    chain(remote);
    chain(stdio);
  });

  await remote.start();
  await stdio.start();
  await closed;
};
