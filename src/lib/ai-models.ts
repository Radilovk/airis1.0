/**
 * Препоръчан Google модел за калибрирания iris pipeline.
 *
 * Избор (авг. 2026, синтетичен бенчмарк + live Gemini):
 * - gemini-3.6-flash: 100% location recall, 75% dual-seam agreement, ~2× по-бърз от 2.5-flash
 * - gemini-2.5-flash: същият recall, но 40% dual-seam; 404 при част от новите API ключове
 * - flash-lite: по-евтин, но без валидирана точност за координатна детекция
 *
 * За vision + JSON детекция на ирисови ленти flash tier е достатъчен — pro не добавя
 * пропорционална стойност спрямо 4–8 заявки на анализ.
 */
export const RECOMMENDED_GEMINI_MODEL = 'gemini-3.6-flash'

/** Списък за Admin — препоръчаният модел е първи. */
export const GEMINI_MODELS = [
  RECOMMENDED_GEMINI_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  // gemini-2.5-* връща 404 за нови API ключове (авг. 2026)
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
] as const

export function geminiModelLabel(model: string): string {
  return model === RECOMMENDED_GEMINI_MODEL ? `${model} (препоръчан)` : model
}
