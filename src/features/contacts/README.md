# features/contacts

**Menü:** Customers (`/dashboard/customers`)

**Sahip olduğu tablo(lar):** `contacts`

**Not:** Bu, projedeki paylaşılan çekirdek varlıktır. `conversations`,
`lead_profiles`, `reservations`, `sales`, `attribution_events` bu tabloya
referans verir — diğer feature'lar `contact` verisine ihtiyaç duyduğunda bu
klasördeki repository/type'ları import eder, kendi kopyasını oluşturmaz.

## İç yapı

```
contacts/
  types.ts                                  Contact, ContactStatus, ContactListItem tipleri
  validators/list-contacts-query.ts          arama/durum/sayfa parametreleri (Zod)
  repositories/contacts.repository.ts        tek Supabase sorgu noktası
  services/contacts.service.ts               sayfalama + "son mesaj tarihi" türetme
  components/
    customer-status-badge.tsx                durum rozeti (Server)
    customers-search-input.tsx               debounced arama kutusu (Client)
    customers-status-filter.tsx              durum filtresi (Client)
    customers-table.tsx                      liste tablosu + boş durum (Server)
    customer-detail.tsx                      müşteri detay kartı (Server)
```

Rotalar: `src/app/dashboard/customers/{page,loading,error}.tsx`,
`src/app/dashboard/customers/[id]/{page,loading,not-found}.tsx`.
