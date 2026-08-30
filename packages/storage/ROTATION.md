# Token encryption — key versioning & rotation runbook

`@advance-labs/storage` encrypts OAuth/refresh tokens at rest with AES-256-GCM (`src/crypto.ts`). Every
ciphertext is stamped with a **key-version tag** so the at-rest format can evolve and the encryption
key can be rotated without a flag-day re-encrypt.

## On-disk format

```
v1:<base64( iv[12] | authTag[16] | ciphertext )>
```

- `encrypt()` always emits the **current** version (`CURRENT_KEY_VERSION`, today `v1`).
- `decrypt()` reads the `vN:` prefix and dispatches to the matching decoder. It also accepts a
  **legacy, un-prefixed** body (rows written before versioning) by treating it as `v1`.
- An **unknown/future** version (a `vN:` with no registered decoder) is **rejected** with
  `TokenCryptoError` — it is never silently mis-decrypted or returned as plaintext.

The key itself is scrypt-derived from a passphrase (`TOKEN_ENCRYPTION_KEY`) with a fixed, non-secret
salt; the secret is the passphrase.

## Rotating the encryption key (introducing `v2`)

The version tag is what makes rotation possible: old and new ciphertext coexist, distinguished by
their prefix. To rotate:

1. **Add a `v2` scheme in `src/crypto.ts`.** Introduce the new key/derivation (e.g. read a second
   passphrase `TOKEN_ENCRYPTION_KEY_V2`), bump `CURRENT_KEY_VERSION` to `v2`, and have `encrypt()`
   stamp `v2:`. Register a `v2` branch in `decrypt()`'s version dispatch **while keeping the `v1`
   branch** so existing rows still decrypt. (The decoder is keyed by version, so this is purely
   additive.)
2. **Deploy.** From this point new writes are `v2`; reads transparently handle both `v1` and `v2`.
3. **Lazy re-encrypt (preferred).** Every `set()` rewrites the row in the current version, so normal
   token refreshes migrate rows to `v2` over time.
4. **Eager re-encrypt (optional).** To retire `v1` faster, run a one-off backfill: for each row,
   `get()` (decrypts whatever version) then `set()` (re-encrypts as current). Use the service role;
   never log plaintext.
5. **Retire `v1`.** Once telemetry shows no `v1:`-prefixed rows remain, remove the `v1` decoder and
   the old passphrase.

## Notes

- Rotation is a code + ops procedure; `decrypt()` deliberately fails closed on versions it cannot
  handle so a partial/botched rollout can never leak or corrupt tokens.
- The `(user_id, provider)` row key (migration `0001`) is orthogonal to key versioning — a row's
  provider doesn't change when its ciphertext version does.
