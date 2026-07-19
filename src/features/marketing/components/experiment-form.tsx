"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExperimentAction } from "@/features/marketing/actions/marketing-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ExperimentForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const result = await createExperimentAction({
            title: String(fd.get("title") ?? ""),
            experimentType: String(fd.get("experimentType") ?? "creative"),
            hypothesis: String(fd.get("hypothesis") ?? ""),
            changedVariable: String(fd.get("changedVariable") ?? ""),
            budgetAmount: fd.get("budgetAmount")
              ? Number(fd.get("budgetAmount"))
              : undefined,
          });
          setMessage(
            result.success ? "Deney taslağı oluşturuldu." : result.error
          );
          if (result.success) router.refresh();
        });
      }}
    >
      <div className="space-y-1 sm:col-span-2">
        <label className="text-xs" htmlFor="exp-title">
          Başlık
        </label>
        <Input id="exp-title" name="title" required />
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor="experimentType">
          Test türü
        </label>
        <select
          id="experimentType"
          name="experimentType"
          className="border-input h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
          defaultValue="creative"
        >
          <option value="creative">Kreatif</option>
          <option value="audience">Hedef kitle</option>
          <option value="ad_copy">Reklam metni</option>
          <option value="cta">CTA</option>
          <option value="placement">Yerleşim</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor="changedVariable">
          Değiştirilen tek değişken
        </label>
        <Input
          id="changedVariable"
          name="changedVariable"
          required
          placeholder="Örn. kreatif görseli"
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <label className="text-xs" htmlFor="hypothesis">
          Hipotez
        </label>
        <Input id="hypothesis" name="hypothesis" required />
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor="budgetAmount">
          Bütçe (opsiyonel)
        </label>
        <Input id="budgetAmount" name="budgetAmount" type="number" min={0} />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Deney oluştur"}
        </Button>
      </div>
      {message ? (
        <p className="text-muted-foreground sm:col-span-2 text-xs">{message}</p>
      ) : null}
    </form>
  );
}
