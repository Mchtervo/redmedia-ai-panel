import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  listActiveCampaigns,
  listServicesByIds,
} from "@/features/catalog/repositories/catalog.repository";
import { calculatePackageQuote } from "@/features/pricing/services/pricing.service";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getReservationSettings(
  supabase: TypedSupabaseClient
) {
  const { data, error } = await supabase
    .from("reservation_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function quoteServicesByIds(
  supabase: TypedSupabaseClient,
  serviceIds: string[],
  onDate?: string
) {
  const [services, campaigns, settings] = await Promise.all([
    listServicesByIds(supabase, serviceIds),
    listActiveCampaigns(supabase),
    getReservationSettings(supabase),
  ]);

  const deposit = Number(settings?.default_deposit_amount ?? 1000);

  return calculatePackageQuote({
    depositAmount: deposit,
    onDate,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      basePrice: Number(s.base_price),
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      campaignType: c.campaign_type,
      discountType: c.discount_type as
        | "fixed"
        | "percentage"
        | "set_price"
        | "free",
      discountValue: Number(c.discount_value),
      requiredServiceIds: c.required_service_ids ?? [],
      rewardedServiceId: c.rewarded_service_id,
      priority: c.priority,
      startDate: c.start_date,
      endDate: c.end_date,
      active: c.active,
    })),
  });
}
