-- Hazır otomasyon kural şablonları (docs/47 Faz 5).
-- Aksiyonlar yalnızca panel bildirimi / onay talebi (bütçe değişmez).

insert into public.automation_rules (
  name, description, trigger_type, conditions, actions, is_enabled
)
select * from (values
  (
    'İptal kelimesi → onay kuyruğu',
    'Gelen mesajda iptal geçiyorsa insan onayı talebi oluşturur.',
    'inbound_message',
    '[{"field":"message","op":"contains","value":"iptal"}]'::jsonb,
    '[{"type":"approval_request","params":{"title":"İptal talebi — insan onayı gerekli"}},{"type":"panel_notification","params":{"title":"İptal talebi algılandı","body":"Inbox ve Onay Kuyruğunu kontrol edin."}}]'::jsonb,
    true
  ),
  (
    'İndirim kelimesi → bildirim',
    'İndirim/iskonto taleplerinde ekibe bildirim.',
    'inbound_message',
    '[{"field":"message","op":"contains","value":"indirim"}]'::jsonb,
    '[{"type":"panel_notification","params":{"title":"İndirim talebi","body":"Müşteri indirim istedi; onay kuyruğunu kontrol edin."}}]'::jsonb,
    true
  ),
  (
    'Yeni rezervasyon bildirimi',
    'Rezervasyon oluşturulunca operasyon bildirimi.',
    'reservation_created',
    '[]'::jsonb,
    '[{"type":"panel_notification","params":{"title":"Yeni rezervasyon","body":"Sistemde yeni bir rezervasyon oluştu."}}]'::jsonb,
    true
  ),
  (
    'Kapora onaylandı bildirimi',
    'Kapora doğrulanınca ekip bildirimi.',
    'deposit_verified',
    '[]'::jsonb,
    '[{"type":"panel_notification","params":{"title":"Kapora onaylandı","body":"Rezervasyon kaporası doğrulandı."}}]'::jsonb,
    true
  ),
  (
    'Şikayet kelimesi → onay',
    'Şikayet içeren mesajlarda onay talebi.',
    'inbound_message',
    '[{"field":"message","op":"contains","value":"şikayet"}]'::jsonb,
    '[{"type":"approval_request","params":{"title":"Şikayet — insan onayı"}},{"type":"panel_notification","params":{"title":"Şikayet algılandı","body":"Müşteri şikayet mesajı gönderdi."}}]'::jsonb,
    true
  ),
  (
    'Pazarlık kelimesi → bildirim',
    'Pazarlık sinyali ekibe düşer.',
    'inbound_message',
    '[{"field":"message","op":"contains","value":"pazarlık"}]'::jsonb,
    '[{"type":"panel_notification","params":{"title":"Pazarlık sinyali","body":"Müşteri pazarlık/özel fiyat konuşuyor olabilir."}}]'::jsonb,
    true
  )
) as v(name, description, trigger_type, conditions, actions, is_enabled)
where not exists (
  select 1 from public.automation_rules r where r.name = v.name
);
