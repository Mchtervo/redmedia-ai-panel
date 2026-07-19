"use client";

import { useState, useTransition } from "react";
import {
  reviewKnowledgeAction,
  runLearningBatchAction,
  importConversationsAction,
} from "@/features/learning/actions/learning-actions";
import type { KnowledgeDocumentRow } from "@/features/learning/types";
import { KNOWLEDGE_CATEGORY_LABELS } from "@/features/learning/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  item: KnowledgeDocumentRow;
};

export function PendingKnowledgeCard({ item }: Props) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categoryLabel =
    item.category && item.category in KNOWLEDGE_CATEGORY_LABELS
      ? KNOWLEDGE_CATEGORY_LABELS[
          item.category as keyof typeof KNOWLEDGE_CATEGORY_LABELS
        ]
      : item.category ?? "—";

  function run(action: "approve" | "reject" | "edit") {
    setError(null);
    startTransition(async () => {
      const result = await reviewKnowledgeAction({
        knowledgeId: item.id,
        action,
        title,
        content,
        reviewNotes: notes || undefined,
      });
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <article className="border-border space-y-3 border-b py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{categoryLabel}</p>
        <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
          {item.is_pricing_sensitive ? <span>Fiyat hassas</span> : null}
          {item.is_campaign_claim ? <span>Kampanya iddiası</span> : null}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-muted-foreground text-xs">Başlık</span>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isPending}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-muted-foreground text-xs">İçerik</span>
        <textarea
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-24 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={isPending}
        />
      </label>

      {item.faq_question ? (
        <p className="text-muted-foreground text-sm">
          SSS: {item.faq_question}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-muted-foreground text-xs">Not (opsiyonel)</span>
        <Input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isPending}
        />
      </label>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => run("approve")}
        >
          Onayla
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => run("edit")}
        >
          Düzenle
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run("reject")}
        >
          Reddet
        </Button>
      </div>
    </article>
  );
}

export function LearningToolbar() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [importJson, setImportJson] = useState("");

  function runBatch() {
    setMessage(null);
    startTransition(async () => {
      const result = await runLearningBatchAction();
      setMessage(result.success ? result.message ?? "Tamam." : result.error);
    });
  }

  function runImport() {
    setMessage(null);
    startTransition(async () => {
      const result = await importConversationsAction(importJson);
      setMessage(result.success ? result.message ?? "Tamam." : result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={isPending} onClick={runBatch}>
          Bekleyen konuşmaları analiz et
        </Button>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium">
          Geçmiş konuşma JSON içe aktar
        </span>
        <textarea
          className="border-input bg-background focus-visible:ring-ring min-h-28 w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-2 focus-visible:outline-none"
          placeholder='{"conversations":[...]}'
          value={importJson}
          onChange={(event) => setImportJson(event.target.value)}
          disabled={isPending}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={isPending || !importJson.trim()}
          onClick={runImport}
        >
          İçe aktar ve analiz et
        </Button>
      </label>

      {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}
    </div>
  );
}
