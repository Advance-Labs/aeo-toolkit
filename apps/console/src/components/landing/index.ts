/**
 * Landing page DATA, consumed by `components/landing-v2`.
 *
 * The section components that used to live here (Hero, Features, ToolsShowcase, HowItWorks,
 * CtaBand, WhyAeo, Faq, ProofBand, TrustStrip, HeroVisual) were deleted on 2026-10-09: nothing
 * imported them. `app/page.tsx` renders `landing-v2`, and had done for some time, so they were
 * dead code carrying a full set of gradients, glows and float animations that no visitor ever
 * saw. Only the data and the icon set were still referenced.
 */
export { FAQS, TOOLS, STEPS, TOOL_CATEGORIES, PLANNED_TOOLS } from './data';
export type { ToolEntry, ToolCategory, PlannedTool } from './data';
