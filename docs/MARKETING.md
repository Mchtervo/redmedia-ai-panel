# AI Marketing Director

Meta reklamları, Instagram içerikleri ve CRM müşteri kaynağını birleştiren
pazarlama yönetim modülü.

## Kurallar

- Kampanya otomatik kapatılmaz / bütçe değiştirilmez.
- AI yalnızca öneri üretir; her öneride güven + gerekçe zorunlu.
- Token yoksa Meta API çağrısı yapılmaz; mock veri üretilmez.
- `organization_id` yok (single-tenant).
- Mevcut `campaigns` / `ad_sets` / `ads` tabloları yeniden kullanılır.

## Rotalar

| Yol | Sayfa |
|-----|--------|
| `/dashboard/marketing` | Genel bakış |
| `.../performance` | Reklam performansı |
| `.../instagram` | Instagram içerikleri |
| `.../attribution` | AI Attribution Dashboard |
| `.../attribution/[contactId]` | Attribution timeline |
| `.../reports` | Günlük AI Marketing Report |
| `.../strategies` | AI stratejileri |
| `.../experiments` | Deneyler |
| `.../memory` | Marketing memory |
| `.../connections` | Bağlantılar |

## Attribution (Modül 9)

Bkz. `docs/ATTRIBUTION.md`.

## Migration

- `supabase/migrations/20260717000021_marketing_director.sql`
- `supabase/migrations/20260717000024_ai_attribution_engine.sql`
