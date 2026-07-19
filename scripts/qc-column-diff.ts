/**
 * Migration dosyalarındaki "alter table ... add column if not exists" ve
 * "create table" kolonlarını canlı OpenAPI şemasıyla karşılaştırır.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-column-diff.ts
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
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
  };
  const live: Record<string, Set<string>> = {};
  for (const [t, d] of Object.entries(spec.definitions ?? {})) {
    live[t] = new Set(Object.keys(d.properties ?? {}));
  }

  const dir = resolve(process.cwd(), "supabase", "migrations");
  // add column if not exists yakala
  const missingByFile = new Map<string, string[]>();
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".sql")) continue;
    const sql = readFileSync(resolve(dir, f), "utf8");

    // alter table public.X ... add column if not exists Y
    const alterRe = /alter table (?:if exists )?public\.(\w+)([\s\S]*?);/gi;
    let m: RegExpExecArray | null;
    while ((m = alterRe.exec(sql)) !== null) {
      const table = m[1];
      const body = m[2];
      const colRe = /add column (?:if not exists )?(\w+)/gi;
      let c: RegExpExecArray | null;
      while ((c = colRe.exec(body)) !== null) {
        const col = c[1];
        if (!live[table]) continue; // tablo zaten yok — tablo diff raporunda
        if (!live[table].has(col)) {
          (missingByFile.get(f) ?? missingByFile.set(f, []).get(f)!).push(
            `${table}.${col}`
          );
        }
      }
    }
  }

  console.log("=== Canlıda eksik kolonlar (migration bazlı) ===\n");
  if (missingByFile.size === 0) console.log("Yok.");
  for (const [f, cols] of [...missingByFile.entries()].sort()) {
    console.log(`${f}:`);
    for (const c of cols) console.log(`  - ${c}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
