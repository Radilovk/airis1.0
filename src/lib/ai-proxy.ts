/**
 * Откъде AIRIS вика Gemini.
 *
 * Сайтът е статичен и публичен — ключ в кода би бил видим за всеки. Затова
 * по подразбиране заявките минават през worker-а `airis-ai` (`worker/`), който
 * пази ключа като таен. Клиентът не настройва нищо.
 *
 * Собствен ключ от настройките (за администратора) все още работи: тогава
 * заявката отива директно към Google.
 */
export const AI_PROXY_URL: string =
  (import.meta.env.VITE_AI_PROXY_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://airis-ai.radilov-k.workers.dev'

export function geminiEndpoint(model: string, apiKey?: string): { url: string; headers: Record<string, string> } {
  const path = `/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const key = apiKey?.trim()
  if (key) {
    return {
      url: `https://generativelanguage.googleapis.com${path}`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    }
  }
  return { url: `${AI_PROXY_URL}${path}`, headers: { 'Content-Type': 'application/json' } }
}
