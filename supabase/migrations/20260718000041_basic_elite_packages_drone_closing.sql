-- Basic Cinema 11.000 (plato dahil) + Elite Premium 21.000 (plato+kapora dahil).
-- Drone paket hediyesi iptal — kapanışta yalnız dış çekimde kullanılır.

-- Drone free_item kampanyasını kapat (fiyat motoru artık hediye uygulamasın)
update public.service_campaigns
set
  active = false,
  name = 'KAPALI — Drone paket hediyesi yok',
  description = 'KAPALI. Drone liste 4.000 TL; pakette hediye değil. Kararsız müşteride yalnız DIŞ ÇEKİM kapanış hediyesi (gelin alma/kuaför/salon hariç). Paketler: Basic Cinema 11.000 TL (plato dahil); Elite Premium 21.000 TL (plato+kapora dahil).'
where rewarded_service_id = 'b2000001-0001-4000-8000-000000000003'
  and discount_type = 'free';

update public.services
set
  description = 'Liste 4.000 TL. Pakette otomatik hediye değil. Dış çekim kapanışında (kararsız müşteri) hediye edilebilir; gelin alma ve diğerlerinde hediye yok. Ana paketler: Basic Cinema 11.000 TL · Elite Premium 21.000 TL.'
where slug = 'dis-cekim-drone';

update public.services
set
  description = 'Basic Cinema / Elite Premium paket bileşeni. Basic Cinema paket toplamı 11.000 TL (plato dahil).'
where slug in ('dis-cekim-fotograf', 'dis-cekim-video');

update public.services
set
  description = 'Elite Premium paket bileşeni. Elite toplam 21.000 TL (plato+kapora dahil: albümler + gelin alma + salon giriş + ilk dans).'
where slug in ('buyuk-album', 'iki-aile-albumu');
