# lisct-mcp

MCP server (stdio) and REST client for [lisct](https://lisct.com), authenticated with an API key.

Source: [github.com/yuanshenstarto/lisct-mcp](https://github.com/yuanshenstarto/lisct-mcp)

## Claude Code

```sh
claude mcp add --scope user lisct -- npx -y lisct-mcp
```

The key is read from the environment, so exporting `LISCT_API_KEY` in your shell profile is enough — no need to bake it into a config file. Confirm with `claude mcp list`.

> An `mcpServers` block in `~/.claude/settings.json` is **not** read by Claude Code. The server never starts and the host reports "not connected", which looks like a credential problem but isn't. Use `claude mcp add` (writes `~/.claude.json`), or a project-level `.mcp.json`.

## Other MCP hosts

`claude_desktop_config.json`, `.mcp.json`, and anything else taking the standard block:

```json
{
  "mcpServers": {
    "lisct": {
      "command": "npx",
      "args": ["-y", "lisct-mcp"],
      "env": { "LISCT_API_KEY": "lisct_…" }
    }
  }
}
```

Verify credentials and reachability: `LISCT_API_KEY=lisct_… npx lisct-mcp --check`. It handshakes against the same MCP endpoint the bridge uses and prints the live tool table, so a green check means the bridge is green.

Tools are proxied straight from the server's own MCP endpoint, so the tool table never drifts: `expand`, `get_set`, `search`, `create_set`, `add_elements`, `remove_elements`, `rename_element`, `set_status`, `delete_set`, `reorder`. Write ops require a key with the `write` scope.

## As a library

```ts
import { createLisctClient } from "lisct-mcp";

const lisct = createLisctClient({ apiKey: process.env.LISCT_API_KEY });
const { text } = await lisct.expand({ depth: 3 });
await lisct.createSet({ expression: "(groceries ,todo)" });
```

`LISCT_URL` overrides the base url (default `https://lisct.com`) for self-hosted instances.

MIT
