import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateCostUsd,
  FALLBACK_MODEL,
  resolveModelRoute,
  type AiTaskKind,
} from "./model-router";

const ROUTER_VARS = [
  "OPENAI_MODEL_FAST",
  "OPENAI_MODEL_DEFAULT",
  "OPENAI_MODEL_REASONING",
  "OPENAI_MODEL_COMPLEX",
  "OPENAI_MODEL",
  "OPENAI_MODEL_BALANCED",
  "OPENAI_MODEL_VISION",
];

beforeEach(() => {
  for (const name of ROUTER_VARS) {
    delete process.env[name];
  }
});

test("yapılandırma yokken tüm görevler güvenli varsayılana düşer", () => {
  const route = resolveModelRoute("dm_reply");
  assert.equal(route.model, FALLBACK_MODEL);
});

test("görev → katman eşlemesi doğru env değişkenini kullanır", () => {
  process.env.OPENAI_MODEL_FAST = "model-fast";
  process.env.OPENAI_MODEL_DEFAULT = "model-default";
  process.env.OPENAI_MODEL_REASONING = "model-reasoning";
  process.env.OPENAI_MODEL_COMPLEX = "model-complex";

  const expectations: Array<[AiTaskKind, string]> = [
    ["dm_reply", "model-default"],
    ["comment_reply", "model-fast"],
    ["classification", "model-fast"],
    ["tagging", "model-fast"],
    ["short_summary", "model-fast"],
    ["extraction", "model-default"],
    ["crm_assist", "model-default"],
    ["reservation_assist", "model-default"],
    ["customer_summary", "model-default"],
    ["vision", "model-default"],
    ["reasoning", "model-reasoning"],
    ["ceo_intelligence", "model-reasoning"],
    ["marketing_strategy", "model-reasoning"],
    ["campaign_analysis", "model-reasoning"],
    ["sales_strategy", "model-reasoning"],
    ["architecture_analysis", "model-complex"],
    ["database_analysis", "model-complex"],
    ["security_analysis", "model-complex"],
    ["migration_planning", "model-complex"],
  ];

  for (const [task, expected] of expectations) {
    assert.equal(resolveModelRoute(task).model, expected, `görev: ${task}`);
  }
});

test("katman değişkeni boşsa DEFAULT katmanına düşer", () => {
  process.env.OPENAI_MODEL_DEFAULT = "model-default";
  assert.equal(resolveModelRoute("dm_reply").model, "model-default");
  assert.equal(resolveModelRoute("ceo_intelligence").model, "model-default");
});

test("COMPLEX boşsa REASONING'e düşer", () => {
  process.env.OPENAI_MODEL_DEFAULT = "model-default";
  process.env.OPENAI_MODEL_REASONING = "model-reasoning";
  assert.equal(
    resolveModelRoute("database_analysis").model,
    "model-reasoning"
  );
});

test("fallback modeli katman modelinden farklıysa default katmanıdır", () => {
  process.env.OPENAI_MODEL_DEFAULT = "model-default";
  process.env.OPENAI_MODEL_REASONING = "model-reasoning";
  const route = resolveModelRoute("reasoning");
  assert.equal(route.model, "model-reasoning");
  assert.equal(route.fallbackModel, "model-default");
});

test("katman modeli default ile aynıysa fallback sabit güvenli modeldir", () => {
  process.env.OPENAI_MODEL_DEFAULT = "model-default";
  const route = resolveModelRoute("dm_reply");
  assert.equal(route.model, "model-default");
  assert.equal(route.fallbackModel, FALLBACK_MODEL);
});

test("deprecated OPENAI_MODEL hâlâ fallback olarak okunur", () => {
  process.env.OPENAI_MODEL = "legacy-model";
  assert.equal(resolveModelRoute("extraction").model, "legacy-model");
});

test("deprecated OPENAI_MODEL_BALANCED, DEFAULT yerine geçer", () => {
  process.env.OPENAI_MODEL_BALANCED = "balanced-model";
  assert.equal(resolveModelRoute("extraction").model, "balanced-model");
});

test("OPENAI_MODEL_DEFAULT, deprecated değişkenlere göre önceliklidir", () => {
  process.env.OPENAI_MODEL = "legacy-model";
  process.env.OPENAI_MODEL_BALANCED = "balanced-model";
  process.env.OPENAI_MODEL_DEFAULT = "new-default";
  assert.equal(resolveModelRoute("extraction").model, "new-default");
});

test("geçersiz model adı biçimi yok sayılır ve güvenli modele düşülür", () => {
  process.env.OPENAI_MODEL_FAST = "bad model!!";
  assert.equal(resolveModelRoute("dm_reply").model, FALLBACK_MODEL);
});

test("vision görevi deprecated OPENAI_MODEL_VISION override'ına saygı duyar", () => {
  process.env.OPENAI_MODEL_DEFAULT = "model-default";
  process.env.OPENAI_MODEL_VISION = "vision-model";
  assert.equal(resolveModelRoute("vision").model, "vision-model");
});

test("maliyet tahmini bilinen model için hesaplanır", () => {
  const cost = estimateCostUsd("gpt-4o-mini", 1_000_000, 1_000_000);
  assert.equal(cost, 0.75); // 0.15 input + 0.60 output
});

test("maliyet tahmini bilinmeyen modelde null döner", () => {
  assert.equal(estimateCostUsd("unknown-model-x", 1000, 1000), null);
});

test("maliyet tahmini eksik token sayımlarını 0 kabul eder", () => {
  assert.equal(estimateCostUsd("gpt-4o-mini", null, undefined), 0);
});
