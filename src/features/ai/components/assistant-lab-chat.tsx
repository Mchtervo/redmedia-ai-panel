"use client";

import { useMemo, useState, useTransition } from "react";
import {
  runAssistantLabStressTestAction,
  sendAssistantLabMessageAction,
} from "@/features/ai/actions/assistant-lab-actions";
import { AssistantLabBrainPanel } from "@/features/ai/components/assistant-lab-brain-panel";
import type { LabBrainTrace } from "@/features/ai/services/lab-brain.service";
import type { SalesBrainSnapshot } from "@/features/ai/services/sales-brain.service";
import {
  LAB_PERSONA_IDS,
  listLabPersonas,
  type LabPersonaId,
} from "@/features/ai/services/lab-stress-customer.service";

type ChatRole = "customer" | "ai";

type ChatBubble = {
  id: string;
  role: ChatRole;
  content: string;
  meta?: string;
};

type Props = {
  labReady: boolean;
  labReadyReason: string | null;
};

const DIFFICULTY_ORDER = { kolay: 0, orta: 1, zor: 2 } as const;

export function AssistantLabChat({ labReady, labReadyReason }: Props) {
  const personas = useMemo(
    () =>
      [...listLabPersonas()].sort(
        (a, b) =>
          DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
          a.label.localeCompare(b.label, "tr")
      ),
    []
  );
  const [personaId, setPersonaId] = useState<LabPersonaId>("kolay_yatkin");
  const selected = personas.find((p) => p.id === personaId) ?? personas[0]!;

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [brainTraces, setBrainTraces] = useState<LabBrainTrace[]>([]);
  const [salesBrain, setSalesBrain] = useState<SalesBrainSnapshot | null>(null);
  const [stressNote, setStressNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetChat() {
    setMessages([]);
    setDraft("");
    setError(null);
    setBrainTraces([]);
    setSalesBrain(null);
    setStressNote(null);
  }

  function send() {
    const text = draft.trim();
    if (!text || pending || !labReady) return;

    const customerBubble: ChatBubble = {
      id: `c-${Date.now()}`,
      role: "customer",
      content: text,
    };

    const historyForApi = messages.map((m) => ({
      senderType: m.role === "customer" ? ("customer" as const) : ("ai" as const),
      content: m.content,
    }));

    setMessages((prev) => [...prev, customerBubble]);
    setDraft("");
    setError(null);
    setStressNote(null);

    startTransition(async () => {
      const result = await sendAssistantLabMessageAction({
        customerMessage: text,
        history: historyForApi,
        salesBrain,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.data.salesBrain) {
        setSalesBrain(result.data.salesBrain);
      }

      setBrainTraces((prev) => [
        ...prev,
        {
          ...result.data.brain,
          turnLabel: `Tur ${prev.length + 1}`,
        },
      ]);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${result.data.aiRunId}`,
          role: "ai",
          content: result.data.reply,
          meta: [
            result.data.model,
            result.data.salesBrain?.state ?? null,
            result.data.brain.salesBrain?.reflectRewritten
              ? "rewrite"
              : null,
            result.data.requiresHumanApproval ? "insan onayı" : null,
            result.data.brain.errors.length > 0
              ? `${result.data.brain.errors.length} hata`
              : "temiz",
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ]);
    });
  }

  function runPersonaTest() {
    if (pending || !labReady) return;
    resetChat();
    setStressNote(`${selected.label} simülasyonu çalışıyor…`);

    startTransition(async () => {
      const result = await runAssistantLabStressTestAction({
        personaId: selected.id,
        turns: selected.defaultTurns,
      });
      if (!result.success) {
        setError(result.error);
        setStressNote(null);
        return;
      }

      const bubbles: ChatBubble[] = [];
      const traces: LabBrainTrace[] = [];
      for (const turn of result.data.turns) {
        bubbles.push({
          id: `c-${turn.aiRunId}`,
          role: "customer",
          content: turn.customerMessage,
          meta: result.data.personaLabel,
        });
        bubbles.push({
          id: `a-${turn.aiRunId}`,
          role: "ai",
          content: turn.reply,
          meta: [
            turn.model,
            turn.brain.errors.length > 0
              ? `${turn.brain.errors.length} hata`
              : "temiz",
          ].join(" · "),
        });
        traces.push(turn.brain);
      }
      setMessages(bubbles);
      setBrainTraces(traces);
      setStressNote(
        `${result.data.personaLabel} bitti: ${result.data.turns.length} tur · ${result.data.totalErrors} gerçekçi hata maddesi. Sıradaki personası seçip tekrar çalıştır.`
      );
    });
  }

  return (
    <div className="space-y-0">
      <div className="border-border flex min-h-[420px] flex-col rounded-lg border">
        <div className="border-border flex flex-col gap-3 border-b px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Test sohbeti</h3>
              <p className="text-muted-foreground text-xs">
                Persona seçip sırayla çalıştırın veya elle müşteri yazın.
                Instagram gitmez; altta beyin paneli güncellenir.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runPersonaTest}
                disabled={pending || !labReady}
                className="border-border hover:bg-muted disabled:opacity-40 rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Bu personası çalıştır
              </button>
              <button
                type="button"
                onClick={resetChat}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
              >
                Sıfırla
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs" htmlFor="lab-persona">
              Müşteri personası
            </label>
            <select
              id="lab-persona"
              value={personaId}
              onChange={(e) => {
                const v = e.target.value;
                if ((LAB_PERSONA_IDS as readonly string[]).includes(v)) {
                  setPersonaId(v as LabPersonaId);
                }
              }}
              disabled={pending || !labReady}
              className="border-border bg-background w-full max-w-xl rounded-md border px-3 py-2 text-sm"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.difficulty.toUpperCase()}] {p.label}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">{selected.description}</p>
          </div>
        </div>

        {!labReady ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-sm">
            {labReadyReason ?? "Laboratuvar şu an kullanılamıyor."}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Öneri sıra: Kolay yatkın → Kafası karışık → İkna edilmek
                  isteyen → Sadece fiyat → Pazarlıkçı → Plato inatçı → Alakasız
                  → Dalga geçen → Sistem dışı → Şikâyet. Her birini seçip
                  &quot;Bu personası çalıştır&quot; deyin.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "customer"
                        ? "ml-8 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900"
                        : "mr-8 border-border rounded-lg border px-3 py-2 text-sm"
                    }
                  >
                    <p className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wide">
                      {m.role === "customer" ? "Müşteri" : "Asistan"}
                      {m.meta ? ` · ${m.meta}` : ""}
                    </p>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))
              )}
              {pending ? (
                <p className="text-muted-foreground text-xs">
                  Yanıt + beyin analizi üretiliyor…
                </p>
              ) : null}
              {stressNote ? (
                <p className="text-muted-foreground text-xs">{stressNote}</p>
              ) : null}
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <form
              className="border-border flex flex-col gap-2 border-t p-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label className="sr-only" htmlFor="lab-chat-input">
                Müşteri mesajı
              </label>
              <textarea
                id="lab-chat-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Elle müşteri mesajı yazın…"
                className="border-border bg-background min-h-[44px] flex-1 resize-y rounded-md border px-3 py-2 text-sm"
                disabled={pending}
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                className="bg-foreground text-background hover:opacity-90 disabled:opacity-40 rounded-md px-4 py-2 text-sm font-medium sm:self-end"
              >
                Gönder
              </button>
            </form>
          </>
        )}
      </div>

      <AssistantLabBrainPanel traces={brainTraces} pending={pending} />
    </div>
  );
}
