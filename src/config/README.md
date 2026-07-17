# config/

Ortam değişkeni okuma/doğrulama katmanı için rezerve edilmiştir (örn.
`config/env.ts` — `process.env` erişimini merkezi ve tipli hale getirecek,
bkz. `.cursor/rules/02-security.mdc`). Şu an `process.env` doğrudan
`src/lib/supabase/*` ve `src/proxy.ts` içinde okunuyor; merkezi bir katmana
çıkarılması ayrı bir refactor adımıdır, henüz yapılmadı.
