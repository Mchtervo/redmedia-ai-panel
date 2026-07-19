"use client";

import { useEffect, useState, useTransition } from "react";
import {
  assignStaffAction,
  getStaffSuggestionsAction,
  unassignStaffAction,
} from "@/features/team/actions/staff-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StaffCandidate, StaffRoleSlug } from "@/features/team/types";
import { STAFF_ROLE_LABELS } from "@/features/team/types";

type RoleSlot = {
  roleSlug: StaffRoleSlug;
  roleLabel: string;
  reason: string;
  quantity: number;
};

type ExistingAssignment = {
  id: string;
  staff_member_id: string;
  assigned_role: string;
  assignment_status: string;
  staff_members: { full_name: string } | null;
};

export function ReservationStaffAssignPanel({
  reservationId,
  roleSlots,
  candidateStartAt,
  candidateEndAt,
  existingAssignments,
}: {
  reservationId: string;
  roleSlots: RoleSlot[];
  candidateStartAt: string;
  candidateEndAt: string;
  existingAssignments: ExistingAssignment[];
}) {
  if (roleSlots.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Bu rezervasyonda atanacak rol bulunamadı (hizmet seçimi gerekli).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Personel Atama</h2>
      {existingAssignments.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {existingAssignments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
            >
              <span>
                {a.staff_members?.full_name ?? a.staff_member_id.slice(0, 8)} ·{" "}
                {STAFF_ROLE_LABELS[a.assigned_role as StaffRoleSlug] ??
                  a.assigned_role}{" "}
                ({a.assignment_status})
              </span>
              <UnassignButton
                assignmentId={a.id}
                reservationId={reservationId}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {roleSlots.map((slot) => (
        <RoleAssignBlock
          key={`${slot.roleSlug}-${slot.reason}`}
          reservationId={reservationId}
          slot={slot}
          candidateStartAt={candidateStartAt}
          candidateEndAt={candidateEndAt}
        />
      ))}
    </div>
  );
}

function UnassignButton({
  assignmentId,
  reservationId,
}: {
  assignmentId: string;
  reservationId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await unassignStaffAction(assignmentId, reservationId);
        })
      }
    >
      Kaldır
    </Button>
  );
}

function RoleAssignBlock({
  reservationId,
  slot,
  candidateStartAt,
  candidateEndAt,
}: {
  reservationId: string;
  slot: RoleSlot;
  candidateStartAt: string;
  candidateEndAt: string;
}) {
  const [candidates, setCandidates] = useState<StaffCandidate[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [selected, setSelected] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getStaffSuggestionsAction({
        requiredRole: slot.roleSlug,
        candidateStartAt,
        candidateEndAt,
        excludeReservationId: reservationId,
      });
      if (cancelled || !result.success) return;
      setCandidates(result.data.candidates);
      setSuggested(result.data.suggestedStaffIds);
      setAvailableCount(result.data.availableCount);
      if (result.data.suggestedStaffIds[0]) {
        setSelected(result.data.suggestedStaffIds[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slot.roleSlug, candidateStartAt, candidateEndAt, reservationId]);

  const selectedCandidate = candidates.find((c) => c.staffMemberId === selected);
  const needsOverride =
    selectedCandidate && selectedCandidate.status !== "available";

  function onAssign() {
    setMessage(null);
    startTransition(async () => {
      const result = await assignStaffAction({
        reservationId,
        staffMemberId: selected,
        assignedRole: slot.roleSlug,
        candidateStartAt,
        candidateEndAt,
        overrideConflict: override,
        overrideReason: overrideReason || undefined,
      });
      setMessage(result.success ? result.message ?? "Atandı" : result.error);
    });
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="font-medium">{slot.roleLabel}</h3>
        <p className="text-muted-foreground text-sm">{slot.reason}</p>
        <p className="text-sm">
          Gerekli: {slot.quantity} · Müsait: {availableCount}
          {suggested[0] ? " · Önerilen listenin başında" : ""}
        </p>
      </div>
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {candidates.map((c) => (
          <li key={c.staffMemberId}>
            <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-muted/50">
              <input
                type="radio"
                name={`staff-${slot.roleSlug}`}
                checked={selected === c.staffMemberId}
                onChange={() => setSelected(c.staffMemberId)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{c.fullName}</span>
                {suggested.includes(c.staffMemberId) ? (
                  <span className="text-muted-foreground"> (önerilen)</span>
                ) : null}
                <br />
                <span
                  className={
                    c.status === "available"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400"
                  }
                >
                  {c.statusLabel}
                </span>
                {c.previousAssignmentSummary ? (
                  <>
                    <br />
                    <span className="text-muted-foreground">
                      Önceki: {c.previousAssignmentSummary}
                    </span>
                  </>
                ) : null}
                {c.nextAssignmentSummary ? (
                  <>
                    <br />
                    <span className="text-muted-foreground">
                      Sonraki: {c.nextAssignmentSummary}
                    </span>
                  </>
                ) : null}
                {c.travelRiskMinutes != null ? (
                  <>
                    <br />
                    <span className="text-muted-foreground">
                      Yol boşluğu: {Math.round(c.travelRiskMinutes)} dk
                    </span>
                  </>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {needsOverride ? (
        <div className="space-y-2 rounded border border-amber-500/40 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
            />
            Uyarıya rağmen ata (özel yetki)
          </label>
          <Input
            placeholder="Gerekçe (zorunlu)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </div>
      ) : null}
      <Button
        type="button"
        disabled={
          isPending ||
          !selected ||
          (Boolean(needsOverride) && (!override || !overrideReason.trim()))
        }
        onClick={onAssign}
      >
        {isPending ? "Atanıyor…" : "Ata"}
      </Button>
      {message ? (
        <p className="text-muted-foreground text-sm" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
