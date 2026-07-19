import type { Metadata } from "next";
import { createAdminClient } from "@/server/supabase/admin";
import { listAllServicesAdmin } from "@/features/catalog/repositories/catalog.repository";
import { ServicePriceEditor } from "@/features/catalog/components/service-price-editor";

export const metadata: Metadata = { title: "Hizmetler — Redmedia AI Panel" };

export default async function ServicesPage() {
  const supabase = createAdminClient();
  const services = await listAllServicesAdmin(supabase);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hizmetler ve fiyatlar</h1>
        <p className="text-muted-foreground text-sm">
          Fiyatlar veritabanından yönetilir; AI uydurmaz.
        </p>
      </div>
      <ul className="space-y-3">
        {services.map((service) => (
          <li
            key={service.id}
            className="border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-medium">{service.name}</div>
              <div className="text-muted-foreground text-xs">
                {service.default_duration_minutes} dk · {service.slug}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {service.description}
              </p>
            </div>
            <ServicePriceEditor
              serviceId={service.id}
              initialPrice={Number(service.base_price)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
