import Link from "next/link";
import type { CorrectionCase } from "@/features/ai/services/correction-case.service";
import { MessageThread } from "@/features/conversations/components/message-thread";
import { RegenerateLostSaleButton } from "@/features/ai/components/regenerate-lost-sale-button";
import { ApplySuggestedReplyForm } from "@/features/ai/components/apply-suggested-reply-form";
import type { QualityFactor } from "@/features/ai/services/conversation-quality.service";

function FactorList({ factors }: { factors: QualityFactor[] }) {
  return (
    <ul className="mt-2 space-y-1.5 text-sm">
      {factors.map((f) => (
        <li
          key={`${f.sign}-${f.label}`}
          className="flex items-center justify-between gap-3"
        >
          <span>{f.label}</span>
          <span
            className={
              f.sign === "+"
                ? "font-medium tabular-nums"
                : "text-muted-foreground font-medium tabular-nums"
            }
          >
            {f.sign}
            {f.delta}
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function CorrectionCaseView({ data }: { data: CorrectionCase }) {
  const { quality, prediction } = data;

  const reasonStats = data.successForReason;
  const successHint = reasonStats
    ? `Bu kayıp nedeninde öneri ${reasonStats.applied} kez uygulandı → ${reasonStats.reservations} rezervasyon (%${reasonStats.reservationRatePct}). Genel başarı: %${data.overallSuccessRatePct}.`
    : data.overallSuccessRatePct > 0
      ? `Genel öneri başarı oranı: %${data.overallSuccessRatePct}. Bu kayıp nedeninde henüz uygulama yok.`
      : "Henüz yeterli uygulama yok — gönderdikçe başarı oranı dolacak.";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">
            <Link href="/dashboard/ai" className="hover:underline">
              Outcome Intelligence
            </Link>
            {" · "}
            Düzeltme vakası
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {data.contactName ?? "Konuşma"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Skor {quality.score} · {quality.grade}
            {!data.isProduction ? " · (üretim dışı — dikkat)" : ""}
            {data.alreadyApplied ? " · öneri daha önce uygulandı" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/inbox/${data.conversationId}`}
            className="border-border hover:bg-muted rounded-md border px-3 py-2 text-sm font-medium"
          >
            Inbox’ta aç
          </Link>
          {data.linkedReservation ? (
            <Link
              href={`/dashboard/reservations/${data.linkedReservation.id}`}
              className="border-border hover:bg-muted rounded-md border px-3 py-2 text-sm font-medium"
            >
              Rezervasyon ({data.linkedReservation.status})
            </Link>
          ) : null}
          <RegenerateLostSaleButton conversationId={data.conversationId} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border flex min-h-[420px] flex-col rounded-lg border">
          <div className="border-border border-b px-4 py-3">
            <h2 className="font-semibold">Tam konuşma</h2>
          </div>
          <div className="max-h-[70vh] flex-1 overflow-hidden">
            <MessageThread messages={data.messages} />
          </div>
        </section>

        <div className="space-y-4">
          <section className="border-border rounded-lg border p-4">
            <h2 className="font-semibold">Quality Score — nedenler</h2>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {quality.score}
            </p>
            <FactorList factors={quality.factors} />
          </section>

          <section className="border-border rounded-lg border p-4">
            <h2 className="font-semibold">Kayıp nedeni</h2>
            <p className="mt-2 text-sm font-medium">{data.lossReasonLabel}</p>
            {data.lostSale?.whyLost ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {data.lostSale.whyLost}
              </p>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                Deterministik analiz. Daha derin analiz için “Kayıp analizi
                yenile”.
              </p>
            )}
          </section>

          {prediction ? (
            <section className="border-border rounded-lg border p-4">
              <h2 className="font-semibold">Tekrar yazma tahmini</h2>
              <p className="mt-2 text-sm">
                Müşteri tahminen{" "}
                <span className="font-medium">
                  {formatWhen(prediction.predictedReplyAt)}
                </span>{" "}
                yazar (~{prediction.predictedReplyHours} saat, güven:{" "}
                {prediction.confidence === "high"
                  ? "yüksek"
                  : prediction.confidence === "medium"
                    ? "orta"
                    : "düşük"}
                ).
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {prediction.basis}
              </p>
              <p className="mt-2 text-sm">
                Önerilen takip:{" "}
                <span className="font-medium">
                  {formatWhen(prediction.recommendedFollowUpAt)}
                </span>
              </p>
            </section>
          ) : null}

          <section className="border-border rounded-lg border p-4">
            <h2 className="font-semibold">Önerilen cevap — uygula</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Fiyat uydurmayın; katalog dışı rakam yazmayın. İndirim / iptal /
              şikâyet → insan onayı.
            </p>
            <div className="mt-3">
              <ApplySuggestedReplyForm
                conversationId={data.conversationId}
                initialText={
                  prediction?.followUpSuggestion &&
                  data.alternativeReply.length < 20
                    ? prediction.followUpSuggestion
                    : data.alternativeReply
                }
                lossReason={data.lossReasonLabel}
                alreadyApplied={data.alreadyApplied}
                successHint={successHint}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
