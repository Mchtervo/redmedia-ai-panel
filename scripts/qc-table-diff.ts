/**
 * Canlı DB tablo listesi (OpenAPI) ile migration dosyalarındaki
 * beklenen tabloları karşılaştırır.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-table-diff.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const spec = (await res.json()) as {
    definitions?: Record<string, unknown>;
  };
  const live = new Set(Object.keys(spec.definitions ?? {}));

  const dir = resolve(process.cwd(), "supabase", "migrations");
  const expected = new Map<string, string>(); // table -> migration file
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".sql")) continue;
    const sql = readFileSync(resolve(dir, f), "utf8");
    const re = /create table (?:if not exists )?public\.(\w+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      if (!expected.has(m[1])) expected.set(m[1], f);
    }
  }

  const missing: Array<[string, string]> = [];
  for (const [t, f] of expected) {
    if (!live.has(t)) missing.push([t, f]);
  }
  const extra = [...live].filter((t) => !expected.has(t)).sort();

  console.log(`Canlı tablo sayısı   : ${live.size}`);
  console.log(`Beklenen tablo sayısı: ${expected.size}`);

  console.log(`\n=== EKSİK tablolar (migration'da var, canlıda YOK) — ${missing.length} ===\n`);
  const byFile = new Map<string, string[]>();
  for (const [t, f] of missing) {
    (byFile.get(f) ?? byFile.set(f, []).get(f)!).push(t);
  }
  for (const [f, ts] of [...byFile.entries()].sort()) {
    console.log(`${f}:`);
    for (const t of ts) console.log(`  - ${t}`);
  }

  console.log(`\n=== Canlıda olup migration'da olmayan — ${extra.length} ===\n`);
  for (const t of extra) console.log(`  - ${t}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
