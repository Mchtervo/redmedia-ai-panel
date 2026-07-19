"use client";

import { useState, useTransition } from "react";
import { reviewBrainCandidateAction } from "@/features/ai-brain/actions/brain-actions";
import { Button } from "@/components/ui/button";

type Candidate = {
  id: string;
  title: string;
  category: string;
  proposed_rule: string;
  evidence_summary: string | null;
  confidence_score: number;
  expected_impact: string | null;
  evidence_count: number;
  source_count: number;
};

export function BrainCandidateCard({ candidate }: { candidate: Candidate }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [editedRule, setEditedRule] = useState(candidate.proposed_rule);

  function act(
    action: "approve" | "reject" | "archive" | "test_mode" | "edit_approve"
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await reviewBrainCandidateAction({
        id: candidate.id,
        action,
        proposedRule: action === "edit_approve" ? editedRule : undefined,
      });
      setMessage(result.success ? result.message ?? "Tamam" : result.error);
    });
  }

  return (
    <article className="space-y-3 rounded-lg border p-4 text-sm">
      <div>
        <h3 className="font-medium">{candidate.title}</h3>
        <p className="text-muted-foreground">
          {candidate.category} · güven{" "}
          {Math.round(Number(candidate.confidence_score) * 100)}% · kanıt{" "}
          {candidate.evidence_count}/{candidate.source_count}
        </p>
      </div>
      <p className="whitespace-pre-wrap">{candidate.proposed_rule}</p>
      {candidate.evidence_summary ? (
        <p className="text-muted-foreground text-xs">
          Kanıt: {candidate.evidence_summary}
        </p>
      ) : null}
      {candidate.expected_impact ? (
        <p className="text-xs">Etki: {candidate.expected_impact}</p>
      ) : null}
      <textarea
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        rows={3}
        value={editedRule}
        onChange={(e) => setEditedRule(e.target.value)}
        aria-label="Düzenlenmiş kural"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => act("approve")}
        >
          Onayla
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => act("edit_approve")}
        >
          Düzenleyerek onayla
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => act("test_mode")}
        >
          Test modu
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => act("reject")}
        >
          Reddet
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => act("archive")}
        >
          Arşivle
        </Button>
      </div>
      {message ? (
        <p className="text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </article>
  );
}
