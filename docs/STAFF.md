# Personel Yönetimi

Panelden personel ekleme, rol atama, izin ve rezervasyona eleman seçimi.

## Migration

`supabase/migrations/20260717000017_staff_management.sql`

Supabase SQL Editor'de bu dosyayı çalıştırın (Reservation OS 13–16 sonrası).

## Roller

- `main_operator` — Ana Çekim Sorumlusu
- `event_photographer` — Etkinlik Fotoğrafçısı (nikâh/nişan/kına yalnız foto)
- `wedding_venue_photographer` — Düğün Salonu Fotoğrafçısı
- `shoulder_camera_operator` — Omuz Kamera Operatörü
- `video_operator` / `drone_operator` / `assistant`

## Panel

- `/dashboard/team`
- `/dashboard/team/[id]`
- `/dashboard/team/calendar`
- Rezervasyon detayında **Personel Atama** (öneri + override gerekçe)

## AI

Kesin müsaitlik vermeden önce ekip kapasitesi kontrol edilir. Yetersizse:

> Belirttiğiniz saat için ekip uygunluğunu ayrıca kontrol etmemiz gerekiyor.

`required_role` ve `suggested_staff_ids` taslak promptuna yazılır; atama admin panelden yapılır.
