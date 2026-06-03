import { describe, expect, it } from 'vitest';

import { buildAiVisibilityServer } from './create-server.js';
import { registerAllTools } from './tools/index.js';
import { createServer } from '@aeo/mcp-core';
import { fakeDeps } from './tools/test-fixtures.js';

describe('buildAiVisibilityServer', () => {
  it('builds a rate-limited server with an McpServer instance', () => {
    const created = buildAiVisibilityServer(fakeDeps().deps);
    expect(created.server).toBeDefined();
    expect(created.rateLimiter).toBeDefined();
  });

  it('registers all five tools via the SDK registerTool without throwing', () => {
    const created = createServer({ name: 'test', version: '0.0.0' });
    const names: string[] = [];
    // Spy on the SDK server's registerTool to capture the registered tool names.
    const sdkServer = created.server as unknown as {
      registerTool: (name: string, ...rest: unknown[]) => unknown;
    };
    const original = sdkServer.registerTool.bind(sdkServer);
    sdkServer.registerTool = (name: string, ...rest: unknown[]): unknown => {
      names.push(name);
      return original(name, ...rest);
    };

    registerAllTools(created, fakeDeps().deps);

    expect(names).toEqual([
      'analyze_website_aeo',
      'check_ai_visibility',
      'discover_ranking_prompts',
      'get_visibility_report',
      'compare_competitor_visibility',
    ]);
  });
});
