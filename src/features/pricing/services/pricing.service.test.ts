import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculatePackageQuote } from "@/features/pricing/services/pricing.service";

const DIS_PHOTO = "b2000001-0001-4000-8000-000000000001";
const DIS_VIDEO = "b2000001-0001-4000-8000-000000000002";
const DIS_DRONE = "b2000001-0001-4000-8000-000000000003";
const BUYUK_ALBUM = "b2000001-0001-4000-8000-000000000071";
const IKI_AILE = "b2000001-0001-4000-8000-000000000072";
const GELIN_KLIP = "b2000001-0001-4000-8000-000000000014";
const SALON_KLIP = "b2000001-0001-4000-8000-000000000064";
const KUAFOR_KLIP = "b2000001-0001-4000-8000-000000000034";

const BUNDLE_REQUIRED = [DIS_PHOTO, DIS_VIDEO, BUYUK_ALBUM, IKI_AILE];

const CART_PERCENT = {
  id: "c5",
  name: "Sepet %20",
  campaignType: "percentage",
  discountType: "percentage" as const,
  discountValue: 20,
  requiredServiceIds: BUNDLE_REQUIRED,
  rewardedServiceId: null,
  priority: 40,
  active: true,
};

describe("calculatePackageQuote", () => {
  it("dış çekim paketinde drone ücretsiz + sepet %20 olur", () => {
    const quote = calculatePackageQuote({
      depositAmount: 1000,
      services: [
        { id: DIS_PHOTO, name: "Fotoğraf", basePrice: 5000 },
        { id: DIS_VIDEO, name: "Video", basePrice: 5000 },
        { id: BUYUK_ALBUM, name: "Büyük Albüm", basePrice: 3000 },
        { id: IKI_AILE, name: "2 Aile Albümü", basePrice: 2000 },
        { id: DIS_DRONE, name: "Drone", basePrice: 4000 },
      ],
      campaigns: [
        {
          id: "c1",
          name: "Drone hediye",
          campaignType: "free_item",
          discountType: "free",
          discountValue: 0,
          requiredServiceIds: BUNDLE_REQUIRED,
          rewardedServiceId: DIS_DRONE,
          priority: 10,
          active: true,
        },
        CART_PERCENT,
      ],
    });

    const drone = quote.lines.find((l) => l.serviceId === DIS_DRONE);
    assert.equal(drone?.finalPrice, 0);
    // 15000 × 0.8 (drone 0)
    assert.equal(quote.totalPrice, 12000);
    assert.equal(quote.discountAmount, 7000); // 4000 hediye + 3000 %20
  });

  it("kampanya klipleri 3500 kalır, sepet %20 yalnızca diğerlerine uygulanır", () => {
    const quote = calculatePackageQuote({
      depositAmount: 1000,
      services: [
        { id: DIS_PHOTO, name: "Fotoğraf", basePrice: 5000 },
        { id: DIS_VIDEO, name: "Video", basePrice: 5000 },
        { id: BUYUK_ALBUM, name: "Büyük Albüm", basePrice: 3000 },
        { id: IKI_AILE, name: "2 Aile Albümü", basePrice: 2000 },
        { id: DIS_DRONE, name: "Drone", basePrice: 4000 },
        { id: GELIN_KLIP, name: "Gelin Alma", basePrice: 5000 },
        { id: SALON_KLIP, name: "Salon Giriş", basePrice: 5000 },
        { id: KUAFOR_KLIP, name: "Kuaför", basePrice: 5000 },
      ],
      campaigns: [
        {
          id: "c1",
          name: "Drone hediye",
          campaignType: "free_item",
          discountType: "free",
          discountValue: 0,
          requiredServiceIds: BUNDLE_REQUIRED,
          rewardedServiceId: DIS_DRONE,
          priority: 10,
          active: true,
        },
        {
          id: "c3",
          name: "Gelin 3500",
          campaignType: "fixed_price",
          discountType: "set_price",
          discountValue: 3500,
          requiredServiceIds: BUNDLE_REQUIRED,
          rewardedServiceId: GELIN_KLIP,
          priority: 20,
          active: true,
        },
        {
          id: "c2",
          name: "Kuaför 3500",
          campaignType: "fixed_price",
          discountType: "set_price",
          discountValue: 3500,
          requiredServiceIds: BUNDLE_REQUIRED,
          rewardedServiceId: KUAFOR_KLIP,
          priority: 25,
          active: true,
        },
        {
          id: "c4",
          name: "Salon 3500",
          campaignType: "fixed_price",
          discountType: "set_price",
          discountValue: 3500,
          requiredServiceIds: BUNDLE_REQUIRED,
          rewardedServiceId: SALON_KLIP,
          priority: 30,
          active: true,
        },
        CART_PERCENT,
      ],
    });

    assert.equal(
      quote.lines.find((l) => l.serviceId === GELIN_KLIP)?.finalPrice,
      3500
    );
    assert.equal(
      quote.lines.find((l) => l.serviceId === SALON_KLIP)?.finalPrice,
      3500
    );
    assert.equal(
      quote.lines.find((l) => l.serviceId === KUAFOR_KLIP)?.finalPrice,
      3500
    );
    // Site örneği: 12000 + 3500×3 + drone 0 = 22500
    assert.equal(quote.totalPrice, 22500);
    // Kazanç: %20=3000 + klipler 1500×3=4500 + drone 4000 = 11500
    assert.equal(quote.discountAmount, 11500);
  });
});
