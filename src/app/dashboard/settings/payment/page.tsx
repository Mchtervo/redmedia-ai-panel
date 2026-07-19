import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { listPaymentAccounts } from "@/features/payments/services/payments.service";
import { PaymentAccountForm } from "@/features/payments/components/payment-account-form";

export const metadata: Metadata = {
  title: "Ödeme Ayarları — Redmedia AI Panel",
};

export default async function PaymentSettingsPage() {
  const supabase = createAdminClient();
  const accounts = await listPaymentAccounts(supabase);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">IBAN / Ödeme hesapları</h1>
        <p className="text-muted-foreground text-sm">
          IBAN kodda tutulmaz. Aşağıdaki formdan kaydedin; AI yalnızca
          varsayılan aktif hesabı gönderir.
        </p>
      </div>
      <PaymentAccountForm />
      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a.id} className="border-border rounded-lg border p-3 text-sm">
            <div className="font-medium">
              {a.bank_name} {a.is_default ? "(varsayılan)" : ""}{" "}
              {!a.active ? "(pasif)" : ""}
            </div>
            <div>{a.account_holder_name}</div>
            <div className="font-mono text-xs">{a.iban}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
