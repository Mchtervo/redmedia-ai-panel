import { strict as assert } from "node:assert";
import { test } from "node:test";
import { evaluateCondition } from "./automation-engine.service";
import {
  automationActionsSchema,
  automationConditionsSchema,
} from "@/features/automations/types";

test("contains koşulu Türkçe büyük/küçük harfe duyarsız eşleşir", () => {
  assert.equal(
    evaluateCondition(
      { field: "message", op: "contains", value: "İPTAL" },
      { message: "Randevumu iptal etmek istiyorum" }
    ),
    true
  );
});

test("contains koşulu eşleşmeyince false döner", () => {
  assert.equal(
    evaluateCondition(
      { field: "message", op: "contains", value: "indirim" },
      { message: "Fiyat bilgisi alabilir miyim?" }
    ),
    false
  );
});

test("not_contains koşulu doğru çalışır", () => {
  assert.equal(
    evaluateCondition(
      { field: "message", op: "not_contains", value: "iptal" },
      { message: "Fiyat bilgisi alabilir miyim?" }
    ),
    true
  );
});

test("gt/lt koşulları sayısal alanlarda çalışır", () => {
  assert.equal(
    evaluateCondition(
      { field: "totalPrice", op: "gt", value: 10000 },
      { totalPrice: 15000 }
    ),
    true
  );
  assert.equal(
    evaluateCondition(
      { field: "totalPrice", op: "lt", value: 10000 },
      { totalPrice: 15000 }
    ),
    false
  );
});

test("bağlamda olmayan alan false döner", () => {
  assert.equal(
    evaluateCondition(
      { field: "message", op: "contains", value: "iptal" },
      { reservationId: "abc" }
    ),
    false
  );
});

test("koşul şeması geçersiz operatörü reddeder", () => {
  const parsed = automationConditionsSchema.safeParse([
    { field: "message", op: "regex", value: ".*" },
  ]);
  assert.equal(parsed.success, false);
});

test("aksiyon şeması boş listeyi reddeder", () => {
  const parsed = automationActionsSchema.safeParse([]);
  assert.equal(parsed.success, false);
});

test("aksiyon şeması panel bildirimi tanımını kabul eder", () => {
  const parsed = automationActionsSchema.safeParse([
    {
      type: "panel_notification",
      params: { title: "Test bildirimi", body: "Detay" },
    },
  ]);
  assert.equal(parsed.success, true);
});
