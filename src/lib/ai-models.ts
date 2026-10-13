/**
 * Препоръчан Google модел за калибрирания iris pipeline.
 *
 * Избор (окт. 2026):
 * - gemini-3.8-flash: най-новият стабилен flash, по-силно зрение от 3.6. По
 *   подразбиране мисли на ниво „medium" — затова заявките изрично искат „low"
 *   (виж `geminiThinkingConfig`). Без това всяка от ~13-те заявки на анализ
 *   чакаше дълго разсъждение, което за JSON детекция не носи точност.
 * - gemini-3.6-flash: валидиран в бенчмарка (100% location recall), остава избор.
 * - gemini-2.5-* е достъпен само за стари ключове; 2.0 и 3-pro-preview са спрени.
 *
 * За vision + JSON детекция на ирисови ленти flash tier е достатъчен — pro не добавя
 * пропорционална стойност спрямо 13 заявки на анализ.
 */
export const RECOMMENDED_GEMINI_MODEL = 'gemini-3.8-flash'

/** Списък за Admin — препоръчаният модел е първи. */
export const GEMINI_MODELS = [
  RECOMMENDED_GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-flash-latest',
] as const

/**
 * Стари или спрени модели, записани в настройките на устройствата. При тях
 * заявката отива към препоръчания модел, вместо да върне 404 или да е бавна.
 */
const RETIRED_GEMINI_MODELS = new Set([
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.6-flash',
  'gemini-pro-latest',
  'gemini-flash-lite-latest',
])

export function resolveGeminiModel(model: string | undefined | null): string {
  const m = (model ?? '').trim()
  return !m || RETIRED_GEMINI_MODELS.has(m) ? RECOMMENDED_GEMINI_MODEL : m
}

/** Модели, които приемат „minimal" — най-бързото ниво на мислене. */
const MINIMAL_THINKING = /gemini-3\.6-flash|gemini-3\.5-flash-lite|gemini-3-flash|flash-lite/

/**
 * Най-ниското ниво на мислене, което моделът приема. Детекцията и
 * интерпретацията искат строг JSON по готова схема — дългото разсъждение само
 * бави. `null` = не пращаме нищо (моделът не поддържа настройката).
 */
export function geminiThinkingConfig(model: string): Record<string, unknown> | null {
  if (/gemini-(1\.|2\.0)/.test(model)) return null
  if (/gemini-2\.5-flash-lite/.test(model)) return null
  if (/gemini-2\.5/.test(model)) return { thinkingBudget: /pro/.test(model) ? 128 : 0 }
  return { thinkingLevel: MINIMAL_THINKING.test(model) ? 'minimal' : 'low' }
}

export function geminiModelLabel(model: string): string {
  return model === RECOMMENDED_GEMINI_MODEL ? `${model} (препоръчан)` : model
}
