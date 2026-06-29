# Managed / Autopilot — Master Service Agreement (DRAFT SKELETON)

> ⚠️ **RELEASE GATE — NOT LEGAL TEXT.** Structural skeleton flagged by the Autopilot check-agent
> review (spec §0.4, compliance review "customer-harm exposure"). The Managed tier acts on the
> customer's own domain and accounts, so the downside of any third-party (Google/Reddit/CMS) action
> lands on the customer. This MSA must exist and be counsel-reviewed **before** the tier launches.

## Required clauses (counsel to draft)
1. **Informed consent + assumption of risk.** Customer acknowledges that content, link-outreach, and
   community engagement carry inherent search-engine and platform-policy risk, that outcomes are not
   guaranteed, and that Advance Labs is **not liable for third-party penalties** (Google deindexing/
   manual actions, platform account actions) absent gross negligence.
2. **Per-action authorization is a consent event.** The human-approval inbox records who approved what,
   when, and the editorial rationale (the `proposal_audit` append-only log). This is the defense both
   ways: that the customer editorially approved each action, and that we acted only on approved items.
3. **Limitation of liability** (capped, e.g. to fees paid) and **indemnification**.
4. **Least-privilege + offboarding.** OAuth scopes minimized (CMS/GSC/Reddit read where possible);
   token revocation and data deletion on offboarding.
5. **Guarantee reference.** Incorporates `guarantee-terms.md` (work-delivered SLA; no outcome promise).
6. **Compliance posture.** Link work is consent-based, relevance-gated, and disclosed; community work is
   listen + human-posted (no autonomous posting). We recommend; the customer approves and bears final
   responsibility for actions on their property.
7. **Kill-switch.** Right to pause a customer whose domain shows a manual action.

---
*Drafted as a structural placeholder per the pre-build review. Counsel sign-off required before launch.*
