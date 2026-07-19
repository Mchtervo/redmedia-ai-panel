"use client";

import { useState, useTransition } from "react";
import { savePaymentAccountAction } from "@/features/reservations/actions/reservation-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PaymentAccountForm() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="border-border grid gap-2 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          const result = await savePaymentAccountAction({
            bankName: String(fd.get("bankName") ?? ""),
            accountHolderName: String(fd.get("accountHolderName") ?? ""),
            iban: String(fd.get("iban") ?? ""),
            isDefault: fd.get("isDefault") === "on",
          });
          setMsg(result.success ? "Hesap kaydedildi" : result.error);
          if (result.success) form.reset();
        });
      }}
    >
      <Input name="bankName" placeholder="Banka adı" required />
      <Input name="accountHolderName" placeholder="Hesap sahibi" required />
      <Input name="iban" placeholder="TR.. IBAN" required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked />
        Varsayılan hesap
      </label>
      <Button type="submit" disabled={isPending}>
        Kaydet
      </Button>
      {msg ? <p className="text-muted-foreground text-sm">{msg}</p> : null}
    </form>
  );
}
