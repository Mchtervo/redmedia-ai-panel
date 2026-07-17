import { verifyChatPlaceSignature } from "@/server/webhooks/chatplace-signature";
import { verifyChatPlaceToken } from "@/server/webhooks/chatplace-token";

export type ChatPlaceWebhookAuthInput = {
  rawBody: string;
  signatureHeader: string | null | undefined;
  tokenHeader: string | null | undefined;
  webhookSecret: string | undefined;
  webhookToken: string | undefined;
};

/**
 * Webhook kimlik doğrulama: geçerli HMAC **veya** geçerli statik token.
 * İkisi de geçersizse `false` (fail-closed).
 */
export function verifyChatPlaceWebhookAuth(
  input: ChatPlaceWebhookAuthInput
): boolean {
  const hmacOk = verifyChatPlaceSignature(
    input.rawBody,
    input.signatureHeader,
    input.webhookSecret
  );

  if (hmacOk) {
    return true;
  }

  return verifyChatPlaceToken(input.tokenHeader, input.webhookToken);
}
