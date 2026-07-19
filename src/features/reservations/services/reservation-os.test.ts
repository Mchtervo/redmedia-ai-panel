import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFollowUpReason } from "@/features/follow-ups/services/follow-ups.service";
import { validateReceiptAgainstAccount } from "@/features/payments/services/payments.service";
import { requireVerifiedKaporaReceipt } from "@/features/reservations/services/reservations.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

describe("classifyFollowUpReason", () => {
  it("opt-out algılar", () => {
    const result = classifyFollowUpReason("Rahatsız etmeyin lütfen");
    assert.equal(result.optOut, true);
  });

  it("düşüneceğim için 2 saat planlar", () => {
    const result = classifyFollowUpReason("Bir düşüneceğim");
    assert.equal(result.reason, "thinking");
    assert.equal(result.delayHours, 2);
  });
});

describe("validateReceiptAgainstAccount", () => {
  it("düşük tutarda needs_review döner", () => {
    const result = validateReceiptAgainstAccount({
      minAmount: 1000,
      accountHolderName: "Redmedia Video",
      iban: "TR330006100519786457841326",
      analysis: {
        detectedBank: "Ziraat",
        detectedSenderName: "Ali",
        detectedRecipientName: "Redmedia Video",
        detectedIban: "TR330006100519786457841326",
        detectedAmount: 500,
        detectedCurrency: "TRY",
        detectedTransactionDate: "2026-07-18",
        detectedReference: "REF1",
        confidenceScore: 0.99,
        manipulationSignals: [],
        extractedText: null,
      },
    });
    assert.equal(result.receiptVerified, false);
    assert.equal(result.status, "needs_review");
  });
});

describe("requireVerifiedKaporaReceipt", () => {
  it("doğrulanmış dekont yoksa kesinleştirmeyi engeller", async () => {
    const supabase = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
    } as unknown as SupabaseClient<Database>;

    await assert.rejects(
      () => requireVerifiedKaporaReceipt(supabase, "00000000-0000-4000-8000-000000000001"),
      /Kapora dekontu doğrulanmadan/
    );
  });
});
