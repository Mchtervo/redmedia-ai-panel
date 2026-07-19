# features/team

**Menü:** Ekip (`/dashboard/team`)

**Tablolar:** `staff_members`, `staff_roles`, `staff_member_roles`,
`staff_unavailability`, `reservation_staff_assignments`, `panel_notifications`,
`staff_audit_logs`

## Sayfalar

- `/dashboard/team` — liste + yeni personel
- `/dashboard/team/[id]` — detay, rol, izin, görevler
- `/dashboard/team/calendar` — personel takvimi

## Kurallar

Rol eşleme: `services/role-resolution.service.ts`  
Uygunluk/öneri: `services/staff-availability.service.ts`  
AI kesin atama yapmaz; `required_role` + `suggested_staff_ids` üretir.
