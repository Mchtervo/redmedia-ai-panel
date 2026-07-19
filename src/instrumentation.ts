/**
 * Next.js instrumentation hook: sunucu başlarken bir kez çalışır.
 * Zorunlu environment değişkenleri eksikse süreç net bir hata ile durur
 * (docs/45_ENVIRONMENT_CONFIGURATION.md).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertServerEnv } = await import("@/lib/env");
    assertServerEnv();
  }
}
