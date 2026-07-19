/**
 * Website fiyat/kampanya mantığını Supabase kataloguna uygular.
 * npx tsx scripts/sync-catalog-from-website.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(): void {
  const raw = readFileSync(resolve(".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  }
}

async function rest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const BUNDLE = [
  "b2000001-0001-4000-8000-000000000001",
  "b2000001-0001-4000-8000-000000000002",
  "b2000001-0001-4000-8000-000000000071",
  "b2000001-0001-4000-8000-000000000072",
];

async function main(): Promise<void> {
  loadEnv();

  await rest("PATCH", "services?slug=eq.buyuk-album", {
    name: "Büyük Albüm (5 yaprak / 10 sayfa)",
    base_price: 3000,
    description:
      "30x60 cm lüks A kalite baskı. Varsayılan: 5 yaprak 10 sayfa. (10 yaprak 20 sayfa: 4.500 TL)",
  });
  await rest("PATCH", "services?slug=eq.iki-aile-albumu", {
    name: "2 Aile Albümü",
    base_price: 2000,
    description: "2 adet lüks mini aile albümü (adet 1.000 TL).",
  });

  for (const slug of [
    "gelin-alma-klip",
    "salon-giris-klip",
    "kuafor-klip",
  ] as const) {
    await rest("PATCH", `services?slug=eq.${slug}`, {
      base_price: 5000,
      description:
        "Liste 5.000 TL. Dış çekim foto+video+albüm paketinde kampanyayla 3.500 TL.",
    });
  }

  await rest("PATCH", "services?slug=eq.dis-cekim-drone", {
    base_price: 4000,
    description:
      "Havadan sinematik görüntüler. Dış çekim paketinde hediye (4.000 → 0).",
  });
  await rest("PATCH", "services?slug=eq.dis-cekim-fotograf", {
    description: "Poz sınırı yok — o etkinliğe ait tüm kareler teslim.",
  });
  await rest("PATCH", "services?slug=eq.dis-cekim-video", {
    description: "Sinematik kurgu — o etkinliğe özel klip teslimi.",
  });

  await rest(
    "PATCH",
    "service_campaigns?id=eq.c3000001-0001-4000-8000-000000000001",
    {
      name: "Dış Çekim Paket → Drone hediye",
      description:
        "Foto+Video (dış)+Büyük Albüm+2 Aile Albümü → Drone HEDİYE (4.000→0). Aynı pakette gelin/salon/kuaför klipleri 5.000→3.500.",
      required_service_ids: BUNDLE,
      rewarded_service_id: "b2000001-0001-4000-8000-000000000003",
      discount_type: "free",
      discount_value: 0,
      active: true,
      priority: 10,
    }
  );

  await rest(
    "PATCH",
    "service_campaigns?id=eq.c3000001-0001-4000-8000-000000000002",
    {
      name: "Dış Çekim Paket → Kuaför Klip 3.500 TL",
      description:
        "Paket koşulunda Kuaför & Hazırlık Klip liste 5.000 yerine bu pakete özel 3.500 TL.",
      campaign_type: "fixed_price",
      discount_type: "set_price",
      discount_value: 3500,
      required_service_ids: BUNDLE,
      rewarded_service_id: "b2000001-0001-4000-8000-000000000034",
      active: true,
      priority: 25,
    }
  );

  await rest(
    "PATCH",
    "service_campaigns?id=eq.c3000001-0001-4000-8000-000000000003",
    {
      name: "Dış Çekim Paket → Gelin Alma Klip 3.500 TL",
      description:
        "Paket koşulunda Gelin Alma Merasimi Klip liste 5.000 yerine 3.500 TL (1.500 kazanç).",
      active: true,
      priority: 20,
    }
  );

  await rest(
    "PATCH",
    "service_campaigns?id=eq.c3000001-0001-4000-8000-000000000004",
    {
      name: "Dış Çekim Paket → Salon Giriş & İlk Dans 3.500 TL",
      description:
        "Paket koşulunda Salon Girişi & İlk Dans Klip liste 5.000 yerine 3.500 TL (1.500 kazanç).",
      active: true,
      priority: 30,
    }
  );

  // Sepet %20 — set_price klipleri hariç (rewarded null = motor sepet yüzdesi)
  const percentCampaign = {
    id: "c3000001-0001-4000-8000-000000000005",
    name: "Dış Çekim Paket → Sepet %20 indirim",
    description:
      "Aynı pakette sepete %20 paket indirimi (foto+video+albümler ve diğer ekler). Gelin Alma / Salon Giriş / Kuaför kampanya klipleri (3.500) bu %20'ye GİRMEZ. Erken rezervasyona özel: kazanç = paket %20 + klip 1.500×adet + drone hediye 4.000.",
    campaign_type: "percentage",
    discount_type: "percentage",
    discount_value: 20,
    required_service_ids: BUNDLE,
    rewarded_service_id: null,
    active: true,
    priority: 40,
  };
  const existingPercent = (await rest(
    "GET",
    "service_campaigns?id=eq.c3000001-0001-4000-8000-000000000005&select=id"
  )) as { id: string }[];
  if (!existingPercent?.length) {
    await rest("POST", "service_campaigns", percentCampaign);
  } else {
    await rest(
      "PATCH",
      "service_campaigns?id=eq.c3000001-0001-4000-8000-000000000005",
      percentCampaign
    );
  }

  const services = await rest(
    "GET",
    "services?slug=in.(buyuk-album,iki-aile-albumu,gelin-alma-klip,salon-giris-klip,kuafor-klip,dis-cekim-drone)&select=slug,base_price,name"
  );
  const campaigns = await rest(
    "GET",
    "service_campaigns?select=name,active,discount_type,discount_value&order=priority&active=eq.true"
  );
  console.log(JSON.stringify({ services, campaigns }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
