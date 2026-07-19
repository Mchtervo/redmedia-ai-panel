-- Website sepet / paket mantığı ile katalog senkronu:
-- Büyük Albüm (5yp/10sy) 3.000; 2 Aile Albümü 2.000 (1.000×2)
-- Dış çekim foto+video+albümler → drone hediye
-- Aynı pakette gelin / salon / kuaför klipleri liste 5.000 → 3.500

update public.services
set
  name = 'Büyük Albüm (5 yaprak / 10 sayfa)',
  base_price = 3000,
  description = '30x60 cm lüks A kalite baskı. Varsayılan: 5 yaprak 10 sayfa. (10 yaprak 20 sayfa ayrı fiyat: 4.500 TL)'
where slug = 'buyuk-album';

update public.services
set
  name = '2 Aile Albümü',
  base_price = 2000,
  description = '2 adet lüks mini aile albümü (adet 1.000 TL).'
where slug = 'iki-aile-albumu';

update public.services
set
  base_price = 5000,
  description = 'Liste 5.000 TL. Dış çekim foto+video+albüm paketinde kampanyayla 3.500 TL.'
where slug in ('gelin-alma-klip', 'salon-giris-klip', 'kuafor-klip');

update public.services
set
  base_price = 4000,
  description = 'Havadan sinematik görüntüler — o etkinliğe özel drone çekimi. Dış çekim paketinde hediye olabilir.'
where slug = 'dis-cekim-drone';

update public.services
set
  description = 'Poz sınırı yok — o etkinliğe ait tüm kareler teslim.'
where slug = 'dis-cekim-fotograf';

update public.services
set
  description = 'Sinematik kurgu — o etkinliğe özel klip teslimi.'
where slug = 'dis-cekim-video';

-- Drone hediye kampanyası metni
update public.service_campaigns
set
  name = 'Dış Çekim Paket → Drone hediye',
  description = 'Fotoğraf (dış) + Video Klip (dış) + Büyük Albüm + 2 Aile Albümü seçilirse Drone HEDİYE (liste 4.000 TL → 0). Aynı pakette Gelin Alma / Salon Giriş-İlk Dans / Kuaför klip liste 5.000 yerine 3.500.',
  required_service_ids = array[
    'b2000001-0001-4000-8000-000000000001'::uuid,
    'b2000001-0001-4000-8000-000000000002'::uuid,
    'b2000001-0001-4000-8000-000000000071'::uuid,
    'b2000001-0001-4000-8000-000000000072'::uuid
  ],
  rewarded_service_id = 'b2000001-0001-4000-8000-000000000003',
  discount_type = 'free',
  discount_value = 0,
  active = true,
  priority = 10
where id = 'c3000001-0001-4000-8000-000000000001';

-- Eski yanlış kuaför kampanyasını bu paket koşuluna çevir
update public.service_campaigns
set
  name = 'Dış Çekim Paket → Kuaför Klip 3.500 TL',
  description = 'Dış çekim Foto+Video+Büyük Albüm+2 Aile Albümü paketinde Kuaför & Hazırlık Klip liste 5.000 TL yerine bu pakete özel 3.500 TL.',
  campaign_type = 'fixed_price',
  discount_type = 'set_price',
  discount_value = 3500,
  required_service_ids = array[
    'b2000001-0001-4000-8000-000000000001'::uuid,
    'b2000001-0001-4000-8000-000000000002'::uuid,
    'b2000001-0001-4000-8000-000000000071'::uuid,
    'b2000001-0001-4000-8000-000000000072'::uuid
  ],
  rewarded_service_id = 'b2000001-0001-4000-8000-000000000034',
  active = true,
  priority = 25
where id = 'c3000001-0001-4000-8000-000000000002';

update public.service_campaigns
set
  name = 'Dış Çekim Paket → Gelin Alma Klip 3.500 TL',
  description = 'Dış çekim Foto+Video+Büyük Albüm+2 Aile Albümü paketinde Gelin Alma Merasimi Klip liste 5.000 TL yerine bu pakete özel 3.500 TL (1.500 TL kazanç).',
  active = true,
  priority = 20
where id = 'c3000001-0001-4000-8000-000000000003';

update public.service_campaigns
set
  name = 'Dış Çekim Paket → Salon Giriş & İlk Dans 3.500 TL',
  description = 'Dış çekim Foto+Video+Büyük Albüm+2 Aile Albümü paketinde Salon Girişi & İlk Dans Klip liste 5.000 TL yerine bu pakete özel 3.500 TL (1.500 TL kazanç).',
  active = true,
  priority = 30
where id = 'c3000001-0001-4000-8000-000000000004';
