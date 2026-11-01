# @advance-labs/visibility

AI-answer visibility checks. Ask an answer engine a buyer question, then work out whether a brand
was named in the answer, cited as a source, and where it ranked among competitors.

Ported from the AI Visibility Wall's `engines.js` and `aeo-visibility.js`.

## Install

```bash
npm install @advance-labs/visibility ai
```

`ai` (Vercel AI SDK v6) is a peer dependency. Auth is read from the environment by the AI SDK:
`AI_GATEWAY_API_KEY` locally, or `VERCEL_OIDC_TOKEN` on Vercel. No keys live in this package.

## Use

```ts
import { askEngine, analyzeAnswer, mapPooled, DEFAULT_ENGINES } from '@advance-labs/visibility';

const brand = { name: 'Linear', domain: 'linear.app', aliases: ['Linear App'] };
const rivals = [{ name: 'Jira', domain: 'atlassian.com' }];

const checks = await mapPooled(DEFAULT_ENGINES, 3, async (slug) => {
  const answer = await askEngine(slug, 'What is the best issue tracker for a startup?', {
    timeoutMs: 60_000,
  });
  return {
    engine: answer.engine,
    costUsd: answer.costUsd,
    ...analyzeAnswer(answer, brand, rivals),
  };
});
// [{ status: 'fulfilled', value: { engine, named, cited, position, competitorsNamed } }, ...]
```

## API

- `analyzeAnswer({ text, sources }, entity, competitors?)` returns
  `{ named, cited, position, competitorsNamed }`.
  - `named`: name, alias or domain appears in the prose (case-insensitive, whole-word, so "Linear"
    does not match "linearly").
  - `cited`: the entity's domain, or any subdomain of it, is among the source URLs.
  - `position`: 1 + competitors first mentioned before the entity; `null` if not named in prose.
  - `competitorsNamed`: competitors named in prose or cited as a source.
- `entityTerms(entity)`: the match strings (name, aliases, domain, and the domain's brand label if
  4+ characters; shorter labels cause false positives).
- `askEngine(slug, prompt, opts?)`: one grounded answer through the Vercel AI Gateway. `slug` is a
  gateway model slug. Perplexity searches natively; other models get the gateway's Perplexity
  search tool (5 results, up to 3 steps). Returns `{ text, sources, engine, model, usage?, costUsd? }`.
  `opts`: `model` (override the model object), `timeoutMs`, `tags`, `searchTool`.
- `DEFAULT_ENGINES`: `perplexity/sonar`, `openai/gpt-5.6-luna`, `google/gemini-3.7-flash`.
- `engineLabel(slug)`, `collectSources(result)`, `mapPooled(items, limit, fn)`.

## What this measures

Non-Perplexity engines measure "would this model name the brand when reasoning over live search
results", not a replay of chatgpt.com or gemini.google.com. Do not describe it as the latter.

## License

Apache-2.0
