import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getContactById } from "@/features/contacts/repositories/contacts.repository";
import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";
import {
  ensureCustomerProfile,
  getCustomerProfileByContactId,
  updateCustomerProfile,
} from "@/features/customer-intelligence/repositories/customer-profiles.repository";
import {
  buildProfileUpdateUserPrompt,
  PROFILE_UPDATE_SYSTEM_PROMPT,
} from "@/features/customer-intelligence/prompts/profile-update";
import {
  extractProfileDeltaHeuristics,
  mergeProfileDelta,
  mergeRequestedServices,
  profileDeltaSchema,
  type ProfileDelta,
} from "@/features/customer-intelligence/utils/profile-extract";
import type { CustomerProfile } from "@/features/customer-intelligence/types";
import { toCrmMemorySnapshot } from "@/features/customer-intelligence/types";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";

type TypedSupabaseClient = SupabaseClient<Database>;

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  return JSON.parse(fenced?.[1]?.trim() ?? trimmed) as unknown;
}

async function enrichDeltaWithOpenAi(
  message: string,
  profile: CustomerProfile,
  todayIsoDate: string
): Promise<ProfileDelta> {
  if (!isOpenAiConfigured()) {
    return {};
  }

  try {
    const { completion } = await createRoutedChatCompletion("classification", {
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROFILE_UPDATE_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildProfileUpdateUserPrompt({
            customerMessage: message,
            currentProfileJson: JSON.stringify(toCrmMemorySnapshot(profile)),
            todayIsoDate,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return {};
    }

    const parsed = profileDeltaSchema.safeParse(extractJsonObject(raw));
    return parsed.success ? parsed.data : {};
  } catch (error) {
    const msg = error instanceof Error ? error.message : "profile_ai_error";
    console.error("[customer-intelligence] profil AI güncelleme hatası:", msg);
    return {};
  }
}

function combineDeltas(
  heuristic: ProfileDelta,
  aiDelta: ProfileDelta
): ProfileDelta {
  return {
    ...aiDelta,
    ...heuristic,
    requestedServices: mergeRequestedServices(
      aiDelta.requestedServices ?? [],
      heuristic.requestedServices
    ),
    // Heuristik telefon/tarih/etkinlik tipi öncelikli (örnek senaryolar).
    phone: heuristic.phone ?? aiDelta.phone,
    phoneVerified: heuristic.phoneVerified ?? aiDelta.phoneVerified,
    eventType: heuristic.eventType ?? aiDelta.eventType,
    eventDate: heuristic.eventDate ?? aiDelta.eventDate,
  };
}

function inferStatusAndScore(
  profile: CustomerProfile,
  delta: ProfileDelta
): Pick<ProfileDelta, "status" | "leadScore" | "bookingProbability"> {
  let leadScore = delta.leadScore ?? profile.lead_score;
  let status = delta.status ?? profile.status;
  let bookingProbability =
    delta.bookingProbability ?? profile.booking_probability;

  if (delta.eventType || delta.eventDate) {
    leadScore = Math.max(leadScore, 25);
    if (status === "new") {
      status = "interested";
    }
  }

  if (delta.requestedServices && delta.requestedServices.length > 0) {
    leadScore = Math.max(leadScore, 40);
    if (status === "new" || status === "interested") {
      status = "interested";
    }
  }

  if (delta.phone || profile.phone) {
    leadScore = Math.max(leadScore, 55);
    if (status === "interested" || status === "new") {
      status = "hot";
    }
    bookingProbability = Math.max(bookingProbability ?? 0, 45);
  }

  if (profile.event_type && profile.event_date && (delta.phone || profile.phone)) {
    leadScore = Math.max(leadScore, 70);
    bookingProbability = Math.max(bookingProbability ?? 0, 60);
  }

  return { status, leadScore, bookingProbability };
}

export type TouchCustomerProfileFromMessageParams = {
  contactId: string;
  customerMessage: string;
};

/**
 * Her gelen müşteri mesajından sonra CRM profilini günceller.
 */
export async function touchCustomerProfileFromMessage(
  supabase: TypedSupabaseClient,
  params: TouchCustomerProfileFromMessageParams
): Promise<CustomerProfile | null> {
  const contact = await getContactById(supabase, params.contactId);
  if (!contact) {
    return null;
  }

  const profile = await ensureCustomerProfile(supabase, {
    contactId: contact.id,
    instagramId: contact.instagram_user_id,
    username: contact.username,
    fullName: contact.full_name,
    phone: contact.phone,
  });

  const today = getTodayIsoInIstanbul();
  const heuristic = extractProfileDeltaHeuristics(
    params.customerMessage,
    today
  );
  const aiDelta = await enrichDeltaWithOpenAi(
    params.customerMessage,
    profile,
    today
  );
  const combined = combineDeltas(heuristic, aiDelta);
  const scored = inferStatusAndScore(profile, combined);
  const finalDelta: ProfileDelta = { ...combined, ...scored };

  const patch = mergeProfileDelta(
    profile as unknown as Record<string, unknown>,
    finalDelta
  );

  const { count: conversationCount, error: countError } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contact.id);

  if (countError) {
    throw countError;
  }

  const updated = await updateCustomerProfile(supabase, profile.id, {
    eventType:
      typeof patch.event_type === "string" ? patch.event_type : undefined,
    eventDate:
      typeof patch.event_date === "string" ? patch.event_date : undefined,
    venue: typeof patch.venue === "string" ? patch.venue : undefined,
    city: typeof patch.city === "string" ? patch.city : undefined,
    budget: typeof patch.budget === "string" ? patch.budget : undefined,
    phone: typeof patch.phone === "string" ? patch.phone : undefined,
    phoneVerified:
      typeof patch.phone_verified === "boolean"
        ? patch.phone_verified
        : undefined,
    requestedServices: Array.isArray(patch.requested_services)
      ? patch.requested_services
      : undefined,
    objections:
      typeof patch.objections === "string" ? patch.objections : undefined,
    lastSummary:
      typeof patch.last_summary === "string" ? patch.last_summary : undefined,
    notes: typeof patch.notes === "string" ? patch.notes : undefined,
    tags: Array.isArray(patch.tags) ? (patch.tags as string[]) : undefined,
    leadScore: scored.leadScore,
    status: scored.status,
    bookingProbability: scored.bookingProbability ?? null,
    totalMessages: profile.total_messages + 1,
    totalConversations: conversationCount ?? profile.total_conversations,
    lastSeen: new Date().toISOString(),
  });

  // contacts.phone ile senkron (varsa)
  if (updated.phone && updated.phone !== contact.phone) {
    await supabase
      .from("contacts")
      .update({ phone: updated.phone, last_seen_at: updated.last_seen })
      .eq("id", contact.id);
  } else {
    await supabase
      .from("contacts")
      .update({ last_seen_at: updated.last_seen })
      .eq("id", contact.id);
  }

  return updated;
}

export async function recordAiResponseOnProfile(
  supabase: TypedSupabaseClient,
  contactId: string,
  aiReply: string
): Promise<void> {
  const profile = await getCustomerProfileByContactId(supabase, contactId);
  if (!profile) {
    return;
  }

  await updateCustomerProfile(supabase, profile.id, {
    lastAiResponse: aiReply.slice(0, 2000),
  });
}

export async function loadCrmMemoryForPrompt(
  supabase: TypedSupabaseClient,
  contactId: string | null
) {
  if (!contactId) {
    return null;
  }

  const profile = await getCustomerProfileByContactId(supabase, contactId);
  return profile ? toCrmMemorySnapshot(profile) : null;
}
