/**
 * `generate_outreach_email` — AI-drafted cold outreach (BYOK).
 *
 * Pipes a contact + context object through `@aeo/llm` via the injected
 * `OutreachClient`. The API key is request-scoped: it is read from the tool input,
 * forwarded to the LLM client, and never logged or persisted by this server.
 */
import { z } from 'zod';
import type { McpToolDef } from '@aeo/mcp-core';
import { jsonResult } from '../lib/result.js';
import { generateOutreach, type OutreachRequest } from '../lib/outreach.js';
import type { ToolDeps } from './deps.js';

const contactSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    site: z.string().optional(),
    role: z.string().optional(),
  })
  .describe('The recipient. All fields optional; more detail yields better personalization.');

const contextSchema = z
  .object({
    fromBrand: z.string().min(1).describe('Your brand or site doing the outreach.'),
    fromName: z.string().optional().describe('Your name, for the sign-off.'),
    reason: z
      .string()
      .min(1)
      .describe('Why you are reaching out (broken link, resource page fit, guest post, etc.).'),
    targetUrl: z.string().optional().describe('The page you want linked or featured.'),
    notes: z.string().optional().describe('Personalization notes to weave in.'),
    tone: z
      .string()
      .optional()
      .describe('Desired tone (default: concise, friendly, professional).'),
  })
  .describe('The outreach angle and sender context.');

const inputSchema = {
  contact: contactSchema,
  context: contextSchema,
  provider: z
    .enum(['anthropic', 'openai', 'groq', 'perplexity', 'gateway'])
    .describe('LLM provider for @aeo/llm.'),
  model: z.string().min(1).describe('Model id (e.g. claude-sonnet-4-20250514).'),
  apiKey: z.string().min(1).describe('BYOK API key — request-scoped, never persisted or logged.'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
};

type Shape = typeof inputSchema;

export function generateOutreachEmailTool(deps: ToolDeps): McpToolDef<Shape> {
  return {
    name: 'generate_outreach_email',
    title: 'Generate outreach email',
    description:
      'Draft a short, personalized cold outreach email from a contact + context object using your ' +
      'own LLM key (BYOK). Returns a subject line and body. The API key is request-scoped and is ' +
      'never persisted or logged.',
    inputSchema,
    handler: async (args) => {
      const req: OutreachRequest = {
        contact: args.contact,
        context: args.context,
        provider: args.provider,
        model: args.model,
        apiKey: args.apiKey,
        ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
        ...(args.maxTokens !== undefined ? { maxTokens: args.maxTokens } : {}),
      };

      const result = await generateOutreach(deps.outreach, req);
      return jsonResult({
        subject: result.subject,
        body: result.body,
        raw: result.raw,
        model: result.model,
      });
    },
  };
}
