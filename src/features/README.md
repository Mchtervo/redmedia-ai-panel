# features/

Dikey dilimler (vertical slices). Her alt klasör bir panel menü öğesine (Customers,
Inbox, Leads, Reservations, AI, Ads, Analytics, Knowledge, Integrations, Team,
Settings) karşılık gelir ve `docs/DATABASE.md`'deki ilgili tabloları sahiplenir.

Bkz. `docs/ARCHITECTURE.md` — Hybrid Architecture (Feature-Based + Layered).

## Standart iç yapı (bir feature'a gerçek kod eklenmeye başlandığında)

```
features/<isim>/
  components/     feature'a özel UI (liste, detay, form)
  actions/        feature'a özel Server Action'lar
  repositories/   feature'ın tablolarına özel veri erişimi
  services/       feature'a özel iş mantığı orkestrasyonu
  validators/     feature'a özel Zod şemaları
  types.ts        feature'a özel tipler
```

Bu alt klasörler, o feature için ilk gerçek kod yazıldığında oluşturulur;
önceden boş iskelet olarak açılmaz (YAGNI).

## Paylaşılan çekirdek varlık notu

`contacts` tablosuna `conversations`, `lead_profiles`, `reservations`, `sales`,
`attribution_events` referans verir. `features/contacts` bu varlığın sahibidir;
diğer feature'lar kendi kopyalarını oluşturmak yerine
`features/contacts/repositories` ve `features/contacts/types` içindekileri
import eder.
