-- Reservation OS seed: categories, services, campaigns, durations.
-- Fixed UUIDs for stable campaign wiring. IBAN is NOT seeded.

-- Categories
insert into public.service_categories (id, name, slug, description, sort_order) values
  ('a1000001-0001-4000-8000-000000000001', 'Dış Çekim', 'dis-cekim', 'Açık alan / plato dış çekim', 10),
  ('a1000001-0001-4000-8000-000000000002', 'Gelin Alma', 'gelin-alma', 'Gelin alma merasimi', 20),
  ('a1000001-0001-4000-8000-000000000003', 'Kına', 'kina', 'Kına gecesi çekimi', 30),
  ('a1000001-0001-4000-8000-000000000004', 'Kuaför & Hazırlık', 'kuafor-hazirlik', 'Kuaför ve hazırlık', 40),
  ('a1000001-0001-4000-8000-000000000005', 'Nikâh', 'nikah', 'Nikâh töreni', 50),
  ('a1000001-0001-4000-8000-000000000006', 'Nişan', 'nisan', 'Nişan töreni', 60),
  ('a1000001-0001-4000-8000-000000000007', 'Salon / Düğün', 'salon-dugun', 'Salon girişi ve düğün', 70)
on conflict (slug) do nothing;

-- Services (slug unique)
insert into public.services (id, category_id, name, slug, description, base_price, default_duration_minutes, service_type) values
  -- Dış çekim
  ('b2000001-0001-4000-8000-000000000001', 'a1000001-0001-4000-8000-000000000001', 'Fotoğraf', 'dis-cekim-fotograf', 'Poz sınırı yok, etkinliğe ait tüm kareler teslim.', 5000, 120, 'photo'),
  ('b2000001-0001-4000-8000-000000000002', 'a1000001-0001-4000-8000-000000000001', 'Video Klip — Dış Çekim', 'dis-cekim-video', 'Sinematik kurgu, etkinliğe özel klip teslimi.', 5000, 120, 'video'),
  ('b2000001-0001-4000-8000-000000000003', 'a1000001-0001-4000-8000-000000000001', 'Drone', 'dis-cekim-drone', 'Dış çekim drone.', 4000, 0, 'drone'),
  -- Gelin alma
  ('b2000001-0001-4000-8000-000000000011', 'a1000001-0001-4000-8000-000000000002', 'Fotoğraf', 'gelin-alma-fotograf', 'Gelin alma fotoğraf.', 5000, 60, 'photo'),
  ('b2000001-0001-4000-8000-000000000012', 'a1000001-0001-4000-8000-000000000002', 'Drone', 'gelin-alma-drone', 'Gelin alma drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000013', 'a1000001-0001-4000-8000-000000000002', 'Omuz Kamera', 'gelin-alma-omuz', 'Gelin alma omuz kamera.', 6500, 60, 'shoulder_cam'),
  ('b2000001-0001-4000-8000-000000000014', 'a1000001-0001-4000-8000-000000000002', 'Gelin Alma Merasimi Klip', 'gelin-alma-klip', 'Kampanya fiyatı 3.500 TL.', 3500, 60, 'video'),
  -- Kına
  ('b2000001-0001-4000-8000-000000000021', 'a1000001-0001-4000-8000-000000000003', 'Fotoğraf', 'kina-fotograf', 'Kına fotoğraf.', 5000, 120, 'photo'),
  ('b2000001-0001-4000-8000-000000000022', 'a1000001-0001-4000-8000-000000000003', 'Video Klip — Kına', 'kina-video', 'Kına video klip.', 5000, 120, 'video'),
  ('b2000001-0001-4000-8000-000000000023', 'a1000001-0001-4000-8000-000000000003', 'Drone', 'kina-drone', 'Kına drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000024', 'a1000001-0001-4000-8000-000000000003', 'Omuz Kamera', 'kina-omuz', 'Kına omuz kamera.', 6500, 120, 'shoulder_cam'),
  -- Kuaför
  ('b2000001-0001-4000-8000-000000000031', 'a1000001-0001-4000-8000-000000000004', 'Fotoğraf', 'kuafor-fotograf', 'Kuaför fotoğraf.', 5000, 90, 'photo'),
  ('b2000001-0001-4000-8000-000000000032', 'a1000001-0001-4000-8000-000000000004', 'Drone', 'kuafor-drone', 'Kuaför drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000033', 'a1000001-0001-4000-8000-000000000004', 'Omuz Kamera', 'kuafor-omuz', 'Kuaför omuz kamera.', 6500, 90, 'shoulder_cam'),
  ('b2000001-0001-4000-8000-000000000034', 'a1000001-0001-4000-8000-000000000004', 'Kuaför & Hazırlık Klip', 'kuafor-klip', 'Normal 5.000 TL; foto+video ile 3.500 TL.', 5000, 90, 'video'),
  -- Nikâh
  ('b2000001-0001-4000-8000-000000000041', 'a1000001-0001-4000-8000-000000000005', 'Fotoğraf', 'nikah-fotograf', 'Nikâh fotoğraf.', 5000, 60, 'photo'),
  ('b2000001-0001-4000-8000-000000000042', 'a1000001-0001-4000-8000-000000000005', 'Video Klip — Nikâh', 'nikah-video', 'Nikâh video.', 5000, 60, 'video'),
  ('b2000001-0001-4000-8000-000000000043', 'a1000001-0001-4000-8000-000000000005', 'Drone', 'nikah-drone', 'Nikâh drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000044', 'a1000001-0001-4000-8000-000000000005', 'Omuz Kamera', 'nikah-omuz', 'Nikâh omuz kamera.', 6500, 60, 'shoulder_cam'),
  -- Nişan
  ('b2000001-0001-4000-8000-000000000051', 'a1000001-0001-4000-8000-000000000006', 'Fotoğraf', 'nisan-fotograf', 'Nişan fotoğraf.', 5000, 120, 'photo'),
  ('b2000001-0001-4000-8000-000000000052', 'a1000001-0001-4000-8000-000000000006', 'Video Klip — Nişan', 'nisan-video', 'Nişan video.', 5000, 120, 'video'),
  ('b2000001-0001-4000-8000-000000000053', 'a1000001-0001-4000-8000-000000000006', 'Drone', 'nisan-drone', 'Nişan drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000054', 'a1000001-0001-4000-8000-000000000006', 'Omuz Kamera', 'nisan-omuz', 'Nişan omuz kamera.', 6500, 120, 'shoulder_cam'),
  -- Salon
  ('b2000001-0001-4000-8000-000000000061', 'a1000001-0001-4000-8000-000000000007', 'Fotoğraf', 'salon-fotograf', 'Salon fotoğraf.', 5000, 60, 'photo'),
  ('b2000001-0001-4000-8000-000000000062', 'a1000001-0001-4000-8000-000000000007', 'Drone', 'salon-drone', 'Salon drone.', 4000, 0, 'drone'),
  ('b2000001-0001-4000-8000-000000000063', 'a1000001-0001-4000-8000-000000000007', 'Omuz Kamera', 'salon-omuz', 'Salon omuz kamera.', 6500, 60, 'shoulder_cam'),
  ('b2000001-0001-4000-8000-000000000064', 'a1000001-0001-4000-8000-000000000007', 'Salon Girişi & İlk Dans Klip', 'salon-giris-klip', 'Kampanya fiyatı 3.500 TL.', 3500, 60, 'video')
on conflict (slug) do nothing;

-- Campaigns
insert into public.service_campaigns (
  id, name, description, campaign_type, discount_type, discount_value,
  required_service_ids, rewarded_service_id, active, priority
) values
  (
    'c3000001-0001-4000-8000-000000000001',
    'Dış Çekim Foto+Video → Drone ücretsiz',
    'Dış çekimde Fotoğraf + Video Klip birlikte seçilirse Drone ücretsiz.',
    'free_item', 'free', 0,
    array[
      'b2000001-0001-4000-8000-000000000001'::uuid,
      'b2000001-0001-4000-8000-000000000002'::uuid
    ],
    'b2000001-0001-4000-8000-000000000003',
    true, 10
  ),
  (
    'c3000001-0001-4000-8000-000000000002',
    'Kuaför Foto+Video → Klip 3.500 TL',
    'Fotoğraf + video birlikte seçildiğinde kuaför klip fiyatı 3.500 TL.',
    'fixed_price', 'set_price', 3500,
    array[
      'b2000001-0001-4000-8000-000000000031'::uuid,
      'b2000001-0001-4000-8000-000000000034'::uuid
    ],
    'b2000001-0001-4000-8000-000000000034',
    true, 20
  )
on conflict (id) do nothing;

insert into public.teams (id, name, active)
values ('d4000001-0001-4000-8000-000000000001', 'Ana Ekip', true)
on conflict (id) do nothing;
