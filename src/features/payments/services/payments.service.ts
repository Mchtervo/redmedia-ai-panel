import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getReservationSettings } from "@/features/pricing/services/quote-from-db.service";
import {
  getReservationById,
  insertReservationChange,
  updateReservation,
} from "@/features/reservations/repositories/reservations.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

export async function listPaymentAccounts(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("payment_accounts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDefaultPaymentAccount(
  supabase: TypedSupabaseClient
) {
  const { data, error } = await supabase
    .from("payment_accounts")
    .select("*")
    .eq("active", true)
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertPaymentAccount(
  supabase: TypedSupabaseClient,
  input: {
    id?: string;
    bankName: string;
    accountHolderName: string;
    iban: string;
    currency?: string;
    active?: boolean;
    isDefault?: boolean;
  }
) {
  if (input.isDefault) {
    await supabase
      .from("payment_accounts")
      .update({ is_default: false })
      .eq("is_default", true);
  }

  if (input.id) {
    const { data, error } = await supabase
      .from("payment_accounts")
      .update({
        bank_name: input.bankName,
        account_holder_name: input.accountHolderName,
        iban: input.iban,
        currency: input.currency ?? "TRY",
        active: input.active ?? true,
        is_default: input.isDefault ?? false,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("payment_accounts")
    .insert({
      bank_name: input.bankName,
      account_holder_name: input.accountHolderName,
      iban: input.iban,
      currency: input.currency ?? "TRY",
      active: input.active ?? true,
      is_default: input.isDefault ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function buildDepositIbanMessage(
  supabase: TypedSupabaseClient,
  reservationId: string
): Promise<string> {
  const [account, reservation, settings] = await Promise.all([
    getDefaultPaymentAccount(supabase),
    getReservationById(supabase, reservationId),
    getReservationSettings(supabase),
  ]);

  if (!account) {
    return "Ödeme hesabı henüz tanımlanmamış. Ekibimiz size kısa süre içinde IBAN bilgisini iletecektir.";
  }

  const deposit = Number(
    reservation?.deposit_amount ?? settings?.default_deposit_amount ?? 1000
  );

  if (reservation) {
    await updateReservation(supabase, reservationId, {
      deposit_status: "requested",
      status:
        reservation.status === "draft" || reservation.status === "inquiry"
          ? "deposit_pending"
          : reservation.status,
    });
  }

  return [
    `Rezervasyonunuzu ön onaylı olarak oluşturuyoruz. Rezervasyonun kesinleşebilmesi için ${deposit.toLocaleString("tr-TR")} TL kapora ödemenizi aşağıdaki IBAN'a gönderebilirsiniz.`,
    "",
    `Kapora tutarı: ${deposit.toLocaleString("tr-TR")} TL`,
    `Banka: ${account.bank_name}`,
    `Hesap sahibi: ${account.account_holder_name}`,
    `IBAN: ${account.iban}`,
    "",
    "Ödemeyi yaptıktan sonra lütfen banka dekontunun veya ödeme ekranının ekran görüntüsünü bu sohbet üzerinden hemen paylaşın.",
  ].join("\n");
}

export type ReceiptAnalysis = {
  detectedBank: string | null;
  detectedSenderName: string | null;
  detectedRecipientName: string | null;
  detectedIban: string | null;
  detectedAmount: number | null;
  detectedCurrency: string | null;
  detectedTransactionDate: string | null;
  detectedReference: string | null;
  confidenceScore: number;
  manipulationSignals: string[];
  extractedText: string | null;
};

export function validateReceiptAgainstAccount(params: {
  analysis: ReceiptAnalysis;
  accountHolderName: string;
  iban: string;
  minAmount: number;
}): {
  receiptVerified: boolean;
  status: "needs_review" | "verified" | "rejected";
  reasons: string[];
  customerReplyHint: "ok" | "iban" | "amount" | "unreadable" | "duplicate" | "review";
} {
  const reasons: string[] = [];
  let customerReplyHint:
    | "ok"
    | "iban"
    | "amount"
    | "unreadable"
    | "duplicate"
    | "review" = "ok";

  if (params.analysis.confidenceScore < 0.45) {
    reasons.push("Dekont okunamadı veya güven çok düşük.");
    customerReplyHint = "unreadable";
  }

  const holder = params.accountHolderName.toLocaleLowerCase("tr-TR");
  const holderParts = holder.split(/\s+/).filter((p) => p.length > 2);
  const detectedHolder = (
    params.analysis.detectedRecipientName ?? ""
  ).toLocaleLowerCase("tr-TR");

  const holderOk =
    Boolean(detectedHolder) &&
    holderParts.some((part) => detectedHolder.includes(part));
  if (!holderOk) {
    reasons.push("Alıcı / hesap sahibi eşleşmiyor veya okunamadı.");
    if (customerReplyHint === "ok") customerReplyHint = "iban";
  }

  const cleanExpected = params.iban.replace(/\s/g, "").toUpperCase();
  const cleanDetected = (params.analysis.detectedIban ?? "")
    .replace(/\s/g, "")
    .toUpperCase();
  const ibanOk =
    Boolean(cleanDetected) &&
    (cleanDetected === cleanExpected ||
      cleanExpected.endsWith(cleanDetected.slice(-8)) ||
      cleanDetected.endsWith(cleanExpected.slice(-8)));
  if (!ibanOk) {
    reasons.push("IBAN kayıtlı hesap ile eşleşmiyor.");
    customerReplyHint = "iban";
  }

  if (
    params.analysis.detectedAmount == null ||
    params.analysis.detectedAmount + 0.01 < params.minAmount
  ) {
    reasons.push(`Tutar en az ${params.minAmount} TL olmalı.`);
    if (customerReplyHint === "ok" || customerReplyHint === "iban") {
      customerReplyHint = "amount";
    }
  }

  if (
    params.analysis.detectedCurrency &&
    params.analysis.detectedCurrency.toUpperCase() !== "TRY"
  ) {
    reasons.push("Para birimi TRY değil.");
  }

  if (params.analysis.confidenceScore < 0.7 && customerReplyHint === "ok") {
    reasons.push("OCR güven skoru düşük.");
    customerReplyHint = "review";
  }

  if (params.analysis.manipulationSignals.length > 0) {
    reasons.push("Manipülasyon sinyali var.");
    customerReplyHint = "review";
  }

  const receiptVerified =
    reasons.length === 0 && params.analysis.confidenceScore >= 0.85;

  return {
    receiptVerified,
    status: receiptVerified
      ? "verified"
      : customerReplyHint === "unreadable" || customerReplyHint === "iban"
        ? "rejected"
        : "needs_review",
    reasons,
    customerReplyHint: receiptVerified ? "ok" : customerReplyHint,
  };
}

export function buildReceiptCustomerReply(hint: {
  customerReplyHint:
    | "ok"
    | "iban"
    | "amount"
    | "unreadable"
    | "duplicate"
    | "review";
  minAmount: number;
}): string {
  switch (hint.customerReplyHint) {
    case "ok":
      return "Dekontunuz tarafımıza ulaştı, teşekkür ederiz. Bilgiler uygun görünüyor. Ödemeniz kontrol edildikten sonra rezervasyonunuz kesinleştirilecektir.";
    case "iban":
      return "Dekontunuzu aldık, teşekkürler. Görseldeki IBAN veya hesap sahibi bilgisi kayıtlı hesabımızla uyuşmuyor gibi görünüyor. Lütfen doğru IBAN'a yapılan ödemenin dekontunu paylaşır mısınız?";
    case "amount":
      return `Dekontunuzu aldık. Görünen tutar kapora tutarının (${hint.minAmount.toLocaleString("tr-TR")} TL) altında veya okunamadı. Eksik kısım tamamlandıktan sonra güncel dekontu paylaşabilir misiniz?`;
    case "unreadable":
      return "Dekont görseli net okunamadı. Daha net bir ekran görüntüsü veya PDF paylaşabilir misiniz?";
    case "duplicate":
      return "Bu dekont daha önce sisteme yüklenmiş görünüyor. Farklı bir işlem dekontu paylaşırsanız kontrol ederiz.";
    default:
      return "Dekontunuz tarafımıza ulaştı, teşekkür ederiz. Bilgileri inceliyoruz; sonuç netleşince size dönüş yapacağız.";
  }
}

export async function createPaymentReceipt(
  supabase: TypedSupabaseClient,
  input: {
    reservationId: string;
    contactId?: string | null;
    fileUrl: string;
    fileHash?: string | null;
    originalFilename?: string | null;
    uploadedVia?: "admin_panel" | "instagram" | "chatplace" | "website";
    analysis?: ReceiptAnalysis | null;
  }
) {
  const reservation = await getReservationById(supabase, input.reservationId);
  if (!reservation) throw new Error("Rezervasyon bulunamadı.");

  if (input.fileHash) {
    const { data: dup } = await supabase
      .from("payment_receipts")
      .select("id")
      .eq("file_hash", input.fileHash)
      .maybeSingle();
    if (dup) {
      return {
        receipt: null,
        canAuto: false,
        duplicate: true as const,
        customerReply: buildReceiptCustomerReply({
          customerReplyHint: "duplicate",
          minAmount: Number(reservation.deposit_amount ?? 1000),
        }),
      };
    }
  }

  if (input.analysis?.detectedReference) {
    const { data: dupRef } = await supabase
      .from("payment_receipts")
      .select("id")
      .eq("detected_reference", input.analysis.detectedReference)
      .maybeSingle();
    if (dupRef) {
      return {
        receipt: null,
        canAuto: false,
        duplicate: true as const,
        customerReply: buildReceiptCustomerReply({
          customerReplyHint: "duplicate",
          minAmount: Number(reservation.deposit_amount ?? 1000),
        }),
      };
    }
  }

  const account = await getDefaultPaymentAccount(supabase);
  const settings = await getReservationSettings(supabase);
  const minAmount = Number(
    reservation.deposit_amount ?? settings?.default_deposit_amount ?? 1000
  );

  let validation: ReturnType<typeof validateReceiptAgainstAccount> = {
    receiptVerified: false,
    status: "needs_review",
    reasons: ["Analiz bekleniyor"],
    customerReplyHint: "review",
  };

  if (input.analysis && account) {
    validation = validateReceiptAgainstAccount({
      analysis: input.analysis,
      accountHolderName: account.account_holder_name,
      iban: account.iban,
      minAmount,
    });
  }

  const autoConfirmEnv =
    process.env.AUTO_CONFIRM_HIGH_CONFIDENCE_RECEIPTS?.trim().toLowerCase() ===
    "true";
  const settingsAuto = Boolean(settings?.auto_confirm_high_confidence_receipts);
  const canAuto =
    (autoConfirmEnv || settingsAuto) &&
    validation.receiptVerified &&
    (input.analysis?.confidenceScore ?? 0) >= 0.95 &&
    (input.analysis?.detectedAmount ?? 0) >= minAmount;

  // Kesin confirmed ASLA burada yapılmaz — yalnızca admin onayı.
  void canAuto;

  const { data, error } = await supabase
    .from("payment_receipts")
    .insert({
      reservation_id: input.reservationId,
      contact_id: input.contactId ?? reservation.contact_id,
      file_url: input.fileUrl,
      file_hash: input.fileHash ?? null,
      original_filename: input.originalFilename ?? null,
      uploaded_via: input.uploadedVia ?? "admin_panel",
      extracted_text: input.analysis?.extractedText ?? null,
      detected_bank: input.analysis?.detectedBank ?? null,
      detected_sender_name: input.analysis?.detectedSenderName ?? null,
      detected_recipient_name: input.analysis?.detectedRecipientName ?? null,
      detected_iban: input.analysis?.detectedIban ?? null,
      detected_amount: input.analysis?.detectedAmount ?? null,
      detected_currency: input.analysis?.detectedCurrency ?? null,
      detected_transaction_date: input.analysis?.detectedTransactionDate ?? null,
      detected_reference: input.analysis?.detectedReference ?? null,
      confidence_score: input.analysis?.confidenceScore ?? null,
      validation_result: validation.status,
      validation_reasons: validation.reasons as unknown as Json,
      manipulation_signals: (input.analysis?.manipulationSignals ??
        []) as unknown as Json,
      receipt_verified: validation.receiptVerified,
      payment_confirmed: false,
      status:
        validation.status === "verified"
          ? "verified"
          : validation.status === "rejected"
            ? "rejected"
            : "needs_review",
    })
    .select("*")
    .single();

  if (error) throw error;

  await updateReservation(supabase, input.reservationId, {
    deposit_status: "under_review",
    status: "payment_review",
  });

  await insertReservationChange(supabase, {
    reservationId: input.reservationId,
    changedByType: "system",
    fieldName: "payment_receipt",
    newValue: {
      receiptId: data.id,
      status: data.status,
      receiptVerified: validation.receiptVerified,
    },
    reason: "Dekont yüklendi",
  });

  const customerReply = buildReceiptCustomerReply({
    customerReplyHint: validation.customerReplyHint,
    minAmount,
  });

  return {
    receipt: data,
    canAuto: false,
    duplicate: false as const,
    customerReply,
  };
}

export async function listPaymentReceipts(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("payment_receipts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function analyzeReceiptWithVision(
  imageUrlOrDataUrl: string
): Promise<ReceiptAnalysis> {
  const { createRoutedChatCompletion, isOpenAiConfigured } = await import(
    "@/lib/ai/openai-client"
  );

  if (!isOpenAiConfigured()) {
    return {
      detectedBank: null,
      detectedSenderName: null,
      detectedRecipientName: null,
      detectedIban: null,
      detectedAmount: null,
      detectedCurrency: "TRY",
      detectedTransactionDate: null,
      detectedReference: null,
      confidenceScore: 0,
      manipulationSignals: ["openai_missing"],
      extractedText: null,
    };
  }

  const { completion } = await createRoutedChatCompletion("vision", {
    temperature: 0,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Dekont görselinden JSON çıkar: detectedBank, detectedSenderName, detectedRecipientName, detectedIban, detectedAmount (number), detectedCurrency, detectedTransactionDate (YYYY-MM-DD), detectedReference, confidenceScore (0-1), manipulationSignals (string[]), extractedText. Uydurma.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Bu dekontu analiz et." },
          { type: "image_url", image_url: { url: imageUrlOrDataUrl } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      detectedBank: (parsed.detectedBank as string) ?? null,
      detectedSenderName: (parsed.detectedSenderName as string) ?? null,
      detectedRecipientName: (parsed.detectedRecipientName as string) ?? null,
      detectedIban: (parsed.detectedIban as string) ?? null,
      detectedAmount:
        typeof parsed.detectedAmount === "number"
          ? parsed.detectedAmount
          : null,
      detectedCurrency: (parsed.detectedCurrency as string) ?? "TRY",
      detectedTransactionDate:
        (parsed.detectedTransactionDate as string) ?? null,
      detectedReference: (parsed.detectedReference as string) ?? null,
      confidenceScore:
        typeof parsed.confidenceScore === "number"
          ? parsed.confidenceScore
          : 0.5,
      manipulationSignals: Array.isArray(parsed.manipulationSignals)
        ? (parsed.manipulationSignals as string[])
        : [],
      extractedText: (parsed.extractedText as string) ?? null,
    };
  } catch {
    return {
      detectedBank: null,
      detectedSenderName: null,
      detectedRecipientName: null,
      detectedIban: null,
      detectedAmount: null,
      detectedCurrency: "TRY",
      detectedTransactionDate: null,
      detectedReference: null,
      confidenceScore: 0,
      manipulationSignals: ["parse_failed"],
      extractedText: raw.slice(0, 500),
    };
  }
}
