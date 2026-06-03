/**
 * Publisher — the single true side effect of the pipeline.
 *
 * Everything upstream (research → write → edit → schedule) is pure data transformation. Publishing
 * pushes a post to a live destination (a Git-backed static site, a headless CMS, a Vercel deploy
 * hook). That I/O is isolated behind this interface so the orchestrator stays testable and so a
 * dry run can swap in `NoopPublisher` with zero credentials.
 */
import type { Post } from '../types.js';
import type { Env } from '../config.js';

export interface PublishResult {
  slug: string;
  /** Canonical URL the post is now reachable at. */
  url: string;
  /** Provider-specific id (commit sha, CMS entry id, deployment id). */
  ref?: string;
  publishedAt: string;
}

export interface Publisher {
  /** Publish one post; resolves with its canonical URL. Throws `PublishError` on failure. */
  publish(post: Post): Promise<PublishResult>;
}

export class PublishError extends Error {
  constructor(
    message: string,
    readonly slug: string,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

/**
 * No-op publisher for dry runs and tests. Computes the canonical URL deterministically and records
 * "publication" without performing any network I/O. Default for `node dist/run.js` without
 * publish credentials configured.
 */
export class NoopPublisher implements Publisher {
  constructor(
    private readonly baseUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  publish(post: Post): Promise<PublishResult> {
    const url = joinUrl(this.baseUrl, `/blog/${post.slug}`);
    return Promise.resolve({
      slug: post.slug,
      url,
      ref: 'dry-run',
      publishedAt: this.now().toISOString(),
    });
  }
}

/** Join an origin and a path into one URL without doubled slashes. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * The subset of the global `fetch` we use, narrowed so tests can inject a stub without pulling in
 * DOM lib types. Returns enough of a `Response` to branch on `ok`/`status` and read the body.
 */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

/** The JSON payload POSTed to the publish webhook. Contains no secrets. */
export interface PublishWebhookPayload {
  slug: string;
  title: string;
  /** Markdown body of the post (the canonical source). */
  markdown: string;
  /** Primary target keyword, useful for CMS front-matter. */
  primaryKeyword: string;
  /** Canonical URL the post should be reachable at. */
  canonical: string;
}

export interface CmsPublisherConfig {
  baseUrl: string;
  /** Webhook that receives the rendered post (a CMS endpoint or a serverless ingest route). */
  webhookUrl: string;
  /** Optional Vercel/Netlify deploy hook pinged (empty POST) after the post is accepted. */
  deployHookUrl?: string;
  /**
   * Optional request-scoped bearer credential for the webhook. Never persisted or logged; sent only
   * in the `Authorization` header of the publish request.
   */
  token?: string;
  /** Injectable fetch (defaults to global `fetch`). */
  fetch?: FetchLike;
  /** Injectable clock for deterministic `publishedAt`. */
  now?: () => Date;
}

/**
 * Webhook/CMS publisher.
 *
 * `publish` POSTs the rendered post as JSON to `webhookUrl`, then — when `deployHookUrl` is set —
 * fires an empty POST to trigger a static-site rebuild. It returns the post's canonical URL plus a
 * provider ref echoed by the webhook (when present). All credentials are request-scoped: the bearer
 * token lives only in the `Authorization` header and is never logged.
 */
export class CmsPublisher implements Publisher {
  private readonly fetch: FetchLike;
  private readonly now: () => Date;

  constructor(private readonly config: CmsPublisherConfig) {
    // Wrap global fetch so it keeps its receiver; Response is structurally a FetchResponseLike.
    this.fetch =
      config.fetch ?? ((url, init) => globalThis.fetch(url, init) as Promise<FetchResponseLike>);
    this.now = config.now ?? (() => new Date());
  }

  async publish(post: Post): Promise<PublishResult> {
    const canonical = post.url ?? joinUrl(this.config.baseUrl, `/blog/${post.slug}`);

    const payload: PublishWebhookPayload = {
      slug: post.slug,
      title: post.title,
      markdown: post.markdown,
      primaryKeyword: post.primaryKeyword,
      canonical,
    };

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.config.token !== undefined && this.config.token.length > 0) {
      headers['authorization'] = `Bearer ${this.config.token}`;
    }

    const res = await this.fetch(this.config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await safeBody(res);
      throw new PublishError(
        `publish webhook returned ${res.status}${detail ? `: ${detail}` : ''}`,
        post.slug,
      );
    }

    const ref = extractRef(await safeBody(res));

    // Trigger a deploy if configured. A non-2xx here is a hard failure: the post was accepted but
    // would not go live, so surfacing it lets the run summary reflect reality.
    if (this.config.deployHookUrl !== undefined && this.config.deployHookUrl.length > 0) {
      const deployRes = await this.fetch(this.config.deployHookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '',
      });
      if (!deployRes.ok) {
        throw new PublishError(
          `deploy hook returned ${deployRes.status} after publishing`,
          post.slug,
        );
      }
    }

    const result: PublishResult = {
      slug: post.slug,
      url: canonical,
      publishedAt: this.now().toISOString(),
    };
    if (ref !== undefined) result.ref = ref;
    return result;
  }
}

/** Read a response body without throwing; returns '' if the body is unreadable. */
async function safeBody(res: FetchResponseLike): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** Best-effort extraction of a provider ref (`{ id }` / `{ ref }` / `{ sha }`) from a JSON body. */
function extractRef(body: string): string | undefined {
  if (body.trim().length === 0) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const o = parsed as Record<string, unknown>;
  for (const key of ['ref', 'id', 'sha', 'deploymentId'] as const) {
    const v = o[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Env-gated publisher factory: returns a {@link CmsPublisher} when `PUBLISH_WEBHOOK_URL` is set,
 * else the {@link NoopPublisher} dry-run path. `baseUrl` supplies the canonical origin; deploy hook
 * and bearer token are read from the environment when present.
 */
export function getPublisher(env: Env, baseUrl: string, fetchImpl?: FetchLike): Publisher {
  const webhookUrl = env['PUBLISH_WEBHOOK_URL'];
  if (webhookUrl !== undefined && webhookUrl.trim().length > 0) {
    const config: CmsPublisherConfig = { baseUrl, webhookUrl };
    const deployHookUrl = env['DEPLOY_HOOK_URL'];
    if (deployHookUrl !== undefined && deployHookUrl.trim().length > 0) {
      config.deployHookUrl = deployHookUrl;
    }
    const token = env['PUBLISH_WEBHOOK_TOKEN'];
    if (token !== undefined && token.trim().length > 0) {
      config.token = token;
    }
    if (fetchImpl !== undefined) config.fetch = fetchImpl;
    return new CmsPublisher(config);
  }
  return new NoopPublisher(baseUrl);
}
