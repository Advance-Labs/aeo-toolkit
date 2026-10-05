# ADV-322: keyless MCP context measurement

**Status: measurement recorded; fold decision open.** ADR-0004 is in [PR #75](https://github.com/Advance-Labs/aeo-toolkit/pull/75), not yet merged. This note measures the payload but does not amend that ADR or claim a client comparison happened.

## What the servers advertise

On 2026-10-05 at repo commit `3977328`, I registered the current `ai-visibility` and `backlink` tool sets on `@modelcontextprotocol/sdk` v1.29.0's `McpServer`, connected an SDK `Client` using `InMemoryTransport`, and captured each actual `tools/list` result. The hypothetical 12-tool result is the two returned `tools` arrays concatenated in registration order. It is not a deployed combined endpoint.

| Tool set | Tools | Compact `tools` JSON bytes | `cl100k_base` tokens | `o200k_base` tokens | Names-only proxy (`cl100k_base`) |
|---|---:|---:|---:|---:|---:|
| AI Visibility | 5 | 3,540 | 821 | 846 | 26 |
| Backlink | 7 | 6,064 | 1,361 | 1,378 | 33 |
| Hypothetical combined | 12 | 9,603 | 2,180 | 2,222 | 58 |

The JSON is compact UTF-8 with no spaces (`JSON.stringify(tools)` equivalent). The token columns use Python `tiktoken` v0.14.0's `cl100k_base` and `o200k_base` encodings on that same compact JSON; they are **cross-model proxies, not Claude or Cursor billed-token measurements**. Names-only is `JSON.stringify(tools.map(t => t.name))`, also only a proxy for deferred discovery. The full `tools/list` response object adds roughly one JSON wrapper; the 5/7/12 `cl100k_base` totals become 822/1,362/2,181 tokens. The combined schema is almost exactly additive, so the cost of loading all twelve is about 2.18k proxy tokens. The question is when and whether a client loads it.

## What client evidence says today

- [Claude Code's current MCP documentation](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search) says tool search defaults to deferring **all** MCP schemas, loading names and server instructions until tools are needed. Its `ENABLE_TOOL_SEARCH=auto` mode uses an **aggregate 10% of context window** threshold; there is no documented seven-tool or twelve-tool per-server cutoff. Thus the 2026-10-02 observation that all 31 tools were deferred does not, by itself, show that twelve would cross a threshold. This is a reading of the documented policy, not a live Claude Code result for these servers.
- [Claude's connector access modes](https://support.claude.com/en/articles/13730515-manage-claude-s-tool-access) describe Auto, Always available, and On demand. They give broad guidance by connector and tool totals, but no published seven-versus-twelve cutoff. No authenticated Claude.ai comparison was run.
- [Cursor's MCP documentation](https://docs.cursor.com/context/model-context-protocol) says disabled tools do not enter context. It does not publish a seven-versus-twelve deferral threshold. No Cursor comparison was run.

This environment has neither a signed-in Claude Code CLI nor Cursor client, and no Claude.ai connector session was available for a controlled comparison. SDK `tools/list` proves the definitions and wire shape, **not** what those clients place in model context. It also does not measure tool selection quality or the shared-handler failure/rate-limit effect.

## Experiment needed before a decision

1. In one real client account, connect the existing 7-tool Backlink endpoint in a fresh session with fixed model, context size, tool-access mode, and other connected servers. Record the client's reported MCP context tokens (Claude Code: `/context all`, plus `/mcp` connection status) and whether each schema starts loaded or deferred. Ask for one Backlink tool and record discovery/call success.
2. Repeat with a temporary **12-tool combined endpoint** using the same registry definitions and identical client settings. Keep both old URLs working during this experiment; do not migrate client configs yet. Record the same context and discovery measurements, plus whether AI Visibility and Backlink tools can both be selected and called. Do not call key-bearing tools without test credentials.
3. Repeat in Claude.ai Auto and On demand, and Cursor, if those are real client surfaces in use. Record mode and screenshot/log evidence. Compare 12 versus 7, not 31 versus 7, and note other tools consuming the context budget.
4. Test failure isolation and rate-limit scope in the combined handler with injected Perplexity failures. Only then decide whether one fewer client config entry is worth the measured context and blast-radius change. Amend ADR-0004 and plan aliases for both old endpoints if folding wins.

The current evidence supports **no fold decision**. It does correct the premise that tool count alone triggers Claude Code's default deferral at twelve.
