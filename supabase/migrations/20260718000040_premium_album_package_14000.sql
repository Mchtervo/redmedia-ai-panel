-- Premium Albümlü Paket: 14.000 TL (plato + kapora dahil).
-- Ekstralar paket üstüne normal liste fiyatından.

update public.services
set
  base_price = 3000,
  description = 'Premium Albümlü Paket parçası (1 büyük albüm). Paket toplamı 14.000 TL.'
where slug = 'buyuk-album';

update public.services
set
  base_price = 2000,
  description = 'Premium Albümlü Paket parçası (2 aile albümü). Paket toplamı 14.000 TL.'
where slug = 'iki-aile-albumu';

-- Sepet %20 kampanyasını kapat — ana teklif artık sabit 14.000 paket
update public.service_campaigns
set
  active = false,
  description = 'KAPALI — ana teklif Premium Albümlü Paket 14.000 TL (plato+kapora dahil).'
where discount_type = 'percentage'
  and rewarded_service_id is null
  and active = true;

-- Drone hediye kampanyasını paket anlatımına bağla (opsiyonel hediye değil; ekstra ücretli)
update public.service_campaigns
set
  name = 'Premium Albümlü Paket notu',
  description = 'Ana paket: Fotoğraf + Sinematik Klip + Büyük Albüm + 2 Aile Albümü = 14.000 TL (plato ve kapora dahil). Drone, omuz kamera, kuaför hazırlık, gelin alma, ilk dans pakete EKSTRA eklenir (normal liste fiyatı).',
  active = true,
  priority = 1
where id = 'c3000001-0001-4000-8000-000000000001';

-- Gelin / salon / kuaför set_price 3500 kampanyalarını kapat — ekstra = normal fiyat
update public.service_campaigns
set
  active = false,
  description = coalesce(description, '') || ' KAPALI — ekstra hizmetler normal liste fiyatıyla paketin üstüne eklenir.'
where discount_type = 'set_price'
  and active = true;
