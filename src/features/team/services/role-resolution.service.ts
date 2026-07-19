import {
  STAFF_ROLE_LABELS,
  type RequiredRoleSlot,
  type StaffRoleSlug,
} from "@/features/team/types";

export type ServiceForRoleResolution = {
  id: string;
  slug: string;
  service_type: string;
  category_slug: string;
  required_role_slug?: string | null;
};

const EVENT_PHOTO_CATEGORIES = new Set(["nikah", "nisan", "kina"]);
const MAIN_SHOOT_CATEGORIES = new Set([
  "dis-cekim",
  "gelin-alma",
  "kuafor-hazirlik",
]);
const VIDEO_LIKE = new Set(["video", "drone", "clip"]);

function isVideoLike(serviceType: string, slug: string): boolean {
  if (VIDEO_LIKE.has(serviceType)) return true;
  return /klip|video|drone/i.test(slug);
}

function isPhoto(serviceType: string): boolean {
  return serviceType === "photo";
}

function isShoulder(serviceType: string, slug: string): boolean {
  return serviceType === "shoulder_cam" || /omuz/i.test(slug);
}

function pushSlot(
  slots: Map<string, RequiredRoleSlot>,
  roleSlug: StaffRoleSlug,
  reason: string,
  serviceIds: string[],
  quantity = 1
) {
  const key = `${roleSlug}:${reason}`;
  const existing = slots.get(key);
  if (existing) {
    for (const id of serviceIds) {
      if (!existing.serviceIds.includes(id)) existing.serviceIds.push(id);
    }
    existing.quantity = Math.max(existing.quantity, quantity);
    return;
  }
  slots.set(key, {
    roleSlug,
    roleLabel: STAFF_ROLE_LABELS[roleSlug],
    reason,
    serviceIds: [...serviceIds],
    quantity,
  });
}

/**
 * Redmedia özel kurallarına göre seçili hizmetlerden gereken personel rollerini üretir.
 * Aynı rolde birden fazla slot quantity ile ifade edilir (kapasite).
 */
export function resolveRequiredRoles(
  services: ServiceForRoleResolution[]
): RequiredRoleSlot[] {
  if (services.length === 0) return [];

  const slots = new Map<string, RequiredRoleSlot>();
  const byCategory = new Map<string, ServiceForRoleResolution[]>();

  for (const service of services) {
    if (service.required_role_slug) {
      const slug = service.required_role_slug as StaffRoleSlug;
      if (slug in STAFF_ROLE_LABELS) {
        pushSlot(
          slots,
          slug,
          `Hizmet override: ${service.slug}`,
          [service.id]
        );
        continue;
      }
    }

    if (isShoulder(service.service_type, service.slug)) {
      pushSlot(
        slots,
        "shoulder_camera_operator",
        "Omuz kamera hizmeti",
        [service.id]
      );
      continue;
    }

    const list = byCategory.get(service.category_slug) ?? [];
    list.push(service);
    byCategory.set(service.category_slug, list);
  }

  for (const [categorySlug, group] of byCategory) {
    const ids = group.map((s) => s.id);
    const hasVideoLike = group.some((s) =>
      isVideoLike(s.service_type, s.slug)
    );
    const hasPhoto = group.some((s) => isPhoto(s.service_type));
    const onlyPhoto =
      hasPhoto &&
      group.every(
        (s) =>
          isPhoto(s.service_type) ||
          isShoulder(s.service_type, s.slug)
      ) &&
      !hasVideoLike;

    if (EVENT_PHOTO_CATEGORIES.has(categorySlug)) {
      if (onlyPhoto) {
        pushSlot(
          slots,
          "event_photographer",
          `Yalnız fotoğraf (${categorySlug})`,
          ids.filter((id) => {
            const s = group.find((g) => g.id === id);
            return s && isPhoto(s.service_type);
          })
        );
      } else if (hasVideoLike || hasPhoto) {
        pushSlot(
          slots,
          "main_operator",
          `Video/klip/drone içeren etkinlik (${categorySlug})`,
          ids
        );
      }
      continue;
    }

    if (categorySlug === "salon-dugun") {
      if (onlyPhoto) {
        pushSlot(
          slots,
          "wedding_venue_photographer",
          "Düğün salonu yalnız fotoğraf",
          ids.filter((id) => {
            const s = group.find((g) => g.id === id);
            return s && isPhoto(s.service_type);
          })
        );
      } else {
        pushSlot(
          slots,
          "main_operator",
          "Salon giriş / ilk dans / video içeren salon",
          ids
        );
      }
      continue;
    }

    if (MAIN_SHOOT_CATEGORIES.has(categorySlug) || hasPhoto || hasVideoLike) {
      pushSlot(
        slots,
        "main_operator",
        `Ana çekim paketi (${categorySlug})`,
        ids
      );
    }
  }

  return Array.from(slots.values());
}

/**
 * Belirli bir rol için o saatte kaç müsait personel gerekir / var kontrolü.
 */
export function hasEnoughStaffCapacity(params: {
  requiredQuantity: number;
  availableCount: number;
}): boolean {
  return params.availableCount >= params.requiredQuantity;
}
