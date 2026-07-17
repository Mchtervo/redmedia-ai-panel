"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hata mesajı/detayı loglanmaz (bkz. .cursor/rules/02-security.mdc);
    // yalnızca teşhis için geliştirme konsoluna yazılır.
    console.error("Customers sayfası yüklenirken hata oluştu:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Müşteriler yüklenemedi</p>
        <p className="text-sm text-muted-foreground">
          Bir şeyler ters gitti. Lütfen tekrar deneyin.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        Tekrar dene
      </Button>
    </div>
  );
}
