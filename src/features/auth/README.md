# features/auth

Panel menüsünde yer almayan, kimlik doğrulama (giriş) akışına özel modül.
`/login` sayfası (`src/app/login/`) tarafından kullanılır.

- `validators/login-schema.ts` — giriş formu Zod şeması (e-posta/şifre).

Not: Rota bileşenleri (`page.tsx`, `login-form.tsx`) Next.js App Router
konvansiyonu nedeniyle `src/app/login/` içinde kalır; bu klasör yalnızca
o rotanın kullandığı auth'a özel doğrulama/mantık için vardır.
