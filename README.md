# chisel-knowledge-mcp

Standalone MCP server for building and managing knowledge workspaces.

## Requirements

- Node.js 22 or newer
- `npm`

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Type check

```bash
npx tsc --noEmit
```

## Config

The server reads workspace configuration from:

`~/.chisel-knowledge/config.json`

If the file does not exist, the server starts with zero configured workspaces and logs a warning to stderr.

Example configuration:

```json
{
  "workspaces": [
    {
      "name": "second-brain",
      "path": "/Users/bruce/Vaults/SecondBrain"
    },
    {
      "name": "chisel-dev",
      "path": "/Users/bruce/GitHub/chisel"
    }
  ]
}
```

Workspace names must be unique and kebab-case. Workspace paths must be absolute.

## Claude Desktop

Use this MCP server with Claude Desktop by adding:

```json
{
  "mcpServers": {
    "chisel-knowledge": {
      "command": "npx",
      "args": ["-y", "@teknologika/chisel-knowledge-mcp"]
    }
  }
}
```

## Tools

- `knowledge_list_workspaces`
- `knowledge_workspace_status`
- `knowledge_ingest_text`
- `knowledge_ingest_clipboard`
- `knowledge_ingest_url`
- `knowledge_search`
- `knowledge_read`
- `knowledge_list`

## Notes

- Transport is stdio only.
- Logging goes to stderr so stdout stays reserved for MCP protocol messages.
- `knowledge_ingest_*` writes to `inbox/`.
- `knowledge_read` and `knowledge_list` read from `knowledge/`.
- `knowledge_ingest_url` is a stub and returns an internal error for now.
