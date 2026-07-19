/**
 * Çözülmemiş şablon ({{ ... }}) içeren contact isim/username alanlarını
 * null'a çevirir (tek seferlik veri temizliği).
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-fix-template-contact.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: contacts, error } = await sb
    .from("contacts")
    .select("id, full_name, username");
  if (error) throw error;

  let fixed = 0;
  for (const c of contacts ?? []) {
    const badName = c.full_name?.includes("{{") ?? false;
    const badUser = c.username?.includes("{{") ?? false;
    if (!badName && !badUser) continue;
    const { error: upErr } = await sb
      .from("contacts")
      .update({
        full_name: badName ? null : c.full_name,
        username: badUser ? null : c.username,
      })
      .eq("id", c.id);
    if (upErr) throw upErr;
    fixed += 1;
    console.log(`Temizlendi: ${c.id}`);
  }
  console.log(`Toplam düzeltilen contact: ${fixed}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
