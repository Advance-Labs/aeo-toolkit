import { describe, expect, it } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import {
  analyzeAnswer,
  askEngine,
  collectSources,
  DEFAULT_ENGINES,
  engineLabel,
  entityTerms,
  mapPooled,
  type Entity,
} from './index.js';

const linear = { name: 'Linear', domain: 'linear.app' };

describe('entityTerms', () => {
  it('includes name, aliases, domain and 4+ char brand label, lowercased', () => {
    expect(
      entityTerms({ name: 'Acme Co', domain: 'https://www.acme.io/x', aliases: ['ACME'] }).sort(),
    ).toEqual(['acme', 'acme co', 'acme.io'].sort());
  });
  it('drops short brand labels', () => {
    expect(entityTerms({ name: 'Hom', domain: 'hom.ca' }).sort()).toEqual(['hom', 'hom.ca']);
  });
});

describe('analyzeAnswer', () => {
  const run = (text: string, sources: string[] = [], comps: Entity[] = []) =>
    analyzeAnswer({ text, sources }, linear, comps);

  it('does not match substrings', () => {
    expect(run('Tasks scale linearly with team size.').named).toBe(false);
    expect(run('Try Linear for issues.').named).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(run('i like LINEAR a lot').named).toBe(true);
  });
  it('matches aliases and domain in prose', () => {
    const e = { name: 'Acme Corporation', domain: 'acme.io', aliases: ['Acme'] };
    expect(analyzeAnswer({ text: 'Acme is great', sources: [] }, e).named).toBe(true);
    expect(analyzeAnswer({ text: 'see acme.io today', sources: [] }, e).named).toBe(true);
  });
  it('cited via exact host and subdomain, not via lookalike', () => {
    expect(run('', ['https://linear.app/docs']).cited).toBe(true);
    expect(run('', ['https://docs.linear.app/x']).cited).toBe(true);
    expect(run('', ['https://www.linear.app/x']).cited).toBe(true);
    expect(run('', ['https://notlinear.app/x']).cited).toBe(false);
    expect(run('', ['https://linear.app.evil.com/x']).cited).toBe(false);
  });
  it('named and cited are independent', () => {
    const r = run('nothing here', ['https://linear.app']);
    expect(r).toMatchObject({ named: false, cited: true, position: null });
  });
  it('position counts competitors named first; competitors from prose or sources', () => {
    const comps = [
      { name: 'Jira', domain: 'atlassian.com', aliases: ['Jira'] },
      { name: 'Asana', domain: 'asana.com' },
      { name: 'Trello', domain: 'trello.com' },
    ];
    const r = run(
      'Jira and Asana are popular, but Linear is fast.',
      ['https://trello.com/x'],
      comps,
    );
    expect(r.position).toBe(3);
    expect(r.competitorsNamed).toEqual(['Jira', 'Asana', 'Trello']);
    expect(run('Linear beats Jira.', [], comps).position).toBe(1);
  });
  it('handles whitespace runs inside multi-word names', () => {
    const e = { name: 'Kuzyn Builds', domain: 'kuzyn.ca' };
    expect(analyzeAnswer({ text: 'Kuzyn\n  Builds does it', sources: [] }, e).named).toBe(true);
  });
});

describe('mapPooled', () => {
  it('never exceeds the limit, preserves order, captures errors', async () => {
    let inflight = 0;
    let peak = 0;
    const out = await mapPooled([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inflight++;
      peak = Math.max(peak, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight--;
      if (n === 3) throw new Error('boom');
      return n * 2;
    });
    expect(peak).toBe(2);
    expect(out.map((o) => o.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
    expect(out[5]).toEqual({ status: 'fulfilled', value: 12 });
  });
  it('handles empty input', async () => {
    expect(await mapPooled([], 3, async () => 1)).toEqual([]);
  });
});

describe('collectSources', () => {
  it('reads native sources and tool results, deduped, http(s) only', () => {
    expect(
      collectSources({
        sources: [{ url: 'https://a.com' }, { url: 'ftp://x' }],
        steps: [
          {
            toolResults: [
              { output: { results: [{ url: 'https://a.com' }, { url: 'https://b.com' }] } },
            ],
          },
        ],
      }),
    ).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('askEngine (mock model, no network)', () => {
  it('returns text, label and usage', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'Linear is a good pick.' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 5, text: 5, reasoning: 0 },
        },
        warnings: [],
      }),
    } as never);
    const a = await askEngine('perplexity/sonar', 'best issue tracker?', {
      model,
      timeoutMs: 5000,
    });
    expect(a.text).toBe('Linear is a good pick.');
    expect(a.engine).toBe('perplexity');
    expect(a.model).toBe('perplexity/sonar');
    expect(a.usage?.totalTokens).toBe(15);
    expect(a.costUsd).toBeUndefined();
  });
});

describe('defaults', () => {
  it('exports the measured engines and label helper', () => {
    expect(DEFAULT_ENGINES).toEqual([
      'perplexity/sonar',
      'openai/gpt-5.6-luna',
      'google/gemini-3.7-flash',
    ]);
    expect(engineLabel('openai/gpt-5.6-luna')).toBe('openai');
  });
});
