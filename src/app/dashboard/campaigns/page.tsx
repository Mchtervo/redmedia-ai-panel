import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { listCampaignsAdmin } from "@/features/catalog/repositories/catalog.repository";
import { CampaignToggle } from "@/features/catalog/components/campaign-toggle";

export const metadata: Metadata = { title: "Kampanyalar — Redmedia AI Panel" };

export default async function CampaignsPage() {
  const supabase = createAdminClient();
  const campaigns = await listCampaignsAdmin(supabase);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kampanyalar</h1>
        <p className="text-muted-foreground text-sm">
          Yalnızca aktif kampanyalar fiyat hesabına girer.
        </p>
      </div>
      <ul className="space-y-3">
        {campaigns.map((c) => (
          <li key={c.id} className="border-border rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">{c.name}</div>
                <p className="text-muted-foreground text-sm">{c.description}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {c.campaign_type} · {c.discount_type} · öncelik {c.priority}
                </p>
              </div>
              <CampaignToggle id={c.id} active={c.active} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
