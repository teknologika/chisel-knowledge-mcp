# Chisel Knowledge MCP

Canonical behavior reference for the `@teknologika/chisel-knowledge-mcp` server.

## Overview

`chisel-knowledge-mcp` is a stdio-only Model Context Protocol server for building and managing knowledge workspaces. It loads workspace definitions at startup, exposes workspace-oriented tools, and keeps all protocol traffic on stdout while logging to stderr.

The server is designed around a small set of local filesystem conventions:

- Workspace roots are defined in `~/.chisel-knowledge/config.json`
- Raw ingests are written to `<workspace>/inbox/`
- Compiled or curated content is read from `<workspace>/knowledge/`

## Startup and configuration

On startup, the server reads `~/.chisel-knowledge/config.json`.

If the file does not exist, the server starts with zero configured workspaces and logs a warning to stderr. Configuration is validated with Zod before use.

Workspace entries must have this shape:

```json
{
  "name": "second-brain",
  "path": "/Users/bruce/Vaults/SecondBrain"
}
```

Rules:

- `name` is a unique kebab-case identifier
- `path` is an absolute path to the workspace root
- Duplicate workspace names are rejected during config load

The sample config in `config.example.json` matches the expected structure.

## Workspace model

`WorkspaceService.resolve(name)` looks up a configured workspace by name.

If the name is unknown, the service throws:

`McpError(ErrorCode.InvalidParams, "Unknown workspace: <name>")`

This error behavior is part of the public contract used by the MCP tools.

## Transport and logging

The server uses `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.

Operational logging goes to stderr via `pino`. Stdout is reserved for MCP protocol messages and must remain free of application logs.

## Tool reference

### `knowledge_list_workspaces`

Returns all configured workspaces with an `exists` flag for each path.

Result shape:

```json
[
  { "name": "second-brain", "path": "/Users/bruce/Vaults/SecondBrain", "exists": true }
]
```

Behavior:

- Reads the configured workspace list
- Checks each workspace path with `fs.existsSync`

### `knowledge_workspace_status`

Returns workspace metadata and placeholder status counters.

Parameters:

- `workspace`: workspace name

Result shape:

```json
{
  "name": "second-brain",
  "path": "/Users/bruce/Vaults/SecondBrain",
  "exists": true,
  "inboxCount": 0,
  "knowledgeCount": 0,
  "lastCompiled": null
}
```

Behavior:

- Resolves the workspace by name
- Returns `exists` from the filesystem
- Leaves counts at zero and `lastCompiled` at `null` until real compilation logic is added

### `knowledge_ingest_text`

Writes raw text into the workspace inbox.

Parameters:

- `workspace`: workspace name
- `content`: text to write
- `title`: optional title used for the file slug

Behavior:

- Creates `<workspace>/inbox/` if needed
- Writes a Markdown file named `{YYYY-MM-DD}-{slug}.md`
- Returns the absolute file path and workspace name

Slug rules:

- Title is lowercased
- Spaces become hyphens
- Non-alphanumeric characters are stripped
- Slugs are truncated to 50 characters
- Missing titles use `untitled`

### `knowledge_ingest_clipboard`

Reads the current clipboard and writes it to the workspace inbox.

Parameters:

- `workspace`: workspace name
- `title`: optional title used for the file slug

Behavior:

- Reads text using `pbpaste`
- Reuses the same file-writing flow as `knowledge_ingest_text`

### `knowledge_ingest_url`

URL ingestion is defined in the tool surface but not implemented yet.

Behavior:

- Throws `McpError(ErrorCode.InternalError, "URL ingestion not yet implemented")`

### `knowledge_search`

Search is defined in the tool surface but still stubbed.

Parameters:

- `workspace`: workspace name
- `query`: search text
- `limit`: optional maximum result count

Behavior:

- Returns `{ "results": [] }`

### `knowledge_read`

Reads a file from the workspace.

Parameters:

- `workspace`: workspace name
- `path`: file path relative to the workspace root

Behavior:

- Resolves the requested path against the workspace root
- Reads the file contents as UTF-8
- Returns the content and absolute file path

### `knowledge_list`

Lists Markdown files under the workspace knowledge area.

Parameters:

- `workspace`: workspace name
- `directory`: optional directory to scan instead of the default `knowledge/`

Behavior:

- Defaults to `<workspace>/knowledge/`
- If `directory` is provided, resolves it against the workspace root
- Does not create `knowledge/` automatically
- Returns `.md` files recursively with path, size, and modified timestamp

## File naming and directory conventions

Workspace roots use two well-known subdirectories:

- `<workspace>/inbox/` for raw ingested content
- `<workspace>/knowledge/` for curated or compiled knowledge

Ingest tools write to `inbox/`. Read and list tools operate on `knowledge/` unless a specific path is provided.

The default ingest filename format is:

`{YYYY-MM-DD}-{slug}.md`

## Claude Desktop config

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

## Quick references

- Package name: `@teknologika/chisel-knowledge-mcp`
- Binary name: `chisel-knowledge-mcp`
- Entry point: `dist/server.js`
- License: MIT
