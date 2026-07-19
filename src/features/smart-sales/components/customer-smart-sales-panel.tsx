"use client";

import { useState, useTransition } from "react";
import {
  addAdminNoteAction,
  updateCustomerTagsAction,
  updateLifecycleStageAction,
} from "@/features/smart-sales/actions/smart-sales-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGES,
  SALES_TAG_OPTIONS,
  type LifecycleStage,
} from "@/features/smart-sales/types";

export function CustomerSmartSalesPanel({
  contactId,
  lifecycleStage,
  tags,
  opportunityScore,
}: {
  contactId: string;
  lifecycleStage: string;
  tags: string[];
  opportunityScore: number;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>(tags);
  const [stage, setStage] = useState(lifecycleStage);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Akıllı satış</h2>
        <span className="tabular-nums">
          Opportunity Score: {opportunityScore}/100{" "}
          <span className="text-muted-foreground">(tahmini)</span>
        </span>
      </div>

      <label className="block space-y-1">
        <span className="text-muted-foreground text-xs">Yaşam döngüsü</span>
        <select
          className="border-input bg-background w-full rounded-md border px-3 py-2"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          {LIFECYCLE_STAGES.map((s) => (
            <option key={s} value={s}>
              {LIFECYCLE_STAGE_LABELS[s as LifecycleStage]}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await updateLifecycleStageAction(contactId, stage);
            setMessage(r.success ? r.message ?? "Tamam" : r.error);
          })
        }
      >
        Aşamayı kaydet
      </Button>

      <fieldset className="space-y-2">
        <legend className="text-muted-foreground text-xs">Etiketler</legend>
        <div className="flex flex-wrap gap-2">
          {SALES_TAG_OPTIONS.map((tag) => (
            <label
              key={tag}
              className="border-border flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => toggleTag(tag)}
              />
              {tag}
            </label>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const r = await updateCustomerTagsAction(contactId, selectedTags);
              setMessage(r.success ? r.message ?? "Tamam" : r.error);
            })
          }
        >
          Etiketleri kaydet
        </Button>
      </fieldset>

      <div className="space-y-2">
        <label className="text-muted-foreground text-xs block">
          Admin notu (müşteriye görünmez; AI dikkate alır ama söylemez)
        </label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Örn. Daha önce pazarlık yaptı."
        />
        <Button
          type="button"
          size="sm"
          disabled={isPending || note.trim().length < 2}
          onClick={() =>
            startTransition(async () => {
              const r = await addAdminNoteAction(contactId, note);
              setMessage(r.success ? r.message ?? "Tamam" : r.error);
              if (r.success) setNote("");
            })
          }
        >
          Not ekle
        </Button>
      </div>

      {message ? (
        <p className="text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
