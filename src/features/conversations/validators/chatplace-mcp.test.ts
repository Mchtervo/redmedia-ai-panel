import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chatPlaceChatsListSchema,
  chatPlaceMessagesSchema,
  mapChatPlaceSide,
  stripChatPlaceHtml,
  unixSecondsToIso,
} from "./chatplace-mcp";

test("chats_list şeması gerçek cevap şeklini kabul eder", () => {
  const parsed = chatPlaceChatsListSchema.parse({
    items: [
      {
        id: "63cd5fe5-daa8-4b26-b43b-1ed186d95025",
        clientId: "019e93e0-c286-7191-9a25-d67b16bc8446",
        clientName: "Test Kişi",
        status: 1,
        statusName: "active",
        type: 1,
        typeName: "open",
        lastMessageAt: 1784348052,
      },
    ],
    lastItemId: "b9e224fb-4298-42d0-9448-393da9f967dd",
    lastItemTimestamp: "1784321910",
    hasNextItems: true,
  });
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.hasNextItems, true);
});

test("chats_messages şeması mesaj listesini kabul eder", () => {
  const parsed = chatPlaceMessagesSchema.parse([
    {
      id: "019f736e-8bc6-73a7-9ea7-f79c368d15a6",
      side: "bot",
      message: "<p>Merhaba</p>",
      isRead: false,
      createdAt: 1784348052,
    },
  ]);
  assert.equal(parsed[0].side, "bot");
});

test("HTML temizleme: etiketler gider, satır sonları ve metin kalır", () => {
  assert.equal(
    stripChatPlaceHtml("<p>Merhaba</p><p>Fiyat 5.000 TL &amp; KDV</p>"),
    "Merhaba\nFiyat 5.000 TL & KDV"
  );
  assert.equal(stripChatPlaceHtml("satır1<br/>satır2"), "satır1\nsatır2");
  assert.equal(
    stripChatPlaceHtml(
      '<p><span data-type="mention" class="mention" data-id="x">@ad</span> selam</p>'
    ),
    "@ad selam"
  );
});

test("unix saniye ISO'ya çevrilir (orijinal zaman korunur)", () => {
  assert.equal(unixSecondsToIso(1784348052), "2026-07-18T04:14:12.000Z");
  assert.equal(unixSecondsToIso(0), "1970-01-01T00:00:00.000Z");
});

test("side eşlemesi: client → inbound/customer", () => {
  assert.deepEqual(mapChatPlaceSide("client"), {
    direction: "inbound",
    senderType: "customer",
  });
});

test("side eşlemesi: bot → outbound/ai", () => {
  assert.deepEqual(mapChatPlaceSide("bot"), {
    direction: "outbound",
    senderType: "ai",
  });
});

test("side eşlemesi: bilinmeyen (operator) → outbound/staff", () => {
  assert.deepEqual(mapChatPlaceSide("operator"), {
    direction: "outbound",
    senderType: "staff",
  });
});
