/**
 * live-capture.ts — кога камерата да снима сама.
 *
 * Човек често не вижда екрана: държи задната камера към окото си или снима
 * пред огледало. Затова решението „сега“ се взема от кадрите, а не от бутон.
 * Всеки анализиран кадър дава едно `FrameReading`; `CaptureGate` го сравнява
 * с предишните и казва колко сме близо до добра снимка и какво да се поправи.
 *
 * Добра снимка = ирисът е намерен уверено, достатъчно е голям, в центъра е,
 * телефонът е неподвижен и рязкостта е близо до най-добрата от последните
 * секунди. Последното е относително нарочно: абсолютният праг зависи от
 * телефона и светлината, а „по-рязко от това няма да стане“ работи навсякъде.
 */

export type CaptureHint = 'search' | 'closer' | 'farther' | 'center' | 'hold' | 'focus' | 'ready'

export interface FrameReading {
  /** Ирис, намерен в анализирания квадрат; координатите са в пиксели на квадрата. */
  found: boolean
  cx: number
  cy: number
  r: number
  /** Страна на анализирания квадрат. */
  side: number
  /** Увереност за зеницата и за лимбуса, 0..1. */
  pupilConfidence: number
  limbusConfidence: number
  /** Дисперсия на Лапласиана в пръстена на ириса — виж `irisSharpness`. */
  sharpness: number
  /** Скорост на въртене на телефона, °/s; undefined, ако няма жироскоп. */
  rotation?: number
  t: number
}

export interface CaptureState {
  /** 0..1 — колко близо сме до снимка; движи звука и лентата. */
  score: number
  hint: CaptureHint
  ready: boolean
}

export const LIVE_CAPTURE = {
  /**
   * Зеницата се открива уверено (рязък тъмен ръб), лимбусът — не: мекият
   * преход ирис→склера дава 0.15–0.45 и при добри снимки. Затова различни
   * прагове; 0.15 е и прагът на `iris-quality` за „лимбусът не е намерен“.
   */
  minPupilConfidence: 0.5,
  minLimbusConfidence: 0.15,
  /** Радиус на ириса спрямо квадрата: под това е далеч, над това — твърде близо. */
  minRadius: 0.17,
  maxRadius: 0.42,
  /** Допустимо отместване на центъра от средата, дял от квадрата. */
  maxOffset: 0.14,
  /** Допустимо преместване между два кадъра, дял от радиуса. */
  maxShift: 0.08,
  maxRadiusChange: 0.07,
  maxRotation: 15,
  /** Под това кадърът е размазан, колкото и да е „най-добрият“. */
  sharpnessFloor: 40,
  /** Рязкост ≥ този дял от най-добрата за прозореца. */
  sharpnessShare: 0.85,
  /**
   * Прозорецът се мери във време, но на бавен телефон в него влизат само
   * 3–4 кадъра (при две очи — по-малко), затова изискваме само 3.
   */
  sharpnessWindowMs: 3000,
  minSharpSamples: 3,
  /** Толкова поредни добри кадъра преди снимката (~0.4–0.6 s). */
  readyStreak: 3,
}

export class CaptureGate {
  private prev: FrameReading | null = null
  private sharpHistory: { t: number; v: number }[] = []
  private streak = 0

  reset() {
    this.prev = null
    this.sharpHistory = []
    this.streak = 0
  }

  push(f: FrameReading): CaptureState {
    const C = LIVE_CAPTURE
    const prev = this.prev
    this.prev = f.found ? f : null

    if (!f.found || f.pupilConfidence < C.minPupilConfidence || f.limbusConfidence < C.minLimbusConfidence) {
      this.streak = 0
      return { score: 0, hint: 'search', ready: false }
    }

    const rRel = f.r / f.side
    const sizeOk = rRel >= C.minRadius && rRel <= C.maxRadius
    const sizeScore = sizeOk ? 1 : rRel < C.minRadius ? Math.max(0, rRel / C.minRadius) : Math.max(0, 1 - (rRel - C.maxRadius) / C.maxRadius)

    const offset = Math.max(Math.abs(f.cx / f.side - 0.5), Math.abs(f.cy / f.side - 0.5))
    const centerOk = offset <= C.maxOffset
    const centerScore = centerOk ? 1 : Math.max(0, 1 - (offset - C.maxOffset) / 0.2)

    let stable = false
    if (prev) {
      const shift = Math.hypot(f.cx - prev.cx, f.cy - prev.cy) / f.r
      const dr = Math.abs(f.r - prev.r) / f.r
      stable = shift <= C.maxShift && dr <= C.maxRadiusChange && (f.rotation === undefined || f.rotation <= C.maxRotation)
    }

    this.sharpHistory = this.sharpHistory.filter(s => f.t - s.t <= C.sharpnessWindowMs)
    this.sharpHistory.push({ t: f.t, v: f.sharpness })
    const peak = Math.max(...this.sharpHistory.map(s => s.v))
    const sharpOk =
      this.sharpHistory.length >= C.minSharpSamples &&
      f.sharpness >= C.sharpnessFloor &&
      f.sharpness >= peak * C.sharpnessShare
    const sharpScore = peak > 0 ? Math.min(1, f.sharpness / peak) * (f.sharpness >= C.sharpnessFloor ? 1 : 0.5) : 0

    const allOk = sizeOk && centerOk && stable && sharpOk
    this.streak = allOk ? this.streak + 1 : 0

    const score = Math.min(
      1,
      0.25 + 0.2 * sizeScore + 0.15 * centerScore + 0.2 * (stable ? 1 : 0) + 0.2 * sharpScore
    )

    const hint: CaptureHint = !sizeOk
      ? rRel < C.minRadius
        ? 'closer'
        : 'farther'
      : !centerOk
        ? 'center'
        : !stable
          ? 'hold'
          : !sharpOk
            ? 'focus'
            : 'ready'

    return { score: allOk ? Math.max(score, 0.95) : Math.min(score, 0.9), hint, ready: this.streak >= C.readyStreak }
  }
}

/** Кратки подсказки — показват се на екрана и се казват на глас. */
export const HINT_TEXT: Record<CaptureHint, string> = {
  search: 'Търся окото',
  closer: 'По-близо',
  farther: 'По-далеч',
  center: 'Окото в средата',
  hold: 'Задръжте неподвижно',
  focus: 'Фокусирам…',
  ready: 'Снимам',
}

/**
 * Рязкост на ириса: дисперсия на Лапласиана в пръстена между зеницата и
 * лимбуса, върху изрязване в пълната резолюция на кадъра. Зеницата и
 * отблясъкът в нея се изключват — те са резки и при размазан ирис.
 */
export function irisSharpness(
  source: CanvasImageSource,
  cx: number,
  cy: number,
  r: number,
  canvas: HTMLCanvasElement,
  size = 160
): number {
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || r <= 0) return 0
  ctx.drawImage(source, cx - r, cy - r, 2 * r, 2 * r, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  const gray = new Float32Array(size * size)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]

  const c = size / 2
  const rIn = c * 0.5
  const rOut = c * 0.9
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const d = Math.hypot(x - c, y - c)
      if (d < rIn || d > rOut) continue
      const i = y * size + x
      // Прегорелите петна (отблясък от светкавицата) не са текстура на ириса.
      if (gray[i] > 245) continue
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - size] - gray[i + size]
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  if (n < 50) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}
