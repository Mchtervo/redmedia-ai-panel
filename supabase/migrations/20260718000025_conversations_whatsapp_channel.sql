-- AI Sales Learning Engine: WhatsApp kanal desteği.
-- Conversation Memory tüm kanalları (Instagram DM, Messenger, WhatsApp)
-- okuyabilmeli; kanal kısıtı genişletilir.

alter table public.conversations
  drop constraint if exists conversations_channel_check;

alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('instagram', 'facebook', 'whatsapp'));
