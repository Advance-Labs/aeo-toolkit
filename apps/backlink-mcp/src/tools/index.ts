/**
 * Tool factory aggregation.
 *
 * Each factory takes the shared `ToolDeps` and returns a typed `McpToolDef` over
 * its *own* zod input shape. To register them all from one loop without losing
 * (or unifying) those heterogeneous shapes, we wrap each factory in a registrar
 * thunk via `toRegistrar`: the generic captures each tool's concrete `TShape` at
 * definition time, so the resulting `TOOL_REGISTRARS` array is uniformly typed
 * (`ToolRegistrar`) and every `registerTool` call inside stays monomorphic.
 *
 * Keeping registrars as an array makes the http and stdio entrypoints — and the
 * tests — register exactly the same set.
 */
import type { ZodRawShape } from 'zod';
import { registerTool, type CreatedServer, type McpToolDef } from '@aeo/mcp-core';

import type { ToolDeps } from './deps.js';
import { findMentionsTool } from './find-mentions.js';
import { findProspectsTool } from './find-prospects.js';
import { findCompetitorLinkSourcesTool } from './find-competitor-link-sources.js';
import { verifyPageLinksTool } from './verify-page-links.js';
import { extractContactInfoTool } from './extract-contact-info.js';
import { checkPageHistoryTool } from './check-page-history.js';
import { generateOutreachEmailTool } from './generate-outreach-email.js';

export type { ToolDeps } from './deps.js';

/** Builds a tool from injected deps and registers it on a `CreatedServer`. */
export type ToolRegistrar = (target: CreatedServer, deps: ToolDeps) => void;

/**
 * Wrap one tool factory in a registrar, capturing its concrete zod shape in
 * `TShape`. Each `registerTool` call is thus monomorphic (the shape is fixed at
 * this call site), and the returned thunk erases `TShape` to a uniform
 * `ToolRegistrar` so a heterogeneous set can live in one array.
 */
function toRegistrar<TShape extends ZodRawShape>(
  factory: (deps: ToolDeps) => McpToolDef<TShape>,
): ToolRegistrar {
  return (target, deps) => {
    registerTool(target, factory(deps));
  };
}

/** Every tool registrar, in registration order. */
export const TOOL_REGISTRARS: readonly ToolRegistrar[] = [
  toRegistrar(findMentionsTool),
  toRegistrar(findProspectsTool),
  toRegistrar(findCompetitorLinkSourcesTool),
  toRegistrar(verifyPageLinksTool),
  toRegistrar(extractContactInfoTool),
  toRegistrar(checkPageHistoryTool),
  toRegistrar(generateOutreachEmailTool),
];

export {
  findMentionsTool,
  findProspectsTool,
  findCompetitorLinkSourcesTool,
  verifyPageLinksTool,
  extractContactInfoTool,
  checkPageHistoryTool,
  generateOutreachEmailTool,
};
