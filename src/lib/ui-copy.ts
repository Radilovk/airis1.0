/** Централизирани потребителски текстове — единен тон и терминология. */

export const CALIBRATION = {
  title: (side: 'left' | 'right') =>
    `Настройка · ${side === 'left' ? 'ляв' : 'десен'} ирис`,
  subtitle: 'Подредете кръговете по окото — от това зависи точността на анализа.',
  measuring: 'Разпознаване на окото…',
  stepCenter: '1. Център',
  stepOuter: '2. Външен ръб',
  stepInner: '3. Зеница',
  hintCenter: 'Плъзнете кръста, докато центърът съвпадне със зеницата.',
  hintOuter: 'Нагласете жълтия кръг по външния ръб на цветната част на ириса.',
  hintInner: 'Нагласете синия кръг по ръба на зеницата (тъмната част в средата).',
  pupilLabel: 'зеница',
  outerLabel: 'външен ръб',
  autoReset: 'Автоматично',
  showGrid: 'Покажи мрежа',
  hideGrid: 'Скрий мрежа',
  stripTitle: 'Какво вижда анализът',
  stripHint:
    'Ирисът се разгъва в карта: 12 зони по часовника и 12 пръстена от зеницата навън. Засенчените части се пропускат.',
  confirm: 'Потвърди и продължи',
  confirmWarn: 'Потвърди с предупреждения',
  retake: 'Друга снимка',
  metricSharpness: 'Резкост',
  metricPupil: 'Зеница',
  metricCoverage: 'Видима зона',
  metricGlare: 'Без блясък',
  manualOk: 'Настроено ръчно — готово за анализ.',
  autoOk: 'Окото е разпознато автоматично. Проверете кръговете и продължете.',
  needsRetake: 'Нужна е нова снимка',
  needsRetakeHint:
    'Снимката не е подходяща — направете нова или коригирайте кръговете по-горе.',
  legendOuter: 'Жълт — по ръба на цветната част',
  legendInner: 'Син — по ръба на зеницата',
  gestureHint: 'Хванете кръг, за да го смените; плъзнете вътре, за да местите.',
  fineTune: 'Фина настройка (стрелки и размер)',
  smaller: 'По-малък',
  larger: 'По-голям',
} as const

/**
 * Поправя калки от английски („support“), които моделът понякога пише въпреки
 * указанието в промпта. „Подкрепа на червата“ не е български израз —
 * казва се „грижа за червата“; глаголът „подкрепя“ става „помага на“.
 */
const SUPPORT_REWRITES: Array<[RegExp, string]> = [
  [/(^|[^\p{L}])подкрепа\s+(?:на|за)\s+/gu, '$1грижа за '],
  [/(^|[^\p{L}])Подкрепа\s+(?:на|за)\s+/gu, '$1Грижа за '],
  [/(^|[^\p{L}])подкрепата\s+(?:на|за)\s+/gu, '$1грижата за '],
  [/(^|[^\p{L}])нужда\s+от\s+подкрепа/gu, '$1нужда от грижа'],
  [/(^|[^\p{L}])(имунна|чревна|чернодробна|хормонална|нервна)\s+подкрепа/giu, '$1грижа за $2та система'],
  [/(^|[^\p{L}])подкрепя(т)?\s+/gu, '$1помага$2 на '],
  [/(^|[^\p{L}])Подкрепя(т)?\s+/gu, '$1Помага$2 на '],
  [/(^|[^\p{L}])подкрепящ(и|а|о)?(?=[^\p{L}]|$)/gu, '$1помощн$2'],
  [/(^|[^\p{L}])подкрепа(?=[^\p{L}]|$)/gu, '$1грижа'],
]

export function naturalBulgarian(text: string): string {
  let out = text
  for (const [re, to] of SUPPORT_REWRITES) out = out.replace(re, to)
  // „помощн“ без окончание → „помощен“
  return out.replace(/(^|[^\p{L}])помощн(?=[^\p{L}]|$)/gu, '$1помощен')
}

/** Прилага `naturalBulgarian` върху всички низове в обект от модела. */
export function naturalBulgarianDeep<T>(value: T): T {
  if (typeof value === 'string') return naturalBulgarian(value) as T
  if (Array.isArray(value)) return value.map(v => naturalBulgarianDeep(v)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = naturalBulgarianDeep(v)
    return out as T
  }
  return value
}
