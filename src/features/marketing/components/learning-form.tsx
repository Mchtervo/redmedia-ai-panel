"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLearningAction } from "@/features/marketing/actions/marketing-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LearningForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const result = await createLearningAction({
            title: String(fd.get("title") ?? ""),
            description: String(fd.get("description") ?? ""),
            rationale: String(fd.get("rationale") ?? ""),
            confidenceLevel: Number(fd.get("confidenceLevel")),
            supportingExperimentCount: Number(
              fd.get("supportingExperimentCount")
            ),
          });
          setMessage(
            result.success ? "Öğrenim kaydı eklendi." : result.error
          );
          if (result.success) router.refresh();
        });
      }}
    >
      <Input name="title" required placeholder="Başlık" />
      <Input name="description" required placeholder="Açıklama" />
      <Input name="rationale" required placeholder="Gerekçe (zorunlu)" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name="confidenceLevel"
          type="number"
          min={0}
          max={100}
          defaultValue={40}
          required
          aria-label="Güven seviyesi"
        />
        <Input
          name="supportingExperimentCount"
          type="number"
          min={0}
          defaultValue={0}
          required
          aria-label="Destekleyen deney sayısı"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Kaydet"}
      </Button>
      {message ? (
        <p className="text-muted-foreground text-xs">{message}</p>
      ) : null}
    </form>
  );
}
