import { formatDateTime } from "@/lib/utils";

type TimelineEvent = {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  actor_type: string;
  occurred_at: string;
};

type DmMessage = {
  id: string;
  sender_type: string;
  content: string | null;
  created_at: string;
};

export function CustomerTimeline({
  events,
  messages,
  adminNotes,
}: {
  events: TimelineEvent[];
  messages: DmMessage[];
  adminNotes: Array<{ id: string; body: string; created_at: string }>;
}) {
  const merged = [
    ...events.map((e) => ({
      id: `e-${e.id}`,
      at: e.occurred_at,
      kind: "event" as const,
      title: e.title,
      body: e.body,
      meta: `${e.actor_type} · ${e.event_type}`,
    })),
    ...messages
      .filter((m) => m.content?.trim())
      .map((m) => ({
        id: `m-${m.id}`,
        at: m.created_at,
        kind: "dm" as const,
        title:
          m.sender_type === "customer"
            ? "DM — Müşteri"
            : m.sender_type === "ai"
              ? "DM — AI"
              : "DM — Personel",
        body: m.content,
        meta: m.sender_type,
      })),
    ...adminNotes.map((n) => ({
      id: `n-${n.id}`,
      at: n.created_at,
      kind: "note" as const,
      title: "Admin notu",
      body: n.body,
      meta: "staff",
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Zaman çizgisi</h2>
      <ul className="space-y-3">
        {merged.map((item) => (
          <li key={item.id} className="border-border border-b pb-3 text-sm last:border-0">
            <div className="text-muted-foreground text-xs">
              {formatDateTime(item.at)} · {item.meta}
            </div>
            <div className="font-medium">{item.title}</div>
            {item.body ? (
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                {item.body}
              </p>
            ) : null}
          </li>
        ))}
        {merged.length === 0 ? (
          <li className="text-muted-foreground text-sm">Henüz kayıt yok.</li>
        ) : null}
      </ul>
    </section>
  );
}
