/**
 * Tüm API route (Route Handler) cevapları için standart zarf (envelope).
 * Bkz. `.cursor/rules/01-code-quality.mdc` — API cevapları standart yapıda
 * olsun; ham hata (stack trace, sürücü hatası) doğrudan istemciye sızmasın.
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export function apiSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function apiError(code: string, message: string): ApiResponse<never> {
  return { success: false, error: { code, message } };
}
