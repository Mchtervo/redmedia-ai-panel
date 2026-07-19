/**
 * Applies outdoor album-bundle campaign fix to live Supabase via REST.
 * Run: npx tsx scripts/apply-outdoor-bundle-campaigns.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): Record<string, string> {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    out[m[1]] = m[2].trim();
  }
  return out;
}

async function rest(
  url: string,
  key: string,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main(): Promise<void> {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik");

  await rest(url, key, "POST", "service_categories", [
    {
      id: "a1000001-0001-4000-8000-000000000008",
      name: "Albüm",
      slug: "album",
      description: "Çift ve aile albümleri",
      sort_order: 80,
    },
  ]);
  console.log("category ok");

  await rest(url, key, "POST", "services", [
    {
      id: "b2000001-0001-4000-8000-000000000071",
      category_id: "a1000001-0001-4000-8000-000000000008",
      name: "Büyük Albüm",
      slug: "buyuk-album",
      description:
        "Paket kampanyası için gerekli. Liste fiyatını Hizmetler ekranından girin.",
      base_price: 0,
      default_duration_minutes: 0,
      service_type: "album",
    },
    {
      id: "b2000001-0001-4000-8000-000000000072",
      category_id: "a1000001-0001-4000-8000-000000000008",
      name: "2 Aile Albümü",
      slug: "iki-aile-albumu",
      description:
        "Paket kampanyası için gerekli (2 adet aile albümü). Liste fiyatını Hizmetler ekranından girin.",
      base_price: 0,
      default_duration_minutes: 0,
      service_type: "album",
    },
  ]);
  console.log("albums ok");

  const pricePatch = {
    base_price: 5000,
    description:
      "Liste 5.000 TL. Dış çekim paket kampanyasında 3.500 TL.",
  };
  await rest(url, key, "PATCH", "services?slug=eq.gelin-alma-klip", pricePatch);
  await rest(url, key, "PATCH", "services?slug=eq.salon-giris-klip", pricePatch);
  await rest(url, key, "PATCH", "services?slug=eq.kuafor-klip", {
    description: "Kuaför & hazırlık video klip.",
  });
  console.log("prices ok");

  const required = [
    "b2000001-0001-4000-8000-000000000001",
    "b2000001-0001-4000-8000-000000000002",
    "b2000001-0001-4000-8000-000000000071",
    "b2000001-0001-4000-8000-000000000072",
  ];

  await rest(
    url,
    key,
    "PATCH",
    "service_campaigns?id=eq.c3000001-0001-4000-8000-000000000001",
    {
      name: "Dış Çekim Paket → Drone hediye",
      description:
        "Dış çekim Fotoğraf + Video Klip + Büyük Albüm + 2 Aile Albümü birlikte seçilirse Drone hediye (ücretsiz). Bu paketle Gelin Alma Merasimi Klip ve Salon Girişi & İlk Dans Klip de liste 5.000 TL yerine 3.500 TL olur; müşteriye değer/indirim farkını katalogdaki bu rakamlarla anlat.",
      campaign_type: "free_item",
      discount_type: "free",
      discount_value: 0,
      required_service_ids: required,
      rewarded_service_id: "b2000001-0001-4000-8000-000000000003",
      active: true,
      priority: 10,
    }
  );
  console.log("drone campaign ok");

  await rest(
    url,
    key,
    "PATCH",
    "service_campaigns?id=eq.c3000001-0001-4000-8000-000000000002",
    {
      active: false,
      description:
        "KAPALI — bu kampanya geçersiz; indirim dış çekim albüm paketinde.",
    }
  );
  console.log("kuafor campaign off");

  await rest(url, key, "POST", "service_campaigns", [
    {
      id: "c3000001-0001-4000-8000-000000000003",
      name: "Dış Çekim Paket → Gelin Alma Klip 3.500 TL",
      description:
        "Dış çekim Fotoğraf + Video Klip + Büyük Albüm + 2 Aile Albümü seçilince Gelin Alma Merasimi Klip 3.500 TL (liste 5.000 TL).",
      campaign_type: "fixed_price",
      discount_type: "set_price",
      discount_value: 3500,
      required_service_ids: required,
      rewarded_service_id: "b2000001-0001-4000-8000-000000000014",
      active: true,
      priority: 20,
    },
    {
      id: "c3000001-0001-4000-8000-000000000004",
      name: "Dış Çekim Paket → Salon Giriş & İlk Dans 3.500 TL",
      description:
        "Dış çekim Fotoğraf + Video Klip + Büyük Albüm + 2 Aile Albümü seçilince Salon Girişi & İlk Dans Klip 3.500 TL (liste 5.000 TL).",
      campaign_type: "fixed_price",
      discount_type: "set_price",
      discount_value: 3500,
      required_service_ids: required,
      rewarded_service_id: "b2000001-0001-4000-8000-000000000064",
      active: true,
      priority: 30,
    },
  ]);
  console.log("addon campaigns ok");

  const campaigns = await rest(
    url,
    key,
    "GET",
    "service_campaigns?select=name,active,priority&order=priority"
  );
  console.log(JSON.stringify(campaigns, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
