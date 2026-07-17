import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyChatPlaceWebhookAuth } from "@/server/webhooks/chatplace-auth";
import { computeChatPlaceSignature } from "@/server/webhooks/chatplace-signature";

const SECRET = "test-webhook-secret";
const TOKEN = "test-webhook-token-value";
const BODY = JSON.stringify({ event: "message.received", hello: "world" });

describe("verifyChatPlaceWebhookAuth", () => {
  it("geçerli token ile kabul eder (HMAC yok)", () => {
    const ok = verifyChatPlaceWebhookAuth({
      rawBody: BODY,
      signatureHeader: null,
      tokenHeader: TOKEN,
      webhookSecret: SECRET,
      webhookToken: TOKEN,
    });
    assert.equal(ok, true);
  });

  it("yanlış token ile reddeder", () => {
    const ok = verifyChatPlaceWebhookAuth({
      rawBody: BODY,
      signatureHeader: null,
      tokenHeader: "wrong-token",
      webhookSecret: SECRET,
      webhookToken: TOKEN,
    });
    assert.equal(ok, false);
  });

  it("token yok ve HMAC yoksa reddeder", () => {
    const ok = verifyChatPlaceWebhookAuth({
      rawBody: BODY,
      signatureHeader: null,
      tokenHeader: null,
      webhookSecret: SECRET,
      webhookToken: TOKEN,
    });
    assert.equal(ok, false);
  });

  it("geçerli HMAC ile kabul eder (token yok)", () => {
    const signature = `sha256=${computeChatPlaceSignature(BODY, SECRET)}`;
    const ok = verifyChatPlaceWebhookAuth({
      rawBody: BODY,
      signatureHeader: signature,
      tokenHeader: null,
      webhookSecret: SECRET,
      webhookToken: TOKEN,
    });
    assert.equal(ok, true);
  });

  it("yanlış HMAC + yanlış token ile reddeder", () => {
    const ok = verifyChatPlaceWebhookAuth({
      rawBody: BODY,
      signatureHeader: "sha256=deadbeef",
      tokenHeader: "wrong",
      webhookSecret: SECRET,
      webhookToken: TOKEN,
    });
    assert.equal(ok, false);
  });
});
