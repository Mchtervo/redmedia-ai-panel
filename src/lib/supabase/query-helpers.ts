/**
 * PostgREST/Supabase sorgu string'leri için paylaşılan kaçış (escape)
 * yardımcıları. Birden fazla feature repository'sinin (contacts,
 * conversations, ...) arama filtresi oluştururken kullandığı, güvenlik
 * açısından hassas mantık — burada tek yerde tutulur (DRY).
 */

/**
 * ILIKE deseninde `%`, `_`, `\` özel karakterlerini kaçırır; kullanıcının
 * arama girdisindeki bu karakterler joker karakter olarak yorumlanmaz.
 */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * PostgREST `or()` mini-dilinde virgül, parantez, boşluk, çift tırnak gibi
 * ayraç karakterleri değer içinde geçiyorsa değeri çift tırnak içine alıp
 * kaçırmak gerekir (bkz. PostgREST "Reserved Characters" dokümantasyonu).
 * Bu olmadan kullanıcı girdisi filtre söz dizimini bozabilir.
 */
export function escapeOrFilterValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** `%terim%` desenini, kaçırılmış ve çift-tırnaklı, kullanıma hazır hale getirir. */
export function buildIlikeValue(term: string): string {
  return escapeOrFilterValue(`%${escapeIlikePattern(term)}%`);
}

/**
 * Birden fazla kolon için `or()` filtre string'i üretir, örn.:
 * `full_name.ilike."%terim%",username.ilike."%terim%"`
 */
export function buildOrIlikeFilter(columns: readonly string[], term: string): string {
  const value = buildIlikeValue(term);
  return columns.map((column) => `${column}.ilike.${value}`).join(",");
}
