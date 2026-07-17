# validators/

Yalnızca birden fazla feature'ın ortak kullandığı Zod şemaları (örn.
sayfalama, ortak enum'lar). Feature'a özel şemalar burada değil, ilgili
`features/<isim>/validators/` içinde kalır.

Not: Mevcut `src/lib/validation/login-schema.ts`, auth'a özel olduğu için
`src/features/auth/validators/` altına taşınmıştır (paylaşılan değildir).

Henüz kod eklenmedi.
