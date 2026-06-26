# Chisel Knowledge MCP

Canonical behavior reference for the `@teknologika/chisel-knowledge-mcp` server.

## Overview

`chisel-knowledge-mcp` is a stdio-only Model Context Protocol server for building and managing knowledge workspaces. It loads workspace definitions at startup, exposes workspace-oriented tools, and keeps all protocol traffic on stdout while logging to stderr.

The package is dual-mode:

- The root export (`@teknologika/chisel-knowledge-mcp`) exposes the workspace service, inbox and knowledge indexes, and workspace types for direct library consumers.
- The server export (`@teknologika/chisel-knowledge-mcp/server`) starts the stdio MCP server used by Claude Desktop and other MCP clients.

The server is designed around a small set of local filesystem conventions:

- Workspace roots are defined in `~/.chisel/knowledge-mcp-config.json`
- Raw and fetched ingests are written to `<workspace>/inbox/`
- Compiled or curated content is read from `<workspace>/knowledge/`
- Processed inbox files are moved into `<workspace>/inbox/archived/`
- Inbox files are indexed into `<workspace>/.inbox-index.db` as they are written so they can be searched immediately.
- Knowledge files continue to use `<workspace>/.knowledge-index.db` and are re-indexed on demand when searched.
- The deterministic compile tools write curated articles, the topic-structured `knowledge/index.md`, and `knowledge/log.md` under `<workspace>/knowledge/`.

## Package entry points

The published package exposes two entry points with distinct responsibilities:

- `@teknologika/chisel-knowledge-mcp` is the library surface. It re-exports `WorkspaceService`, `KnowledgeIndex`, `InboxIndex`, and the workspace-related types so local consumers can work with the same deterministic service layer without speaking MCP.
- `@teknologika/chisel-knowledge-mcp/server` is the MCP transport entry. It preserves the stdio server behavior, is emitted as an executable Node script, and remains the binary target for command-line and desktop integrations.

This split keeps the protocol layer and the direct library surface aligned while allowing consumers to choose the integration style that fits their runtime.

## Startup and configuration

On startup, the server reads `~/.chisel/knowledge-mcp-config.json`.

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

## Deterministic inbox workflow

The server does not embed an LLM or make compile decisions on its own. The MCP client or external LLM reads an inbox file, decides whether it is new or should extend existing knowledge, and then calls one of the compile tools below.

The deterministic service methods that back that workflow are:

- `WorkspaceService.getNextInboxFile(name)` returns the first inbox file and its content in one read.
- `WorkspaceService.getDedupeContext(name, file, query)` returns search matches from both `knowledge/` and `inbox/` for a client-chosen query.
- `WorkspaceService.compileNew(name, inboxFile, articlePath, content)` writes a new article, compiles the article summary into a topic-sectioned `knowledge/index.md`, appends `knowledge/log.md`, and archives the source inbox file.
- `WorkspaceService.compileExtend(name, inboxFile, targetPath, updatedContent)` writes an updated article, refreshes the matching summary bullet in `knowledge/index.md`, appends `knowledge/log.md`, and archives the source inbox file.

The compile helpers are deterministic file operations. They do not call an LLM, do not decide whether an article should be new or extended, and do not generate content.

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

Returns workspace metadata and live content counters.

Parameters:

- `workspace`: workspace name

Result shape:

```json
{
  "name": "second-brain",
  "path": "/Users/bruce/Vaults/SecondBrain",
  "exists": true,
  "inboxCount": 4,
  "knowledgeCount": 9,
  "lastCompiled": null
}
```

The counts reflect the current filesystem contents, so the example values vary by workspace.

Behavior:

- Resolves the workspace by name
- Returns `exists` from the filesystem
- Counts Markdown files under `<workspace>/inbox/`, excluding `<workspace>/inbox/archived/`
- Counts Markdown files under `<workspace>/knowledge/`, excluding `index.md` and `_index.md`
- Returns `lastCompiled` as `null`

### `knowledge_ingest_text`

Writes raw text into the workspace inbox.

Parameters:

- `workspace`: workspace name
- `content`: text to write
- `title`: optional title used for the file slug

Behavior:

- Creates `<workspace>/inbox/` if needed
- Writes a Markdown file named `{YYYY-MM-DD}-{slug}.md`
- Returns the file path relative to the workspace root and workspace name
- Indexes the new file into `<workspace>/.inbox-index.db` before returning

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
- Returns `McpError(ErrorCode.InternalError, "knowledge_ingest_clipboard requires macOS (pbpaste unavailable)")` when `pbpaste` is unavailable
- Reuses the same file-writing flow as `knowledge_ingest_text`

### `knowledge_ingest_url`

Fetches a web page through Jina Reader, then writes the rendered Markdown into the workspace inbox.

Parameters:

- `workspace`: workspace name
- `url`: the source URL to fetch
- `title`: optional title used for the file slug when provided

Result shape:

```json
{
  "file": "inbox/2026-04-05-every-copywriting-formula-ever.md",
  "workspace": "second-brain"
}
```

Behavior:

- Fetches `https://r.jina.ai/<url>` with an `Accept: text/markdown` header
- Surfaces fetch failures as `McpError(ErrorCode.InternalError, "...")`
- Surfaces non-2xx Jina responses as `McpError(ErrorCode.InternalError, "Jina Reader returned <status> for <url>")`
- Extracts the title from Jina frontmatter when no explicit title is provided
- Falls back to the source URL when neither an explicit title nor Jina title metadata is available
- Reuses the same file-writing flow as `knowledge_ingest_text`

### `knowledge_search`

Searches knowledge files with a workspace-local SQLite FTS5 index backed by Node's built-in `node:sqlite` module.

Parameters:

- `workspace`: workspace name
- `query`: search text
- `limit`: optional maximum result count

Result shape:

```json
{
  "results": [
    {
      "file": "knowledge/compile-architecture.md",
      "excerpt": "**Compile Workflow**\n...snippet text...",
      "score": 1
    }
  ]
}
```

Behavior:

- Resolves the workspace by name
- Returns `{ "results": [] }` when `<workspace>/knowledge/` does not exist
- Builds or reuses a SQLite database at `<workspace>/.knowledge-index.db`
- Uses Node 22's built-in SQLite runtime rather than a native addon, so the search path does not depend on a host-specific `.node` binary
- Re-indexes Markdown files under `<workspace>/knowledge/` on each search, excluding `index.md` and `_index.md`
- Skips files whose modification time has not changed since the last index pass
- Stores one chunk per heading section, with oversized sections split on paragraph boundaries
- Treats level 1 to 3 headings as chunk boundaries
- Strips YAML frontmatter, HTML comments, and image markup before indexing
- Preserves image alt text for search terms
- Returns snippets with the matching excerpt from the Markdown body and the nearest chunk heading when available
- Normalizes query tokens into FTS prefix terms, so each word is matched with a trailing wildcard

### `knowledge_search_inbox`

Searches inbox files with a workspace-local SQLite FTS5 index backed by Node's built-in `node:sqlite` module.

Parameters:

- `workspace`: workspace name
- `query`: search text
- `limit`: optional maximum result count

Result shape:

```json
{
  "results": [
    {
      "file": "inbox/2026-04-05-note.md",
      "excerpt": "**Heading**\n...snippet text...",
      "score": 1
    }
  ]
}
```

Behavior:

- Resolves the workspace by name
- Returns `{ "results": [] }` when `<workspace>/inbox/` does not exist
- Builds or reuses a SQLite database at `<workspace>/.inbox-index.db`
- Re-indexes Markdown files under `<workspace>/inbox/` on each search
- Skips files under `<workspace>/inbox/archived/`
- Skips files whose modification time has not changed since the last index pass
- Stores one chunk per heading section, with oversized sections split on paragraph boundaries
- Treats level 1 to 3 headings as chunk boundaries
- Strips YAML frontmatter, HTML comments, and image markup before indexing
- Preserves image alt text for search terms
- Returns snippets with the matching excerpt from the Markdown body and the nearest chunk heading when available
- Normalizes query tokens into FTS prefix terms, so each word is matched with a trailing wildcard

### `knowledge_get_next_inbox_file`

Returns the first unprocessed inbox file and its content in a single call.

Parameters:

- `workspace`: workspace name

Result shape:

```json
{
  "file": "inbox/2026-04-05-note.md",
  "content": "# Note\\n\\nContent...",
  "size": 512,
  "modified": "2026-04-05T10:15:00.000Z"
}
```

Behavior:

- Resolves the workspace by name
- Returns `null` when `<workspace>/inbox/` does not exist or has no unarchived Markdown files
- Reads the first inbox file in sorted path order
- Returns the file path relative to the workspace root together with the file contents, size, and modified timestamp

### `knowledge_get_dedupe_context`

Runs deterministic FTS searches against both the knowledge and inbox indexes for a file-specific query.

Parameters:

- `workspace`: workspace name
- `file`: inbox file path relative to the workspace root
- `query`: 2-3 key terms extracted from the file content

Result shape:

```json
{
  "file": "inbox/2026-04-05-note.md",
  "knowledgeMatches": [
    {
      "file": "knowledge/concepts/related.md",
      "excerpt": "**Heading**\\n...snippet text...",
      "score": 1
    }
  ],
  "inboxMatches": [
    {
      "file": "inbox/2026-04-05-other.md",
      "excerpt": "**Heading**\\n...snippet text...",
      "score": 1
    }
  ]
}
```

Behavior:

- Resolves the workspace by name
- Runs `knowledge/` and `inbox/` searches with a limit of 5 results each
- Filters out matches that point back to the file being processed
- Returns both result sets without modifying the filesystem

### `knowledge_compile_new`

Writes a newly compiled article, updates the index and log, and archives the source inbox file.

Parameters:

- `workspace`: workspace name
- `inbox_file`: inbox file path to archive after compile
- `article_path`: target path relative to `knowledge/`, such as `concepts/my-article.md`
- `content`: full compiled article markdown including YAML frontmatter

Result shape:

```json
{
  "articlePath": "knowledge/concepts/my-article.md",
  "inboxFile": "inbox/2026-04-05-note.md",
  "workspace": "second-brain"
}
```

Behavior:

- Resolves the workspace by name
- Creates `<workspace>/knowledge/` if needed
- Writes the article under `<workspace>/knowledge/<article_path>`
- Reads `knowledge/index.md` when it exists and otherwise starts a new master index
- Creates a `# Master Index — {workspaceName}` document with a `## Topics` section when no index exists yet
- Derives the topic from the first path segment of `article_path`
- Derives the reference path from `article_path` without the `.md` suffix and without a `knowledge/` prefix
- Adds the article to the topic section named after that topic
- Preserves any topic description text already stored beneath that heading
- Stores entries as bullet links in the form `- [[{ref}]] — {summary}`
- Derives the summary from `extractSummary(content)`
- Escapes literal pipe characters in the summary so bullet entries remain readable
- Updates the `Last compiled` stamp when the master index exists
- Appends a deterministic entry to `knowledge/log.md`
- Archives the source inbox file after the article is written
- Returns the normalized article path together with the inbox file and workspace name

### `knowledge_compile_extend`

Writes an updated article, refreshes the master index timestamp, appends to the log, and archives the source inbox file.

Parameters:

- `workspace`: workspace name
- `inbox_file`: inbox file path to archive after extend
- `target_path`: existing article path relative to the workspace root, such as `knowledge/concepts/existing.md`
- `content`: full updated article markdown including YAML frontmatter

Result shape:

```json
{
  "targetPath": "knowledge/concepts/existing.md",
  "inboxFile": "inbox/2026-04-05-note.md",
  "workspace": "second-brain"
}
```

Behavior:

- Resolves the workspace by name
- Writes the updated article under the existing knowledge path
- Reads `knowledge/index.md` when it exists
- Derives the reference path from `target_path` without a `knowledge/` prefix and without the `.md` suffix
- Derives the summary from `extractSummary(updatedContent)`
- Updates the matching bullet summary in the topic section that already owns that reference
- Refreshes the `Last compiled` stamp in the master index when the index exists
- Leaves topic descriptions and section structure intact while updating the matching bullet summary
- Appends a deterministic entry to `knowledge/log.md`
- Archives the source inbox file after the article is written
- Returns the article path that was updated together with the inbox file and workspace name

### `knowledge_list_inbox`

Lists Markdown files that are waiting in a workspace inbox.

Parameters:

- `workspace`: workspace name

Result shape:

```json
{
  "files": [
    {
      "path": "inbox/2026-04-05-note.md",
      "size": 512,
      "modified": "2026-04-05T10:15:00.000Z"
    }
  ]
}
```

Behavior:

- Resolves the workspace by name
- Reads `<workspace>/inbox/` recursively
- Skips anything under `<workspace>/inbox/archived/`
- Returns `.md` files sorted by relative path with size and modified timestamp
- Returns an empty file list when `inbox/` does not exist

### `knowledge_write`

Writes a compiled article into the workspace knowledge directory.

Parameters:

- `workspace`: workspace name
- `path`: file path relative to `<workspace>/knowledge/`
- `content`: UTF-8 text to write

Result shape:

```json
{
  "file": "knowledge/mcp-arch/compile.md",
  "workspace": "second-brain"
}
```

Behavior:

- Resolves the workspace by name
- Resolves the target under `<workspace>/knowledge/`
- Rejects paths that escape the knowledge boundary
- Creates parent directories as needed
- Writes the file as UTF-8
- Returns the file path relative to the workspace root

### `knowledge_archive`

Moves a processed inbox file into the archive area.

Parameters:

- `workspace`: workspace name
- `file`: path relative to the workspace root, such as `inbox/2026-04-05-note.md`

Result shape:

```json
{
  "original": "inbox/2026-04-05-note.md",
  "archived": "inbox/archived/2026-04-05-note.md",
  "workspace": "second-brain"
}
```

Behavior:

- Resolves the workspace by name
- Rejects paths outside `<workspace>/inbox/`
- Rejects files already inside `<workspace>/inbox/archived/`
- Verifies that the source file exists
- Creates `<workspace>/inbox/archived/` as needed
- Moves the source file into the archive directory
- Uses the basename of the source file for the archive name
- Prefixes the archive filename with `Date.now()` when the target name already exists
- Removes the archived file from `<workspace>/.inbox-index.db` so it no longer appears in inbox search results
- Returns both archived paths relative to the workspace root

### `knowledge_read`

Reads a file from the workspace.

Parameters:

- `workspace`: workspace name
- `path`: file path relative to the workspace root

Behavior:

- Resolves the requested path against the workspace root
- Rejects paths that escape the workspace boundary
- Reads the file contents as UTF-8
- Returns the content and file path relative to the workspace root

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
- Skips the master index files `index.md` and `_index.md` so the master index never appears in knowledge listings or indexing

## File naming and directory conventions

Workspace roots use three well-known subdirectories and three local files:

- `<workspace>/inbox/` for raw ingested content
- `<workspace>/inbox/archived/` for processed inbox files
- `<workspace>/knowledge/` for curated or compiled knowledge
- `<workspace>/knowledge/index.md` for the pipeline-maintained master index, organized by topic sections and bullet entries
- `<workspace>/knowledge/log.md` for the pipeline-maintained build log
- `<workspace>/.knowledge-index.db` for the local FTS index used by `knowledge_search`

Ingest tools write to `inbox/`. Inbox listing and archiving tools operate on `inbox/`, while read and list tools operate on `knowledge/` unless a specific path is provided.

All ingest tools preserve the same output contract: they create a dated Markdown file under `<workspace>/inbox/` and return the file path relative to the workspace root together with the workspace name.

The master index is the canonical human-readable catalog of compiled articles. It is excluded from knowledge listing and search, so only content files contribute to workspace counts and FTS indexing.

The search tool rebuilds its index from the Markdown files in `knowledge/` on demand, excluding the master index files, so search results always reflect the current filesystem state without requiring a separate indexing command. The database file is created the first time the search path runs against a workspace that already has a `knowledge/` directory.

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
