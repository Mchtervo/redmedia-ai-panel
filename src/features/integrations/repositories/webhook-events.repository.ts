import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  WebhookEvent,
  WebhookProvider,
} from "@/features/integrations/types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type RecordWebhookEventParams = {
  provider: WebhookProvider;
  eventType?: string | null;
  signatureVerified: boolean;
  payload: Json;
};

/**
 * Dış servisten (ChatPlace/Meta) gelen ham webhook olayını, işlenmeden önce
 * kaydeder (`status='received'`). Böylece işleme sırasında bir hata olsa da
 * ham veri kaybolmaz ve yeniden işlenebilir (bkz. docs/CHATPLACE.md).
 */
export async function recordWebhookEvent(
  supabase: TypedSupabaseClient,
  { provider, eventType, signatureVerified, payload }: RecordWebhookEventParams
): Promise<WebhookEvent> {
  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_type: eventType ?? null,
      signature_verified: signatureVerified,
      payload,
      status: "received",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/** Başarılı işlenen (veya duplicate nedeniyle atlanan) olayı işaretler. */
export async function markWebhookEventHandled(
  supabase: TypedSupabaseClient,
  id: string,
  status: "processed" | "ignored"
): Promise<void> {
  const { error } = await supabase
    .from("webhook_events")
    .update({ status, processed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Başarısız işlenen olayı işaretler. `errorMessage` kısa ve hassas veri
 * içermeyecek şekilde çağıran tarafından verilir (bkz.
 * `.cursor/rules/02-security.mdc` — loglarda içerik gösterilmez).
 */
export async function markWebhookEventFailed(
  supabase: TypedSupabaseClient,
  id: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from("webhook_events")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 500),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}
