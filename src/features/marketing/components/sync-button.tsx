"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  syncMarketingAction,
  testConnectionAction,
  runMetaSyncAction,
  testAllConnectionsAction,
} from "@/features/marketing/actions/marketing-actions";
import { Button } from "@/components/ui/button";
import type { MetaConnectionType } from "@/features/marketing/types";

export function SyncButton({
  syncType,
  label,
}: {
  syncType: "ads" | "insights" | "instagram" | "attribution";
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await syncMarketingAction(syncType);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : label}
    </Button>
  );
}

export function TestConnectionButton({
  connectionType,
}: {
  connectionType: MetaConnectionType;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await testConnectionAction(connectionType);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : "Bağlantıyı test et"}
    </Button>
  );
}

export function MetaSyncKindButton({
  kind,
  label,
}: {
  kind:
    | "full"
    | "campaigns"
    | "adsets"
    | "ads"
    | "insights"
    | "instagram";
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await runMetaSyncAction(kind);
          router.refresh();
        });
      }}
    >
      {pending ? "Senkron…" : label}
    </Button>
  );
}

export function TestAllConnectionsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await testAllConnectionsAction();
          router.refresh();
        });
      }}
    >
      {pending ? "Test…" : "Tüm bağlantıları test et"}
    </Button>
  );
}

export function MetaOAuthConnectButton({
  label = "Meta'ya Bağlan",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "outline";
}) {
  const className =
    variant === "outline"
      ? "border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm font-medium"
      : "bg-primary text-primary-foreground inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium";

  return (
    <a href="/api/meta/oauth/start" className={className}>
      {label}
    </a>
  );
}
