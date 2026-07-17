import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chatPlaceWebhookSchema,
  resolveExternalMessageId,
  toIngestInput,
} from "@/features/conversations/validators/chatplace-webhook";

describe("resolveExternalMessageId", () => {
  it("geçerli id'yi olduğu gibi döner", () => {
    assert.equal(resolveExternalMessageId("ig-msg-123"), "ig-msg-123");
  });

  it("eksik id için UUID üretir", () => {
    const a = resolveExternalMessageId(undefined);
    const b = resolveExternalMessageId("");
    assert.match(a, /^[0-9a-f-]{36}$/i);
    assert.match(b, /^[0-9a-f-]{36}$/i);
    assert.notEqual(a, b);
  });

  it("çözülmemiş şablon için UUID üretir", () => {
    const id = resolveExternalMessageId("{{ clientId }}{{ createdAt }}");
    assert.match(id, /^[0-9a-f-]{36}$/i);
  });
});

describe("chatPlaceWebhookSchema message.id optional", () => {
  it("message.id olmadan geçer", () => {
    const parsed = chatPlaceWebhookSchema.safeParse({
      event: "message.received",
      conversation: { id: "c1", channel: "instagram" },
      contact: { id: "u1", username: "user" },
      message: { type: "text", text: "Merhaba" },
    });
    assert.equal(parsed.success, true);
  });

  it("toIngestInput id yokken externalMessageId üretir", () => {
    const payload = chatPlaceWebhookSchema.parse({
      event: "message.received",
      conversation: { id: "c1", channel: "instagram" },
      contact: { id: "u1" },
      message: { text: "Merhaba" },
    });
    const input = toIngestInput(payload, {});
    assert.ok(input.externalMessageId);
    assert.match(input.externalMessageId!, /^[0-9a-f-]{36}$/i);
  });
});
