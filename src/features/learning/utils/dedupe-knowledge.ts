/**
 * Pending knowledge UI / cleanup için başlık bazlı tekilleştirme.
 */

export function normalizeKnowledgeTitle(title: string): string {
  return title
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,!?;:"'()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

type WithTitle = { id: string; title: string; created_at?: string | null };

/**
 * Aynı normalize başlıktan yalnızca en yeni kaydı bırakır.
 */
export function dedupeKnowledgeByTitle<T extends WithTitle>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = normalizeKnowledgeTitle(item.title);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    const existingAt = existing.created_at ?? "";
    const nextAt = item.created_at ?? "";
    if (nextAt >= existingAt) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}
