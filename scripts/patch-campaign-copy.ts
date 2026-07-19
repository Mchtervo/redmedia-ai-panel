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

async function main(): Promise<void> {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const description =
    "Dış çekim Foto+Video Klip+Büyük Albüm+2 Aile Albümü olursa Drone HEDİYE. Aynı pakette Gelin Alma ve Salon Giriş/İlk Dans liste 5.000 TL yerine bu pakete özel 3.500 TL.";
  const r = await fetch(
    `${url}/rest/v1/service_campaigns?id=eq.c3000001-0001-4000-8000-000000000001`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ description }),
    }
  );
  console.log(r.status, await r.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
