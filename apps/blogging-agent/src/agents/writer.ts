/**
 * Writer agent — turns a topic brief into a full markdown article.
 *
 * Cost-split: drafting is bulk work, so it runs on the cheap high-throughput model (Groq via
 * `@aeo/llm`). The agent injects internal links from the brief and produces front-matter plus a
 * structured body. Pure-ish: the LLM call is injected as `CompleteFn`.
 */
import type { LlmCompletionRequest } from '@aeo/types';
import type { CompleteFn } from '../llm/client.js';
import { fingerprint } from './dedup.js';
import type { ModelChoice, Post, Strategy, TopicBrief } from '../types.js';

export interface WriterInput {
  brief: TopicBrief;
  strategy: Strategy;
  model: ModelChoice;
}

function buildSystemPrompt(strategy: Strategy): string {
  return [
    'You are an expert SEO content writer.',
    `Audience: ${strategy.audience || 'a general professional readership'}.`,
    `Voice: ${strategy.voice || 'clear, authoritative, and practical'}.`,
    'Write a complete, original blog article in GitHub-flavored Markdown.',
    'Start with an H1 title, then a 2-3 sentence intro, then well-structured H2/H3 sections,',
    'and a short conclusion. Use the provided internal link slugs as relative Markdown links',
    'in the form [anchor](/blog/<slug>). Do not fabricate statistics. No front-matter, no code fences.',
  ].join(' ');
}

function buildUserPrompt(brief: TopicBrief): string {
  const links =
    brief.internalLinks.length > 0
      ? brief.internalLinks.map((s) => `- /blog/${s}`).join('\n')
      : '- (none)';
  return [
    `Title: ${brief.title}`,
    `Primary keyword: ${brief.primaryKeyword}`,
    `Secondary keywords: ${brief.secondaryKeywords.join(', ') || '(none)'}`,
    `Search intent / angle: ${brief.intent}`,
    'Internal link targets (use 1-3 naturally where relevant):',
    links,
  ].join('\n');
}

/** Prepend YAML front-matter so the published file is CMS-ready. */
export function withFrontMatter(brief: TopicBrief, body: string): string {
  const fm = [
    '---',
    `title: ${JSON.stringify(brief.title)}`,
    `slug: ${JSON.stringify(brief.slug)}`,
    `keyword: ${JSON.stringify(brief.primaryKeyword)}`,
    '---',
    '',
  ].join('\n');
  return `${fm}${body.trim()}\n`;
}

/**
 * Run the writer agent: draft markdown for a brief and return a `Post` in `drafted` status with a
 * fresh dedup fingerprint. `now` is injected for deterministic timestamps in tests.
 */
export async function runWriter(
  input: WriterInput,
  complete: CompleteFn,
  now: () => Date = () => new Date(),
): Promise<Post> {
  const req: LlmCompletionRequest = {
    provider: input.model.provider,
    model: input.model.model,
    apiKey: input.model.apiKey,
    temperature: 0.7,
    maxTokens: 2048,
    messages: [
      { role: 'system', content: buildSystemPrompt(input.strategy) },
      { role: 'user', content: buildUserPrompt(input.brief) },
    ],
  };

  const res = await complete(req);
  const body = res.text.trim();
  if (body.length === 0) {
    throw new WriterEmptyDraftError(input.brief.slug);
  }
  const markdown = withFrontMatter(input.brief, body);
  const ts = now().toISOString();

  return {
    slug: input.brief.slug,
    title: input.brief.title,
    primaryKeyword: input.brief.primaryKeyword,
    status: 'drafted',
    markdown,
    fingerprint: fingerprint(body),
    createdAt: ts,
    updatedAt: ts,
    revisionCount: 0,
  };
}

export class WriterEmptyDraftError extends Error {
  constructor(slug: string) {
    super(`writer produced an empty draft for "${slug}"`);
    this.name = 'WriterEmptyDraftError';
  }
}
