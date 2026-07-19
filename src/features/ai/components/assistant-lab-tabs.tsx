"use client";

import { useState } from "react";
import { AssistantLabChat } from "@/features/ai/components/assistant-lab-chat";
import { SalesBenchmarkPanel } from "@/features/ai/components/sales-benchmark-panel";
import { AdversarialBenchmarkPanel } from "@/features/ai/components/adversarial-benchmark-panel";
import { HumanVsAiPanel } from "@/features/ai/components/human-vs-ai-panel";

type Props = {
  labReady: boolean;
  labReadyReason: string | null;
};

type LabTab = "chat" | "benchmark" | "adversarial" | "human_vs_ai";

export function AssistantLabTabs({ labReady, labReadyReason }: Props) {
  const [tab, setTab] = useState<LabTab>("chat");

  const tabs: { id: LabTab; label: string }[] = [
    { id: "chat", label: "Test sohbeti" },
    { id: "benchmark", label: "Sales Benchmark" },
    { id: "adversarial", label: "Adversarial" },
    { id: "human_vs_ai", label: "Human vs AI" },
  ];

  return (
    <div className="space-y-3">
      <div
        className="border-border flex flex-wrap gap-1 border-b"
        role="tablist"
        aria-label="Laboratuvar sekmeleri"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-foreground border-b-2"
                : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <AssistantLabChat
          labReady={labReady}
          labReadyReason={labReadyReason}
        />
      ) : null}
      {tab === "benchmark" ? <SalesBenchmarkPanel /> : null}
      {tab === "adversarial" ? <AdversarialBenchmarkPanel /> : null}
      {tab === "human_vs_ai" ? <HumanVsAiPanel /> : null}
    </div>
  );
}
