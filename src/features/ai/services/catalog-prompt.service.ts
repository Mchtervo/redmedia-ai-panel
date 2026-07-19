import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  listActiveCampaigns,
  listActiveServices,
} from "@/features/catalog/repositories/catalog.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

function formatTry(amount: number, currency = "TRY"): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency === "TRY" ? "TRY" : currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Asistan prompt'una enjekte edilen DB katalog özeti.
 * Fiyat/kampanya yalnızca aktif kayıtlardan gelir; uydurma yok.
 */
export async function buildCatalogPromptBlock(
  supabase: TypedSupabaseClient
): Promise<string> {
  const [services, campaigns] = await Promise.all([
    listActiveServices(supabase),
    listActiveCampaigns(supabase),
  ]);

  if (services.length === 0 && campaigns.length === 0) {
    return "(aktif hizmet veya kampanya kaydı yok)";
  }

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const lines: string[] = [];

  if (services.length > 0) {
    lines.push("Hizmetler:");
    for (const service of services) {
      const amount = Number(service.base_price);
      const price =
        amount > 0
          ? formatTry(amount, service.currency)
          : "liste fiyatı panelden girilecek";
      const desc = service.description?.trim()
        ? ` — ${service.description.trim().slice(0, 180)}`
        : "";
      lines.push(`- ${service.name}: ${price}${desc}`);
    }
  }

  if (campaigns.length > 0) {
    lines.push("");
    lines.push("Aktif kampanyalar / paket fırsatları (müşteriye kısa anlat):");
    for (const campaign of campaigns) {
      const requiredNames = campaign.required_service_ids
        .map((id) => serviceById.get(id)?.name)
        .filter((name): name is string => Boolean(name));
      const rewardSvc = campaign.rewarded_service_id
        ? serviceById.get(campaign.rewarded_service_id)
        : null;

      let dealLine = campaign.description?.trim() || campaign.name;
      if (
        campaign.discount_type === "free" &&
        rewardSvc &&
        requiredNames.length > 0
      ) {
        dealLine = `${requiredNames.join(" + ")} seçilirse ${rewardSvc.name} HEDİYE (ücretsiz).`;
      } else if (
        campaign.discount_type === "set_price" &&
        rewardSvc &&
        requiredNames.length > 0
      ) {
        const list = formatTry(
          Number(rewardSvc.base_price),
          rewardSvc.currency
        );
        const camp = formatTry(
          Number(campaign.discount_value),
          rewardSvc.currency
        );
        dealLine = `${requiredNames.join(" + ")} paketinde ${rewardSvc.name}: liste ${list} yerine bu pakete özel ${camp}.`;
      } else if (
        campaign.discount_type === "percentage" &&
        !campaign.rewarded_service_id &&
        requiredNames.length > 0
      ) {
        dealLine = `${requiredNames.join(" + ")} paketinde sepete %${Number(campaign.discount_value)} paket indirimi. Gelin Alma / Salon Giriş / Kuaför kampanya klipleri (3.500) bu orana GİRMEZ.`;
      }

      lines.push(`- ${dealLine}`);
    }
  }

  lines.push("");
  lines.push(
    "Satış dili: Önce samimi ol, sonra erken rezervasyona özel %20 ile Basic 11.000 / Elite 21.000 sun. Tarihler hızla doluyor / zam gelecek diye yumuşak ikna et; sıkma. '3 tarih kaldı' uydurma. Drone hediye yalnız dış çekim kapanışında."
  );

  return lines.join("\n");
}

export type CatalogLabSummary = {
  services: {
    id: string;
    name: string;
    basePrice: number;
    currency: string;
    description: string | null;
  }[];
  campaigns: {
    id: string;
    name: string;
    description: string | null;
    campaignType: string;
    discountType: string;
    discountValue: number;
    requiredServiceNames: string[];
    rewardedServiceName: string | null;
  }[];
};

export async function getCatalogLabSummary(
  supabase: TypedSupabaseClient
): Promise<CatalogLabSummary> {
  const [services, campaigns] = await Promise.all([
    listActiveServices(supabase),
    listActiveCampaigns(supabase),
  ]);
  const serviceById = new Map(services.map((s) => [s.id, s]));

  return {
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      basePrice: Number(s.base_price),
      currency: s.currency,
      description: s.description,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      campaignType: c.campaign_type,
      discountType: c.discount_type,
      discountValue: Number(c.discount_value),
      requiredServiceNames: c.required_service_ids
        .map((id) => serviceById.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
      rewardedServiceName: c.rewarded_service_id
        ? (serviceById.get(c.rewarded_service_id)?.name ?? null)
        : null,
    })),
  };
}
