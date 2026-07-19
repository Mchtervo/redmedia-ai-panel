-- Dış çekim paket kampanyası: foto + klip + büyük albüm + 2 aile albümü
-- → drone hediye; gelin alma + salon giriş/ilk dans 3.500 TL (liste 5.000 TL).
-- Yanlış kuaför kampanyası kapatılır.

-- Albüm kategorisi
insert into public.service_categories (id, name, slug, description, sort_order)
values (
  'a1000001-0001-4000-8000-000000000008',
  'Albüm',
  'album',
  'Çift ve aile albümleri',
  80
)
on conflict (slug) do nothing;

-- Albüm hizmetleri (liste fiyatı bilinmiyorsa 0; panelden güncellenir)
insert into public.services (
  id, category_id, name, slug, description, base_price,
  default_duration_minutes, service_type
) values
  (
    'b2000001-0001-4000-8000-000000000071',
    'a1000001-0001-4000-8000-000000000008',
    'Büyük Albüm',
    'buyuk-album',
    'Paket kampanyası için gerekli. Liste fiyatını Hizmetler ekranından girin.',
    0,
    0,
    'album'
  ),
  (
    'b2000001-0001-4000-8000-000000000072',
    'a1000001-0001-4000-8000-000000000008',
    '2 Aile Albümü',
    'iki-aile-albumu',
    'Paket kampanyası için gerekli (2 adet aile albümü). Liste fiyatını Hizmetler ekranından girin.',
    0,
    0,
    'album'
  )
on conflict (slug) do nothing;

-- Liste fiyatı 5.000; kampanya ile 3.500
update public.services
set
  base_price = 5000,
  description = 'Liste 5.000 TL. Dış çekim paket kampanyasında 3.500 TL.'
where slug in ('gelin-alma-klip', 'salon-giris-klip');

-- Eski kuaför kampanya metnini temizle (kampanya kapatılacak)
update public.services
set description = 'Kuaför & hazırlık video klip.'
where slug = 'kuafor-klip';

-- Drone hediye: foto + klip + büyük albüm + 2 aile albümü
update public.service_campaigns
set
  name = 'Dış Çekim Paket → Drone hediye',
  description = 'Dış çekim Fotoğraf + Video Klip + Büyük Albüm + 2 Aile Albümü birlikte seçilirse Drone hediye (ücretsiz). Bu paketle Gelin Alma Merasimi Klip ve Salon Girişi & İlk Dans Klip de liste 5.000 TL yerine 3.500 TL olur; müşteriye değer/indirim farkını katalogdaki bu rakamlarla anlat.',
  campaign_type = 'free_item',
  discount_type = 'free',
  discount_value = 0,
  required_service_ids = array[
    'b2000001-0001-4000-8000-000000000001'::uuid,
    'b2000001-0001-4000-8000-000000000002'::uuid,
    'b2000001-0001-4000-8000-000000000071'::uuid,
    'b2000001-0001-4000-8000-000000000072'::uuid
  ],
  rewarded_service_id = 'b2000001-0001-4000-8000-000000000003',
  active = true,
  priority = 10
where id = 'c3000001-0001-4000-8000-000000000001';

-- Yanlış kuaför kampanyasını kapat
update public.service_campaigns
set
  active = false,
  description = 'KAPALI — bu kampanya geçersiz; indirim dış çekim albüm paketinde.'
where id = 'c3000001-0001-4000-8000-000000000002';

-- Aynı paket → gelin alma klip 3.500
insert into public.service_campaigns (
  id, name, description, campaign_type, discount_type, discount_value,
  required_service_ids, rewarded_service_id, active, priority
) values (
  'c3000001-0001-4000-8000-000000000003',
  'Dış Çekim Paket → Gelin Alma Klip 3.500 TL',
  'Dış çekim Fotoğraf + Video Klip + Büyük Albüm + 2 Aile Albümü seçilince Gelin Alma Merasimi Klip 3.500 TL (liste 5.000 TL).',
  'fixed_price',
  'set_price',
  3500,
  array[
    'b2000001-0001-4000-8000-000000000001'::uuid,
    'b2000001-0001-4000-8000-000000000002'::uuid,
    'b2000001-0001-4000-8000-000000000071'::uuid,
    'b2000001-0001-4000-8000-000000000072'::uuid
  ],
  'b2000001-0001-4000-8000-000000000014',
  true,
  20
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  campaign_type = excluded.campaign_type,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  required_service_ids = excluded.required_service_ids,
  rewarded_service_id = excluded.rewarded_service_id,
  active = excluded.active,
  priority = excluded.priority;

-- Aynı paket → salon giriş & ilk dans 3.500
insert into public.service_campaigns (
  id, name, description, campaign_type, discount_type, discount_value,
  required_service_ids, rewarded_service_id, active, priority
) values (
  'c3000001-0001-4000-8000-000000000004',
  'Dış Çekim Paket → Salon Giriş & İlk Dans 3.500 TL',
  'Dış çekim Fotoğraf + Video Klip + Büyük Albüm + 2 Aile Albümü seçilince Salon Girişi & İlk Dans Klip 3.500 TL (liste 5.000 TL).',
  'fixed_price',
  'set_price',
  3500,
  array[
    'b2000001-0001-4000-8000-000000000001'::uuid,
    'b2000001-0001-4000-8000-000000000002'::uuid,
    'b2000001-0001-4000-8000-000000000071'::uuid,
    'b2000001-0001-4000-8000-000000000072'::uuid
  ],
  'b2000001-0001-4000-8000-000000000064',
  true,
  30
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  campaign_type = excluded.campaign_type,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  required_service_ids = excluded.required_service_ids,
  rewarded_service_id = excluded.rewarded_service_id,
  active = excluded.active,
  priority = excluded.priority;
