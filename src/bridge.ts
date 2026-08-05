/**
 * stdio ⇄ streamable-HTTP bridge. lisct already speaks MCP over HTTP at
 * /api/mcp/mcp; this exposes that same server on stdio for hosts that can't
 * send an Authorization header to a remote MCP endpoint.
 *
 * It is a message-level pipe, not a re-implementation: tools, schemas and
 * future capabilities pass through untouched, so the package never drifts
 * from the server's op table.
 */
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

const pipe = (
  from: Transport,
  to: Transport,
  onError: (error: Error) => void,
): void => {
  from.onmessage = (message: JSONRPCMessage) => {
    void to.send(message).catch(onError);
  };
  from.onclose = () => void to.close().catch(() => {});
  from.onerror = onError;
};

/** Resolves when either side closes. */
export const runBridge = async ({
  apiKey,
  baseUrl = process.env.LISCT_URL ?? DEFAULT_BASE_URL,
  onError = (where, error) => console.error(`[lisct-mcp:${where}]`, error),
}: BridgeOptions): Promise<void> => {
  const remote = new StreamableHTTPClientTransport(
    new URL(mcpEndpoint(baseUrl)),
    { requestInit: { headers: { Authorization: `Bearer ${apiKey}` } } },
  );
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
