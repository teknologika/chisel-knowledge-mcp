# Canonical Documentation Map

This file is the authoritative root-of-trust for documentation discovery in this repository. When documenting or updating behavior, start here and update the mapped canonical doc in place.

| Area | Code evidence (paths/symbols) | Canonical doc |
| --- | --- | --- |
| MCP server behavior and workspace operations | `src/server.ts`, `src/shared/config/config.ts`, `src/domains/workspace/workspace.service.ts`, `src/infrastructure/mcp/mcp-server.ts` | [`docs/chisel-knowledge-mcp.md`](./chisel-knowledge-mcp.md) |


## How To Extend This Mapping

Add a new mapping entry only when behavior is not owned by an existing canonical area and cannot be reasonably covered by extending an existing canonical doc. New entries must map one behavioral unit to exactly one file under `docs/`, and include concrete code evidence (paths and symbols).
