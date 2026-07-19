-- Dış çekim paketinde sepet %20 indirimi.
-- Gelin Alma / Salon Giriş / Kuaför kampanya klipleri (set_price 3.500) bu %20'ye GİRMEZ.
-- Motor: discount_type=percentage + rewarded_service_id IS NULL → set_price/free hariç sepet satırları.

insert into public.service_campaigns (
  id, name, description, campaign_type, discount_type, discount_value,
  required_service_ids, rewarded_service_id, active, priority
) values (
  'c3000001-0001-4000-8000-000000000005',
  'Dış Çekim Paket → Sepet %20 indirim',
  'Foto+Video (dış)+Büyük Albüm+2 Aile Albümü paketinde sepete %20 paket indirimi. Gelin Alma / Salon Giriş-İlk Dans / Kuaför kampanya klipleri (liste 5.000→3.500) bu %20 dışında kalır. Erken rezervasyona özel: müşteriye kazanç (paket indirimi + kampanya klipleri + drone hediye) ile pazarla.',
  'percentage',
  'percentage',
  20,
  array[
    'b2000001-0001-4000-8000-000000000001'::uuid,
    'b2000001-0001-4000-8000-000000000002'::uuid,
    'b2000001-0001-4000-8000-000000000071'::uuid,
    'b2000001-0001-4000-8000-000000000072'::uuid
  ],
  null,
  true,
  40
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
