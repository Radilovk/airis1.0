/**
 * eye-health.ts — офталмологичен скрининг по снимката.
 *
 * ЗАЩО Е ОТДЕЛЕН СЛОЙ
 * ───────────────────
 * Иридологичната детекция гледа само РАЗГЪНАТАТА лента на ириса — тоест
 * склерата, ръбът на роговицата и вътрешността на зеницата са изрязани. А точно
 * там са знаците, които офталмологията приема сериозно:
 *
 *   • arcus (бял/сив пръстен по ръба на роговицата)       — липиди, възраст
 *   • помътняване в зеницата                              — леща (катаракта)
 *   • жълта / червена склера                              — билирубин, възпаление
 *   • кафеникаво-златист пръстен по лимбуса               — натрупване на мед
 *   • петно (невус) върху ириса, неправилна зеница        — за проследяване
 *   • птеригиум, анизокория, хетерохромия
 *
 * Този модул НЕ поставя диагнози. Всеки признак носи само „какво се вижда",
 * „защо има значение" и „какво да направите" — и ниво на насочване към очен
 * лекар (`EyeReferral`). Целта е човек със забележим знак да не го пропусне,
 * а не да бъде уплашен.
 *
 * Източниците са три и са независими:
 *   1. PHOTO       — един LLM пас върху ЦЯЛАТА снимка на окото (с промпт-чеклист).
 *   2. MEASUREMENT — код: зеница/ирис от калибрацията (анизокория) и цвят на
 *                    ириса в двете снимки (хетерохромия).
 *   3. IRIDOLOGY   — иридологичният „натриев/липиден ръб" е същият видим знак,
 *                    който офталмологията нарича arcus; превежда се дословно.
 */
import type {
  EyeHealthReport,
  EyeReferral,
  EyeSign,
  EyeSignKey,
  IrisGeometrySnapshot,
} from '@/types'

export type EyeSide = 'left' | 'right'

/* ── нива ────────────────────────────────────────────────────────────────── */

const REFERRAL_RANK: Record<EyeReferral, number> = { none: 0, routine: 1, soon: 2, urgent: 3 }

export function maxReferral(a: EyeReferral, b: EyeReferral): EyeReferral {
  return REFERRAL_RANK[a] >= REFERRAL_RANK[b] ? a : b
}

export function referralRank(r: EyeReferral): number {
  return REFERRAL_RANK[r]
}

export const REFERRAL_COPY: Record<EyeReferral, { title: string; body: string }> = {
  none: {
    title: 'Не виждаме знаци, които да изискват очен преглед',
    body:
      'По снимките не личат признаци, за които си струва да бързате при очен лекар. ' +
      'Профилактичен преглед веднъж на 1–2 години е добра идея, особено след 40 г.',
  },
  routine: {
    title: 'Добре е да си запишете профилактичен очен преглед',
    body:
      'Има видим знак, който не е спешен, но е добре да бъде погледнат от офталмолог ' +
      'при следващия удобен случай.',
  },
  soon: {
    title: 'Покажете се на очен лекар в близките седмици',
    body:
      'На снимките има знак, който заслужава преглед с биомикроскоп. Снимката може да ' +
      'подведе — затова решението е на лекаря, не на приложението.',
  },
  urgent: {
    title: 'Потърсете очен лекар възможно най-скоро',
    body:
      'Има знак, при който не бива да се чака. Ако има и болка, внезапна промяна в ' +
      'зрението или главоболие — спешна помощ.',
  },
}

const REFERRAL_CHIP: Record<EyeReferral, string> = {
  none: 'без нужда от преглед',
  routine: 'профилактичен преглед',
  soon: 'преглед в близките седмици',
  urgent: 'преглед веднага',
}

/** Кратък етикет за чип. */
export function eyeReferralChip(r: EyeReferral): string {
  return REFERRAL_CHIP[r]
}

/** Какво проверява скринингът — показва се, за да е ясно, че „чисто" е резултат. */
export const EYE_CHECKLIST = [
  'Ръб на роговицата (бял/сив пръстен)',
  'Зеница — прозрачност, форма, размер',
  'Бяло на окото — оттенък и зачервяване',
  'Ирис — петна и цвят на двете очи',
]

/* ── текстове по признак ─────────────────────────────────────────────────── */

interface SignCopy {
  title: string
  what: string
  why: string
  action: string
  referral: EyeReferral
}

interface CopyContext {
  age?: number
  side: EyeSign['side']
}

const COPY: Record<EyeSignKey, (ctx: CopyContext) => SignCopy> = {
  arcus: ({ age, side }) => {
    const young = age != null && age > 0 && age < 50
    const old = age != null && age >= 60
    const oneSided = side !== 'both'
    return {
      title: 'Светъл пръстен по ръба на роговицата (arcus)',
      what:
        'Бледосива или белезникава дъга по външния ръб на ириса. В иридологията се нарича ' +
        '„холестеролов" или „натриев" пръстен.',
      why: old
        ? 'След 60 г. е чест и обикновено безобиден възрастов знак. Полезно е все пак да знаете липидите си.'
        : young
          ? 'Под 50 г. този пръстен по-често върви с повишен холестерол — затова си струва да се провери.'
          : 'Може да е възрастов, но понякога върви с повишени липиди в кръвта.' +
            (oneSided ? ' Когато е само на едното око, лекарят може да поиска и допълнителни изследвания.' : ''),
      action: young || oneSided
        ? 'Помолете личния лекар за липиден профил и се покажете на офталмолог.'
        : 'При следващите изследвания включете липиден профил; очният лекар ще го види при рутинен преглед.',
      referral: young || oneSided ? 'soon' : 'routine',
    }
  },
  lens_opacity: ({ age }) => {
    const child = age != null && age > 0 && age < 18
    return {
      title: 'Помътняване в зеницата',
      what:
        'Зеницата изглежда сивкава, млечна или с белезникаво петно, вместо дълбоко черна ' +
        '(не става дума за отблясъка от светкавицата).',
      why: child
        ? 'При дете бял или сив рефлекс в зеницата изисква спешен преглед — причините се лекуват най-добре рано.'
        : 'Най-честата причина е помътняване на лещата (катаракта). Развива се бавно и се лекува успешно.',
      action: child
        ? 'Запишете час при детски офталмолог веднага.'
        : 'Покажете се на офталмолог — особено ако виждате размазано, цветовете избледняват или има ореоли около светлините.',
      referral: child ? 'urgent' : 'soon',
    }
  },
  scleral_yellow: () => ({
    title: 'Жълтеникав оттенък на бялото на окото',
    what: 'Склерата изглежда жълтеникава, а не бяла.',
    why:
      'Пожълтяването на склерата може да е знак за повишен билирубин. Често е и от топла ' +
      'светлина при снимането — затова първо проверете на дневна светлина.',
    action:
      'Погледнете окото в огледало на дневна светлина. Ако жълтото е реално — към личния лекар в близките дни.',
    referral: 'soon',
  }),
  scleral_red: () => ({
    title: 'Зачервено бяло на окото',
    what: 'Видими разширени съдове или общо зачервяване на склерата.',
    why: 'Най-често е от умора, сухота, екран или дразнене, но може да е и възпаление.',
    action:
      'Почивка, овлажняващи капки, по-малко екран. Ако има болка, светлобоязън или намалено зрение — очен лекар веднага.',
    referral: 'routine',
  }),
  limbal_ring: () => ({
    title: 'Кафеникаво-златист пръстен по периферията на ириса',
    what: 'Тъмна, златиста или зеленикава ивица точно по ръба на роговицата.',
    why:
      'Обикновено е пигмент на самия ирис, но в редки случаи такъв пръстен е признак за ' +
      'натрупване на мед в организма. Различава се само с биомикроскоп.',
    action: 'Покажете се на офталмолог, за да изключи пръстена на Кайзер–Флайшер.',
    referral: 'soon',
  }),
  iris_nevus: () => ({
    title: 'Тъмно петно (невус) върху ириса',
    what: 'Ясно очертано кафяво петно върху тъканта на ириса.',
    why:
      'Пигментните петна по ириса са чести и почти винаги безобидни, но — както бенките по ' +
      'кожата — е добре да се следят.',
    action:
      'Снимайте окото на същата светлина след 6–12 месеца. При растеж, промяна на формата или изкривена зеница — офталмолог.',
    referral: 'routine',
  }),
  pupil_irregular: () => ({
    title: 'Неправилна форма на зеницата',
    what: 'Зеницата не е кръгла — има вдлъбнатина, издърпване или форма на ключалка.',
    why: 'Може да е вродено, след прекарано възпаление или травма. Нова промяна винаги заслужава преглед.',
    action: 'Покажете окото на офталмолог, особено ако не сте забелязвали това преди.',
    referral: 'soon',
  }),
  pterygium: () => ({
    title: 'Израстък от ъгъла на окото към роговицата',
    what: 'Месесто, триъгълно удебеляване на конюнктивата, обикновено откъм носа.',
    why: 'Свързано е със слънце, вятър и сухота. Расте бавно и обикновено е безобидно.',
    action: 'Слънчеви очила с UV защита. Офталмолог, ако расте към зеницата или дразни.',
    referral: 'routine',
  }),
  anisocoria: () => ({
    title: 'Различна големина на зениците',
    what: 'Зеницата на едното око е видимо по-голяма от другата спрямо размера на ириса.',
    why:
      'До един от петима души има лека естествена разлика. Разлика обаче се получава и когато ' +
      'двете снимки са правени на различна светлина. Новопоявила се разлика заслужава преглед.',
    action:
      'Снимайте двете очи на еднаква светлина. Ако разликата се потвърди — офталмолог. ' +
      'Ако е внезапна и с главоболие, двойно виждане или увиснал клепач — спешна помощ.',
    referral: 'soon',
  }),
  heterochromia: () => ({
    title: 'Различен цвят на двата ириса',
    what: 'Ирисите на двете очи са в видимо различен оттенък.',
    why:
      'Вродената разлика е безобидна. Придобитата — появила се в зряла възраст — може да е след ' +
      'възпаление или от някои капки за очи. Различна светлина на двете снимки също дава разлика.',
    action: 'Ако цветът се е променил отскоро — покажете се на офталмолог.',
    referral: 'routine',
  }),
}

export function makeSign(
  key: EyeSignKey,
  side: EyeSign['side'],
  source: EyeSign['source'],
  confidence: number,
  age?: number,
  detail?: string
): EyeSign {
  const copy = COPY[key]({ age, side })
  return { key, side, source, confidence: round2(confidence), detail, ...copy }
}

function round2(v: number) {
  return Math.round(v * 100) / 100
}

/* ── LLM пас върху цялата снимка ────────────────────────────────────────── */

const PHOTO_KEYS: EyeSignKey[] = [
  'arcus',
  'lens_opacity',
  'scleral_yellow',
  'scleral_red',
  'limbal_ring',
  'iris_nevus',
  'pupil_irregular',
  'pterygium',
]

/**
 * Промпт за офталмологичния пас. Подава се ОРИГИНАЛНАТА снимка (не лентата),
 * защото склерата, ръбът на роговицата и зеницата са важни именно тук.
 *
 * Чеклистът изисква отговор за всеки признак, но с изрично правило, че
 * „present: true" се дава само при ЯСНО видим знак, и с изброени капани
 * (светкавица, червени очи, топла светлина, грим), които иначе дават фалшиви
 * положителни.
 */
export function buildEyeHealthPrompt(side: EyeSide): string {
  return `Ти си внимателен офталмолог, който гледа ЕДНА снимка на ${side === 'right' ? 'дясно' : 'ляво'} око.
Задачата е СКРИНИНГ: да отбележиш само ЯСНО ВИДИМИ външни знаци, при които човек
би трябвало да се покаже на очен лекар. Не поставяш диагноза.

За всеки признак отговори present true/false и confidence 0..1.
present=true САМО ако знакът се вижда ясно. При съмнение — false.
Ако зоната не се вижда (клепач, отблясък, изрязана снимка) — present=false, visible=false.

ПРИЗНАЦИ:
  "arcus"           — бледосив/белезникав пръстен или дъга по ВЪНШНИЯ ръб на ириса
                      (роговицата), често отделен от ириса с тясна по-тъмна ивица.
                      extent: "partial" (дъга, обикновено горе/долу) или "full".
  "lens_opacity"    — зеницата е сивкава/млечна/с бяло петно вместо черна.
                      НЕ Е: малка бяла точка или полумесец от светкавицата;
                      червени очи от светкавица; отражение на прозорец.
  "scleral_yellow"  — бялото на окото е жълтеникаво. Сравни с кожата и бялото на
                      снимката: ако ЦЯЛАТА снимка е топла/жълта, това е светлината — false.
  "scleral_red"     — ясно зачервяване или разширени съдове по склерата.
  "limbal_ring"     — златисто-кафява или зеленикава ивица ТОЧНО по ръба на роговицата,
                      различна от останалия цвят на ириса.
  "iris_nevus"      — ясно очертано, плътно тъмнокафяво петно върху ириса (не общ цвят,
                      не сянка от мигли). Дай clock — часовата позиция, напр. "4:30".
  "pupil_irregular" — зеницата не е кръгла: вдлъбнатина, ключалка, изтеглен ръб.
                      Леко овална от ъгъла на снимане — false.
  "pterygium"       — месесто триъгълно удебеление от ъгъла на окото към роговицата.

Освен това:
  "sclera_visible" — вижда ли се достатъчно бяло на окото, за да се прецени цветът.
  "white_balance"  — "neutral" | "warm" | "cool" — общият оттенък на снимката.
  "flash"          — има ли отблясък от светкавица в зеницата.

Върни САМО JSON, без markdown:
{"signs":{"arcus":{"present":false,"confidence":0.0,"visible":true,"extent":"none"},
"lens_opacity":{"present":false,"confidence":0.0,"visible":true},
"scleral_yellow":{"present":false,"confidence":0.0,"visible":true},
"scleral_red":{"present":false,"confidence":0.0,"visible":true},
"limbal_ring":{"present":false,"confidence":0.0,"visible":true},
"iris_nevus":{"present":false,"confidence":0.0,"visible":true,"clock":""},
"pupil_irregular":{"present":false,"confidence":0.0,"visible":true},
"pterygium":{"present":false,"confidence":0.0,"visible":true}},
"sclera_visible":true,"white_balance":"neutral","flash":false}`
}

export interface PhotoSign {
  key: EyeSignKey
  confidence: number
  detail?: string
}

export interface PhotoScreen {
  side: EyeSide
  signs: PhotoSign[]
  /** Колко признака изобщо са били видими за преценка. */
  visibleCount: number
}

/** Праг за показване на признак от снимката. Под него — не се споменава. */
export const PHOTO_MIN_CONFIDENCE = 0.65

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Разчита отговора на офталмологичния пас. Толерантен е към липсващи полета;
 * прилага капаните от промпта още веднъж с код, защото промптът е молба.
 */
export function parseEyeHealthResponse(parsed: unknown, side: EyeSide): PhotoScreen {
  const root = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  const signs = (root.signs && typeof root.signs === 'object' ? root.signs : {}) as Record<string, unknown>
  const warm = String(root.white_balance ?? '').toLowerCase() === 'warm'
  const scleraVisible = root.sclera_visible !== false
  const flash = root.flash === true

  const out: PhotoSign[] = []
  let visibleCount = 0
  for (const key of PHOTO_KEYS) {
    const raw = signs[key]
    if (!raw || typeof raw !== 'object') continue
    const s = raw as Record<string, unknown>
    if (s.visible !== false) visibleCount++
    if (s.present !== true || s.visible === false) continue

    let conf = Math.max(0, Math.min(1, num(s.confidence)))
    // Капани, повторени с код:
    if ((key === 'scleral_yellow' || key === 'scleral_red') && !scleraVisible) continue
    if (key === 'scleral_yellow' && warm) conf *= 0.6
    if (key === 'lens_opacity' && flash) conf *= 0.75
    if (conf < PHOTO_MIN_CONFIDENCE) continue

    let detail: string | undefined
    if (key === 'arcus' && typeof s.extent === 'string' && s.extent !== 'none') {
      detail = s.extent === 'full' ? 'пълен пръстен' : 'частична дъга'
    }
    if (key === 'iris_nevus' && typeof s.clock === 'string' && s.clock.trim()) {
      detail = `около ${s.clock.trim()} ч`
    }
    out.push({ key, confidence: conf, detail })
  }
  return { side, signs: out, visibleCount }
}

/* ── измервания с код ────────────────────────────────────────────────────── */

/** Съотношение радиус зеница / радиус ирис. Нормата на дневна светлина е ~0.25–0.45. */
export function pupilRatio(geo?: IrisGeometrySnapshot): number | undefined {
  if (!geo || !(geo.limbus?.r > 0) || !(geo.pupil?.r > 0)) return undefined
  return geo.pupil.r / geo.limbus.r
}

/**
 * Праг за анизокория в съотношение зеница/ирис. Ирисът е ~11.7 мм, така че 0.07
 * от радиуса отговаря на ~0.8 мм разлика в диаметъра на зеницата — над шума на
 * калибрацията и над физиологичната анизокория (обикновено ≤ 0.4–0.5 мм).
 */
export const ANISOCORIA_RATIO_DELTA = 0.07

export function measureAnisocoria(
  left?: IrisGeometrySnapshot,
  right?: IrisGeometrySnapshot,
  opts?: { flashLeft?: boolean; flashRight?: boolean }
): { left?: number; right?: number; delta?: number; reliable: boolean } {
  const l = pupilRatio(left)
  const r = pupilRatio(right)
  if (l == null || r == null) return { left: l, right: r, reliable: false }
  const trusted = (g?: IrisGeometrySnapshot) => !!g && (g.manual || g.pupilConfidence >= 0.55)
  // Светкавицата свива зеницата — снимки с и без светкавица не са сравними.
  const sameLight = (opts?.flashLeft ?? false) === (opts?.flashRight ?? false)
  return {
    left: round2(l),
    right: round2(r),
    delta: round2(Math.abs(l - r)),
    reliable: trusted(left) && trusted(right) && sameLight,
  }
}

/** sRGB (0..255) → CIE Lab (D65). */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}

/**
 * Среден цвят на ириса в Lab. Взима се долната половина на пояса между
 * зеницата и лимбуса (горната често е под клепача), без отблясъци и сенки.
 */
export async function sampleIrisColor(
  dataUrl: string,
  geo: IrisGeometrySnapshot
): Promise<[number, number, number] | null> {
  if (typeof document === 'undefined' || !dataUrl) return null
  const img = await new Promise<HTMLImageElement | null>(resolve => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => resolve(null)
    el.src = dataUrl
  })
  if (!img) return null
  const W = img.naturalWidth || geo.imageWidth
  const H = img.naturalHeight || geo.imageHeight
  const scale = Math.min(1, 480 / Math.max(W, H))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(W * scale))
  c.height = Math.max(1, Math.round(H * scale))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const data = ctx.getImageData(0, 0, c.width, c.height).data

  // Геометрията е в пиксели на изображението, за което е измерена.
  const sx = c.width / (geo.imageWidth || W)
  const sy = c.height / (geo.imageHeight || H)
  const cx = geo.limbus.cx * sx
  const cy = geo.limbus.cy * sy
  const rIn = geo.pupil.r * sx * 1.35
  const rOut = geo.limbus.r * sx * 0.85
  if (!(rOut > rIn)) return null

  let n = 0
  let L = 0
  let A = 0
  let B = 0
  for (let deg = 20; deg <= 160; deg += 4) {
    const a = (deg * Math.PI) / 180
    for (let t = 0; t <= 1; t += 0.1) {
      const rad = rIn + (rOut - rIn) * t
      const x = Math.round(cx + Math.cos(a) * rad)
      const y = Math.round(cy + Math.sin(a) * rad)
      if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue
      const i = (y * c.width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const max = Math.max(r, g, b)
      if (max > 240 || max < 18) continue // отблясък / сянка
      const lab = rgbToLab(r, g, b)
      L += lab[0]
      A += lab[1]
      B += lab[2]
      n++
    }
  }
  if (n < 40) return null
  return [L / n, A / n, B / n]
}

/**
 * Праг за хетерохромия: разстояние в цветната равнина (a*, b*) на Lab.
 * Яркостта (L*) се игнорира — тя зависи повече от експонацията на снимката,
 * отколкото от ириса. Кафяво срещу синьо дава > 25; две снимки на едно и също
 * око при различна светлина — обикновено < 10.
 */
export const HETEROCHROMIA_AB_DELTA = 16

export function colorDelta(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[1] - b[1], a[2] - b[2])
}

/* ── сглобяване ──────────────────────────────────────────────────────────── */

export interface AssessInput {
  photo: Partial<Record<EyeSide, PhotoScreen | null>>
  geometry: Partial<Record<EyeSide, IrisGeometrySnapshot | undefined>>
  flash?: Partial<Record<EyeSide, boolean>>
  /** Lab цвят на ириса по око (от `sampleIrisColor`). */
  irisColor?: Partial<Record<EyeSide, [number, number, number] | null>>
  /** Иридологичните находки — за превода „натриев ръб" → arcus. */
  findings?: Array<{ side: EyeSide; type: string; confidence: number }>
  age?: number
}

/**
 * Обединява трите източника в един отчет. Един и същ признак от двете очи става
 * един запис със side: 'both'. Признак от снимката печели пред изведения от
 * иридологичната находка, защото е гледан директно.
 */
export function assessEyeHealth(input: AssessInput): EyeHealthReport {
  const signs: EyeSign[] = []
  const age = input.age

  // 1. Снимка
  const bySideKey = new Map<EyeSignKey, { sides: Set<EyeSide>; conf: number; detail?: string }>()
  for (const side of ['left', 'right'] as const) {
    for (const s of input.photo[side]?.signs ?? []) {
      const cur = bySideKey.get(s.key) ?? { sides: new Set<EyeSide>(), conf: 0 }
      cur.sides.add(side)
      cur.conf = Math.max(cur.conf, s.confidence)
      if (s.detail) cur.detail = cur.detail ? `${cur.detail}; ${side === 'left' ? 'ляво' : 'дясно'} ${s.detail}` : s.detail
      bySideKey.set(s.key, cur)
    }
  }
  for (const [key, v] of bySideKey) {
    const side: EyeSign['side'] = v.sides.size === 2 ? 'both' : [...v.sides][0]
    signs.push(makeSign(key, side, 'photo', v.conf, age, v.detail))
  }

  // 2. Иридология → arcus. „Натриевият/липиден ръб" е видимият бял пръстен по
  // периферията — същото, което офталмологията нарича arcus.
  if (!signs.some(s => s.key === 'arcus')) {
    const rims = (input.findings ?? []).filter(f => f.type === 'sodium_ring' && f.confidence >= 0.6)
    if (rims.length > 0) {
      const sides = new Set(rims.map(f => f.side))
      const conf = Math.max(...rims.map(f => f.confidence)) * 0.85
      signs.push(
        makeSign(
          'arcus',
          sides.size === 2 ? 'both' : [...sides][0],
          'iridology',
          conf,
          age,
          'изведено от иридологичния „натриев/липиден ръб"'
        )
      )
    }
  }

  // 3. Измервания
  const aniso = measureAnisocoria(input.geometry.left, input.geometry.right, {
    flashLeft: input.flash?.left,
    flashRight: input.flash?.right,
  })
  if (aniso.reliable && aniso.delta != null && aniso.delta >= ANISOCORIA_RATIO_DELTA) {
    const bigger = (aniso.left ?? 0) > (aniso.right ?? 0) ? 'left' : 'right'
    signs.push(
      makeSign(
        'anisocoria',
        bigger,
        'measurement',
        Math.min(0.9, 0.5 + aniso.delta * 3),
        age,
        `зеница/ирис: ляво ${aniso.left?.toFixed(2)} · дясно ${aniso.right?.toFixed(2)}`
      )
    )
  }

  const cl = input.irisColor?.left
  const cr = input.irisColor?.right
  const sameLight = (input.flash?.left ?? false) === (input.flash?.right ?? false)
  if (cl && cr && sameLight) {
    const d = colorDelta(cl, cr)
    if (d >= HETEROCHROMIA_AB_DELTA) {
      signs.push(
        makeSign('heterochromia', 'both', 'measurement', Math.min(0.85, 0.45 + d / 60), age, `цветова разлика ${d.toFixed(0)}`)
      )
    }
  }

  // Подредба: първо по-спешното, после по-уверено.
  signs.sort(
    (a, b) => REFERRAL_RANK[b.referral] - REFERRAL_RANK[a.referral] || b.confidence - a.confidence
  )

  const ranPhoto = !!(input.photo.left || input.photo.right)
  const ranMeasure = aniso.left != null || aniso.right != null
  const referral = signs.reduce<EyeReferral>((acc, s) => maxReferral(acc, s.referral), 'none')

  return {
    ran: ranPhoto || ranMeasure || signs.length > 0,
    referral,
    signs,
    checked: EYE_CHECKLIST,
    pupilRatio: { left: aniso.left, right: aniso.right },
  }
}

/** Имената на изследвания, които трябва да влязат в плана при даден очен отчет. */
export function eyeHealthChecks(report?: EyeHealthReport): string[] {
  if (!report || report.referral === 'none') return []
  const out = ['Преглед при офталмолог (очен лекар)']
  if (report.signs.some(s => s.key === 'arcus')) out.push('Липиден профил')
  if (report.signs.some(s => s.key === 'scleral_yellow')) out.push('Билирубин и чернодробни ензими')
  return out
}
