/**
 * Generates the docs pages that must never drift from their sources:
 *
 *   docs/skills/**      <- skills/** (each SKILL.md becomes <skill>/index.md, references mirrored)
 *   docs/rules/*.md     <- @advance-labs/scoring rule metadata + skills/rule-map.json
 *   public/llms.txt     <- every published page's title + description
 *
 * All three outputs are gitignored. The sources stay readable on GitHub as they are; this only
 * gives Starlight something to render. Runs before `astro build` / `astro dev`.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aeoRules, eeatSignalDefs, technicalSeoRules } from '@advance-labs/scoring';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SKILLS = path.join(REPO_ROOT, 'skills');
const DOCS = path.join(REPO_ROOT, 'docs');
const OUT_SKILLS = path.join(DOCS, 'skills');
const OUT_RULES = path.join(DOCS, 'rules');
const LLMS_TXT = fileURLToPath(new URL('../public/llms.txt', import.meta.url));
const REPO_URL = 'https://github.com/Advance-Labs/aeo-toolkit';
const SITE = 'https://docs.advancelabs.dev/aeo-toolkit';
const INSTALL = '/plugin install aeo-toolkit --marketplace Advance-Labs/aeo-toolkit';

const ruleMap = JSON.parse(readFileSync(path.join(SKILLS, 'rule-map.json'), 'utf8')).rules;

/** YAML-safe scalar: JSON strings are valid YAML. */
const y = (s) => JSON.stringify(String(s).replace(/\s+/g, ' ').trim());

function splitFrontmatter(raw) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, '\n'));
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: m[2] };
}

/** First `# H1` becomes the page title (Starlight renders it), the rest stays as the body. */
function takeH1(body) {
  const m = /^\s*# (.+)\n/.exec(body);
  return m ? { h1: m[1].trim(), rest: body.slice(m[0].length) } : { h1: null, rest: body };
}

/** First prose paragraph, for the page's meta description. */
function firstParagraph(body) {
  const para = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|>|\||[-*] |\d+\. |:::|<|```)/.test(p));
  // Plain text: it ends up in <meta name="description"> and llms.txt.
  return para ? para.replace(/[`*]/g, '').replace(/\s+/g, ' ') : '';
}

/** Where a file under skills/ lands under docs/skills/. */
function outPathFor(src) {
  const rel = path.relative(SKILLS, src);
  return path.join(OUT_SKILLS, rel.replace(/(^|\/)(SKILL|README)\.md$/, '$1index.md'));
}

/**
 * Relative links are written against the source file's location. Re-point them so they still
 * resolve from the generated location: links to other skill markdown follow the mirror, anything
 * else (rule-map.json, packages, docs outside skills/) goes to GitHub.
 */
function rewriteLinks(md, src, out) {
  return md.replace(/\]\(([^)\s]+)\)/g, (whole, href) => {
    if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) return whole;
    const [p, hash] = href.split('#');
    const abs = path.resolve(path.dirname(src), p);
    const suffix = hash ? `#${hash}` : '';
    if (abs.startsWith(SKILLS + path.sep) && abs.endsWith('.md')) {
      return `](${path.relative(path.dirname(out), outPathFor(abs))}${suffix})`;
    }
    const repoRel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
    const kind = /\.[a-z0-9]+$/i.test(repoRel) ? 'blob' : 'tree';
    return `](${REPO_URL}/${kind}/main/${repoRel}${suffix})`;
  });
}

function write(file, frontmatter, body) {
  mkdirSync(path.dirname(file), { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? y(v) : JSON.stringify(v)}`)
    .join('\n');
  writeFileSync(file, `---\n${fm}\n---\n\n${body.trim()}\n`);
}

// ── Rules ───────────────────────────────────────────────────────────────────
const RULE_PAGES = [
  {
    file: 'technical-seo',
    title: 'Technical SEO rules',
    blurb: 'Crawlability, indexability and page hygiene: the checks every search and answer engine depends on.',
    rules: technicalSeoRules,
  },
  {
    file: 'aeo',
    title: 'AEO rules',
    blurb: 'Answer-engine specific checks: AI crawler access, server rendering, entity markup and extractable answers.',
    rules: aeoRules,
  },
  {
    file: 'eeat',
    title: 'E-E-A-T rules',
    blurb: 'Experience, expertise, authoritativeness and trust signals, scored as a separate sub-score.',
    rules: eeatSignalDefs,
  },
];

/** The generated rule page (docs/rules/<file>.md) that documents a rule id. */
const rulePageFile = (id) =>
  path.join(OUT_RULES, `${RULE_PAGES.find((p) => p.rules.some((r) => r.id === id)).file}.md`);

rmSync(OUT_RULES, { recursive: true, force: true });
RULE_PAGES.forEach((page, i) => {
  const entries = page.rules.map((r) => {
    const skill = ruleMap[r.id];
    const meta = [
      r.severity && `Severity: **${r.severity}**`,
      `Weight: **${r.weight}**`,
      r.pillar && `Pillar: **${r.pillar}**`,
    ]
      .filter(Boolean)
      .join(' · ');
    return [
      `<a id="${r.id}"></a>`,
      `## ${r.title ?? r.label}`,
      '',
      `\`${r.id}\` · ${meta}`,
      '',
      r.description ?? '',
      '',
      `**Fix:** ${r.recommendation}`,
      '',
      `**Skill:** [\`${skill}\`](../skills/${skill}/index.md) teaches an agent how to fix this in your stack.`,
    ].join('\n');
  });
  write(
    path.join(OUT_RULES, `${page.file}.md`),
    {
      title: page.title,
      description: `${page.blurb} ${page.rules.length} rules, each mapped to the agent skill that fixes it.`,
      sidebar: { order: i },
      editUrl: false,
    },
    `${page.blurb}\n\n${entries.join('\n\n')}`,
  );
});

// ── Skills ──────────────────────────────────────────────────────────────────
rmSync(OUT_SKILLS, { recursive: true, force: true });
const readmeSrc = path.join(SKILLS, 'README.md');
const readme = readFileSync(readmeSrc, 'utf8');
// Sidebar order follows the README table, which is grouped Access → Measurement.
const order = [...readme.matchAll(/^\| \[`([a-z0-9-]+)`\]/gm)].map((m) => m[1]);

const skillPages = [];
for (const name of readdirSync(SKILLS).filter((d) => statSync(path.join(SKILLS, d)).isDirectory())) {
  const src = path.join(SKILLS, name, 'SKILL.md');
  const out = outPathFor(src);
  const { fm, body } = splitFrontmatter(readFileSync(src, 'utf8'));
  const { h1, rest } = takeH1(body);
  const title = h1 ?? name;
  const owned = Object.keys(ruleMap).filter((id) => ruleMap[id] === name);
  const description = firstParagraph(rest) || fm.description;

  const header = [
    ':::note[Agent skill]',
    `\`${name}\` · [source on GitHub](${REPO_URL}/tree/main/skills/${name}) · install with \`${INSTALL}\` ([all install options](../index.md#install))`,
    '',
    `**An agent loads it when:** ${fm.description}`,
    ':::',
    owned.length
      ? `\n**Audit rules it owns:** ${owned.map((id) => `[\`${id}\`](${path.relative(path.dirname(out), rulePageFile(id))}#${id})`).join(', ')}`
      : '',
  ].join('\n');

  write(
    out,
    {
      title,
      description,
      sidebar: { label: name, order: order.indexOf(name) === -1 ? 999 : order.indexOf(name) },
      editUrl: `${REPO_URL}/edit/main/skills/${name}/SKILL.md`,
    },
    `${header}\n\n${rewriteLinks(rest, src, out)}`,
  );
  skillPages.push({ name, title, description });

  const refDir = path.join(SKILLS, name, 'references');
  let refs = [];
  try {
    refs = readdirSync(refDir).filter((f) => f.endsWith('.md'));
  } catch {
    // no references for this skill
  }
  for (const f of refs) {
    const rsrc = path.join(refDir, f);
    const rout = outPathFor(rsrc);
    const { body: rbody } = splitFrontmatter(readFileSync(rsrc, 'utf8'));
    const { h1: rh1, rest: rrest } = takeH1(rbody);
    write(
      rout,
      {
        title: rh1 ?? `${title}: ${f.replace(/\.md$/, '')}`,
        description: firstParagraph(rrest) || `${title}, ${f.replace(/\.md$/, '')} recipe.`,
        sidebar: { hidden: true },
        editUrl: `${REPO_URL}/edit/main/skills/${name}/references/${f}`,
      },
      `[← ${title}](../index.md)\n\n${rewriteLinks(rrest, rsrc, rout)}`,
    );
  }
}

{
  const out = outPathFor(readmeSrc);
  const { h1, rest } = takeH1(readme);
  write(
    out,
    {
      title: h1 ?? 'AEO skills',
      description:
        'Agent skills that teach Claude Code and other coding agents to fix every AEO Toolkit audit rule in your stack, plus the MCP servers that detect and verify.',
      sidebar: { label: 'Overview + install', order: -1 },
      editUrl: `${REPO_URL}/edit/main/skills/README.md`,
    },
    rewriteLinks(rest, readmeSrc, out),
  );
}

// ── llms.txt ────────────────────────────────────────────────────────────────
function pageList(dir, base = DOCS) {
  return readdirSync(dir).flatMap((entry) => {
    const abs = path.join(dir, entry);
    const rel = path.relative(base, abs).split(path.sep).join('/');
    if (statSync(abs).isDirectory()) {
      return /^(archive|legal)$/.test(rel) ? [] : pageList(abs, base);
    }
    if (!/\.mdx?$/.test(entry) || entry.startsWith('_')) return [];
    const { fm } = splitFrontmatter(readFileSync(abs, 'utf8'));
    if (fm.sidebar?.includes?.('hidden')) return [];
    const slug = rel
      .replace(/\.mdx?$/, '')
      .toLowerCase()
      .replace(/(^|\/)readme$/, '$1index')
      .replace(/(^|\/)index$/, '');
    const title = (fm.title ?? slug).replace(/^"|"$/g, '');
    return [{ slug, title, rel }];
  });
}

const pages = pageList(DOCS).filter((p) => !p.rel.startsWith('skills/') && !p.rel.includes('/references/'));
const lines = [
  '# AEO Toolkit',
  '',
  '> Open-source Answer Engine Optimization: a scoring engine with 58 rules, hosted MCP servers that detect and measure, and agent skills that teach coding agents to fix each rule in the stack they are working in.',
  '',
  `Install the skills and MCP servers in Claude Code: \`${INSTALL}\``,
  '',
  '## Skills',
  '',
  ...skillPages
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
    .map((s) => `- [${s.name}](${SITE}/skills/${s.name}/): ${s.description}`),
  '',
  '## Docs',
  '',
  ...pages.map((p) => `- [${p.title}](${SITE}/${p.slug ? `${p.slug}/` : ''})`),
  '',
];
mkdirSync(path.dirname(LLMS_TXT), { recursive: true });
writeFileSync(LLMS_TXT, lines.join('\n'));

console.log(`docs: generated ${skillPages.length} skill pages, ${RULE_PAGES.length} rule pages, llms.txt`);
