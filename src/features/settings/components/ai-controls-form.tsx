"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  updateAiFeatureFlagsAction,
  updateDailyAdBudgetAction,
} from "@/features/settings/actions/settings-actions";
import {
  AI_FLAG_KEYS,
  AI_FLAG_LABELS,
  type AiFeatureFlags,
} from "@/features/settings/types";

type AiControlsFormProps = {
  initialFlags: AiFeatureFlags;
  initialDailyBudget: number | null;
};

export function AiControlsForm({
  initialFlags,
  initialDailyBudget,
}: AiControlsFormProps) {
  const [flags, setFlags] = useState(initialFlags);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof AiFeatureFlags) {
    setFlags((current) => {
      const next = { ...current, [key]: !current[key] };
      if (key === "AI_MASTER" && !next.AI_MASTER) {
        for (const k of AI_FLAG_KEYS) {
          if (k !== "AI_MASTER") next[k] = false;
        }
      }
      if (key !== "AI_MASTER" && next[key]) {
        next.AI_MASTER = true;
      }
      return next;
    });
  }

  function saveFlags() {
    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      for (const key of AI_FLAG_KEYS) {
        if (flags[key]) formData.set(key, "on");
      }
      const result = await updateAiFeatureFlagsAction(formData);
      setMessage(
        result.success
          ? "AI kontrolleri kaydedildi."
          : result.error
      );
    });
  }

  function saveBudget(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateDailyAdBudgetAction(formData);
      setMessage(
        result.success ? "Günlük reklam bütçesi kaydedildi." : result.error
      );
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            AI evren anahtarları
          </h2>
          <p className="text-muted-foreground text-sm">
            Her modülü ayrı kapatabilirsiniz. Acil durumda önce &quot;Tüm
            AI&quot;yı kapatın.
          </p>
        </div>

        <ul className="divide-border border-border divide-y rounded-xl border">
          {AI_FLAG_KEYS.map((key) => {
            const meta = AI_FLAG_LABELS[key];
            const checked = flags[key];
            const isMaster = key === "AI_MASTER";
            return (
              <li
                key={key}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p
                    className={
                      isMaster
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "font-medium"
                    }
                  >
                    {meta.title}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {meta.description}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="size-4 accent-[var(--primary)]"
                    aria-label={meta.title}
                  />
                  <span>{checked ? "Açık" : "Kapalı"}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <Button type="button" onClick={saveFlags} disabled={pending}>
          {pending ? "Kaydediliyor…" : "AI kontrollerini kaydet"}
        </Button>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Günlük reklam bütçesi
          </h2>
          <p className="text-muted-foreground text-sm">
            AI Reklam Direktörü bu tutara göre kaç kreatif / strateji önerisi
            üretir. Bütçeyi Meta&apos;da AI değiştirmez.
          </p>
        </div>
        <form action={saveBudget} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Günlük bütçe (TRY)</span>
            <input
              name="daily_ad_budget_try"
              type="number"
              min={0}
              step={50}
              defaultValue={initialDailyBudget ?? ""}
              placeholder="örn. 2000"
              className="border-border bg-background h-9 w-40 rounded-lg border px-3"
            />
          </label>
          <Button type="submit" variant="outline" disabled={pending}>
            Bütçeyi kaydet
          </Button>
        </form>
      </section>

      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
