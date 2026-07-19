-- CAPI: token var ama test_event_code ile doğrulanmamış durumu
alter table public.meta_connections
  drop constraint if exists meta_connections_status_check;

alter table public.meta_connections
  add constraint meta_connections_status_check
  check (status in (
    'connected',
    'disconnected',
    'error',
    'token_expired',
    'configured'
  ));
