# server/webhooks/

ChatPlace webhook kimlik doğrulama yardımcıları:

- `chatplace-signature.ts` — HMAC-SHA256 (`x-chatplace-signature`)
- `chatplace-token.ts` — statik token (`x-chatplace-token`)
- `chatplace-auth.ts` — HMAC **veya** token (fail-closed)
- `chatplace-auth.test.ts` — birim testleri (`npm run test:webhooks`)

Bkz. `docs/CHATPLACE.md`, `.cursor/rules/02-security.mdc`.
