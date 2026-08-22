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
  /** Хоризонтален радиус (и единственият, ако окото гледа право в камерата). */
  r: number
  /**
   * Вертикален радиус на лимбуса — присъства само когато е измерим.
   * Измерено върху снимка със светкавица: rx=366, ry=354.
   */
  ry?: number
}

/**
 * Криви на клепачите — квадратни полиноми y = c0·x² + c1·x + c2 в координати на
 * ОРИГИНАЛНОТО изображение. `null` означава „не е открит клепач от тази страна",
 * тоест ирисът е свободен дотам.
 */
export interface Eyelids {
  upper: [number, number, number] | null
  lower: [number, number, number] | null
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
  /** Открити криви на клепачите; използват се от разгъвката за маскиране. */
  eyelids?: Eyelids
}

/** Зеницата и лимбусът споделят център — иначе мрежата в калибратора изглежда изместена. */
export function concentricGeometry(geo: IrisGeometry): IrisGeometry {
  const { cx, cy } = geo.limbus
  return {
    ...geo,
    pupil: { ...geo.pupil, cx, cy },
    limbus: { ...geo.limbus, cx, cy },
  }
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

/**
 * Средна интензивност по окръжност с радиус r.
 *
 * Връща NaN, ако ПРЕКАЛЕНО МАЛКО проби попадат в кадъра. Прагът не е козметика:
 * докато извънкадровите проби просто се пропускаха, кандидат с изместен център
 * можеше да спечели, защото се оценяваше само по половината окръжност, която
 * случайно попада на добър преход. Синтетичният тест го хвана — там лимбусът
 * излезе r=428 вместо 280, с център, изтеглен наляво извън кадъра.
 */
function ringMean(
  g: Gray,
  cx: number,
  cy: number,
  r: number,
  samples: number,
  angles?: number[],
  minCoverage = 0.8
): number {
  let sum = 0
  let n = 0
  const list = angles ?? Array.from({ length: samples }, (_, i) => (i / samples) * Math.PI * 2)
  for (const a of list) {
    const xi = Math.round(cx + r * Math.cos(a))
    const yi = Math.round(cy + r * Math.sin(a))
    if (xi < 0 || yi < 0 || xi >= g.w || yi >= g.h) continue
    sum += g.data[yi * g.w + xi]
    n++
  }
  if (n === 0 || n < list.length * minCoverage) return NaN
  return sum / n
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

/**
 * Относителен контраст на границата: (средно навън − средно навътре) спрямо
 * сумата им. Мярката е нормирана, тоест не зависи от общата експонация.
 *
 * ЗАЩО НЕ Z-ОЦЕНКА НА ПРОФИЛА (както беше)
 * ────────────────────────────────────────
 * Първата версия смяташе колко „изпъква" най-силният радиус спрямо целия
 * профил. Върху синтетичен ирис с рязък ръб това дава високи стойности, но
 * върху РЕАЛНИ снимки границата на зеницата е плавна и съседните радиуси също
 * имат силен градиент — z-оценката пада. Измерено върху две реални снимки с
 * визуално ТОЧНА детекция: старата метрика връщаше 0.14 и 0.22, при праг за
 * отхвърляне 0.35. Тоест приложението отхвърляше добри снимки.
 *
 * Контрастът е физически смислен: зеницата е почти черна, ирисът около нея е
 * значително по-светъл. Същите две снимки дават 0.79 и 0.76, а кадър без око —
 * 0.00.
 */
function edgeContrast(
  g: Gray,
  cx: number,
  cy: number,
  r: number,
  angles?: number[]
): number {
  const band = Math.max(2, r * 0.18)
  const inner = ringMean(g, cx, cy, r - band, 64, angles)
  const outer = ringMean(g, cx, cy, r + band, 64, angles)
  if (Number.isNaN(inner) || Number.isNaN(outer)) return 0
  const sum = inner + outer
  if (sum < 1) return 0
  return clamp((outer - inner) / sum, 0, 1)
}

/**
 * Увереност = предимно контраст на границата, плюс малък дял „изпъкване" на
 * профила. Вторият член пази от фалшиви положителни върху плавна сянка, която
 * има контраст, но няма ясен ръб.
 */
function confidence(
  contrast: number,
  strength: number,
  profile: number[],
  contrastScale: number
): number {
  const contrastScore = clamp((contrast - 0.06) / contrastScale, 0, 1)

  const vals = profile.filter(v => Number.isFinite(v))
  let peakScore = 0
  if (vals.length >= 3 && Number.isFinite(strength)) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
    if (sd > 1e-6) peakScore = clamp(((strength - mean) / sd - 0.5) / 3, 0, 1)
  }

  return clamp(0.8 * contrastScore + 0.2 * peakScore, 0, 1)
}

/**
 * Ъгли за търсене на лимбуса: ±35° около 3:00 и 9:00. Горе и долу клепачите
 * систематично изместват прехода ирис→склера, затова там не се мери.
 */
const LIMBUS_ANGLES: number[] = (() => {
  const a: number[] = []
  for (let deg = -35; deg <= 35; deg += 5) {
    a.push((deg * Math.PI) / 180)
    a.push(Math.PI + (deg * Math.PI) / 180)
  }
  return a
})()

/**
 * Същите ъгли, но разделени на ДВЕ СТРАНИ — темпорална и назална.
 *
 * Разделянето не е козметично. Оценката „среден външен пръстен минус среден
 * вътрешен" се лъже систематично: зеницата (яркост ≈ 10) е много по-тъмна от
 * ириса (≈ 130), затова търсенето печели, като измести кръга настрани, докато
 * ЕДНАТА страна на вътрешния пръстен попадне в зеницата, а ОТСРЕЩНАТА страна на
 * външния — в склерата. Аритметиката при истина cx=600, r_ирис=430, r_зеница=130:
 *
 *   истинският кръг   cx=600 r=430 → 102
 *   изместеният кръг  cx=750 r=278 → 111   ← печели
 *
 * Резултатът беше радиус 0.63–0.77 от истинския при всеки размер, с изместен
 * център. Затова двете страни се оценяват поотделно и печели ПО-СЛАБАТА:
 * изместеният кръг е добър от едната страна и лош от другата, истинският —
 * добър и от двете. Няма нова константа за донастройване.
 */
const LIMBUS_ANGLE_GROUPS: number[][] = (() => {
  // Четири групи вместо две: горна и долна половина на всяка от двете дъги.
  // Изместена окръжност може да съвпадне по две групи, но не по четири.
  const g: number[][] = [[], [], [], []]
  for (let deg = -35; deg <= 35; deg += 5) {
    const rad = (deg * Math.PI) / 180
    g[deg < 0 ? 0 : 1].push(rad)
    g[deg < 0 ? 2 : 3].push(Math.PI + rad)
  }
  return g
})()

/**
 * Колко се наказва разсейката между групите. Концентричната с лимбуса
 * окръжност дава ЕДНАКЪВ преход във всички посоки; изместената дава силен в
 * едни и слаб в други. Наказанието превръща тази симетрия в част от критерия,
 * вместо да се разчита само на най-слабата група.
 */
const ASYMMETRY_PENALTY = 0.6

/** Силата на прехода ирис→склера от едната страна на кандидат-окръжността. */
function limbusHalfScore(g: Gray, cx: number, cy: number, r: number, angles: number[]): number {
  const inner = ringMean(g, cx, cy, r * 0.82, 32, angles)
  const outer = ringMean(g, cx, cy, r * 1.18, 32, angles)
  if (Number.isNaN(inner) || Number.isNaN(outer)) return NaN
  return outer - inner
}

/* ── лимбус (търси се ПРЪВ) ──────────────────────────────────────────────── */

/**
 * РЕДЪТ Е ОБЪРНАТ СПРЯМО ПЪРВАТА ВЕРСИЯ.
 *
 * Първо се търси лимбусът, после зеницата ВЪТРЕ в него. Причината е измерена:
 * върху снимка на тъмнокафяв ирис детекторът, който тръгваше от зеницата, се
 * хвана за тъмно петно от отражение на клон — зеница r=35 и лимбус r=60 при
 * действителни ≈75 и ≈330.
 *
 * При тъмен ирис преходът зеница→ирис е нищожен, докато преходът ирис→склера е
 * силен при ВСЕКИ цвят на очите: склерата е бяла независимо от пигмента.
 * Затова надеждният ориентир е лимбусът, а зеницата се търси в ограничен
 * диапазон спрямо него — физиологично отношението е 0.15–0.65.
 */
function coarseLimbus(g: Gray): { cx: number; cy: number; r: number } {
  const { w, h } = g
  const minDim = Math.min(w, h)

  let best = { cx: w / 2, cy: h / 2, r: minDim * 0.3, score: -Infinity }

  const rMin = Math.round(minDim * 0.14)
  const rMax = Math.round(minDim * 0.48)

  for (let r = rMin; r <= rMax; r += 2) {
    // Пръстените се вземат само по хоризонталата, където клепачите не пречат.
    for (let cy = Math.round(h * 0.3); cy <= Math.round(h * 0.7); cy += 4) {
      for (let cx = Math.round(w * 0.3); cx <= Math.round(w * 0.7); cx += 4) {
        let lo = Infinity
        let hi = -Infinity
        let bad = false
        for (const group of LIMBUS_ANGLE_GROUPS) {
          const v = limbusHalfScore(g, cx, cy, r, group)
          if (Number.isNaN(v)) { bad = true; break }
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
        if (bad) continue
        // ПО-СЛАБАТА група решава, а разсейката между групите се наказва.
        // Виж коментара при `LIMBUS_ANGLE_GROUPS`.
        const score = lo - ASYMMETRY_PENALTY * (hi - lo)
        if (score > best.score) best = { cx, cy, r, score }
      }
    }
  }
  return { cx: best.cx, cy: best.cy, r: best.r }
}

function refineLimbus(g: Gray, seed: { cx: number; cy: number; r: number }) {
  let best = {
    cx: seed.cx,
    cy: seed.cy,
    r: seed.r,
    strength: -Infinity,
    profile: [] as number[],
  }
  const span = Math.max(3, Math.round(seed.r * 0.12))
  for (let dy = -span; dy <= span; dy += 2) {
    for (let dx = -span; dx <= span; dx += 2) {
      const res = scanRadius(
        g, seed.cx + dx, seed.cy + dy,
        seed.r * 0.8, seed.r * 1.25, 1, 1, LIMBUS_ANGLES
      )
      if (res.strength > best.strength) {
        best = { cx: seed.cx + dx, cy: seed.cy + dy, r: res.r, strength: res.strength, profile: res.profile }
      }
    }
  }
  return best
}

/** Ъгли за вертикално измерване: ±22° около 12:00 и 6:00. */
const VERTICAL_ANGLES: number[] = (() => {
  const a: number[] = []
  for (let deg = -22; deg <= 22; deg += 4) {
    a.push(-Math.PI / 2 + (deg * Math.PI) / 180)
    a.push(Math.PI / 2 + (deg * Math.PI) / 180)
  }
  return a
})()

/**
 * Опит за измерване на ВЕРТИКАЛНИЯ радиус на лимбуса.
 *
 * Ирисът се проектира като ЕЛИПСА, щом погледът е дори леко встрани от камерата,
 * а кръговият модел тогава вкарва склера в най-външните пръстени. Маскирането на
 * клепачи не помага, защото това е видима склера, а не клепач.
 *
 * Отгоре и отдолу обаче често има клепач, затова резултатът се приема само при
 * строги условия: радиусът да е в [0.75, 1.06]·rx и извън ръба да е толкова
 * светло, колкото извън хоризонталния ръб — тоест да е СКЛЕРА, а не кожа.
 * Иначе се връща `undefined` и моделът остава кръгов: по-добре леко голям кръг,
 * отколкото прекалено малък, който отрязва истинска тъкан.
 */
function measureVerticalRadius(
  g: Gray,
  cx: number,
  cy: number,
  rx: number
): number | undefined {
  const res = scanRadius(g, cx, cy, rx * 0.72, rx * 1.1, 1, 1, VERTICAL_ANGLES)
  if (!Number.isFinite(res.strength) || res.strength <= 0) return undefined

  const ry = res.r
  if (ry < rx * 0.75 || ry > rx * 1.06) return undefined

  const outsideV = ringMean(g, cx, cy, ry * 1.08, 32, VERTICAL_ANGLES)
  const outsideH = ringMean(g, cx, cy, rx * 1.08, 32, LIMBUS_ANGLES)
  if (Number.isNaN(outsideV) || Number.isNaN(outsideH)) return undefined
  if (outsideV < outsideH * 0.85) return undefined

  return ry
}

/* ── зеница (в границите на лимбуса) ─────────────────────────────────────── */

/**
 * Заменя спекуларните пиксели със средното на най-близките неспекуларни съседи
 * по същия ред. Така отблясъкът не създава нито фалшив тъмен, нито фалшив светъл
 * преход — просто изчезва.
 *
 * Предишната версия го ЗАНУЛЯВАШЕ, тоест го броеше за абсолютно черно, което е
 * по-лошо от самия проблем: зануленото петно ставаше най-тъмната област в кадъра.
 */
function despeckle(g: Gray, rgb: Uint8ClampedArray): Gray {
  const { w, h } = g
  const out = new Float32Array(g.data)
  const isSpec = (i: number) => {
    const p = i * 4
    return rgb[p] > 232 && rgb[p + 1] > 232 && rgb[p + 2] > 232
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!isSpec(i)) continue
      let l = x - 1
      while (l >= 0 && isSpec(y * w + l)) l--
      let r = x + 1
      while (r < w && isSpec(y * w + r)) r++
      const a = l >= 0 ? g.data[y * w + l] : NaN
      const b = r < w ? g.data[y * w + r] : NaN
      if (Number.isNaN(a) && Number.isNaN(b)) continue
      out[i] = Number.isNaN(a) ? b : Number.isNaN(b) ? a : (a + b) / 2
    }
  }
  return { data: out, w, h }
}

/**
 * Локализация на зеницата ВЪТРЕ в вече намерения лимбус.
 *
 * ЗАЩО НЕ ТЪРСЕНЕ НА „НАЙ-ТЪМНИЯ КОМПАКТЕН ДИСК" (както беше)
 * ────────────────────────────────────────────────────────────
 * Върху снимка СЪС СВЕТКАВИЦА това се счупи. Измереният радиален профил показва
 * ярко ядро от отблясъка (яркост 189 в центъра), спад до 44 при радиус ≈80 px и
 * изкачване до плато ≈105 при ≈130 px — тоест ръбът на зеницата е при ≈100 px.
 * Детекторът върна 45: попадна върху спадащата част на ореола около отблясъка.
 * По-лошо, прецизирането се ограничаваше до 0.6–1.6× от този погрешен резултат,
 * така че истинската граница оставаше ИЗВЪН обхвата и не можеше да бъде намерена.
 *
 * Сега, след като лимбусът е известен и надежден, се прилага директно радиалният
 * оператор (Daugman) в физиологично ограничен диапазон 0.08–0.62 от радиуса на
 * лимбуса. В този диапазон най-силният преход „тъмно → светло" Е ръбът на
 * зеницата: лимбусът е извън обхвата, а отблясъкът дава преход с ОБРАТЕН знак и
 * затова изобщо не се конкурира.
 */
function findPupil(
  g: Gray,
  rgb: Uint8ClampedArray,
  limbus: { cx: number; cy: number; r: number }
) {
  const clean = despeckle(g, rgb)

  const rLo = Math.max(3, limbus.r * 0.08)
  const rHi = limbus.r * 0.62
  const span = limbus.r * 0.28

  let best = {
    cx: limbus.cx,
    cy: limbus.cy,
    r: limbus.r * 0.25,
    strength: -Infinity,
    profile: [] as number[],
  }

  const step = Math.max(2, Math.round(limbus.r * 0.05))
  for (let dy = -span; dy <= span; dy += step) {
    for (let dx = -span; dx <= span; dx += step) {
      const res = scanRadius(clean, limbus.cx + dx, limbus.cy + dy, rLo, rHi, 1, 1)
      if (res.strength > best.strength) {
        best = {
          cx: limbus.cx + dx,
          cy: limbus.cy + dy,
          r: res.r,
          strength: res.strength,
          profile: res.profile,
        }
      }
    }
  }

  // Фино дотягане на центъра около най-добрия кандидат.
  const coarse = { ...best }
  for (let dy = -step; dy <= step; dy++) {
    for (let dx = -step; dx <= step; dx++) {
      const res = scanRadius(
        clean,
        coarse.cx + dx,
        coarse.cy + dy,
        Math.max(rLo, coarse.r * 0.7),
        Math.min(rHi, coarse.r * 1.4),
        1,
        1
      )
      if (res.strength > best.strength) {
        best = {
          cx: coarse.cx + dx,
          cy: coarse.cy + dy,
          r: res.r,
          strength: res.strength,
          profile: res.profile,
        }
      }
    }
  }

  return best
}

/* ── клепачи ─────────────────────────────────────────────────────────────── */

/**
 * Откриване на горния и долния клепач чрез RANSAC на квадратна крива.
 *
 * ЗАЩО ГЕОМЕТРИЧНО, А НЕ ПО ЦВЯТ
 * ──────────────────────────────
 * Първо пробвах класификация по цветност (хроматичност спрямо еталон от средния
 * ирис). Измерването върху две реални снимки показа, че разпределенията се
 * припокриват тежко: при всеки праг се губят 50–80 % от истинската ирисова
 * тъкан, за да се хванат 60–100 % от външната. При лешниково-зелени ириси на
 * топла светлина цветът на ириса е твърде близък до цвета на кожата.
 *
 * Клепачът обаче е ГЕОМЕТРИЧЕН обект: гладка крива с рязък хоризонтален ръб.
 * Затова се търси по вертикалния градиент, а кривата се напасва с RANSAC, за да
 * не я развалят миглите и отблясъците.
 *
 * Мащабът е този на работното изображение; коефициентите се преобразуват към
 * оригинала преди връщане.
 */
function detectEyelids(g: Gray, limbus: { cx: number; cy: number; r: number }): Eyelids {
  const { w, h } = g

  // Вертикален градиент |∂I/∂y| (Sobel 3×3, само y).
  const gy = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const up = g.data[(y - 1) * w + x - 1] + 2 * g.data[(y - 1) * w + x] + g.data[(y - 1) * w + x + 1]
      const dn = g.data[(y + 1) * w + x - 1] + 2 * g.data[(y + 1) * w + x] + g.data[(y + 1) * w + x + 1]
      gy[y * w + x] = Math.abs(dn - up)
    }
  }

  const x0 = Math.max(1, Math.round(limbus.cx - limbus.r))
  const x1 = Math.min(w - 2, Math.round(limbus.cx + limbus.r))
  if (x1 - x0 < 12) return { upper: null, lower: null }

  const upPts: Array<[number, number]> = []
  const loPts: Array<[number, number]> = []
  const upVal: number[] = []
  const loVal: number[] = []

  // Търси се само в поясите близо до ръба на ириса — навътре е самата тъкан.
  const bandFrac = 0.4

  for (let x = x0; x <= x1; x++) {
    const dx = x - limbus.cx
    const inside = limbus.r * limbus.r - dx * dx
    if (inside <= 0) continue
    const half = Math.sqrt(inside)
    const yTop = Math.max(1, Math.floor(limbus.cy - half))
    const yBot = Math.min(h - 2, Math.ceil(limbus.cy + half))

    const upEnd = Math.min(Math.round(limbus.cy) - 3, Math.round(limbus.cy - (1 - bandFrac) * half))
    if (upEnd > yTop + 3) {
      let best = -1
      let bestY = yTop
      for (let y = yTop; y <= upEnd; y++) {
        const v = gy[y * w + x]
        if (v > best) {
          best = v
          bestY = y
        }
      }
      upPts.push([x, bestY])
      upVal.push(best)
    }

    const loStart = Math.max(Math.round(limbus.cy) + 3, Math.round(limbus.cy + (1 - bandFrac) * half))
    if (yBot > loStart + 3) {
      let best = -1
      let bestY = yBot
      for (let y = loStart; y <= yBot; y++) {
        const v = gy[y * w + x]
        if (v > best) {
          best = v
          bestY = y
        }
      }
      loPts.push([x, bestY])
      loVal.push(best)
    }
  }

  const fit = (
    pts: Array<[number, number]>,
    vals: number[],
    seed: number
  ): [number, number, number] | null => {
    if (pts.length < 20) return null

    // Само точки със силен градиент — иначе се напасва текстурата на ириса.
    const sorted = [...vals].sort((a, b) => a - b)
    const thr = Math.max(28, sorted[Math.floor(sorted.length * 0.55)])
    const kept = pts.filter((_, i) => vals[i] >= thr)
    if (kept.length < 15) return null

    let rng = seed >>> 0
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0
      return rng / 4294967296
    }

    let bestCoef: [number, number, number] | null = null
    let bestCount = -1
    const tol = 3.0

    for (let iter = 0; iter < 220; iter++) {
      const a = kept[Math.floor(rand() * kept.length)]
      const b = kept[Math.floor(rand() * kept.length)]
      const c = kept[Math.floor(rand() * kept.length)]
      const coef = quadThrough(a, b, c)
      if (!coef) continue
      let n = 0
      for (const [px2, py] of kept) {
        const yy = coef[0] * px2 * px2 + coef[1] * px2 + coef[2]
        if (Math.abs(py - yy) < tol) n++
      }
      if (n > bestCount) {
        bestCount = n
        bestCoef = coef
      }
    }

    // Изисква се съгласие поне от половината силни точки.
    if (!bestCoef || bestCount < kept.length * 0.5) return null
    return bestCoef
  }

  const upper = fit(upPts, upVal, 12345)
  const lower = fit(loPts, loVal, 98765)

  // Преобразуване към координати на оригинала се прави от повикващия — тук
  // всичко е в работния мащаб.
  return { upper, lower }
}

/** Квадратна крива през три точки; null при израждане. */
function quadThrough(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): [number, number, number] | null {
  const [x1, y1] = p1
  const [x2, y2] = p2
  const [x3, y3] = p3
  const d = (x1 - x2) * (x1 - x3) * (x2 - x3)
  if (Math.abs(d) < 1e-6) return null
  const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / d
  const b =
    (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / d
  const c =
    (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 * (x1 - x2) * y3) / d
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null
  return [a, b, c]
}

/** Преобразува коефициенти от работния мащаб към оригиналния. */
function scaleQuad(
  coef: [number, number, number] | null,
  inv: number
): [number, number, number] | null {
  if (!coef) return null
  // y_orig = inv · y_work(x_orig / inv)
  return [coef[0] / inv, coef[1], coef[2] * inv]
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
    // Редът е: лимбус → зеница вътре в него. Виж коментара при `coarseLimbus`.
    const limbusSeed = coarseLimbus(smooth)
    const limbus = refineLimbus(smooth, limbusSeed)
    const pupil = findPupil(smooth, rgb, limbus)
    const limbusRy = measureVerticalRadius(smooth, limbus.cx, limbus.cy, limbus.r)

    const lidsWork = detectEyelids(smooth, limbus)

    const inv = 1 / scale
    const geo: IrisGeometry = {
      pupil: { cx: pupil.cx * inv, cy: pupil.cy * inv, r: pupil.r * inv },
      limbus: {
        cx: limbus.cx * inv,
        cy: limbus.cy * inv,
        r: limbus.r * inv,
        ...(limbusRy !== undefined ? { ry: limbusRy * inv } : {}),
      },
      imageWidth: srcW,
      imageHeight: srcH,
      // Мащабите са различни: зеницата е почти черна спрямо ириса (контраст
      // 0.4–0.8), докато преходът ирис→склера е по-мек (0.15–0.45).
      eyelids: {
        upper: scaleQuad(lidsWork.upper, inv),
        lower: scaleQuad(lidsWork.lower, inv),
      },
      pupilConfidence: confidence(
        edgeContrast(smooth, pupil.cx, pupil.cy, pupil.r),
        pupil.strength,
        pupil.profile,
        0.5
      ),
      limbusConfidence: confidence(
        edgeContrast(smooth, limbus.cx, limbus.cy, limbus.r, LIMBUS_ANGLES),
        limbus.strength,
        limbus.profile,
        0.3
      ),
    }

    // Санитарни ограничения: физиологично отношение зеница/ирис е ≈0.15–0.65.
    const ratio = geo.pupil.r / Math.max(1, geo.limbus.r)
    if (!Number.isFinite(ratio) || ratio < 0.1 || ratio > 0.72) {
      geo.pupilConfidence *= 0.35
      geo.limbusConfidence *= 0.35
      if (ratio > 0.72) geo.limbus.r = geo.pupil.r / 0.4
      if (ratio < 0.1) geo.pupil.r = geo.limbus.r * 0.22
    }
    return concentricGeometry(geo)
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
