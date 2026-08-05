# lisct-mcp

MCP server (stdio) and REST client for [lisct](https://lisct.com), authenticated with an API key.

Source: [github.com/yuanshenstarto/lisct-mcp](https://github.com/yuanshenstarto/lisct-mcp)

## MCP host config

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

Verify credentials: `LISCT_API_KEY=lisct_… npx lisct-mcp --check`.

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
