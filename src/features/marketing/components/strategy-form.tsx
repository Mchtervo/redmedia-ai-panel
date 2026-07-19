"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateStrategyAction } from "@/features/marketing/actions/marketing-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StrategyForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const result = await generateStrategyAction({
            title: String(fd.get("title") ?? ""),
            budgetAmount: Number(fd.get("budgetAmount")),
            periodType: String(fd.get("periodType") ?? "monthly"),
          });
          setMessage(
            result.success
              ? "Strateji taslağı kaydedildi (yalnızca öneri)."
              : result.error
          );
          if (result.success) router.refresh();
        });
      }}
    >
      <div className="flex-1 space-y-1">
        <label className="text-xs" htmlFor="title">
          Başlık
        </label>
        <Input
          id="title"
          name="title"
          required
          placeholder="Örn. Temmuz bütçe dağılımı"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor="budgetAmount">
          Bütçe (TRY)
        </label>
        <Input
          id="budgetAmount"
          name="budgetAmount"
          type="number"
          min={1}
          step="1"
          required
          defaultValue={10000}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor="periodType">
          Dönem
        </label>
        <select
          id="periodType"
          name="periodType"
          className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
          defaultValue="monthly"
        >
          <option value="daily">Günlük</option>
          <option value="weekly">Haftalık</option>
          <option value="monthly">Aylık</option>
          <option value="custom">Özel</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Öneri üret"}
      </Button>
      {message ? (
        <p className="text-muted-foreground w-full text-xs">{message}</p>
      ) : null}
    </form>
  );
}
