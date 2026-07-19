"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowRight, Zap, Filter, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAutomationRuleAction } from "@/features/automations/actions/automation-actions";
import {
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_TRIGGER_LABELS,
} from "@/features/automations/types";

const inputClass =
  "border-input bg-background focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2";

type Template = {
  id: string;
  label: string;
  values: {
    name: string;
    triggerType: string;
    keyword?: string;
    actionType: string;
    actionTitle: string;
    actionBody?: string;
  };
};

const TEMPLATES: Template[] = [
  {
    id: "cancel-keyword",
    label: "İptal kelimesinde onay talebi",
    values: {
      name: "İptal talebinde insan onayı",
      triggerType: "inbound_message",
      keyword: "iptal",
      actionType: "approval_request",
      actionTitle: "Müşteri iptal istedi — kontrol edin",
      actionBody: "Mesajda 'iptal' geçti; nihai karar ekibe ait.",
    },
  },
  {
    id: "discount-keyword",
    label: "İndirim talebinde bildirim",
    values: {
      name: "İndirim talebi bildirimi",
      triggerType: "inbound_message",
      keyword: "indirim",
      actionType: "panel_notification",
      actionTitle: "İndirim talebi geldi",
      actionBody: "Müşteri indirim istedi; konuşmayı inceleyin.",
    },
  },
  {
    id: "new-reservation",
    label: "Yeni rezervasyonda bildirim",
    values: {
      name: "Yeni rezervasyon bildirimi",
      triggerType: "reservation_created",
      actionType: "panel_notification",
      actionTitle: "Yeni rezervasyon oluşturuldu",
      actionBody: "Detaylar için rezervasyon sayfasını açın.",
    },
  },
  {
    id: "deposit-verified",
    label: "Kapora onayında bildirim",
    values: {
      name: "Kapora doğrulandı bildirimi",
      triggerType: "deposit_verified",
      actionType: "panel_notification",
      actionTitle: "Kapora doğrulandı",
      actionBody: "Rezervasyon kesinleşti; ekip planlamasını yapın.",
    },
  },
];

function StepBadge({
  icon: Icon,
  label,
  step,
}: {
  icon: typeof Zap;
  label: string;
  step: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="bg-primary/12 text-primary flex size-6 items-center justify-center rounded-full text-xs font-semibold">
        {step}
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon aria-hidden className="text-muted-foreground size-4" />
        {label}
      </span>
    </div>
  );
}

/**
 * Görsel kural oluşturucu: Tetikleyici → Koşul → Aksiyon adımları.
 * Aksiyonlar bildirim ve onay talebi ile sınırlıdır (AI bütçe/durum değiştiremez).
 */
export function AutomationRuleForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function applyTemplate(template: Template) {
    const form = formRef.current;
    if (!form) return;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name);
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        el.value = value;
      }
    };
    set("name", template.values.name);
    set("triggerType", template.values.triggerType);
    set("keyword", template.values.keyword ?? "");
    set("actionType", template.values.actionType);
    set("actionTitle", template.values.actionTitle);
    set("actionBody", template.values.actionBody ?? "");
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await createAutomationRuleAction({
        name: formData.get("name"),
        triggerType: formData.get("triggerType"),
        keyword: formData.get("keyword") || undefined,
        actionType: formData.get("actionType"),
        actionTitle: formData.get("actionTitle"),
        actionBody: formData.get("actionBody") || undefined,
      });
      if (result.success) {
        setSuccess(true);
        formRef.current?.reset();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">
          Şablonlar:
        </span>
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => applyTemplate(template)}
            className="bg-muted text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
          >
            {template.label}
          </button>
        ))}
      </div>

      <form ref={formRef} action={handleSubmit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Kural adı</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Örn. İptal kelimesinde onay talebi"
            className={inputClass}
          />
        </label>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-start">
          {/* 1. Tetikleyici */}
          <div className="bg-muted/30 space-y-2.5 rounded-xl border border-border/60 p-3.5">
            <StepBadge icon={Zap} label="Tetikleyici" step={1} />
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">
                Hangi olayda çalışsın?
              </span>
              <select name="triggerType" required className={inputClass}>
                {Object.entries(AUTOMATION_TRIGGER_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <ArrowRight
            aria-hidden
            className="text-muted-foreground mx-auto hidden size-4 self-center lg:block"
          />

          {/* 2. Koşul */}
          <div className="bg-muted/30 space-y-2.5 rounded-xl border border-border/60 p-3.5">
            <StepBadge icon={Filter} label="Koşul" step={2} />
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">
                Anahtar kelime (boşsa her olayda çalışır)
              </span>
              <input
                name="keyword"
                maxLength={80}
                placeholder="Örn. iptal"
                className={inputClass}
              />
            </label>
          </div>

          <ArrowRight
            aria-hidden
            className="text-muted-foreground mx-auto hidden size-4 self-center lg:block"
          />

          {/* 3. Aksiyon */}
          <div className="bg-muted/30 space-y-2.5 rounded-xl border border-border/60 p-3.5">
            <StepBadge icon={BellRing} label="Aksiyon" step={3} />
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Ne yapılsın?</span>
              <select name="actionType" required className={inputClass}>
                {Object.entries(AUTOMATION_ACTION_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Aksiyon başlığı</span>
            <input
              name="actionTitle"
              required
              minLength={2}
              maxLength={200}
              placeholder="Örn. Müşteri iptal istedi — kontrol edin"
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Aksiyon açıklaması (opsiyonel)</span>
            <input
              name="actionBody"
              maxLength={500}
              placeholder="Bildirim gövde metni"
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Oluşturuluyor…" : "Kural oluştur"}
          </Button>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          {success ? (
            <p className="text-success text-xs">Kural oluşturuldu.</p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
