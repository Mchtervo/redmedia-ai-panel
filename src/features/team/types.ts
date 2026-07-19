export const STAFF_ROLE_SLUGS = [
  "main_operator",
  "event_photographer",
  "wedding_venue_photographer",
  "shoulder_camera_operator",
  "video_operator",
  "drone_operator",
  "assistant",
] as const;

export type StaffRoleSlug = (typeof STAFF_ROLE_SLUGS)[number];

export const STAFF_ROLE_LABELS: Record<StaffRoleSlug, string> = {
  main_operator: "Ana Çekim Sorumlusu",
  event_photographer: "Etkinlik Fotoğrafçısı",
  wedding_venue_photographer: "Düğün Salonu Fotoğrafçısı",
  shoulder_camera_operator: "Omuz Kamera Operatörü",
  video_operator: "Video Operatörü",
  drone_operator: "Drone Operatörü",
  assistant: "Yardımcı Personel",
};

export const UNAVAILABILITY_TYPES = [
  "day_off",
  "leave",
  "sick",
  "personal",
  "manual_block",
] as const;

export type UnavailabilityType = (typeof UNAVAILABILITY_TYPES)[number];

export const ASSIGNMENT_STATUSES = [
  "proposed",
  "assigned",
  "accepted",
  "declined",
  "completed",
  "cancelled",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export type StaffAvailabilityStatus =
  | "available"
  | "time_conflict"
  | "travel_insufficient"
  | "on_leave"
  | "busy_elsewhere"
  | "role_mismatch"
  | "inactive";

export const STAFF_AVAILABILITY_LABELS: Record<StaffAvailabilityStatus, string> =
  {
    available: "Müsait",
    time_conflict: "Saat çakışıyor",
    travel_insufficient: "Yol süresi yetmiyor",
    on_leave: "İzinli",
    busy_elsewhere: "Başka görevde",
    role_mismatch: "Rol uygun değil",
    inactive: "Pasif",
  };

export type RequiredRoleSlot = {
  roleSlug: StaffRoleSlug;
  roleLabel: string;
  reason: string;
  serviceIds: string[];
  quantity: number;
};

export type StaffCandidate = {
  staffMemberId: string;
  fullName: string;
  roles: StaffRoleSlug[];
  status: StaffAvailabilityStatus;
  statusLabel: string;
  score: number;
  sameDayAssignmentCount: number;
  previousAssignmentSummary: string | null;
  nextAssignmentSummary: string | null;
  travelRiskMinutes: number | null;
};
