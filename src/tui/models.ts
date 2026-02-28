export const DEFAULT_MODEL = "gpt-5.2"
export const AVAILABLE_MODELS = ["gpt-5.2", "claude-4.5-haiku", "glm-5", "kimi-k2.5"] as const

export function filterModels(query: string): string[] {
  const q = query.toLowerCase().trim()
  if (!q) return [...AVAILABLE_MODELS]
  return AVAILABLE_MODELS.filter((m) => m.toLowerCase().includes(q))
}
