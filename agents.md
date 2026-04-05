# AGENTS.md — Codebase Dedupe Protocol (Codex)

## Goal
Prevent duplicate implementations and “wrong file” edits by making **codebase-search** the *only valid source* for claims about what already exists in this repo during this session.

This project has a strict rule: **you must not create new code, new files, or new implementations unless you have first searched the codebase using the MCP tool and compared against the results.** 

## Canonical docs discovery
If `docs/CANONICAL_DOCS.md` exists, it is the first stop for documentation discovery and update routing. Canonical docs listed there must be updated in place; do not create parallel delta docs for those areas.

## Tools you MUST use for codebase discovery
Use **codebase-search** tools for discovery and evidence:

- `list_codebases`
- `search_codebases`
- `get_codebase_stats`

After updates run `update_codebase_scan` to refresh the codebase search results.

These are the only approved discovery tools for “what exists already.”

### Research Planning Refine Repeat (RPRR) Architecture Guardrail

When modifying planning, research, task generation, or execution flows, the RPRR compile boundary must not be violated. A plan is a revisioned cognitive artefact, not a task list. Tasks may only be created by compiling an approved plan revision via the PlanCompiler into TaskStore.

Before implementing any change that touches planning or task creation, review the full guardrail document: docs/RPRR-compile-boundary.md. No planning workflow may create tasks prior to explicit compile.

## Hard rule: No creation without a Dedupe Ticket
Before you do *any* of the following, you must produce a Dedupe Ticket and run the searches it specifies:

Creation triggers include: adding a new file, adding a new module/class/function, introducing a new utility/helper, duplicating a configuration pattern, or proposing a new “approach/framework” that sounds like it could already exist.

A **Dedupe Ticket** is a short structured note you write in your response (keep it compact):

**Dedupe Ticket**
- Intent signature: `<one sentence describing exactly what you are about to add/change>`
- Queries: `<2–4 searches you will run in search_codebases>`
- Top matches: `<up to 5 result identifiers or file paths returned by the tool>`
- Decision: `reuse | extend | new`
- Rationale: `<why reuse/extend is sufficient, or why new is justified>`

You must actually call `search_codebases` before finalizing the ticket. Do not guess.

## Execution protocol
When asked to implement or change code:

1) If the request implies any creation trigger, begin by calling `search_codebases` (and `list_codebases` if you have not yet selected the codebase in this session).
2) Review results and decide `reuse | extend | new`.
3) Only then propose edits, and prefer extending existing implementations over creating new ones.
4) After making significant edits run update_codebase_scan to re-index the codebase

## What you may not do
You may not claim “there is no existing implementation” or “this doesn’t exist” unless you have run `search_codebases` in this session and the results support that claim. “I didn’t see it” is not acceptable without a tool call.

You may not create “parallel” implementations alongside existing ones unless the Dedupe Ticket explicitly justifies why reuse/extension is not viable.

Do not create "regressions" or remove existing features. If you are going to remove or change existing code you need to understand what it does and why it is there in the first place.

## Graceful degradation
If the MCP server is unavailable or returning errors:
State **DEGRADED MODE** at the top of your reply and stop before making changes. Ask for the MCP server to be enabled/fixed, or ask for explicit user approval to proceed best-effort without search. Do not proceed silently.

## Tool intent alignment
When you need to know what exists, where it is, or how similar code is structured, you must treat `search_codebases` as authoritative. Do not infer from local context alone. 

# Canonical Documentation Sync Protocol

## Goal
Keep canonical documentation **continuously correct**. Documentation is not a changelog. After any behavioural change, the canonical docs must read as if the code has always worked that way.

## Canonical docs are authoritative artefacts
For any significant code change, you must treat the canonical documentation as a required companion artefact:
- You must **locate the canonical doc(s)** that describe the relevant behaviour.
- You must **update the existing doc(s) in place** (rewrite/expand sections as needed).
- You must **not** create “delta docs” that explain what changed, unless explicitly requested.

### Canonical mapping entrypoint
- If `docs/CANONICAL_DOCS.md` exists, it is the first stop for canonical doc discovery and update routing.
- Treat the mapped file for each area as the source of truth and update it in place (do not create delta docs).

## Tools you MUST use for doc discovery
Use **codebase-search** for documentation discovery and evidence, same as code discovery:
- `search_codebases`
- `get_chunk_content`
- `list_codebases` (if you haven’t selected a codebase yet)

You may not claim “no docs exist” unless you have searched for them in this session.

## Hard rule: No behavioural change without a Doc Sync Ticket
Before finalising any change that affects behaviour, you must produce a Doc Sync Ticket and run the searches it specifies.

A **behavioural change** includes (but is not limited to): control flow changes, config-driven mode changes, new parameters, changed return values, side effects, error handling, defaults, invariants, or any change that alters how a user/operator should reason about the system.

A **Doc Sync Ticket** is a short structured note you write in your response (keep it compact):

**Doc Sync Ticket**
- Intent signature: `<one sentence describing the behavioural change>`
- Doc discovery queries: `<2–4 searches you will run in search_codebases to find canonical docs>`
- Canonical docs: `<paths to the doc file(s) you will update>`
- Sections affected: `<headings/anchors that will be rewritten or expanded>`
- Sync decision: `update | expand | new section`
- Rationale: `<why this is the minimal coherent update>`

You must actually call `search_codebases` and `get_chunk_content` before finalising the ticket. Do not guess.

## Documentation quality bar (non-negotiable)
When updating canonical docs, write at the level of detail shown in the example: explain decision points, modes, invariants, and downstream effects. Do not simply restate code. Prefer “what it means” over “what it says”.

### Style rules for canonical docs
- Do not use drift language such as “recently added”, “now supports”, “changed from”. Rewrite so it reads as current truth.
- Do not append patch notes to the end of a section if the correct action is to rewrite the section.
- If behaviour is config/mode driven, the documentation must describe each mode, default selection, and the implications.

## Execution protocol
When asked to implement or change code:

1) Run Dedupe Protocol as usual if any creation trigger applies.
2) If the request implies any behavioural change, begin doc discovery by calling `search_codebases` to locate the canonical doc(s).
3) Produce a Doc Sync Ticket (`update | expand | new section`) grounded in tool results.
4) Implement the code change.
5) Update the canonical doc(s) **in place** to match the new behaviour.
6) After significant edits, run `update_codebase_scan` to refresh codebase-search results.

## What you may not do
- You may not finish an implementation response with behavioural changes unless canonical docs have been updated.
- You may not claim documentation is “up to date” unless you have edited the canonical doc(s) in this session.
- You may not create new docs when an existing canonical doc exists unless the Doc Sync Ticket justifies a new section or a new doc location.

## Graceful degradation
If the MCP server is unavailable or returning errors:
State **DEGRADED MODE** at the top of your reply and stop before making changes. Ask for MCP to be enabled/fixed, or ask for explicit user approval to proceed best-effort without doc discovery and sync. Do not proceed silently.
