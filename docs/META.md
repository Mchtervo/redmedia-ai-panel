# Meta (Instagram / Facebook) Entegrasyonu

> **Durum:** Henüz bağlanmadı. Bu belge entegrasyon planını tanımlar; canlı
> bağlantı, API anahtarı veya kod içermez.

## Amaç

Panel, Redmedia'nın Meta (Instagram ve Facebook) hesaplarındaki reklamları,
sayfa konuşmalarını ve performans verilerini görüntülemek ve analiz etmek
için Meta Graph API ile entegre olacaktır.

## v1 Kapsamı ve Sınırları

- **İlk sürümde reklamlar otomatik kapatılmaz/durdurulmaz.** Panel, kampanya
  durumunu değiştiren otomatik bir işlem yapmaz.
- AI, reklam verisi üzerinde **yalnızca analiz ve öneri** üretir (örn.
  "bu kampanyanın dönüşüm oranı düşüyor, incelenmesi önerilir"); kararı
  uygulamaz.
- **Bütçe değişikliği her zaman insan onayı gerektirir.** AI veya panel,
  bütçeyi kendi başına değiştiremez; yalnızca değişiklik önerisi sunar,
  onay sonrası yetkili personel uygular.

Bu sınırlar `.cursor/rules/04-ai-behavior.mdc` ile birlikte geçerlidir ve
gevşetilmesi ayrı bir kararla, açıkça talep edilmeden yapılmaz.

## Planlanan Kullanım Alanları

- Reklam kampanyası ve performans verisinin okunması (insights).
- Sayfa/Instagram hesabı konuşmalarının panelde görüntülenmesi.
- Reklam performansına dair AI destekli özet/öneri raporları.

## Güvenlik Notları

- Meta App Secret ve erişim tokenleri yalnızca sunucu tarafında saklanır
  (bkz. `.cursor/rules/02-security.mdc`).
- Meta'dan gelen webhook istekleri (varsa) imza doğrulamasından geçer.
- API çağrı hataları kullanıcıya sade bir mesajla iletilir; ham hata detayı
  loglanmaz/sızdırılmaz.

## Kapsam Dışı (v1)

- Otomatik bütçe/durum değişikliği.
- Otomatik reklam oluşturma/yayınlama.

Gerçek entegrasyon başladığında bu belge; kullanılan Graph API
endpoint'leri, izinler (permissions) ve veri senkronizasyon sıklığıyla
güncellenecektir.
