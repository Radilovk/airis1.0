/**
 * live-capture.ts — кога камерата да снима сама.
 *
 * Човек често не вижда екрана: държи задната камера към лицето си или снима
 * пред огледало. Затова решението „сега“ се взема от кадрите, а не от бутон.
 * Всеки кадър дава по едно `FrameReading` за всяко око; `CaptureGate` го
 * сравнява с предишните и казва колко сме близо до добра снимка и какво да
 * се поправи.
 *
 * Добра снимка = окото е намерено, отворено, достатъчно едро, в кадъра,
 * телефонът е неподвижен и рязкостта е близо до най-добрата от последните
 * секунди. Последното е относително нарочно: абсолютният праг зависи от
 * телефона и светлината, а „по-рязко от това няма да стане“ работи навсякъде.
 *
 * РАЗМЕРЪТ. Камерата на телефона не фокусира по-близо от ~8–10 cm. Оттам
 * кадърът е широк ~12–15 cm, а ирисът (12 mm) заема 7–10 % от ширината.
 * По-едър ирис не може да се иска — човекът ще се приближава, а образът
 * ще става все по-размазан. Детайлите идват от пълната резолюция на сензора
 * при самата снимка, не от по-близкото снимане.
 */

/**
 * Подсказките са в реда, в който се поправят: първо окото в средата на
 * кадъра, после разстоянието, погледът в обектива, клепачите и накрая
 * неподвижност и фокус. („Гледайте в обектива“ се казва и веднага щом окото
 * бъде намерено — виж `LiveIrisCamera`.)
 */
export type CaptureHint =
  | 'search'
  | 'closer'
  | 'farther'
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveDown'
  | 'gaze'
  | 'open'
  | 'raise'
  | 'lower'
  | 'hold'
  | 'focus'
  | 'ready'

export interface FrameReading {
  found: boolean
  /** Пиксели на видеото. */
  cx: number
  cy: number
  r: number
  frameW: number
  frameH: number
  /** Част от диаметъра на ириса под горния / долния клепач; undefined, ако не е измерено. */
  topCover?: number
  bottomCover?: number
  /** Ирисът между ъглите на окото, 0..1 (0.5 = гледа право); undefined без AI. */
  gaze?: number
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

export interface GateTarget {
  /** Диаметър на ириса като дял от късата страна на кадъра. */
  minDiameter: number
  maxDiameter: number
  /** Центърът на ириса да е поне толкова навътре от ръба (дял от страната). */
  edgeMargin: number
}

/** Двете очи наведнъж: и двете трябва да влязат, затова ирисът е по-малък. */
export const TARGET_BOTH: GateTarget = { minDiameter: 0.06, maxDiameter: 0.2, edgeMargin: 0.1 }
/** По едно око: може малко по-близо, окото да е по-скоро в средата. */
export const TARGET_SINGLE: GateTarget = { minDiameter: 0.085, maxDiameter: 0.4, edgeMargin: 0.2 }

export const LIVE_CAPTURE = {
  /**
   * Колко от ириса могат да крият клепачите. Горният клепач по природа покрива
   * 10–15 % — затова прагът е над това; долният обикновено не покрива нищо.
   */
  maxTopCover: 0.22,
  maxBottomCover: 0.12,
  /** Отклонение на погледа от средата на окото (0.5), над което човек не гледа в обектива. */
  maxGazeOffset: 0.13,
  /** Допустимо преместване между два кадъра, дял от радиуса. */
  maxShift: 0.12,
  maxRadiusChange: 0.1,
  maxRotation: 20,
  /** Под това кадърът е размазан, колкото и да е „най-добрият“. */
  sharpnessFloor: 25,
  /**
   * Отвореността и абсолютният праг за рязкост зависят от човека, телефона и
   * светлината. Ако всичко друго е наред толкова време, двете се пропускат и
   * се снима най-рязкият момент — по-добре снимка, отколкото безкрайно чакане.
   */
  patienceMs: 3000,
  /** Рязкост ≥ този дял от най-добрата за прозореца. */
  sharpnessShare: 0.8,
  /**
   * Прозорецът се мери във време, но на бавен телефон в него влизат само
   * 3–4 кадъра, затова изискваме само 3.
   */
  sharpnessWindowMs: 3000,
  minSharpSamples: 3,
  /** Толкова поредни добри кадъра преди снимката (~0.3–0.5 s). */
  readyStreak: 3,
}

export class CaptureGate {
  private prev: FrameReading | null = null
  private sharpHistory: { t: number; v: number }[] = []
  private streak = 0
  private settledSince: number | null = null

  constructor(private target: GateTarget) {}

  setTarget(target: GateTarget) {
    this.target = target
    this.reset()
  }

  reset() {
    this.prev = null
    this.sharpHistory = []
    this.streak = 0
    this.settledSince = null
  }

  push(f: FrameReading): CaptureState {
    const C = LIVE_CAPTURE
    const T = this.target
    const prev = this.prev
    this.prev = f.found ? f : null

    if (!f.found || f.r <= 0) {
      this.streak = 0
      return { score: 0, hint: 'search', ready: false }
    }

    const short = Math.min(f.frameW, f.frameH)
    const d = (2 * f.r) / short
    const sizeOk = d >= T.minDiameter && d <= T.maxDiameter
    const sizeScore = sizeOk ? 1 : d < T.minDiameter ? Math.max(0, d / T.minDiameter) : Math.max(0, 1 - (d - T.maxDiameter) / T.maxDiameter)

    const mx = T.edgeMargin * f.frameW
    const my = T.edgeMargin * f.frameH
    // Задната камера гледа човека: окото вляво в кадъра е от ДЯСНАТА му
    // страна, затова телефонът трябва да отиде надясно (от негова гледна точка).
    const move: CaptureHint | null =
      f.cx < mx ? 'moveRight' : f.cx > f.frameW - mx ? 'moveLeft' : f.cy < my ? 'moveUp' : f.cy > f.frameH - my ? 'moveDown' : null
    const centerOk = move === null

    let stable = false
    if (prev) {
      const shift = Math.hypot(f.cx - prev.cx, f.cy - prev.cy) / f.r
      const dr = Math.abs(f.r - prev.r) / f.r
      stable = shift <= C.maxShift && dr <= C.maxRadiusChange && (f.rotation === undefined || f.rotation <= C.maxRotation)
    }

    this.sharpHistory = this.sharpHistory.filter(s => f.t - s.t <= C.sharpnessWindowMs)
    this.sharpHistory.push({ t: f.t, v: f.sharpness })
    const peak = Math.max(...this.sharpHistory.map(s => s.v))
    const settled = sizeOk && centerOk && stable
    if (!settled) this.settledSince = null
    else if (this.settledSince === null) this.settledSince = f.t
    const patient = this.settledSince !== null && f.t - this.settledSince >= C.patienceMs

    const gazeOk = patient || f.gaze === undefined || Math.abs(f.gaze - 0.5) <= C.maxGazeOffset
    const topOk = f.topCover === undefined || f.topCover <= C.maxTopCover
    const bottomOk = f.bottomCover === undefined || f.bottomCover <= C.maxBottomCover
    const openOk = patient || (topOk && bottomOk)
    // И двата клепача → присвито око. Само горният → човек гледа надолу към
    // ниско държан телефон: вдигнете го. Само долният → обратното.
    const lidHint: CaptureHint = !topOk && !bottomOk ? 'open' : !topOk ? 'raise' : 'lower'
    const sharpOk =
      this.sharpHistory.length >= C.minSharpSamples &&
      (patient || f.sharpness >= C.sharpnessFloor) &&
      f.sharpness >= peak * C.sharpnessShare
    const sharpScore = peak > 0 ? Math.min(1, f.sharpness / peak) * (f.sharpness >= C.sharpnessFloor ? 1 : 0.5) : 0

    const allOk = sizeOk && centerOk && gazeOk && openOk && stable && sharpOk
    this.streak = allOk ? this.streak + 1 : 0

    const score = Math.min(
      1,
      0.25 + 0.25 * sizeScore + 0.1 * (centerOk ? 1 : 0) + 0.2 * (stable ? 1 : 0) + 0.2 * sharpScore
    )

    // Първо окото в средата — ако се приближава встрани, ще излезе от кадъра.
    const hint: CaptureHint = move
      ? move
      : !sizeOk
        ? d < T.minDiameter
          ? 'closer'
          : 'farther'
        : !gazeOk
          ? 'gaze'
          : !openOk
            ? lidHint
            : !stable
              ? 'hold'
              : !sharpOk
                ? 'focus'
                : 'ready'

    return { score: allOk ? Math.max(score, 0.95) : Math.min(score, 0.9), hint, ready: this.streak >= C.readyStreak }
  }
}

/** Кратки подсказки — показват се едро на екрана и се казват на глас. */
export const HINT_TEXT: Record<CaptureHint, string> = {
  search: 'Търся очите',
  closer: 'По-близо',
  farther: 'По-далеч',
  moveLeft: 'Преместете телефона наляво',
  moveRight: 'Преместете телефона надясно',
  moveUp: 'Вдигнете телефона',
  moveDown: 'Свалете телефона',
  gaze: 'Гледайте в обектива',
  open: 'Отворете широко очите',
  raise: 'Вдигнете леко телефона',
  lower: 'Свалете леко телефона',
  hold: 'Задръжте неподвижно',
  focus: 'Фокусирам…',
  ready: 'Снимам',
}

/** Защо — по-дребно под подсказката, само на екрана. */
export const HINT_WHY: Partial<Record<CaptureHint, string>> = {
  search: 'Насочете задната камера към лицето',
  closer: 'Окото е малко в кадъра',
  farther: 'Камерата не фокусира толкова близо',
  moveLeft: 'Окото е извън средата',
  moveRight: 'Окото е извън средата',
  moveUp: 'Окото е извън средата',
  moveDown: 'Окото е извън средата',
  gaze: 'В малкото кръгче на гърба, не в екрана',
  open: 'Клепачите закриват ириса',
  raise: 'Горният клепач закрива ириса — гледайте нагоре към обектива',
  lower: 'Долният клепач закрива ириса',
  hold: 'Телефонът се движи',
  focus: 'Чакам най-рязкия момент',
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
