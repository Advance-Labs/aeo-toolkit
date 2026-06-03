/**
 * System + user prompt construction for the grounded SEO answer. Pure string assembly.
 *
 * The system prompt forces the model to answer ONLY from the supplied GA4 + GSC context and to
 * return a numbered, prioritized fix list — matching the tool's contract.
 */
import type { LlmMessage } from '@aeo/types';

export const SYSTEM_PROMPT = [
  'You are an SEO analyst. You are given real Google Analytics 4 and Google Search Console data for a',
  'single website, followed by a question. Rules:',
  '1. Answer ONLY using the numbers in the provided DATA block. Never invent metrics or pages.',
  '2. If the data does not contain what is needed to answer, say so explicitly and state what data',
  '   would be required.',
  '3. Cite specific figures (queries, pages, CTR, impressions, clicks, position) from the DATA block.',
  '4. End with a numbered, prioritized list of concrete fixes, highest impact first.',
  '5. Be concise. No preamble.',
].join('\n');

export interface BuildPromptInput {
  dataContext: string;
  question: string;
}

/** Assemble the message array for `@aeo/llm` `complete()`. */
export function buildMessages(input: BuildPromptInput): LlmMessage[] {
  const userContent = ['DATA:', input.dataContext, '', `QUESTION: ${input.question}`].join('\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
