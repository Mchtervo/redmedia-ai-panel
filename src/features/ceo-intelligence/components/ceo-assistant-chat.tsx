"use client";

import { useState, useTransition } from "react";
import { askCeoAssistantAction } from "@/features/ceo-intelligence/actions/ceo-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Bugün kaç kişi kapora bekliyor?",
  "Bu ay kaç rezervasyon aldık?",
  "En çok hangi paket satılıyor?",
  "Bu hafta boş günümüz var mı?",
  "Bugün yapılması gereken işler neler?",
];

export function CeoAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    startTransition(async () => {
      const result = await askCeoAssistantAction({ question: q });
      const answer = result.success
        ? result.answer
        : result.error;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-lg font-medium">AI Yönetim Asistanı</h2>
        <p className="text-muted-foreground text-sm">
          Yalnızca sistem verisine göre cevap verir; fiyat/kampanya/personel/ödeme
          değiştirmez.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-md border px-2 py-1 text-left text-xs hover:bg-muted"
            onClick={() => send(s)}
            disabled={pending}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">
            Örn. &quot;Dün neden satış düştü?&quot; veya &quot;En çok hangi plato
            tercih ediliyor?&quot;
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={
                m.role === "user"
                  ? "ml-6 rounded-lg bg-primary/10 px-3 py-2"
                  : "mr-6 rounded-lg border bg-background px-3 py-2"
              }
            >
              <div className="text-muted-foreground mb-0.5 text-[10px] uppercase">
                {m.role === "user" ? "Siz" : "CEO AI"}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))
        )}
        {pending ? (
          <p className="text-muted-foreground text-xs">Analiz ediliyor…</p>
        ) : null}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Yönetim sorunuzu yazın…"
          aria-label="Yönetim asistanı sorusu"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          Sor
        </Button>
      </form>
    </section>
  );
}
