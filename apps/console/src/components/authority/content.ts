/**
 * Static content for the Website Authority Checker — explainer, HowTo steps, and FAQ.
 *
 * Single source of truth: the visible HTML and the JSON-LD both render from these
 * arrays, so a FAQPage answer can never drift from the answer a reader sees. That
 * is the rule the whole site runs on, and it is also the only way the text stays
 * quotable by an answer engine.
 *
 * EVERY CLAIM HERE IS CHECKABLE. Do not add a number to this file you cannot source:
 * the page's entire argument is that it tells you what the metric cannot do, and one
 * invented statistic costs more credibility than the page can earn back.
 */

import type { FaqItem } from '@/components/llms-txt/content.js';

export type { FaqItem };

export interface HowToStep {
  name: string;
  text: string;
}

/** Graph scale, quoted on the page. Source: Common Crawl domain-level webgraph. */
export const GRAPH_DOMAINS = '90 million';
export const GRAPH_EDGES = '2 billion';

export const HOW_TO_STEPS: readonly HowToStep[] = [
  {
    name: 'Enter a domain',
    text: 'Paste any domain — yours, a competitor’s, or a link prospect’s. A full URL is fine: it is reduced to the registrable domain, because the link graph is keyed by domain, not by page.',
  },
  {
    name: 'Read the score',
    text: 'You get an Open PageRank from 0 to 10, the domain’s global rank in the graph, and the number of referring domains the graph counted.',
  },
  {
    name: 'Read the trend, not the number',
    text: 'A single score is close to meaningless in isolation. The monthly history is the useful part, and for an established domain it runs back to January 2018: climbing, flat, or falling over years tells you whether anything you did worked. A domain new to the graph has one observation and no trend yet, which is itself informative.',
  },
  {
    name: 'Compare against the set that matters',
    text: 'Check the three or four competitors you actually lose deals to. Authority is only ever a relative measure, and “good” is entirely a function of your niche.',
  },
];

/** Visible FAQ — mirrored 1:1 into the FAQPage JSON-LD. */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'What is a website authority score?',
    answer:
      'A website authority score is a single number estimating how much link equity a domain has accumulated, usually on a 0–10 or 0–100 scale. It is computed by running a ranking algorithm — normally a variant of PageRank — over a crawl of the web’s hyperlink graph. It is an estimate produced by whoever built the index, not a figure published by any search engine.',
  },
  {
    question: 'Is this the same as Moz Domain Authority or Ahrefs Domain Rating?',
    answer:
      'No, and nothing free can be. Domain Authority (Moz), Domain Rating (Ahrefs), and Authority Score (Semrush) are proprietary metrics computed over each company’s own private crawl. Reproducing one would mean licensing that company’s API. This tool reports Open PageRank instead: the same idea, computed over a public link graph anyone can download and check. The numbers correlate loosely but are not interchangeable, and a tool telling you it returns “DA” for free is either reselling Moz or inventing the figure.',
  },
  {
    question: 'Where does the data come from?',
    answer: `Open PageRank is classic PageRank recomputed over Common Crawl’s domain-level web graph — roughly ${GRAPH_DOMAINS} registrable domains connected by about ${GRAPH_EDGES} links, rebuilt from Common Crawl’s monthly crawls and published as open data. Common Crawl also publishes harmonic centrality for the same graph, which is more resistant to link spam than PageRank. You do not have to take our word for any of it: the graph and the rank files are public on AWS Open Data, and the tooling that builds them is open source.`,
  },
  {
    question: 'How often is the score updated?',
    answer:
      'The underlying graph is rebuilt monthly, so a score moves at most once a month and one observation is one month. The series runs back to January 2018, which is about 105 observations for a domain that has been in the graph throughout. If you published a link yesterday, do not expect to see it today — and be suspicious of any tool that shows you a same-day change in a monthly metric.',
  },
  {
    question: 'Does Google use a domain authority score?',
    answer:
      'Not this one, and not any third party’s. Google has stated repeatedly that it does not use Moz’s, Ahrefs’ or Semrush’s scores, none of which it has access to. Google does evaluate signals at site level internally, but those are not public, not published as a number, and not what this tool measures. Treat an authority score as a competitive yardstick for your own planning, never as a prediction of where you will rank.',
  },
  {
    question: 'What counts as a good score?',
    answer:
      'Only relative to your competitive set. Open PageRank is roughly logarithmic — most indexed domains cluster low, and each additional point is substantially harder to win than the last — so comparing a local trades business to a national publisher tells you nothing useful. Check the three or four sites competing for the same queries and read your position among them.',
  },
  {
    question: 'How do I raise it?',
    answer:
      'Earn links from domains that themselves have authority, which is the only input the algorithm has. There is no configuration change, meta tag, or file you can publish that moves a link-graph metric. If your goal is being cited by AI answer engines rather than ranked, links are only part of it: run the AEO audit, which checks crawlability, structured data, and answer readiness alongside it.',
  },
  {
    question: 'Is the checker free, and is there a limit?',
    answer:
      'It is free and needs no account. The lookup runs against the Open PageRank API on a metered free tier, so heavy automated use may be rate limited. If a lookup fails you will be told which of those happened rather than shown a zero.',
  },
];
