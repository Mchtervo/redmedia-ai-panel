import { MarketingSubnavClient } from "@/features/marketing/components/marketing-subnav-client";
import { PageHeader } from "@/components/dashboard/page-header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Pazarlama"
        title="AI Marketing Director"
        description="Meta reklamları, Instagram içerikleri ve CRM kaynağı — yalnızca analiz ve öneri. Kampanya kapatma / bütçe değişikliği yapılmaz."
      />
      <MarketingSubnavClient />
      {children}
    </div>
  );
}
