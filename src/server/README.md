# server/

Kesinlikle sunucu-özel, güvenlik-kritik altyapı. Bu klasördeki hiçbir modül
Client Component'lerden import edilmemelidir (bkz. `.cursor/rules/02-security.mdc`).

- `supabase/` — `server.ts` (anon key + cookie tabanlı, RLS'e tabi),
  `admin.ts` (service role, RLS bypass — yalnızca arka plan/yönetimsel işler)
- `auth/` — oturum/kullanıcı yardımcıları (örn. `getCurrentUser()`, `requireUser()`)
- `rate-limit/` — dış erişime açık API route/webhook'lar için rate limiting
- `webhooks/` — ChatPlace/Meta webhook imza doğrulama yardımcıları
- `logging/` — hassas veri maskeleyen sunucu tarafı logger

Bu alt klasörlerin çoğu henüz koddan boş (rezerve); ilgili entegrasyon
(webhook, rate limiting vb.) gerçekten geliştirilmeye başladığında doldurulacaktır.
