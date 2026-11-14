// There is no PHP test runner in CI; this checks the one thing that can silently drift:
// the bot pattern in the PHP file must list exactly the AI bots the console's classifier counts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const php = readFileSync(new URL('./aeo-ai-demand-collector/aeo-ai-demand-collector.php', import.meta.url), 'utf8');
const m = /const AEO_COLLECTOR_AI_BOTS = '\/(.+)\/i';/.exec(php);
assert.ok(m, 'pattern constant not found');
const source = m[1];
const re = new RegExp(source, 'i');

// Mirror of AI_BOTS in aeo-platform apps/console/src/lib/ai-bots/classify.ts. That repo's
// docs-sync test checks the same list against its own snippets.
const TOKENS = ['ChatGPT-User', 'OAI-SearchBot', 'GPTBot', 'Claude-User', 'Claude-SearchBot', 'ClaudeBot', 'Perplexity-User', 'PerplexityBot', 'MistralAI-User', 'DuckAssistBot', 'Meta-ExternalFetcher', 'Meta-ExternalAgent', 'Amazonbot', 'Bytespider', 'CCBot'];

test('pattern lists exactly the known AI bots', () => {
  assert.equal(source, `(?:^|[^A-Za-z0-9-])(${TOKENS.join('|')})(?![A-Za-z0-9-])`);
});

test('matches AI user agents, case-insensitively', () => {
  assert.ok(re.test('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'));
  assert.ok(re.test('Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)'));
  assert.ok(re.test('claude-user'));
});

test('does not match people, search engines or look-alike tokens', () => {
  assert.ok(!re.test('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'));
  assert.ok(!re.test('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'));
  assert.ok(!re.test('X-GPTBot-extra'));
});

test('uninstall removes every option the plugin stores', () => {
  const stored = new Set([...php.matchAll(/'(aeo_collector_(?:key|ip_source|queue))'/g)].map((x) => x[1]));
  const un = readFileSync(new URL('./aeo-ai-demand-collector/uninstall.php', import.meta.url), 'utf8');
  for (const o of ['aeo_collector_key', 'aeo_collector_ip_source', 'aeo_collector_queue']) {
    assert.ok(stored.has(o), o);
    assert.ok(un.includes(`'${o}'`), `uninstall misses ${o}`);
  }
});
