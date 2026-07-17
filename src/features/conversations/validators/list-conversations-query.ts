import { z } from "zod";
import { CONVERSATION_STATUS_VALUES } from "@/features/conversations/types";

/**
 * `/dashboard/inbox` sayfasının `searchParams`'ından gelen dışarıdan
 * kontrol edilebilen girdiyi doğrular (bkz. `.cursor/rules/01-code-quality.mdc`).
 * Geçersiz değerler sessizce varsayılana döner.
 */
export const listConversationsQuerySchema = z.object({
  // URL parametresi `q`; iç modellerde `search` adı kullanılır (bkz.
  // features/contacts/validators/list-contacts-query.ts ile aynı desen).
  search: z.string().trim().min(1).max(200).optional().catch(undefined),
  status: z.enum(CONVERSATION_STATUS_VALUES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().default(1).catch(1),
});

export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

export function parseListConversationsQuery(
  searchParams: Record<string, string | string[] | undefined>
): ListConversationsQuery {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return listConversationsQuerySchema.parse({
    search: first(searchParams.q),
    status: first(searchParams.status),
    page: first(searchParams.page),
  });
}
