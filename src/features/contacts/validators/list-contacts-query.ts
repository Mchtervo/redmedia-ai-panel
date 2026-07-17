import { z } from "zod";
import { CONTACT_STATUS_VALUES } from "@/features/contacts/types";

/**
 * `/dashboard/customers` sayfasının `searchParams`'ından gelen, dışarıdan
 * (URL üzerinden) kontrol edilebilen girdiyi doğrular (bkz.
 * `.cursor/rules/01-code-quality.mdc`). Geçersiz değerler sessizce
 * varsayılana döner; hata fırlatmaz (kullanıcı deneyimini bozmamak için).
 */
export const listContactsQuerySchema = z.object({
  // Not: URL'deki parametre adı `q`dur; iç modellerde (service/repository)
  // daha açıklayıcı olan `search` adı kullanılır — bu eşleme yalnızca
  // burada (parseListContactsQuery) yapılır.
  search: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .catch(undefined),
  status: z
    .enum(CONTACT_STATUS_VALUES)
    .optional()
    .catch(undefined),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .catch(1),
});

export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;

export function parseListContactsQuery(
  searchParams: Record<string, string | string[] | undefined>
): ListContactsQuery {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return listContactsQuerySchema.parse({
    search: first(searchParams.q),
    status: first(searchParams.status),
    page: first(searchParams.page),
  });
}
