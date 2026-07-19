/**
 * /dashboard/ai sayfasının veri servisini sorgu sorgu çalıştırıp hatayı
 * yeniden üretir.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-ai-page-repro.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cases: Array<{ name: string; run: () => Promise<unknown> }> = [
    {
      name: "conversation_analyses count (learning_status=completed)",
      run: async () => {
        const { count, error } = await sb
          .from("conversation_analyses")
          .select("id", { count: "exact", head: true })
          .eq("learning_status", "completed");
        if (error) throw error;
        return count;
      },
    },
    {
      name: "knowledge_documents count (review_status)",
      run: async () => {
        const { count, error } = await sb
          .from("knowledge_documents")
          .select("id", { count: "exact", head: true })
          .eq("review_status", "pending_review");
        if (error) throw error;
        return count;
      },
    },
    {
      name: "knowledge_documents list (faq_question filter)",
      run: async () => {
        const { data, error } = await sb
          .from("knowledge_documents")
          .select("*")
          .eq("category", "sik_sorulan_sorular")
          .not("faq_question", "is", null)
          .limit(5);
        if (error) throw error;
        return data?.length;
      },
    },
    {
      name: "knowledge_documents list (example_good_reply filter)",
      run: async () => {
        const { data, error } = await sb
          .from("knowledge_documents")
          .select("*")
          .not("example_good_reply", "is", null)
          .limit(5);
        if (error) throw error;
        return data?.length;
      },
    },
    {
      name: "conversation_analyses recent list",
      run: async () => {
        const { data, error } = await sb
          .from("conversation_analyses")
          .select("*")
          .eq("learning_status", "completed")
          .order("analyzed_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        return data?.length;
      },
    },
  ];

  for (const c of cases) {
    try {
      const v = await c.run();
      console.log(`OK   | ${c.name} | ${JSON.stringify(v)}`);
    } catch (e) {
      console.log(`FAIL | ${c.name}`);
      console.log(`     | ${JSON.stringify(e)}`);
    }
  }
}

main();
