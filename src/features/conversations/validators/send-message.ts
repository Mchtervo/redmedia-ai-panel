import { z } from "zod";

export const sendStaffMessageSchema = z.object({
  conversationId: z.uuid(),
  content: z
    .string()
    .trim()
    .min(1, "Mesaj boş olamaz.")
    .max(4000, "Mesaj en fazla 4000 karakter olabilir."),
});

export type SendStaffMessageInput = z.infer<typeof sendStaffMessageSchema>;
