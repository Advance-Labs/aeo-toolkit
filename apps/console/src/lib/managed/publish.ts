/**
 * Publish-on-approve for the Managed tier.
 *
 * Turns an approved {@link ContentProposal} into a sanitized `@aeo/blogging` `Post` and pushes it
 * through the env-gated `Publisher`: a real `CmsPublisher` when `PUBLISH_WEBHOOK_URL` is set, else a
 * dry-run `NoopPublisher` (no credentials, no I/O). Sanitization (security H3) happens HERE, at the
 * publish boundary — the only surviving link is the customer's own site.
 */
import { getPublisher, type Post, type Publisher, type PublishResult } from '@aeo/blogging';
import type { ContentProposal } from '@aeo/types';
import { sanitizeForPublish } from './sanitize.js';

/** Map an approved content proposal to a sanitized `Post` (pure). */
export function buildPostFromProposal(
  proposal: ContentProposal,
  allowedHref: string,
  now: () => Date = () => new Date(),
): Post {
  const ts = now().toISOString();
  return {
    slug: proposal.payload.slug,
    title: proposal.payload.title,
    primaryKeyword: proposal.payload.targetQuery,
    status: 'published',
    markdown: sanitizeForPublish(proposal.payload.markdown, allowedHref),
    fingerprint: [],
    createdAt: ts,
    updatedAt: ts,
    revisionCount: 0,
  };
}

/**
 * Publish an approved content proposal. The publisher is injectable for tests; by default it is
 * resolved from env via `getPublisher` (CmsPublisher when `PUBLISH_WEBHOOK_URL` is set, else dry-run).
 */
export async function publishApprovedContent(
  proposal: ContentProposal,
  siteUrl: string,
  publisher?: Publisher,
): Promise<PublishResult> {
  const post = buildPostFromProposal(proposal, siteUrl);
  const pub = publisher ?? getPublisher(process.env, siteUrl);
  return pub.publish(post);
}
