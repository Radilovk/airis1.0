import type { QuestionnaireData } from '@/types'

/**
 * Приемът на вода в литри. Нови отговори идват в `waterLitres`; старите отчети
 * пазят само `hydration` в чаши (~250 мл).
 */
export function waterLitresOf(q: Pick<QuestionnaireData, 'hydration' | 'waterLitres'> | undefined): number {
  if (!q) return 2
  if (typeof q.waterLitres === 'number' && Number.isFinite(q.waterLitres)) return q.waterLitres
  return (Number.isFinite(q.hydration) ? q.hydration : 8) * 0.25
}

/** „1,5 л“ — с десетична запетая, без излишна нула. */
export function formatLitres(litres: number): string {
  const rounded = Math.round(litres * 100) / 100
  return `${String(rounded).replace('.', ',')} л`
}

/** Достатъчен ли е приемът (≥ 2 л) — прагът, на който досега бяха 8 чаши. */
export function waterIsEnough(q: Pick<QuestionnaireData, 'hydration' | 'waterLitres'>): boolean {
  return waterLitresOf(q) >= 2
}

/** Под минимума (< 1,5 л) — досега 6 чаши. */
export function waterIsLow(q: Pick<QuestionnaireData, 'hydration' | 'waterLitres'>): boolean {
  return waterLitresOf(q) < 1.5
}
