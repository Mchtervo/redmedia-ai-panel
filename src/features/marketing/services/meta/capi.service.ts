/**
 * Conversions API (CAPI) — Pixel Events Manager token ile test.
 * META_ACCESS_TOKEN /debug_token kullanılmaz.
 */
import { MetaGraphError } from "@/features/marketing/services/meta/graph-client";
import { envPixelId } from "@/features/marketing/services/meta/meta-mappers";

function sanitizeCapiError(raw: string): string {
  return raw
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/EAA[A-Za-z0-9]+/g, "[redacted_token]")
    .slice(0, 400);
}

function capiGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
}

function envCapiToken(): string {
  return process.env.META_CAPI_ACCESS_TOKEN?.trim() ?? "";
}

export function envCapiTestEventCode(): string {
  return (
    process.env.META_CAPI_TEST_EVENT_CODE?.trim() ||
    process.env.TEST_EVENT_CODE?.trim() ||
    ""
  );
}

export function envCapiEventSourceUrl(): string {
  return (
    process.env.META_CAPI_EVENT_SOURCE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    ""
  );
}

export type CapiTestResult =
  | {
      outcome: "connected";
      message: string;
      eventsReceived: number | null;
      pixelId: string;
    }
  | {
      outcome: "configured_unverified";
      message: string;
      pixelId: string;
    }
  | {
      outcome: "error";
      message: string;
      pixelId: string | null;
    };

type CapiEventsResponse = {
  events_received?: number;
  messages?: unknown[];
  fbtrace_id?: string;
  error?: { message?: string; code?: number; type?: string };
};

/**
 * CAPI bağlantı testi: yalnızca Events Manager CAPI token + Pixel ID.
 * test_event_code yoksa olay gönderilmez.
 */
export async function testConversionsApiConnection(): Promise<CapiTestResult> {
  const capiToken = envCapiToken();
  const pixelId = envPixelId();

  if (!capiToken || !pixelId) {
    return {
      outcome: "error",
      message: "META_CAPI_ACCESS_TOKEN veya META_PIXEL_ID eksik.",
      pixelId: pixelId || null,
    };
  }

  const testEventCode = envCapiTestEventCode();
  if (!testEventCode) {
    return {
      outcome: "configured_unverified",
      message:
        "Yapılandırıldı, henüz olayla doğrulanmadı. Events Manager test kodunu META_CAPI_TEST_EVENT_CODE olarak ekleyin.",
      pixelId,
    };
  }

  const eventSourceUrl = envCapiEventSourceUrl();
  if (!eventSourceUrl) {
    return {
      outcome: "error",
      message:
        "Test olayı için SITE_URL veya META_CAPI_EVENT_SOURCE_URL gerekli.",
      pixelId,
    };
  }

  const eventTime = Math.floor(Date.now() / 1000);
  const url = `https://graph.facebook.com/${capiGraphVersion()}/${encodeURIComponent(pixelId)}/events`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${capiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            event_name: "PageView",
            event_time: eventTime,
            action_source: "website",
            event_source_url: eventSourceUrl,
          },
        ],
        test_event_code: testEventCode,
      }),
      cache: "no-store",
    });
  } catch {
    throw new MetaGraphError("Meta CAPI ağına ulaşılamadı.", {
      code: "network_error",
      httpStatus: 0,
    });
  }

  const json = (await response.json().catch(() => null)) as CapiEventsResponse | null;

  if (!response.ok || json?.error) {
    const msg = sanitizeCapiError(
      json?.error?.message ?? `HTTP ${response.status}`
    );
    throw new MetaGraphError(msg, {
      code: "capi_error",
      httpStatus: response.status,
      fbCode: json?.error?.code ?? null,
    });
  }

  return {
    outcome: "connected",
    message: "Bağlı — test PageView olayı kabul edildi.",
    eventsReceived: json?.events_received ?? null,
    pixelId,
  };
}
