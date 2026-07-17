# features/analytics

**Menü:** Analytics (`/dashboard/analytics`)

**Kendi tablosu yok** — `sales`, `attribution_events`, `ad_daily_metrics`,
`lead_profiles` üzerinden salt-okuma agregasyon/raporlama yapar.

Cross-feature orkestrasyon gerekiyorsa (birden fazla feature'ın verisini
birleştiren mantık) `src/services/` içine yazılır, burada tekrar edilmez.

Henüz kod eklenmedi. Standart iç yapı için `src/features/README.md`'ye bakın.
