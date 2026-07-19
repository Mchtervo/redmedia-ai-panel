import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  automationActionsSchema,
  automationConditionsSchema,
  type AutomationAction,
  type AutomationCondition,
  type AutomationEventContext,
  type AutomationRuleRow,
  type AutomationTrigger,
} from "@/features/automations/types";
import {
  insertAutomationRun,
  listEnabledRulesForTrigger,
  markRuleExecuted,
} from "@/features/automations/repositories/automations.repository";
import { createPanelNotification } from "@/features/notifications/services/notifications.service";
import { createApprovalRequest } from "@/features/approvals/repositories/approvals.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

function contextValue(
  context: AutomationEventContext,
  field: string
): string | number | undefined {
  const value = context[field as keyof AutomationEventContext];
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
}

export function evaluateCondition(
  condition: AutomationCondition,
  context: AutomationEventContext
): boolean {
  const actual = contextValue(context, condition.field);
  if (actual === undefined) return false;

  switch (condition.op) {
    case "contains":
      return String(actual)
        .toLocaleLowerCase("tr-TR")
        .includes(String(condition.value).toLocaleLowerCase("tr-TR"));
    case "not_contains":
      return !String(actual)
        .toLocaleLowerCase("tr-TR")
        .includes(String(condition.value).toLocaleLowerCase("tr-TR"));
    case "equals":
      return String(actual) === String(condition.value);
    case "gt":
      return Number(actual) > Number(condition.value);
    case "lt":
      return Number(actual) < Number(condition.value);
  }
}

async function executeAction(
  supabase: TypedSupabaseClient,
  action: AutomationAction,
  rule: AutomationRuleRow,
  context: AutomationEventContext
): Promise<void> {
  switch (action.type) {
    case "panel_notification": {
      await createPanelNotification(supabase, {
        type: "automation",
        title: action.params.title,
        body: action.params.body ?? null,
        payload: { ruleId: rule.id, ruleName: rule.name },
        reservationId: context.reservationId ?? null,
      });
      return;
    }
    case "approval_request": {
      await createApprovalRequest(supabase, {
        actionType: "other",
        title: action.params.title,
        payload: { ruleId: rule.id, ruleName: rule.name },
        conversationId: context.conversationId ?? null,
        contactId: context.contactId ?? null,
      });
      return;
    }
  }
}

export type AutomationEngineResult = {
  matchedRules: number;
  executedRules: number;
};

/**
 * Automation Engine (docs/14, docs/32): olay geldiğinde etkin kuralları
 * yükler, koşulları değerlendirir, aksiyonları çalıştırır ve her kural
 * çalıştırmasını automation_runs'a loglar. Hatalar çağıran akışı bozmaz.
 */
export async function runAutomationsForEvent(
  supabase: TypedSupabaseClient,
  trigger: AutomationTrigger,
  context: AutomationEventContext
): Promise<AutomationEngineResult> {
  let rules: AutomationRuleRow[] = [];
  try {
    rules = await listEnabledRulesForTrigger(supabase, trigger);
  } catch (error) {
    console.error(
      "[automation] kurallar yüklenemedi:",
      error instanceof Error ? error.message : "bilinmeyen"
    );
    return { matchedRules: 0, executedRules: 0 };
  }

  let matchedRules = 0;
  let executedRules = 0;

  // Log context'inde hassas içerik (mesaj metni) tutulmaz; yalnızca ID'ler.
  const logContext = {
    reservationId: context.reservationId ?? null,
    conversationId: context.conversationId ?? null,
    contactId: context.contactId ?? null,
  };

  for (const rule of rules) {
    try {
      const conditions = automationConditionsSchema.safeParse(rule.conditions);
      const actions = automationActionsSchema.safeParse(rule.actions);

      if (!conditions.success || !actions.success) {
        await insertAutomationRun(supabase, {
          ruleId: rule.id,
          triggerType: trigger,
          status: "failed",
          detail: "Kural tanımı geçersiz (koşul/aksiyon şeması).",
          context: logContext,
        });
        continue;
      }

      const allMatch = conditions.data.every((condition) =>
        evaluateCondition(condition, context)
      );
      if (!allMatch) {
        await insertAutomationRun(supabase, {
          ruleId: rule.id,
          triggerType: trigger,
          status: "skipped",
          detail: "Koşullar sağlanmadı.",
          context: logContext,
        });
        continue;
      }

      matchedRules += 1;
      for (const action of actions.data) {
        await executeAction(supabase, action, rule, context);
      }
      executedRules += 1;

      await insertAutomationRun(supabase, {
        ruleId: rule.id,
        triggerType: trigger,
        status: "completed",
        detail: `${actions.data.length} aksiyon çalıştırıldı.`,
        context: logContext,
      });
      await markRuleExecuted(supabase, rule);
    } catch (error) {
      console.error(
        "[automation] kural çalıştırma hatası:",
        error instanceof Error ? error.message : "bilinmeyen"
      );
      try {
        await insertAutomationRun(supabase, {
          ruleId: rule.id,
          triggerType: trigger,
          status: "failed",
          detail:
            error instanceof Error
              ? error.message.slice(0, 300)
              : "Bilinmeyen hata",
          context: logContext,
        });
      } catch {
        // Log hatası ana akışı durdurmaz.
      }
    }
  }

  return { matchedRules, executedRules };
}
