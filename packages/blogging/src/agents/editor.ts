/**
 * Editor agent — SEO/clarity review pass over a drafted post.
 *
 * Runs a deterministic local lint (cheap, no tokens) AND an optional LLM polish. The lint catches
 * structural SEO issues (missing H1, keyword absent, too short, no internal links). When the LLM
 * is provided, the editor asks it to fix flagged issues and returns the revised markdown. Pure-ish:
 * the LLM call is injected and optional, so the lint path is fully testable with no network.
 */
import type { LlmCompletionRequest } from '@advance-labs/types';
import type { CompleteFn } from '../llm/client.js';
import { fingerprint } from './dedup.js';
import type { ModelChoice, Post } from '../types.js';

export interface EditIssue {
  code: 'missing-h1' | 'keyword-missing' | 'too-short' | 'no-internal-links' | 'no-headings';
  message: string;
}

export interface EditReport {
  issues: EditIssue[];
  /** Word count of the body (front-matter excluded). */
  wordCount: number;
}

/** Minimum acceptable article length, in words. */
export const MIN_WORD_COUNT = 300;

/** Strip leading YAML front-matter so lint operates on the article body only. */
export function stripFrontMatter(markdown: string): string {
  const match = markdown.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? markdown.slice(match[0].length) : markdown;
}

/** Deterministic SEO/structure lint — no LLM, no network. */
export function lint(post: Pick<Post, 'markdown' | 'primaryKeyword'>): EditReport {
  const body = stripFrontMatter(post.markdown);
  const words = body.split(/\s+/).filter(Boolean);
  const issues: EditIssue[] = [];

  if (!/^#\s+\S/m.test(body) && !/^.+\n=+$/m.test(body)) {
    issues.push({ code: 'missing-h1', message: 'No H1 heading found.' });
  }
  if (!/^##\s+\S/m.test(body)) {
    issues.push({ code: 'no-headings', message: 'No H2 section headings found.' });
  }
  if (!body.toLowerCase().includes(post.primaryKeyword.toLowerCase())) {
    issues.push({
      code: 'keyword-missing',
      message: `Primary keyword "${post.primaryKeyword}" not present in body.`,
    });
  }
  if (words.length < MIN_WORD_COUNT) {
    issues.push({
      code: 'too-short',
      message: `Body is ${words.length} words; minimum is ${MIN_WORD_COUNT}.`,
    });
  }
  if (!/\]\(\/blog\//.test(body)) {
    issues.push({ code: 'no-internal-links', message: 'No internal /blog/ links found.' });
  }

  return { issues, wordCount: words.length };
}

export interface EditorInput {
  post: Post;
  /** Provide to enable the LLM polish step; omit for lint-only mode. */
  model?: ModelChoice;
}

export interface EditorResult {
  post: Post;
  report: EditReport;
  /** True when the LLM polish step ran and changed the markdown. */
  revised: boolean;
}

function buildPolishPrompt(post: Post, report: EditReport): LlmCompletionRequest['messages'] {
  const issueList = report.issues.map((i) => `- ${i.message}`).join('\n') || '- (none)';
  return [
    {
      role: 'system',
      content:
        'You are an SEO editor. Improve clarity and fix the listed issues. Preserve the YAML ' +
        'front-matter verbatim. Return ONLY the full revised Markdown, no commentary, no fences.',
    },
    {
      role: 'user',
      content: `Issues to fix:\n${issueList}\n\nArticle:\n${post.markdown}`,
    },
  ];
}

/**
 * Run the editor: lint, optionally polish via LLM, and return the updated post (status `edited`).
 * `complete` and `now` are injected; when `model`/`complete` is absent the lint result is applied
 * without rewriting the body.
 */
export async function runEditor(
  input: EditorInput,
  complete?: CompleteFn,
  now: () => Date = () => new Date(),
): Promise<EditorResult> {
  const report = lint(input.post);
  const ts = now().toISOString();

  if (!input.model || !complete || report.issues.length === 0) {
    return {
      post: { ...input.post, status: 'edited', updatedAt: ts },
      report,
      revised: false,
    };
  }

  const req: LlmCompletionRequest = {
    provider: input.model.provider,
    model: input.model.model,
    apiKey: input.model.apiKey,
    temperature: 0.3,
    maxTokens: 2048,
    messages: buildPolishPrompt(input.post, report),
  };
  const res = await complete(req);
  const revisedMarkdown = res.text.trim();
  const changed = revisedMarkdown.length > 0 && revisedMarkdown !== input.post.markdown.trim();

  const post: Post = {
    ...input.post,
    status: 'edited',
    markdown: changed ? `${revisedMarkdown}\n` : input.post.markdown,
    fingerprint: changed ? fingerprint(stripFrontMatter(revisedMarkdown)) : input.post.fingerprint,
    updatedAt: ts,
  };
  return { post, report: changed ? lint(post) : report, revised: changed };
}
