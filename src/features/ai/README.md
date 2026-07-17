# features/ai

**Menü:** AI (`/dashboard/ai`)

**Sahip olduğu tablo(lar):** `ai_runs`, `ai_feedback`, `recommendations`

**İlgili dokümantasyon:** `docs/AI.md`, `.cursor/rules/04-ai-behavior.mdc`

## v1 — Basit DM asistanı

- `prompts/simple-assistant.ts` — system prompt
- `repositories/ai-runs.repository.ts` — `ai_runs` yazma
- `services/simple-assistant.service.ts` — OpenAI cevap + log

Hafıza, RAG ve satış kuralları sonraki fazda eklenecek.
