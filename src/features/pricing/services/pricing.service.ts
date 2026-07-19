/**
 * Paket fiyat hesabı — yalnızca DB'den gelen fiyat ve kampanyalar.
 * Prompt içinden fiyat üretilmez.
 */

export type PricedServiceInput = {
  id: string;
  name: string;
  basePrice: number;
  quantity?: number;
};

export type ActiveCampaignInput = {
  id: string;
  name: string;
  campaignType: string;
  discountType: "fixed" | "percentage" | "set_price" | "free";
  discountValue: number;
  requiredServiceIds: string[];
  rewardedServiceId: string | null;
  priority: number;
  startDate?: string | null;
  endDate?: string | null;
  active: boolean;
};

export type PricedLineItem = {
  serviceId: string;
  serviceName: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  finalPrice: number;
  appliedCampaignId?: string | null;
};

export type PackageQuote = {
  lines: PricedLineItem[];
  subtotal: number;
  discountAmount: number;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  appliedCampaignNames: string[];
};

function campaignIsActive(
  campaign: ActiveCampaignInput,
  onDate: string
): boolean {
  if (!campaign.active) {
    return false;
  }
  if (campaign.startDate && onDate < campaign.startDate) {
    return false;
  }
  if (campaign.endDate && onDate > campaign.endDate) {
    return false;
  }
  return true;
}

function hasAllRequired(
  selectedIds: Set<string>,
  required: string[]
): boolean {
  return required.every((id) => selectedIds.has(id));
}

/**
 * Seçilen hizmetler + aktif kampanyalar → paket teklifi.
 * Dış çekim foto+klip+albümler → drone free; aynı paket → gelin/salon klip set_price 3500.
 */
export function calculatePackageQuote(params: {
  services: PricedServiceInput[];
  campaigns: ActiveCampaignInput[];
  depositAmount: number;
  onDate?: string;
}): PackageQuote {
  const onDate =
    params.onDate ?? new Date().toISOString().slice(0, 10);
  const selectedIds = new Set(params.services.map((s) => s.id));

  const lines: PricedLineItem[] = params.services.map((service) => {
    const quantity = service.quantity ?? 1;
    return {
      serviceId: service.id,
      serviceName: service.name,
      unitPrice: service.basePrice,
      quantity,
      discountAmount: 0,
      finalPrice: service.basePrice * quantity,
      appliedCampaignId: null,
    };
  });

  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0
  );

  const applicable = [...params.campaigns]
    .filter((c) => campaignIsActive(c, onDate))
    .filter((c) => hasAllRequired(selectedIds, c.requiredServiceIds))
    .sort((a, b) => a.priority - b.priority);

  const appliedCampaignNames: string[] = [];
  /** set_price uygulanan satırlar — sepet % indirimine girmez (gelin/salon/kuaför 3.500) */
  const setPriceServiceIds = new Set<string>();

  for (const campaign of applicable) {
    // Sepet yüzdesi: rewarded yok → set_price / bedava satırlar hariç tüm sepete
    if (
      campaign.discountType === "percentage" &&
      !campaign.rewardedServiceId
    ) {
      continue; // set_price / free önce; yüzde ikinci turda
    }

    const rewardedId = campaign.rewardedServiceId;
    if (!rewardedId) {
      continue;
    }

    const line = lines.find((item) => item.serviceId === rewardedId);
    if (!line) {
      continue;
    }

    if (campaign.discountType === "free") {
      line.discountAmount = line.finalPrice;
      line.finalPrice = 0;
      line.appliedCampaignId = campaign.id;
      appliedCampaignNames.push(campaign.name);
    } else if (campaign.discountType === "set_price") {
      const target = campaign.discountValue * line.quantity;
      const before = line.unitPrice * line.quantity;
      line.finalPrice = Math.max(0, target);
      line.discountAmount = Math.max(0, before - line.finalPrice);
      line.appliedCampaignId = campaign.id;
      setPriceServiceIds.add(line.serviceId);
      appliedCampaignNames.push(campaign.name);
    } else if (campaign.discountType === "fixed") {
      const cut = Math.min(line.finalPrice, campaign.discountValue);
      line.discountAmount += cut;
      line.finalPrice -= cut;
      line.appliedCampaignId = campaign.id;
      appliedCampaignNames.push(campaign.name);
    } else if (campaign.discountType === "percentage") {
      const cut = (line.finalPrice * campaign.discountValue) / 100;
      line.discountAmount += cut;
      line.finalPrice -= cut;
      line.appliedCampaignId = campaign.id;
      appliedCampaignNames.push(campaign.name);
    }
  }

  // Paket sepet indirimi (%): kampanya klipleri (set_price) ve 0 TL hediyeler hariç
  for (const campaign of applicable) {
    if (
      campaign.discountType !== "percentage" ||
      campaign.rewardedServiceId
    ) {
      continue;
    }
    let applied = false;
    for (const line of lines) {
      if (setPriceServiceIds.has(line.serviceId)) {
        continue;
      }
      if (line.finalPrice <= 0) {
        continue;
      }
      const cut = (line.finalPrice * campaign.discountValue) / 100;
      if (cut <= 0) {
        continue;
      }
      line.discountAmount += cut;
      line.finalPrice = Math.max(0, line.finalPrice - cut);
      line.appliedCampaignId = campaign.id;
      applied = true;
    }
    if (applied) {
      appliedCampaignNames.push(campaign.name);
    }
  }

  // Bundle free_item: if campaign requires A+B and rewards C, C must be in cart
  for (const campaign of applicable) {
    if (campaign.discountType !== "free" || !campaign.rewardedServiceId) {
      continue;
    }
    const line = lines.find(
      (item) => item.serviceId === campaign.rewardedServiceId
    );
    if (line && line.finalPrice > 0 && !line.appliedCampaignId) {
      line.discountAmount = line.finalPrice;
      line.finalPrice = 0;
      line.appliedCampaignId = campaign.id;
      if (!appliedCampaignNames.includes(campaign.name)) {
        appliedCampaignNames.push(campaign.name);
      }
    }
  }

  const discountAmount = lines.reduce(
    (sum, line) => sum + line.discountAmount,
    0
  );
  const totalPrice = Math.max(
    0,
    lines.reduce((sum, line) => sum + line.finalPrice, 0)
  );
  const depositAmount = Math.min(params.depositAmount, totalPrice);
  const remainingAmount = Math.max(0, totalPrice - depositAmount);

  return {
    lines,
    subtotal,
    discountAmount,
    totalPrice,
    depositAmount,
    remainingAmount,
    appliedCampaignNames,
  };
}
