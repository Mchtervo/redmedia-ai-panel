import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEnv } from "./env";

const BASE_VALID: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-placeholder-1234567890",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder-1234567890",
};

test("zorunlu değişkenler tamsa geçer", () => {
  const result = validateEnv({ ...BASE_VALID });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("zorunlu Supabase değişkeni eksikse hata verir", () => {
  const env = { ...BASE_VALID };
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  const result = validateEnv(env);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes("SUPABASE_SERVICE_ROLE_KEY"))
  );
});

test("geçersiz Supabase URL reddedilir", () => {
  const result = validateEnv({
    ...BASE_VALID,
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("NEXT_PUBLIC_SUPABASE_URL")));
});

test("geçersiz CHATPLACE_MCP_URL hata üretir", () => {
  const result = validateEnv({
    ...BASE_VALID,
    CHATPLACE_MCP_URL: "mcp.chatplace.io",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("CHATPLACE_MCP_URL")));
});

test("NEXT_PUBLIC_ öneki ile sır sızdırma tespit edilir", () => {
  const result = validateEnv({
    ...BASE_VALID,
    NEXT_PUBLIC_OPENAI_API_KEY: "sk-leaked",
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes("NEXT_PUBLIC_OPENAI_API_KEY"))
  );
  // Hata mesajı sır DEĞERİNİ içermez.
  assert.ok(!result.errors.join(" ").includes("sk-leaked"));
});

test("bilinen güvenli NEXT_PUBLIC_ değişkenleri hata üretmez", () => {
  const result = validateEnv({ ...BASE_VALID });
  assert.equal(
    result.errors.filter((e) => e.includes("NEXT_PUBLIC_SUPABASE")).length,
    0
  );
});

test("webhook secret/token OPSİYONEL: yokluğu startup'ı bozmaz", () => {
  const result = validateEnv({ ...BASE_VALID });
  assert.equal(result.ok, true);
  assert.ok(!result.errors.join(" ").includes("CHATPLACE_WEBHOOK"));
});

test("deprecated OPENAI_MODEL uyarı üretir ama hata üretmez", () => {
  const result = validateEnv({ ...BASE_VALID, OPENAI_MODEL: "gpt-4o-mini" });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes("OPENAI_MODEL")));
});

test("MCP kısmi yapılandırma (yalnız API key) uyarı üretir", () => {
  const result = validateEnv({ ...BASE_VALID, CHATPLACE_API_KEY: "x".repeat(20) });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes("CHATPLACE_MCP_URL")));
});

test("geçersiz model adı biçimi hata üretir", () => {
  const result = validateEnv({
    ...BASE_VALID,
    OPENAI_MODEL_FAST: "bad model name!!",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("OPENAI_MODEL_FAST")));
});
