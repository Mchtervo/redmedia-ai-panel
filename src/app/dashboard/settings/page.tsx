import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/server/supabase/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { AiControlsForm } from "@/features/settings/components/ai-controls-form";
import {
  getAiFeatureFlags,
  getDailyAdBudgetTry,
} from "@/features/settings/services/ai-feature-flags.service";

export const metadata: Metadata = {
  title: "Ayarlar — Redmedia AI Panel",
};

export default async function SettingsPage() {
  const supabase = createAdminClient();
  const [flags, dailyBudget] = await Promise.all([
    getAiFeatureFlags(supabase),
    getDailyAdBudgetTry(supabase),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader
        title="Ayarlar"
        description="AI evrenlerini aç/kapa, günlük reklam bütçesini yönet."
      />

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/dashboard/settings/payment"
          className="border-border hover:bg-muted rounded-lg border px-3 py-1.5"
        >
          Ödeme hesapları
        </Link>
        <Link
          href="/dashboard/integrations"
          className="border-border hover:bg-muted rounded-lg border px-3 py-1.5"
        >
          Entegrasyonlar
        </Link>
      </nav>

      <AiControlsForm
        initialFlags={flags}
        initialDailyBudget={dailyBudget}
      />
    </div>
  );
}
