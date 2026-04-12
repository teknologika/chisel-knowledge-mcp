# chisel-knowledge-mcp

Standalone MCP server and library for building and managing knowledge workspaces.

Canonical behavior documentation lives in [docs/chisel-knowledge-mcp.md](./docs/chisel-knowledge-mcp.md) and is routed from [docs/CANONICAL_DOCS.md](./docs/CANONICAL_DOCS.md).

## Requirements

- Node.js 22 or newer
- `npm`

## Install

```bash
npm install
```

## Library usage

Import the workspace service and related types directly from the package root:

```ts
import { WorkspaceService, KnowledgeIndex } from '@teknologika/chisel-knowledge-mcp';
```

The MCP server remains available from the `server` subpath and through the published binary.

## Workspace Workflow

The workspace service and MCP server expose a deterministic inbox pipeline:

- `knowledge_get_next_inbox_file` returns the first unprocessed inbox file with its content.
- `knowledge_get_dedupe_context` returns search results from both `knowledge/` and `inbox/` for a file-specific query.
- `knowledge_compile_new` writes a new article into `knowledge/`, updates `knowledge/index.md`, appends `knowledge/log.md`, and archives the source inbox file.
- `knowledge_compile_extend` writes a revised article into `knowledge/`, updates the article's `Updated` entry in `knowledge/index.md`, appends `knowledge/log.md`, and archives the source inbox file.

These tools are deterministic. The LLM that consumes the MCP server decides the article content and the dedupe outcome; the server only performs file and index updates.

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

`~/.chisel/config.json`

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
- The package root exports the library surface; `@teknologika/chisel-knowledge-mcp/server` resolves to the MCP server entry point.
