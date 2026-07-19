import type { ReactNode } from "react";
import type { LearningDashboardData } from "@/features/learning/types";
import {
  LearningToolbar,
  PendingKnowledgeCard,
} from "@/features/learning/components/learning-panel-client";
import { buildLearningIntelligenceBriefs } from "@/features/intelligence/services/learning-briefs.service";
import { IntelligenceBriefList } from "@/features/intelligence/components/intelligence-brief-card";
import { dedupeKnowledgeByTitle } from "@/features/learning/utils/dedupe-knowledge";

type Props = {
  data: LearningDashboardData;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border space-y-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function LearningDashboard({ data }: Props) {
  const { stats } = data;
  const briefs = buildLearningIntelligenceBriefs(data.recentAnalyses, {
    maxClusters: 5,
  });
  const pendingUnique = dedupeKnowledgeByTitle(data.pendingKnowledge);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Öğrenme detayları
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Geçmiş konuşmalardan satış dili, SSS ve itiraz kalıplarını çıkarır.
          AI yalnızca onayladığınız bilgileri kullanır. Benzer analizler ve
          aynı başlıklı öneriler tek kartta birleştirilir.
        </p>
      </div>

      {briefs.length > 0 ? (
        <Section title="AI Intelligence (birleştirilmiş)">
          <p className="text-muted-foreground -mt-1 mb-2 text-xs">
            Aynı niyet/sonuç tekrarları tek özette; her konuşma için ayrı kart
            yok.
          </p>
          <IntelligenceBriefList briefs={briefs} />
        </Section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Analiz edilen konuşma"
          value={stats.analyzedConversationCount}
        />
        <StatCard
          label="Çıkarılan bilgi"
          value={stats.proposedKnowledgeCount}
        />
        <StatCard label="Onay bekleyen" value={stats.pendingKnowledgeCount} />
        <StatCard label="Onaylı" value={stats.approvedKnowledgeCount} />
      </div>

      <Section title="İşlemler">
        <LearningToolbar />
      </Section>

      <Section title="Onay bekleyen bilgiler">
        {pendingUnique.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Bekleyen bilgi yok.
          </p>
        ) : (
          <>
            {data.pendingKnowledge.length > pendingUnique.length ? (
              <p className="text-muted-foreground text-xs">
                {data.pendingKnowledge.length} öneriden{" "}
                {pendingUnique.length} benzersiz başlık gösteriliyor (tekrarlar
                gizlendi).
              </p>
            ) : null}
            {pendingUnique.map((item) => (
              <PendingKnowledgeCard key={item.id} item={item} />
            ))}
          </>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Sık sorulan sorular">
          {data.faqs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz SSS yok.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {data.faqs.map((item) => (
                <li key={item.id}>
                  <p className="font-medium">{item.faq_question}</p>
                  <p className="text-muted-foreground">
                    {item.suggested_answer ?? item.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Müşteri itirazları">
          {data.objections.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz itiraz kaydı yok.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {data.objections.map((item) => (
                <li key={item.id}>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground">{item.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Başarılı cevap örnekleri">
          {data.goodReplies.length === 0 ? (
            <p className="text-muted-foreground text-sm">Örnek yok.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {data.goodReplies.map((item) => (
                <li key={item.id} className="text-muted-foreground">
                  {item.example_good_reply}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Başarısız cevap örnekleri">
          {data.badReplies.length === 0 ? (
            <p className="text-muted-foreground text-sm">Örnek yok.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {data.badReplies.map((item) => (
                <li key={item.id} className="text-muted-foreground">
                  {item.example_bad_reply}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Son konuşma analizleri">
        {data.recentAnalyses.length === 0 ? (
          <p className="text-muted-foreground text-sm">Analiz yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Niyet</th>
                  <th className="py-2 pr-3 font-medium">Skor</th>
                  <th className="py-2 pr-3 font-medium">Sıcaklık</th>
                  <th className="py-2 pr-3 font-medium">Sonuç</th>
                  <th className="py-2 font-medium">Sonraki aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAnalyses.map((row) => (
                  <tr key={row.id} className="border-border border-b">
                    <td className="py-2 pr-3">
                      {row.customer_intent ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.lead_score ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {row.lead_temperature === "hot"
                        ? "Sıcak"
                        : row.lead_temperature === "warm"
                          ? "Ilık"
                          : row.lead_temperature === "cold"
                            ? "Soğuk"
                            : "—"}
                    </td>
                    <td className="py-2 pr-3">{row.sale_outcome}</td>
                    <td className="py-2">{row.next_action ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
