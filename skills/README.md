# AEO Toolkit skills

Claude Skills that turn the [`ga-gsc` MCP server](../apps/console/src/mcp/ga-gsc) from a set
of tools into a set of **workflows**.

The MCP server answers questions like "what are the numbers". These skills answer the
questions people actually ask: *why did traffic drop*, *which pages compete with each other*,
*what should I refresh*. The judgement in each skill — which readings are supportable, which
are guesses, when to say "I don't know" — is the part that does not fit in a tool description.

| Skill | Answers | Tools used |
|---|---|---|
| [`seo-traffic-drop`](seo-traffic-drop/SKILL.md) | Traffic dropped. What caused it? | `gsc_traffic_drop`, `list_gsc_sites` |
| [`seo-cannibalization`](seo-cannibalization/SKILL.md) | Are my own pages competing? | `gsc_cannibalization`, `list_gsc_sites` |
| [`seo-content-decay`](seo-content-decay/SKILL.md) | What content needs refreshing? | `gsc_decay`, `gsc_traffic_drop`, `list_gsc_sites` |

## Install

Skills are plain directories. Copy the ones you want into your skills folder:

```bash
# Claude Code, for one project
mkdir -p .claude/skills
cp -r path/to/aeo-toolkit/skills/seo-traffic-drop .claude/skills/

# or for every project
cp -r path/to/aeo-toolkit/skills/* ~/.claude/skills/
```

They activate on their own when a request matches the `description` in the frontmatter. You
do not need to name the skill.

## They need the MCP server

A skill is instructions, not data. Every one of these calls the `ga-gsc` MCP server, which
holds the Google OAuth connection to your Search Console account. Without it the skill has
nothing to read.

Setup is in [`apps/console/src/mcp/ga-gsc`](../apps/console/src/mcp/ga-gsc). You will need
Search Console access for the property you want to analyse; the server handles the OAuth flow
and stores tokens encrypted.

> **On "no API keys" claims.** Search Console requires OAuth. Anything promising GSC data with
> no authentication is either reading an already-authenticated local session or not reading
> Search Console at all.

## What these will not do

- **They cannot see your competitors' data.** Search Console reports your property only. Any
  competitor comparison needs a third-party rank-tracking source, which these do not use.
- **They cannot separate seasonality from decline.** GSC has no notion of why demand moved.
  Each skill says so where it matters rather than implying more certainty than the data
  supports.
- **They do not change anything.** Every tool is read-only.

## Contributing a skill

Same bar as the rest of the repo: a skill should encode judgement a tool description cannot,
be explicit about what the data cannot answer, and never assert a cause it cannot evidence.

The frontmatter `description` is what decides whether the skill activates, so write it as
*when to use this*, not as a title. `skills.test.ts` in the console app validates the
frontmatter and checks that every tool a skill mentions is actually registered on the server,
so a renamed tool fails CI instead of silently breaking the skill.
