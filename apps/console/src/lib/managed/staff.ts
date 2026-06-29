/**
 * Staff identity + managed-tier enablement for the Managed/Autopilot layer.
 *
 * `isStaff` resolves a session email against the `STAFF_EMAILS` allowlist — the staff who may act on
 * any customer's proposals from the internal approval inbox. `managedEnabled()` mirrors the
 * entitlements carve-out so managed surfaces stay inert-when-dormant (security M1).
 */

/** True iff `email` is in the comma-separated `STAFF_EMAILS` allowlist (case-insensitive, trimmed). */
export function isStaff(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.STAFF_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}

/** Whether the Managed tier is configured on this deploy (price env or the orchestrator job secret). */
export function managedEnabled(): boolean {
  return (
    (process.env.STRIPE_PRICE_MANAGED ?? '').length > 0 ||
    (process.env.ORCHESTRATOR_JOB_SECRET ?? '').length > 0
  );
}
