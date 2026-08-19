/**
 * iris-geometry.ts — намиране на зеницата и лимбуса ИЗЦЯЛО В БРАУЗЪРА.
 *
 * ЗАЩО СЪЩЕСТВУВА ТОЗИ ФАЙЛ
 * ──────────────────────────
 * Досега единственият източник на геометрия беше `method1/app.py` — Flask/OpenCV
 * бекенд, който се вика само ако е зададена `VITE_IRIS_BACKEND_URL`. Приложението
 * се разгръща като статичен сайт (GitHub Pages), тоест в реална употреба тази
 * променлива не е зададена, бекендът не се вика и `unwrappedDataUrl` е undefined.
 * Тогава кодът пращаше на модела ОРИГИНАЛНАТА кръгла снимка заедно с текст
 * „зеницата е в центъра, 12:00 е горе". Нищо в снимката не потвърждаваше това:
 * зеницата рядко е точно в центъра на кадъра, мащабът е неизвестен, а клепачите
 * не са маркирани. Локализацията на находките беше по същество догадка.
 *
 * Тук геометрията се измерва от самото изображение, детерминистично, без мрежа.
 * Всичко надолу по веригата (разгъвката, координатната мрежа, промптът,
 * визуализацията) стъпва върху ЕДИН измерен резултат.
 *
 * МЕТОД
 * ─────
 *  1. Downscale към работна резолюция (≈320 px) — бързо и по-устойчиво на шум.
 *  2. Груба локализация на зеницата: търсене по (център, радиус) на максимума на
 *     „среден пръстен навън − среден диск навътре" върху интензивността, с
 *     интегрално изображение. Спекуларните отблясъци се приравняват към нула,
 *     защото винаги падат вътре в зеницата.
 *  3. Прецизиране: радиален градиентен оператор (аналог на интегро-диференциалния
 *     оператор на Daugman); взима се ПЪРВАТА достатъчно силна стъпка навън, а не
 *     най-силната — най-силната често е лимбусът.
 *  4. Лимбус: същият радиален оператор, но с полярност „светло навън" и
 *     ограничен до вертикалната лента ±35° около хоризонталата (там клепачите
 *     не пречат).
 *  5. Оценка на увереността от контраста на градиента спрямо фона.
 */

export interface Circle {
  cx: number
  cy: number
  r: number
}

export interface IrisGeometry {
  /** Координати в пиксели на ОРИГИНАЛНОТО изображение. */
  pupil: Circle
  limbus: Circle
  /** Ширина/височина на изображението, за което важи геометрията. */
  imageWidth: number
  imageHeight: number
  /** 0..1 — колко уверено е намерена зеницата. */
  pupilConfidence: number
  /** 0..1 — колко уверено е намерен лимбусът. */
  limbusConfidence: number
  /** true, когато потребителят е коригирал ръчно. */
  manual?: boolean
}

const WORK_SIZE = 320

interface Gray {
  data: Float32Array
  w: number
  h: number
}

/* ── помощни ─────────────────────────────────────────────────────────────── */

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

/** Сваля изображението до работен размер и връща сива карта + мащаб. */
function toWorkingGray(img: HTMLImageElement | HTMLCanvasElement): {
  gray: Gray
  scale: number
  srcW: number
  srcH: number
  rgb: Uint8ClampedArray
} {
  const srcW = 'naturalWidth' in img ? img.naturalWidth || img.width : img.width
  const srcH = 'naturalHeight' in img ? img.naturalHeight || img.height : img.height
  const scale = Math.min(1, WORK_SIZE / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const gray = new Float32Array(w * h)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    // Rec. 601 luma
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return { gray: { data: gray, w, h }, scale, srcW, srcH, rgb: data }
}

/** Разделяне 3×3 box blur, изпълнено `passes` пъти — евтина апроксимация на Гаус. */
function blur(g: Gray, passes = 2): Gray {
  const { w, h } = g
  let src = g.data
  let dst = new Float32Array(w * h)
  for (let p = 0; p < passes; p++) {
    // хоризонтално
    for (let y = 0; y < h; y++) {
      const row = y * w
      for (let x = 0; x < w; x++) {
        const a = src[row + Math.max(0, x - 1)]
        const b = src[row + x]
        const c = src[row + Math.min(w - 1, x + 1)]
        dst[row + x] = (a + b + c) / 3
      }
    }
    // вертикално
    const tmp = src
    src = dst
    dst = tmp
    for (let y = 0; y < h; y++) {
      const row = y * w
      const up = Math.max(0, y - 1) * w
      const dn = Math.min(h - 1, y + 1) * w
      for (let x = 0; x < w; x++) {
        dst[row + x] = (src[up + x] + src[row + x] + src[dn + x]) / 3
      }
    }
    const t2 = src
    src = dst
    dst = t2
  }
  return { data: src, w, h }
}

/** Интегрално изображение (summed-area table) с размер (w+1)×(h+1). */
function integral(values: Float32Array, w: number, h: number): Float64Array {
  const sat = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += values[y * w + x]
      sat[(y + 1) * (w + 1) + (x + 1)] = sat[y * (w + 1) + (x + 1)] + rowSum
    }
  }
  return sat
}

function satSum(sat: Float64Array, w: number, x0: number, y0: number, x1: number, y1: number) {
  const W = w + 1
  return (
    sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0]
  )
}

/** Средна интензивност по окръжност с радиус r. Връща NaN, ако излиза от кадъра. */
function ringMean(g: Gray, cx: number, cy: number, r: number, samples: number, angles?: number[]): number {
  let sum = 0
  let n = 0
  const list = angles ?? Array.from({ length: samples }, (_, i) => (i / samples) * Math.PI * 2)
  for (const a of list) {
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= g.w || yi >= g.h) continue
    sum += g.data[yi * g.w + xi]
    n++
  }
  return n === 0 ? NaN : sum / n
}

/**
 * Радиален градиентен оператор: за всеки радиус смята |mean(r+d) − mean(r−d)|
 * със знак, зададен от `polarity` (+1 = светло навън, тоест тъмен диск отвътре).
 * Връща най-добрия радиус и силата на прехода.
 */
function scanRadius(
  g: Gray,
  cx: number,
  cy: number,
  rMin: number,
  rMax: number,
  step: number,
  polarity: 1 | -1,
  angles?: number[]
): { r: number; strength: number; profile: number[] } {
  const d = Math.max(1.5, (rMax - rMin) * 0.02)
  let bestR = rMin
  let best = -Infinity
  const profile: number[] = []
  for (let r = rMin; r <= rMax; r += step) {
    const inner = ringMean(g, cx, cy, r - d, 48, angles)
    const outer = ringMean(g, cx, cy, r + d, 48, angles)
    if (Number.isNaN(inner) || Number.isNaN(outer)) {
      profile.push(0)
      continue
    }
    const v = polarity * (outer - inner)
    profile.push(v)
    if (v > best) {
      best = v
      bestR = r
    }
  }
  return { r: bestR, strength: best, profile }
}

/** Увереност от силата на прехода спрямо разсейването на профила. */
function confidenceFromProfile(strength: number, profile: number[]): number {
  const vals = profile.filter(v => Number.isFinite(v))
  if (vals.length < 3 || !Number.isFinite(strength)) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const varSum = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
  const sd = Math.sqrt(varSum)
  if (sd < 1e-6) return 0
  const z = (strength - mean) / sd
  // z≈2 → ~0.5 ; z≈5 → ~0.9
  return clamp((z - 1) / 5, 0, 1)
}

/* ── зеница ──────────────────────────────────────────────────────────────── */

/**
 * „Pupilness" карта: спекуларните отблясъци (почти бяло) се приравняват към
 * нула. Те винаги падат ВЪТРЕ в зеницата и иначе я разкъсват на две.
 */
function pupilnessMap(g: Gray, rgb: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(g.w * g.h)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    const isSpecular = rgb[p] > 232 && rgb[p + 1] > 232 && rgb[p + 2] > 232
    out[i] = isSpecular ? 0 : g.data[i]
  }
  return out
}

/** Средна стойност в квадрат със страна `side`, центриран в (cx, cy). */
function boxMean(sat: Float64Array, w: number, h: number, cx: number, cy: number, side: number) {
  const half = side / 2
  const x0 = Math.max(0, Math.round(cx - half))
  const y0 = Math.max(0, Math.round(cy - half))
  const x1 = Math.min(w, Math.round(cx + half))
  const y1 = Math.min(h, Math.round(cy + half))
  const area = (x1 - x0) * (y1 - y0)
  if (area <= 0) return NaN
  return satSum(sat, w, x0, y0, x1, y1) / area
}

/**
 * Груба локализация на зеницата.
 *
 * Резултатът е max по (cx, cy, r) на:
 *     mean(пръстен 2.2r…3.2r)  −  mean(диск ≈1.4r)
 *
 * минус абсолютен член за тъмнина на диска.
 *
 * Двата члена са необходими:
 *   • Само контраст → преходът ирис→склера е също толкова силен, колкото
 *     зеница→ирис, и детекторът избира целия ирис. (Точно това се случваше.)
 *   • Само тъмнина → печели всяко тъмно петно, включително мигли и сянка.
 *
 * Работи върху ИНТЕНЗИВНОСТ, а не върху бинарна маска по персентил: при тъмни
 * ириси голяма част от текстурата попада под всеки разумен праг.
 */
const ABSOLUTE_DARKNESS_WEIGHT = 0.6

function coarsePupil(g: Gray, rgb: Uint8ClampedArray): { cx: number; cy: number; r: number } {
  const { w, h } = g
  const values = pupilnessMap(g, rgb)
  const sat = integral(values, w, h)
  const minDim = Math.min(w, h)

  const rMin = Math.max(3, Math.round(minDim * 0.035))
  const rMax = Math.round(minDim * 0.24)

  let best = { cx: w / 2, cy: h / 2, r: minDim * 0.1, score: -Infinity }

  // Зеницата е близо до центъра на изрязания кадър — стесняваме търсенето,
  // което и ускорява, и предпазва от закачане за тъмен фон в ъглите.
  const marginX = w * 0.16
  const marginY = h * 0.16

  for (let r = rMin; r <= rMax; r += 2) {
    const innerSide = r * 1.4
    const outerSide = r * 3.2
    const midSide = r * 2.2
    const step = Math.max(2, Math.round(r / 3))

    for (let cy = marginY; cy <= h - marginY; cy += step) {
      for (let cx = marginX; cx <= w - marginX; cx += step) {
        const disc = boxMean(sat, w, h, cx, cy, innerSide)
        if (Number.isNaN(disc)) continue

        const outerAll = boxMean(sat, w, h, cx, cy, outerSide)
        const midAll = boxMean(sat, w, h, cx, cy, midSide)
        if (Number.isNaN(outerAll) || Number.isNaN(midAll)) continue

        const outerArea = Math.min(w, cx + outerSide / 2) - Math.max(0, cx - outerSide / 2)
        const midArea = Math.min(w, cx + midSide / 2) - Math.max(0, cx - midSide / 2)
        if (outerArea <= midArea) continue

        // средно в пръстена между midSide и outerSide
        const aOuter = outerSide * outerSide
        const aMid = midSide * midSide
        const ring = (outerAll * aOuter - midAll * aMid) / Math.max(1, aOuter - aMid)

        // Само контрастът „пръстен − диск" НЕ стига: преходът ирис→склера е
        // също толкова силен, колкото зеница→ирис, и детекторът избираше
        // целия ирис. Затова добавяме абсолютен член за тъмнина — зеницата е
        // практически черна, докато ирисът не е.
        const score = ring - disc - ABSOLUTE_DARKNESS_WEIGHT * disc
        if (score > best.score) best = { cx, cy, r, score }
      }
    }
  }
  return { cx: best.cx, cy: best.cy, r: best.r }
}

/**
 * Прецизиране на зеницата.
 *
 * От профила на радиалния градиент се взима НЕ глобалният максимум, а НАЙ-МАЛКИЯТ
 * радиус, при който преходът достига 65 % от максимума. Причината: лимбусът също
 * е силен преход „тъмно→светло" и при по-широк обхват на търсене печели той.
 * Границата на зеницата винаги е първата такава стъпка навън.
 */
function refinePupil(g: Gray, seed: { cx: number; cy: number; r: number }) {
  const rLo = Math.max(3, seed.r * 0.55)
  const rHi = seed.r * 1.7

  let best = {
    cx: seed.cx,
    cy: seed.cy,
    r: seed.r,
    strength: -Infinity,
    profile: [] as number[],
  }

  const span = Math.max(2, Math.round(seed.r * 0.45))
  for (let dy = -span; dy <= span; dy += 2) {
    for (let dx = -span; dx <= span; dx += 2) {
      const cx = seed.cx + dx
      const cy = seed.cy + dy
      const res = scanRadius(g, cx, cy, rLo, rHi, 1, 1)
      if (res.strength > best.strength) {
        best = { cx, cy, r: res.r, strength: res.strength, profile: res.profile }
      }
    }
  }

  // Първата достатъчно силна стъпка навън, а не най-силната.
  if (best.profile.length > 2 && Number.isFinite(best.strength)) {
    const threshold = best.strength * 0.65
    for (let i = 0; i < best.profile.length; i++) {
      if (best.profile[i] >= threshold) {
        best.r = rLo + i
        break
      }
    }
  }

  return best
}

/* ── лимбус ──────────────────────────────────────────────────────────────── */

/**
 * Лимбусът се търси само по хоризонталните сектори (±35° около 3:00 и 9:00),
 * защото горе и долу клепачите систематично изместват прехода.
 */
const LIMBUS_ANGLES: number[] = (() => {
  const a: number[] = []
  for (let deg = -35; deg <= 35; deg += 5) {
    a.push((deg * Math.PI) / 180) // около 3:00
    a.push(Math.PI + (deg * Math.PI) / 180) // около 9:00
  }
  return a
})()

function findLimbus(g: Gray, pupil: { cx: number; cy: number; r: number }) {
  // Само хоризонталният обхват има значение — LIMBUS_ANGLES гледа наляво и
  // надясно, така че ограничението идва от ширината, не от височината.
  const maxHorizontal = Math.max(pupil.cx, g.w - pupil.cx)
  const rMin = Math.max(pupil.r * 1.7, pupil.r + 4)
  // Ирисът може да е изрязан плътно до ръба на кадъра, затова не свиваме
  // обхвата до вписан кръг — оставяме търсенето да стигне до ширината.
  const rMax = Math.min(pupil.r * 7, maxHorizontal * 1.02)

  if (rMax <= rMin) {
    return { cx: pupil.cx, cy: pupil.cy, r: pupil.r * 3.2, strength: 0, profile: [] as number[] }
  }

  // центърът на лимбуса може леко да се различава от този на зеницата
  let best = { cx: pupil.cx, cy: pupil.cy, r: rMin, strength: -Infinity, profile: [] as number[] }
  const span = Math.max(2, Math.round(pupil.r * 0.5))
  for (let dy = -span; dy <= span; dy += 2) {
    for (let dx = -span; dx <= span; dx += 2) {
      const cx = pupil.cx + dx
      const cy = pupil.cy + dy
      // на лимбуса склерата е ПО-СВЕТЛА от ириса → полярност +1
      const res = scanRadius(g, cx, cy, rMin, rMax, 1, 1, LIMBUS_ANGLES)
      if (res.strength > best.strength) {
        best = { cx, cy, r: res.r, strength: res.strength, profile: res.profile }
      }
    }
  }
  return best
}

/* ── публично API ────────────────────────────────────────────────────────── */

/**
 * Открива геометрията на ириса в подаденото изображение.
 * Никога не хвърля — при неуспех връща разумна оценка с ниска увереност,
 * така че потребителят винаги може да коригира ръчно.
 */
export function detectIrisGeometry(img: HTMLImageElement | HTMLCanvasElement): IrisGeometry {
  const { gray, scale, srcW, srcH, rgb } = toWorkingGray(img)
  const smooth = blur(gray, 2)

  const fallback = (): IrisGeometry => ({
    pupil: { cx: srcW / 2, cy: srcH / 2, r: Math.min(srcW, srcH) * 0.11 },
    limbus: { cx: srcW / 2, cy: srcH / 2, r: Math.min(srcW, srcH) * 0.45 },
    imageWidth: srcW,
    imageHeight: srcH,
    pupilConfidence: 0,
    limbusConfidence: 0,
  })

  try {
    const seed = coarsePupil(smooth, rgb)
    const pupil = refinePupil(smooth, seed)
    const limbus = findLimbus(smooth, pupil)

    const inv = 1 / scale
    const geo: IrisGeometry = {
      pupil: { cx: pupil.cx * inv, cy: pupil.cy * inv, r: pupil.r * inv },
      limbus: { cx: limbus.cx * inv, cy: limbus.cy * inv, r: limbus.r * inv },
      imageWidth: srcW,
      imageHeight: srcH,
      pupilConfidence: confidenceFromProfile(pupil.strength, pupil.profile),
      limbusConfidence: confidenceFromProfile(limbus.strength, limbus.profile),
    }

    // Санитарни ограничения: физиологично отношение зеница/ирис е ≈0.15–0.65.
    const ratio = geo.pupil.r / Math.max(1, geo.limbus.r)
    if (!Number.isFinite(ratio) || ratio < 0.1 || ratio > 0.72) {
      geo.pupilConfidence *= 0.35
      geo.limbusConfidence *= 0.35
      if (ratio > 0.72) geo.limbus.r = geo.pupil.r / 0.4
      if (ratio < 0.1) geo.pupil.r = geo.limbus.r * 0.22
    }
    return geo
  } catch {
    return fallback()
  }
}

/** Зарежда data URL и открива геометрията. */
export function detectIrisGeometryFromDataUrl(dataUrl: string): Promise<IrisGeometry> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(detectIrisGeometry(img))
    img.onerror = () =>
      resolve({
        pupil: { cx: 0, cy: 0, r: 0 },
        limbus: { cx: 0, cy: 0, r: 0 },
        imageWidth: 0,
        imageHeight: 0,
        pupilConfidence: 0,
        limbusConfidence: 0,
      })
    img.src = dataUrl
  })
}

/** Отношение зеница/ирис — използва се и от оценката на качеството. */
export function pupilRatio(geo: IrisGeometry): number {
  return geo.limbus.r > 0 ? geo.pupil.r / geo.limbus.r : 0
}

/**
 * Каква част от диска на ириса реално попада в кадъра (0..1).
 * Отрязан ирис = ненадеждни периферни пръстени.
 */
export function irisFrameCoverage(geo: IrisGeometry): number {
  const { cx, cy, r } = geo.limbus
  if (r <= 0) return 0
  const margins = [cx, cy, geo.imageWidth - cx, geo.imageHeight - cy]
  // приблизително: делът на обиколката, който остава в кадъра
  let inside = 0
  const N = 72
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    if (x >= 0 && y >= 0 && x < geo.imageWidth && y < geo.imageHeight) inside++
  }
  void margins
  return inside / N
}
