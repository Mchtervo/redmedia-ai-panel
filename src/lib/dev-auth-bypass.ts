/**
 * Local panel erişimi — yalnızca development.
 * Production'da env set edilse bile ASLA açılmaz.
 */
export function isDevAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const flag = process.env.DEV_BYPASS_AUTH?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}
