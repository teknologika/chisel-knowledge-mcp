# chisel-knowledge-mcp

Standalone MCP server for building and managing knowledge workspaces.

Canonical behavior documentation lives in [docs/chisel-knowledge-mcp.md](./docs/chisel-knowledge-mcp.md).

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

If the file does not exist, the server starts with zero configured workspaces and logs a warning to stderr. See [config.example.json](./config.example.json) for the expected shape.

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

## Notes

- Transport is stdio only.
- Logging goes to stderr so stdout stays reserved for MCP protocol messages.
- The binary is `chisel-knowledge-mcp`.
