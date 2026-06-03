/**
 * Preset prompt cards surfaced on the home page. Each maps a one-line label to a fuller question
 * the chat sends. Plain data so it can be imported by both client and server with no side effects.
 */

export interface PresetPrompt {
  id: string;
  title: string;
  description: string;
  question: string;
}

export const PRESET_PROMPTS: readonly PresetPrompt[] = [
  {
    id: 'ctr-gaps',
    title: 'CTR gaps',
    description: 'High-impression queries with low click-through rate.',
    question:
      'Which queries have high impressions but a low click-through rate? List the biggest CTR-gap opportunities and how to fix the titles/meta to capture more clicks.',
  },
  {
    id: 'impression-declines',
    title: 'Impression declines',
    description: 'Pages or queries losing visibility.',
    question:
      'Which pages or queries appear to be underperforming on impressions relative to their ranking position? Identify the likely visibility issues and how to recover them.',
  },
  {
    id: 'engagement',
    title: 'Engagement issues',
    description: 'Low engagement-rate landing pages.',
    question:
      'Which landing pages have the worst engagement rate or shortest average session duration in GA4? What content or UX changes would improve engagement on those pages?',
  },
  {
    id: 'device-country',
    title: 'Device & country',
    description: 'Performance splits by device and country.',
    question:
      'How does performance differ by device category and country in GA4? Call out any segment that is underperforming and recommend targeted fixes.',
  },
] as const;
