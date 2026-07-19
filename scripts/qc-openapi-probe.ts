/**
 * PostgREST OpenAPI şemasını birkaç kez çekip (farklı instance'lara düşmek
 * için) canlı şemada hangi tablo/kolonların olduğunu doğrular.
 * Kullanım: npx tsx --env-file=.env.local scripts/qc-openapi-probe.ts
 */

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  for (let i = 1; i <= 3; i++) {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const spec = (await res.json()) as {
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
    };
    const defs = spec.definitions ?? {};
    const tables = Object.keys(defs).sort();
    const kd = defs["knowledge_documents"]?.properties ?? {};
    console.log(`\n--- Deneme ${i} ---`);
    console.log(`Tablo sayısı: ${tables.length}`);
    console.log(
      `conversation_analyses: ${tables.includes("conversation_analyses") ? "VAR" : "YOK"}`
    );
    console.log(
      `follow_up_tasks: ${tables.includes("follow_up_tasks") ? "VAR" : "YOK"}`
    );
    console.log(
      `attribution_funnel_events: ${tables.includes("attribution_funnel_events") ? "VAR" : "YOK"}`
    );
    console.log(
      `knowledge_documents.faq_question: ${"faq_question" in kd ? "VAR" : "YOK"}`
    );
    console.log(
      `knowledge_documents.review_status: ${"review_status" in kd ? "VAR" : "YOK"}`
    );
    console.log(
      `knowledge_documents kolonları: ${Object.keys(kd).sort().join(", ")}`
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
