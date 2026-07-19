import type { Metadata } from "next";
import { Workflow, History } from "lucide-react";
import { createAdminClient } from "@/server/supabase/admin";
import {
  listAutomationRules,
  listRecentAutomationRuns,
} from "@/features/automations/repositories/automations.repository";
import {
  AUTOMATION_RUN_STATUS_LABELS,
  AUTOMATION_TRIGGER_LABELS,
  automationActionsSchema,
  automationConditionsSchema,
  type AutomationRuleRow,
  type AutomationTrigger,
} from "@/features/automations/types";
import { AutomationRuleForm } from "@/features/automations/components/automation-rule-form";
import { AutomationRuleButtons } from "@/features/automations/components/automation-rule-buttons";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";

export const metadata: Metadata = {
  title: "Otomasyonlar — Redmedia AI Panel",
};

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function describeRule(rule: AutomationRuleRow): {
  conditionText: string;
  actionText: string;
} {
  const conditions = automationConditionsSchema.safeParse(rule.conditions);
  const actions = automationActionsSchema.safeParse(rule.actions);

  const conditionText =
    conditions.success && conditions.data.length > 0
      ? conditions.data
          .map((c) => `${c.field} ${c.op} "${c.value}"`)
          .join(" ve ")
      : "Koşulsuz (her olayda çalışır)";

  const actionText = actions.success
    ? actions.data
        .map((a) =>
          a.type === "panel_notification"
            ? `Bildirim: "${a.params.title}"`
            : `Onay talebi: "${a.params.title}"`
        )
        .join(", ")
    : "Geçersiz aksiyon tanımı";

  return { conditionText, actionText };
}

const RUN_STATUS_TONES: Record<string, StatusTone> = {
  completed: "success",
  skipped: "neutral",
  failed: "danger",
};

export default async function AutomationsPage() {
  const supabase = createAdminClient();
  const [rules, runs] = await Promise.all([
    listAutomationRules(supabase, 50),
    listRecentAutomationRuns(supabase, 50),
  ]);
  const ruleNameById = new Map(rules.map((rule) => [rule.id, rule.name]));

  const completedRuns = runs.filter((r) => r.status === "completed").length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const successRate =
    runs.length > 0 ? Math.round((completedRuns / runs.length) * 100) : null;

  // Kural bazlı başarı: eldeki son çalıştırma loglarından hesaplanır.
  const runStatsByRule = new Map<string, { total: number; completed: number; failed: number }>();
  for (const run of runs) {
    const stat = runStatsByRule.get(run.rule_id) ?? {
      total: 0,
      completed: 0,
      failed: 0,
    };
    stat.total += 1;
    if (run.status === "completed") stat.completed += 1;
    if (run.status === "failed") stat.failed += 1;
    runStatsByRule.set(run.rule_id, stat);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operasyon"
        title="Otomasyonlar"
        description="Tetikleyici → koşul → aksiyon kuralları. Aksiyonlar panel bildirimi ve onay talebi ile sınırlıdır; her çalıştırma loglanır."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Etkin kural"
          value={`${rules.filter((r) => r.is_enabled).length}/${rules.length}`}
        />
        <KpiCard
          label="Son çalıştırmalar"
          value={String(runs.length)}
          hint="en son 50 log"
        />
        <KpiCard
          label="Başarı oranı"
          value={successRate === null ? "—" : `%${successRate}`}
        />
        <KpiCard
          label="Hata"
          value={String(failedRuns)}
          hint={failedRuns > 0 ? "logları inceleyin" : undefined}
        />
      </div>

      <SectionCard
        title="Yeni kural"
        description="Şablon seçin veya adım adım kendi kuralınızı kurun"
      >
        <AutomationRuleForm />
      </SectionCard>

      <SectionCard
        title={`Kurallar (${rules.length})`}
        contentClassName="p-0"
      >
        {rules.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Workflow}
              compact
              title="Henüz otomasyon kuralı yok"
              description="Yukarıdaki şablonlardan biriyle ilk kuralınızı saniyeler içinde oluşturabilirsiniz."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {rules.map((rule) => {
              const { conditionText, actionText } = describeRule(rule);
              const stats = runStatsByRule.get(rule.id);
              const ruleSuccess =
                stats && stats.total > 0
                  ? Math.round((stats.completed / stats.total) * 100)
                  : null;
              return (
                <li key={rule.id} className="space-y-2 px-4 py-3.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      <StatusBadge tone={rule.is_enabled ? "success" : "neutral"}>
                        {rule.is_enabled ? "Etkin" : "Devre dışı"}
                      </StatusBadge>
                      {ruleSuccess !== null ? (
                        <StatusBadge
                          tone={
                            stats && stats.failed > 0 ? "warning" : "success"
                          }
                          withDot={false}
                        >
                          %{ruleSuccess} başarı ({stats?.total} log)
                        </StatusBadge>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {AUTOMATION_TRIGGER_LABELS[rule.trigger_type]} ·{" "}
                      {rule.run_count} çalıştırma
                      {rule.last_run_at
                        ? ` · Son: ${formatDateTime(rule.last_run_at)}`
                        : " · Henüz çalışmadı"}
                    </span>
                  </div>
                  <div className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-2">
                    <p>
                      <span className="font-medium">Koşul:</span> {conditionText}
                    </p>
                    <p>
                      <span className="font-medium">Aksiyon:</span> {actionText}
                    </p>
                  </div>
                  <AutomationRuleButtons
                    ruleId={rule.id}
                    isEnabled={rule.is_enabled}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Çalıştırma geçmişi"
        description="Her kural çalıştırması loglanır — log'suz otomasyon yok"
        contentClassName="p-0"
      >
        {runs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              compact
              title="Henüz çalıştırma logu yok"
              description="Kurallar tetiklendiğinde her çalıştırma burada listelenecek."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border/60 text-xs">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Zaman
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Kural
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Tetikleyici
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Durum
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Detay
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                      {formatDateTime(run.created_at)}
                    </td>
                    <td className="py-2 pr-3">
                      {ruleNameById.get(run.rule_id) ?? "Silinmiş kural"}
                    </td>
                    <td className="py-2 pr-3">
                      {AUTOMATION_TRIGGER_LABELS[
                        run.trigger_type as AutomationTrigger
                      ] ?? run.trigger_type}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge
                        tone={RUN_STATUS_TONES[run.status] ?? "neutral"}
                      >
                        {AUTOMATION_RUN_STATUS_LABELS[run.status]}
                      </StatusBadge>
                    </td>
                    <td className="text-muted-foreground max-w-64 truncate py-2 pr-4">
                      {run.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
