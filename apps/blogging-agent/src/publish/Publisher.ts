/**
 * Publisher — the single true side effect of the pipeline.
 *
 * Everything upstream (research → write → edit → schedule) is pure data transformation. Publishing
 * pushes a post to a live destination (a Git-backed static site, a headless CMS, a Vercel deploy
 * hook). That I/O is isolated behind this interface so the orchestrator stays testable and so a
 * dry run can swap in `NoopPublisher` with zero credentials.
 */
import type { Post } from '../types.js';

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

// STUB: Git/CMS/Vercel publisher.
//
// The real publisher commits the post's markdown to the content repo (or a CMS) and triggers a
// Vercel deploy hook. It is stubbed here so the build needs no Git token, CMS key, or deploy hook.
// Inject those credentials request-scoped at the call site; never persist or log them. Implement
// `publish` to: 1) write `content/blog/<slug>.md`, 2) commit + push (or POST to the CMS), 3) call
// the deploy hook, 4) return the canonical URL + commit/deployment ref.
export interface CmsPublisherConfig {
  baseUrl: string;
  /** e.g. a GitHub repo "owner/name" or a CMS space id. */
  target: string;
  /** Request-scoped credential. Never persisted or logged. */
  token: string;
  /** Optional Vercel deploy hook URL to ping after the commit. */
  deployHookUrl?: string;
}

export class CmsPublisher implements Publisher {
  constructor(private readonly config: CmsPublisherConfig) {}

  // STUB: write file → commit/push (or CMS POST) → trigger deploy hook → return canonical URL.
  publish(post: Post): Promise<PublishResult> {
    return Promise.reject(
      new PublishError(
        'CmsPublisher.publish is a STUB — wire it to your Git/CMS provider and deploy hook before use.',
        post.slug,
      ),
    );
  }
}
