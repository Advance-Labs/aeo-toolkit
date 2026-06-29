# Autopilot — Build Conventions (security invariants)

> Binding for every agent/package in the Autopilot v1 build. Lifted from the spec's §0.6 security
> outcomes. These are not suggestions — Phase verify barriers test for them.

## The seven invariants

1. **SSRF-guarded fetch only.** Any fetch of a user-supplied/external URL goes through
   `@aeo/net-guard.safeFetch`. Never call the raw `@aeo/crawler` / `@aeo/backlinks` HTTP seam on a
   user-controlled URL. The guard: scheme allowlist, DNS-resolve + reject private/loopback/link-local/
   CGNAT/metadata (v4+v6), re-validate every redirect hop, timeout + body cap, host-pin (anti-rebind).

2. **Service-role writes behind ownership checks.** Service-role bypasses RLS. Every action that mutates
   or executes on a customer's behalf must, in application code: resolve session → load the record →
   assert `record.ownerId === session.user.id` (or a staff role) → only then act. RLS-on-SELECT is not
   an authorization control for service-role mutations.

3. **No plaintext tokens.** The managed tier constructs `TokenStore` with `requireEncryption`; a missing
   `encryptionKey` throws. Tokens are keyed `(user_id, provider)` — never `user_id` alone.

4. **External text is data, not instructions.** Scraped/3rd-party content fed to an LLM is delimited and
   passed as structured data, never concatenated into the system prompt.

5. **Schema-validate LLM output.** Every model response is parsed against a schema and rejected on
   mismatch. Never trust free-form model text as control flow.

6. **`href` allowlist + sanitize-before-publish.** Any URL that ends up in published/sent content MUST
   equal an already-agreed target (never model-derived). Emit plain text + one vetted anchor; escape on
   insertion; add `rel` disclosure where applicable.

7. **Managed is inert-when-dormant (not open-when-dormant).** Unlike the free tools (which fail *open* to
   `free`), the `managed` feature requires auth + active entitlement and returns closed when managed env
   is absent. Gate the orchestrator enqueue/execute, not just the UI.

## Package conventions (match the existing repo)

- ESM, `"type": "module"`; relative imports carry the `.js` extension.
- `tsup` build, `vitest` tests, `tsconfig` extends `@aeo/config`'s `node-library.json`.
- Workspace deps as `"workspace:*"`.
- **Injected I/O.** All network/clock/storage is injected; unit tests run with zero network and a fake
  clock. No `Date.now()` / `Math.random()` in pure cores.
- Each package self-documents with a header docblock and a `README.md`.
