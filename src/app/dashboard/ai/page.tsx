import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { getLearningDashboardData } from "@/features/learning/services/learning-dashboard.service";
import { LearningDashboard } from "@/features/learning/components/learning-dashboard";
import { getSalesLearningDashboardData } from "@/features/sales-learning/services/sales-learning-dashboard.service";
import { SalesLearningDashboard } from "@/features/sales-learning/components/sales-learning-dashboard";
import { getAssistantLabDashboardData } from "@/features/ai/services/assistant-lab.service";
import { AssistantLabPanel } from "@/features/ai/components/assistant-lab-panel";
import { getOutcomeIntelligenceDashboard } from "@/features/ai/services/outcome-kpi.service";
import { OutcomeIntelligencePanel } from "@/features/ai/components/outcome-intelligence-panel";

export const metadata: Metadata = {
  title: "Asistan Laboratuvarı — Redmedia AI Panel",
};

export default async function AiLearningPage() {
  const supabase = createAdminClient();
  const [lab, data, salesLearning, outcomeIntel] = await Promise.all([
    getAssistantLabDashboardData(supabase),
    getLearningDashboardData(supabase),
    getSalesLearningDashboardData(supabase),
    getOutcomeIntelligenceDashboard(supabase),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12">
      <AssistantLabPanel data={lab} />
      <OutcomeIntelligencePanel data={outcomeIntel} />
      <LearningDashboard data={data} />
      <SalesLearningDashboard data={salesLearning} />
    </div>
  );
}
