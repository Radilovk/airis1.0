/**
 * iris-map.ts — ЕДИНСТВЕН ИЗТОЧНИК НА ИСТИНАТА за ирисовата топография.
 *
 * До момента в проекта съществуваха ЧЕТИРИ несъвместими карти:
 *   1. pipeline-v9.ts        → organsByZone[12]  (еднаква за двете очи)
 *   2. airis-knowledge.ts    → irisMap.zones[12] (еднаква за двете очи)
 *   3. default-prompts.ts    → DEFAULT_IRIDOLOGY_MANUAL (различно разпределение)
 *   4. image-utils.ts        → етикетите на overlay-а (трети вариант)
 *
 * Резултатът беше, че AI получаваше една карта в промпта, кодът смяташе по друга,
 * а потребителят виждаше трета. Този модул ги заменя.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * КООРДИНАТНА СИСТЕМА (една, навсякъде)
 * ─────────────────────────────────────────────────────────────────────────────
 *   МИНУТА (X)  0..59  — по часовниковата стрелка, както се вижда на снимката.
 *                        min 0 = 12:00, min 15 = 3:00, min 30 = 6:00, min 45 = 9:00
 *                        1 минута = 6°.
 *   ПРЪСТЕН (Y) 0..11  — R0 = ръб на зеницата, R11 = лимбус (външен ръб).
 *                        Ширината на пръстена = 1/12 от (r_лимбус − r_зеница).
 *
 * ЛАТЕРАЛНОСТ: картите за ляв и десен ирис НЕ са еднакви. Черният дроб се
 * проектира само в десния ирис, сърцето и далакът — само в левия (Jensen/Deck). Затова
 * SECTORS е дефинирана поотделно за всяко око.
 *
 * ОГРАДА (важно): това е образователен модел, а не медицинска диагностика.
 * Наименованията на зоните са ориентировъчни; изводите за храненето се правят
 * на ниво „функционална система", не на ниво „орган".
 */

export type Side = 'left' | 'right'

/** Функционалните системи, по които се агрегират находките. */
export type SystemKey =
  | 'digestive'
  | 'metabolic'
  | 'endocrine'
  | 'detox'
  | 'immune'
  | 'nervous'
  | 'circulatory'

export interface SystemDef {
  key: SystemKey
  /** Име за UI (български). */
  label: string
  /** Кратко обяснение за потребителя. */
  blurb: string
  /** Приоритетна ли е системата за целите на хранителния план. */
  priority: boolean
}

/**
 * Приоритетните системи са трите, които имат пряко отношение към храненето.
 * Останалите се изчисляват и показват, но тежат по-малко в плана.
 */
export const SYSTEMS: SystemDef[] = [
  {
    key: 'digestive',
    label: 'Храносмилане',
    blurb: 'Подуване, редовност, усвояване на храната',
    priority: true,
  },
  {
    key: 'metabolic',
    label: 'Кръвна захар и метаболизъм',
    blurb: 'Енергия през деня, апетит за сладко, телесно тегло',
    priority: true,
  },
  {
    key: 'endocrine',
    label: 'Хормони и щитовидна жлеза',
    blurb: 'Щитовидна жлеза, надбъбречни, хормонален ритъм',
    priority: true,
  },
  {
    key: 'detox',
    label: 'Черен дроб и бъбреци',
    blurb: 'Обработка на мазнини, алкохол и лекарства; воден баланс',
    priority: false,
  },
  {
    key: 'immune',
    label: 'Имунна система',
    blurb: 'Възпалителни и автоимунни процеси, алергии, лимфа',
    priority: false,
  },
  {
    key: 'nervous',
    label: 'Стрес и сън',
    blurb: 'Напрежение, сън, възстановяване',
    priority: false,
  },
  {
    key: 'circulatory',
    label: 'Сърдечно-съдова система',
    blurb: 'Холестерол, кръвно налягане, съдове',
    priority: false,
  },
]

export const PRIORITY_SYSTEMS: SystemKey[] = SYSTEMS.filter(s => s.priority).map(s => s.key)

export function systemLabel(key: SystemKey): string {
  return SYSTEMS.find(s => s.key === key)?.label ?? key
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 12-ТЕ ВИЗУАЛНИ СЕКТОРА
 * ───────────────────────────────────────────────────────────────────────────*/

export interface SectorDef {
  /** 1..12 */
  id: number
  /** Начална минута (включително). */
  minuteStart: number
  /** Крайна минута (изключително). */
  minuteEnd: number
  /** Часова позиция за етикет, напр. „12–1 ч". */
  clock: string
  /**
   * ОБЩ етикет за UI. По изрично изискване 12-те зони се запазват визуално,
   * но с общи (функционални), а не с органни имена — така не се създава
   * впечатление за медицинска диагноза.
   */
  label: string
  /**
   * Системите, към които сектора допринася, с тегло 0..1.
   * Сборът не е нормиран — нормира се при агрегацията.
   */
  systems: Partial<Record<SystemKey, number>>
  /** Ориентировъчни анатомични съответствия (само за справка в отчета). */
  reference: string
}

/**
 * Етикетите на 12-те визуални зони са ОБЩИ — функционални, а не органни.
 * Това е изрично изискване: 12-те зони остават видими, но не назовават орган,
 * за да не се създава впечатление за медицинска диагноза. Органните съответствия
 * стоят само в полето `reference`.
 *
 * КАРТАТА Е ПО JENSEN — „Chart to Iridology“, B. Jensen 1980 (в „Iridology
 * Simplified“), прочетена сектор по сектор. Часовете са както се вижда на
 * снимката: при дясното око носът е на 3:00, а слепоочието на 9:00; при лявото
 * — обратно. Двете карти са огледални, освен органите от едната страна:
 *   дясно око — черен дроб ≈7:45–8:05, жлъчка ≈7:40, панкреас ≈7:05–7:20;
 *   ляво око  — сърце ≈2:30–2:50 (до коларетата), далак ≈4:00–4:20.
 * Към носа: гърло и щитовидна (дясно 2:30–2:45, ляво 9:15–9:30), после ГРЪБ И
 * ЛОПАТКА (дясно 3–4:45, ляво 7:15–9). Долу: пикочо-полови (дясно ≈5, ляво ≈6:45),
 * БЪБРЕК + надбъбречна (дясно ≈5:35–5:50, ляво ≈6:05–6:20), крака, слабини,
 * апендикс (дясно ≈6:05), таз, яйчник/тестис (дясно ≈6:45–7, ляво ≈5–5:15).
 * Към слепоочието: ръка, ребра, гръден кош и плевра (дясно 8–9, ляво 3–4),
 * бял дроб (дясно 9–10, ляво 2–3), рамо, шия, ухо.
 *
 * Предишните версии: първата следваше `manual.json` (черният дроб на 4–5 ч в
 * дясното око, сърцето на 8 ч в лявото); втората (2026-10-13) — „класическата"
 * карта по памет, с бъбрека един сектор встрани и гърба на мястото на гръдния
 * кош. Сверено с оригиналната карта на 2026-11-12.
 */
const ZONE_LABELS_RIGHT = [
  'Мозък и хормонален център',      // S1  12–1  главен мозък (двигателен, психичен), хипофиза
  'Лице, чело и синуси',            // S2  1–2   чело/слепоочие, око, горна челюст, нос
  'Гърло и щитовидна ос',           // S3  2–3   уста, сливици, гръклян, ЩИТОВИДНА ≈2:30–2:45, трахея, бронх
  'Гръб и лопатка',                 // S4  3–4   хранопровод, лопатка ≈3:15, горен гръб
  'Долен гръб и полови органи',     // S5  4–5   среден и долен гръб, матка/влагалище ≈4:50
  'Бъбречно-пикочна ос',            // S6  5–6   простата, пикочен мехур ≈5:20, БЪБРЕК+НАДБЪБРЕЧНА ≈5:35–5:50, крака
  'Таз, слабини и сляпо черво',     // S7  6–7   слабини, АПЕНДИКС ≈6:05, коремна стена, таз, яйчник/тестис ≈6:45
  'Черен дроб, жлъчка и панкреас',  // S8  7–8   ПАНКРЕАС ≈7:05–7:20, диафрагма, ЖЛЪЧКА ≈7:40, ЧЕРЕН ДРОБ ≈7:45
  'Ръка, ребра и гръден кош',       // S9  8–9   черен дроб до ≈8:05, ръка, ребра, гръден кош, плевра
  'Дишане',                         // S10 9–10  бял дроб, бронхи
  'Рамо, шия и ухо',                // S11 10–11 рамо, шия, ухо ≈10:40, мастоид
  'Малък мозък и мозъчен ствол',    // S12 11–12 продълговат мозък, малък мозък (сетивен)
]

const ZONE_LABELS_LEFT = [
  'Малък мозък и мозъчен ствол',    // S1  12–1  малък мозък (сетивен), продълговат мозък
  'Рамо, шия и ухо',                // S2  1–2   мастоид, ухо ≈1:20, шия, рамо
  'Дишане и сърдечна област',       // S3  2–3   бял дроб, бронхи, СЪРЦЕ ≈2:30–2:50
  'Гръден кош, ребра и ръка',       // S4  3–4   плевра, гръден кош, ребра, слънчев сплит, ръка
  'Далак и горен корем',            // S5  4–5   ДАЛАК ≈4:00–4:20, горен корем, яйчник/тестис ≈5
  'Таз, слабини и сигма',           // S6  5–6   таз, коремна стена, слабини, крака, сигма
  'Бъбречно-пикочна ос',            // S7  6–7   БЪБРЕК+НАДБЪБРЕЧНА ≈6:05–6:20, ректум, простата, матка/влагалище ≈6:45
  'Долен гръб',                     // S8  7–8   долен и среден гръб
  'Гръб и лопатка',                 // S9  8–9   горен гръб, лопатка ≈8:30, хранопровод ≈8:45
  'Гърло и щитовидна ос',           // S10 9–10  трахея, ЩИТОВИДНА ≈9:15–9:30, гръклян, сливици, уста
  'Лице, чело и синуси',            // S11 10–11 нос, горна челюст, око, чело/слепоочие
  'Мозък и хормонален център',      // S12 11–12 главен мозък (двигателен, психичен), хипофиза
]

function makeSector(labels: string[]) {
  return (
    id: number,
    systems: Partial<Record<SystemKey, number>>,
    reference: string
  ): SectorDef => {
    const minuteStart = (id - 1) * 5
    const minuteEnd = id * 5
    const h = id === 1 ? '12–1' : `${id - 1}–${id}`
    return {
      id,
      minuteStart,
      minuteEnd,
      clock: `${h} ч`,
      label: labels[id - 1],
      systems,
      reference,
    }
  }
}

const sectorR = makeSector(ZONE_LABELS_RIGHT)
const sectorL = makeSector(ZONE_LABELS_LEFT)

/** ДЯСНО ОКО — по картата на Jensen. Носът е на 3:00, слепоочието на 9:00. */
export const SECTORS_RIGHT: SectorDef[] = [
  sectorR(1, { nervous: 0.9, endocrine: 0.8 }, 'главен мозък (двигателен, психичен), хипофиза'),
  sectorR(2, { nervous: 0.6, immune: 0.3 }, 'чело и слепоочие, око, горна челюст, нос/синуси'),
  sectorR(3, { endocrine: 1.0, metabolic: 0.7, immune: 0.5, digestive: 0.2 }, 'уста, сливици, гръклян; щитовидна ≈2:30–2:45; трахея, бронх'),
  sectorR(4, { nervous: 0.3, digestive: 0.2 }, 'хранопровод ≈3:00, лопатка ≈3:15, горен гръб'),
  sectorR(5, { endocrine: 0.4, nervous: 0.2 }, 'среден и долен гръб; матка/влагалище ≈4:50'),
  sectorR(6, { detox: 1.0, endocrine: 0.9 }, 'простата, пикочен мехур ≈5:20; бъбрек + надбъбречна ≈5:35–5:50; крака'),
  sectorR(7, { digestive: 0.5, endocrine: 0.5, immune: 0.3 }, 'слабини, апендикс ≈6:05, коремна стена, таз; яйчник/тестис ≈6:45'),
  sectorR(8, { metabolic: 1.0, digestive: 0.9, detox: 0.8 }, 'панкреас ≈7:05–7:20, диафрагма, жлъчка ≈7:40, черен дроб ≈7:45'),
  sectorR(9, { detox: 0.6, circulatory: 0.3, immune: 0.3 }, 'черен дроб до ≈8:05; ръка, ребра, гръден кош, плевра'),
  sectorR(10, { immune: 0.6, circulatory: 0.4 }, 'бял дроб, бронхи'),
  sectorR(11, { nervous: 0.5, immune: 0.2 }, 'рамо, шия, ухо ≈10:40, мастоид'),
  sectorR(12, { nervous: 0.9, endocrine: 0.3 }, 'продълговат мозък, малък мозък (сетивен)'),
]

/**
 * ЛЯВО ОКО — по картата на Jensen, носът е на 9:00. Огледало на дясното, освен
 * органите от едната страна: сърцето и далакът са само тук, черният дроб,
 * жлъчката и панкреасът — само в дясното око.
 */
export const SECTORS_LEFT: SectorDef[] = [
  sectorL(1, { nervous: 0.9, endocrine: 0.3 }, 'малък мозък (сетивен), продълговат мозък'),
  sectorL(2, { nervous: 0.5, immune: 0.2 }, 'мастоид, ухо ≈1:20, шия, рамо'),
  sectorL(3, { circulatory: 1.0, immune: 0.6 }, 'бял дроб, бронхи; сърце ≈2:30–2:50 (до коларетата)'),
  sectorL(4, { circulatory: 0.3, immune: 0.3, nervous: 0.3 }, 'плевра, гръден кош, ребра, слънчев сплит, ръка'),
  sectorL(5, { immune: 0.9, metabolic: 0.5, digestive: 0.5, endocrine: 0.3 }, 'далак ≈4:00–4:20, горен корем; яйчник/тестис ≈5:00'),
  sectorL(6, { digestive: 0.5, endocrine: 0.3 }, 'таз, коремна стена, слабини, крака; сигма'),
  sectorL(7, { detox: 1.0, endocrine: 0.9, digestive: 0.3 }, 'бъбрек + надбъбречна ≈6:05–6:20; ректум, простата, матка/влагалище ≈6:45'),
  sectorL(8, { nervous: 0.3, endocrine: 0.2 }, 'долен и среден гръб'),
  sectorL(9, { nervous: 0.3, digestive: 0.2 }, 'горен гръб, лопатка ≈8:30, хранопровод ≈8:45'),
  sectorL(10, { endocrine: 1.0, metabolic: 0.7, immune: 0.5, digestive: 0.2 }, 'трахея, бронх; щитовидна ≈9:15–9:30; гръклян, сливици, уста'),
  sectorL(11, { nervous: 0.6, immune: 0.3 }, 'нос/синуси, горна челюст, око, чело и слепоочие'),
  sectorL(12, { nervous: 0.9, endocrine: 0.8 }, 'главен мозък (двигателен, психичен), хипофиза'),
]

export function sectorsFor(side: Side): SectorDef[] {
  return side === 'right' ? SECTORS_RIGHT : SECTORS_LEFT
}

/** Минута (0..59) → номер на сектор (1..12). */
export function minuteToSector(minute: number): number {
  const m = ((Math.round(minute) % 60) + 60) % 60
  return Math.floor(m / 5) + 1
}

/** Минута → градуси (0..360), 0° = 12:00, по часовниковата стрелка. */
export function minuteToDegrees(minute: number): number {
  return (((minute % 60) + 60) % 60) * 6
}

/** Минута → часова позиция за показване, напр. „4:12". */
export function minuteToClock(minute: number): string {
  const m = ((Math.round(minute) % 60) + 60) % 60
  const hour = Math.floor(m / 5) || 12
  const mins = (m % 5) * 12
  return `${hour}:${mins.toString().padStart(2, '0')}`
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ПРЪСТЕННИ ЗОНИ
 * ───────────────────────────────────────────────────────────────────────────*/

export type RingBandKey = 'IPB' | 'STOM' | 'ANW' | 'ORG' | 'LYM' | 'SCU'

export interface RingBandDef {
  key: RingBandKey
  /** Пръстени [от, до] включително, при 12 равни пръстена. */
  rings: [number, number]
  /**
   * Оригиналният диапазон в ПРОЦЕНТИ от разстоянието зеница→лимбус, както е
   * зададен в `manual.json` (`RINGS_PCT`). Пръстените по-горе са изведени от
   * него по центъра на всеки пръстен — това е източникът, не обратното.
   */
  pct: [number, number]
  label: string
  /** Какво тежи, когато находка попадне тук. */
  systems: Partial<Record<SystemKey, number>>
}

export const RING_BANDS: RingBandDef[] = [
  { key: 'IPB', rings: [0, 0], pct: [0, 12], label: 'Зеничен ръб (IPB)', systems: { nervous: 0.7, endocrine: 0.4 } },
  { key: 'STOM', rings: [1, 2], pct: [12, 22], label: 'Стомашен пръстен', systems: { digestive: 1.0 } },
  { key: 'ANW', rings: [3, 4], pct: [22, 38], label: 'Чревно поле / коларета', systems: { digestive: 1.0, nervous: 0.7 } },
  { key: 'ORG', rings: [5, 8], pct: [38, 75], label: 'Органна зона', systems: {} },
  { key: 'LYM', rings: [9, 10], pct: [75, 92], label: 'Лимфа и периферия', systems: { immune: 1.0, detox: 0.5 } },
  { key: 'SCU', rings: [11, 11], pct: [92, 100], label: 'Кожа / елиминация', systems: { detox: 0.9, circulatory: 0.5 } },
]

export function ringBand(ring: number): RingBandDef {
  const r = Math.max(0, Math.min(11, Math.round(ring)))
  return RING_BANDS.find(b => r >= b.rings[0] && r <= b.rings[1]) ?? RING_BANDS[3]
}

/* ── пояси спрямо коларетата ─────────────────────────────────────────────── */

/**
 * Пръстенът (дробен, 0–12) на коларетата по подразбиране: Jensen — „на около
 * 1/3 навън“. При него деленето е точно RING_BANDS по-горе (STOM R1–R2,
 * ANW R3–R4, ORG от R5).
 */
export const DEFAULT_COLLARETTE_RING = 4
/** Правдоподобни граници на измерената коларета (пръстени). */
const MIN_COLLARETTE_RING = 2.4
const MAX_COLLARETTE_RING = 6.6

function clampCollarette(c: number | undefined): number {
  if (c === undefined || !Number.isFinite(c)) return DEFAULT_COLLARETTE_RING
  return Math.max(MIN_COLLARETTE_RING, Math.min(MAX_COLLARETTE_RING, c))
}

/** Граница стомах/черва: ~60 % от пътя от зеничния ръб до коларетата. */
function stomachEdge(c: number): number {
  return 1 + 0.6 * (c - 1)
}

/**
 * Поясът на пръстен спрямо коларетата на ТОЗИ ирис (Jensen, Deck: зоните се
 * броят от коларетата, не по фиксиран процент). Вътре в коларетата —
 * стомах, после черва и самата коларета (ANW); отвън — органите; периферията
 * (лимфа, кожа) остава по процент.
 */
export function bandAt(ring: number, collaretteRing?: number): RingBandDef {
  const r = Math.max(0, Math.min(11, Math.round(ring)))
  const c = clampCollarette(collaretteRing)
  const centre = r + 0.5
  const key: RingBandKey =
    r === 0
      ? 'IPB'
      : r >= 11
        ? 'SCU'
        : r >= 9
          ? 'LYM'
          : centre < stomachEdge(c)
            ? 'STOM'
            : centre <= c + 0.5
              ? 'ANW'
              : 'ORG'
  return bandByKey(key)
}

export function bandByKey(key: RingBandKey | string): RingBandDef {
  return RING_BANDS.find(b => b.key === key) ?? RING_BANDS[3]
}

/** Пръстените [от, до] на пояс при дадена коларета — за рисуване. */
export function bandRingsAt(key: RingBandKey, collaretteRing?: number): [number, number] {
  const rings: number[] = []
  for (let r = 0; r < 12; r++) if (bandAt(r, collaretteRing).key === key) rings.push(r)
  return rings.length ? [rings[0], rings[rings.length - 1]] : bandByKey(key).rings
}

/** Поясът на находка: измереният (`band`), ако го има, иначе по пръстена. */
export function findingBand(f: { ring: number; band?: string }): RingBandDef {
  return f.band ? bandByKey(f.band) : ringBand(f.ring)
}

/** Пръстен на граница между пояси спрямо коларетата (стомах/черва, коларета/органи). */
export function isBoundaryRingAt(ring: number, collaretteRing?: number): boolean {
  const c = clampCollarette(collaretteRing)
  const centre = Math.round(ring) + 0.5
  return Math.abs(centre - stomachEdge(c)) < 0.5 || Math.abs(centre - (c + 0.5)) < 0.5
}

/** Пръстени на границата между пояси — R2 (22 %) и R4 (38 %) по manual.json. */
export const BOUNDARY_RINGS = new Set([2, 4])

/** Намаление на тежестта при гранични пръстени (STOM/ANW и ANW/ORG). */
export const BOUNDARY_RING_WEIGHT = 0.82

export function isBoundaryRing(ring: number): boolean {
  return BOUNDARY_RINGS.has(Math.round(ring))
}

/** Етикет с процентен диапазон от атласа, напр. „Стомашен пръsten (12–22 %)“. */
export function ringBandDisplayLabel(band: RingBandDef): string {
  return `${band.label} (${band.pct[0]}–${band.pct[1]}%)`
}

export function boundaryRingNote(ring: number): string | undefined {
  const r = Math.round(ring)
  if (r === 2) return 'граница STOM/ANW (22%)'
  if (r === 4) return 'граница ANW/ORG (38%)'
  return undefined
}

/* ─────────────────────────────────────────────────────────────────────────────
 * РЕЧНИК НА НАХОДКИТЕ
 *
 * Затворен списък. AI-ят няма право да измисля типове — това е единственият
 * начин находките да бъдат обработени детерминистично надолу по веригата.
 * ───────────────────────────────────────────────────────────────────────────*/

/**
 * СТРУКТУРНИЯТ РЕЧНИК Е ЧАСТИЧНО КОЛАПСИРАН — по измерване, не по вкус.
 *
 * Два независими прочита на една и съща тъкан (§10 в МЕТОДИКА_2) показаха:
 *
 *   пигментен слой:  2 от 2 потвърдени находки със СЪЩИЯ тип
 *   структурен слой: 0 от 3 потвърдени находки със същия тип
 *
 * Тоест моделът именува пигмента безгрешно, а структурата — никога еднакво.
 * Разминаванията бяха `radial_furrow`↔`crypt`, `fiber_loosening`↔`radial_furrow`,
 * `collarette_irregularity`↔`lacuna` — все „тъмно нещо във влакната".
 * Седемте структурни типа са по-фино деление, отколкото снимка позволява да се
 * различи.
 *
 * СЛИВА СЕ САМО `lacuna` + `crypt` → `fiber_defect`. И двете са КОМПАКТНА тъмна
 * дупка; разликата между „овал" и „ромб" не се чете от снимка, а разликата в
 * значението им е по ДЪЛБОЧИНА, която полето `size` вече носи. И двете имаха
 * празни `systems` — посоката им идва от сектора и пояса.
 *
 * `radial_furrow` НЕ се слива, макар и той да участва в разминаванията. Две
 * причини:
 *   1. Признакът му е ОРИЕНТАЦИЯ (вертикална, издължена), а не форма — същият
 *      вид улика, която прави `transversal_fiber` надежден.
 *   2. Той е ЕДИНСТВЕНИЯТ структурен тип със собствена посока към системи
 *      (`nervous: 0.8`). Сливането му изключваше нервната система от
 *      структурния слой изцяло — загуба на канал, а не на етикет.
 *
 * Първата версия на този колапс сля и него, и изтърва `nervous: 0.7` от
 * коларетата. И двете са върнати.
 */
export type FindingType =
  // структурни — три класа, разграничими по ЕДИН признак: има ли ръб
  | 'fiber_defect'
  | 'fiber_thinning'
  | 'collarette_deform'
  | 'radial_furrow'
  | 'transversal_fiber'
  // пигментни / пръстеновидни
  | 'pigment_orange'
  | 'pigment_brown'
  | 'pigment_yellow'
  | 'pigment_diffuse'
  | 'nerve_rings'
  | 'lymphatic_rosary'
  | 'scurf_rim'
  | 'sodium_ring'
  | 'pupil_flattening'

export interface FindingDef {
  type: FindingType
  /** Иридологичното име (за модела и за справка). */
  label: string
  /**
   * Име за клиента — класическият иридологичен термин (лакуна, коларета,
   * пигментно петно…), без „дефект“ или „деформиран“, които звучат като диагноза.
   */
  clientLabel: string
  /** Как изглежда в РАЗГЪНАТАТА лента — това го вижда моделът. */
  appearanceUnwrapped: string
  /** Какво описва функционално (без диагностични твърдения). */
  meaning: string
  /**
   * Базово тегло на натоварване 0..1. Умножава се по размера/увереността
   * и по теглата на сектора и пръстена.
   */
  weight: number
  /** Допълнителни системи, които находката засяга независимо от позицията си. */
  systems: Partial<Record<SystemKey, number>>
  /** В кои пръстени изобщо има смисъл. Находка извън тях се отхвърля. */
  validRings: [number, number]
  /** Дали е глобален признак (важи за целия ирис, а не за конкретен сектор). */
  global?: boolean
  /**
   * Околообхватен пръстен — в разгънатата лента е хоризонтална дъга по цялата
   * ширина. В UI се рисува като пълен пръстен, не като секторен клин.
   */
  circumferential?: boolean
}

export const FINDINGS: Record<FindingType, FindingDef> = {
  fiber_defect: {
    type: 'fiber_defect',
    label: 'Дефект във влакната',
    clientLabel: 'Лакуна',
    appearanceUnwrapped:
      'КОМПАКТНА тъмна зона с различим ръб, в която влакната липсват — овална, ' +
      'листовидна или ромбовидна са едно и също; НЕ е издължена вертикално',
    meaning: 'локално по-рехава тъкан; зона за поддръжка',
    weight: 0.75,
    systems: {},
    validRings: [1, 11],
  },
  radial_furrow: {
    type: 'radial_furrow',
    label: 'Радиална бразда',
    clientLabel: 'Радиална бразда',
    appearanceUnwrapped:
      'ВЕРТИКАЛНА тъмна ивица, по-дълга отколкото широка (в разгъвката радиалното ' +
      'е вертикално); за разлика от `fiber_defect` формата ѝ е ИЗДЪЛЖЕНА по височина',
    meaning: 'нервно-стресов и чревно-транзитен маркер',
    weight: 0.6,
    systems: { nervous: 0.8, digestive: 0.5 },
    validRings: [2, 11],
  },
  fiber_thinning: {
    type: 'fiber_thinning',
    label: 'Разреждане на влакната',
    clientLabel: 'Разредени влакна',
    appearanceUnwrapped:
      'по-редки, размити или бледи влакна БЕЗ ясен ръб — преходът е плавен',
    meaning: 'по-нисък тъканен тонус в зоната',
    weight: 0.5,
    systems: {},
    validRings: [2, 11],
  },
  collarette_deform: {
    type: 'collarette_deform',
    label: 'Деформиран автономен пръстен',
    clientLabel: 'Неравна коларета',
    appearanceUnwrapped:
      'границата около R2–R3 е вълнообразна, накъсана, изтеглена или неравномерно ' +
      'отдалечена от зеницата; определя се по МЯСТО, не по форма',
    meaning: 'храносмилателен и вегетативен дисбаланс',
    weight: 0.9,
    systems: { digestive: 1.0, nervous: 0.7 },
    validRings: [1, 4],
  },
  transversal_fiber: {
    type: 'transversal_fiber',
    label: 'Напречно влакно',
    clientLabel: 'Трансверзала',
    appearanceUnwrapped: 'ХОРИЗОНТАЛНА линия, пресичаща няколко сектора',
    meaning: 'преминала през зоната реакция',
    weight: 0.5,
    systems: {},
    validRings: [2, 11],
    circumferential: true,
  },
  pigment_orange: {
    type: 'pigment_orange',
    label: 'Оранжево-ръждив пигмент',
    clientLabel: 'Оранжево пигментно петно',
    appearanceUnwrapped: 'ясно очертано оранжево или ръждиво петно върху влакната',
    // „панкреас+черен дроб; гликемичен риск НЕЗАВИСИМО ОТ ЛОКАЦИЯ"
    meaning: 'кръвно-захарна натовареност — тежи навсякъде, не само в панкреасната зона',
    weight: 0.9,
    systems: { metabolic: 1.0, detox: 0.5 },
    validRings: [1, 11],
  },
  pigment_brown: {
    type: 'pigment_brown',
    label: 'Кафяво-черен пигмент',
    clientLabel: 'Тъмно пигментно петно',
    appearanceUnwrapped: 'тъмнокафяво до почти черно петно с ясен ръб',
    meaning: 'чернодробно натоварване',
    weight: 0.8,
    systems: { detox: 1.0, digestive: 0.4 },
    validRings: [1, 11],
  },
  pigment_yellow: {
    type: 'pigment_yellow',
    label: 'Жълт пигмент',
    clientLabel: 'Жълто пигментно петно',
    appearanceUnwrapped: 'жълтеникаво петно или воал върху влакната',
    meaning: 'бъбречно натоварване',
    weight: 0.7,
    systems: { detox: 1.0 },
    validRings: [1, 11],
  },
  pigment_diffuse: {
    type: 'pigment_diffuse',
    label: 'Дифузен пигмент',
    clientLabel: 'Дифузна пигментация',
    appearanceUnwrapped: 'размита цветна мъгла без ясен ръб над няколко минути',
    meaning: 'по-общо метаболитно натоварване',
    weight: 0.5,
    systems: { detox: 0.7, metabolic: 0.6 },
    validRings: [1, 11],
  },
  nerve_rings: {
    type: 'nerve_rings',
    label: 'Стресови пръстени',
    clientLabel: 'Нервни пръстени',
    appearanceUnwrapped: 'ХОРИЗОНТАЛНИ дъги/ленти по цялата ширина или част от нея',
    meaning: 'натрупано нервно напрежение',
    weight: 0.7,
    systems: { nervous: 1.0, endocrine: 0.6 },
    validRings: [3, 10],
    circumferential: true,
  },
  lymphatic_rosary: {
    type: 'lymphatic_rosary',
    label: 'Лимфна броеница',
    clientLabel: 'Лимфна броеница',
    appearanceUnwrapped: 'верига от бледи топчета по ред R10',
    meaning: 'забавен лимфен дренаж',
    weight: 0.8,
    systems: { immune: 1.0, detox: 0.6 },
    validRings: [9, 11],
    circumferential: true,
  },
  scurf_rim: {
    type: 'scurf_rim',
    label: 'Кожен ръб',
    clientLabel: 'Кожен пръстен',
    appearanceUnwrapped: 'тъмна лента по най-долния ред R11',
    meaning: 'по-слабо кожно елиминиране',
    weight: 0.6,
    systems: { detox: 1.0 },
    validRings: [10, 11],
    circumferential: true,
  },
  sodium_ring: {
    type: 'sodium_ring',
    label: 'Натриев/липиден ръб',
    clientLabel: 'Натриев пръстен',
    appearanceUnwrapped: 'бледа млечнобяла лента по долния ръб R10–R11',
    meaning: 'липиден и минерален обмен',
    weight: 0.7,
    systems: { circulatory: 1.0, metabolic: 0.8 },
    validRings: [10, 11],
    global: true,
    circumferential: true,
  },
  pupil_flattening: {
    type: 'pupil_flattening',
    label: 'Сплеснат ръб на зеницата',
    clientLabel: 'Сплескване на зеничния ръб',
    appearanceUnwrapped: 'горният ред R0 е видимо изтеглен/прав над няколко минути',
    meaning: 'вегетативна асиметрия в сектора',
    weight: 0.5,
    systems: { nervous: 0.8 },
    validRings: [0, 1],
  },
}

export const FINDING_TYPES = Object.keys(FINDINGS) as FindingType[]

/**
 * Старите, по-фини структурни имена. Приемат се и се превеждат към класа —
 * заради вече записана история и заради модел, който по инерция върне старото
 * име. Нищо не се губи: смисълът идва от сектора и пояса.
 */
const FINDING_ALIASES: Record<string, FindingType> = {
  lacuna: 'fiber_defect',
  crypt: 'fiber_defect',
  giant_lacuna: 'fiber_defect',
  fiber_loosening: 'fiber_thinning',
  collarette_irregularity: 'collarette_deform',
  collarette_defect_lesion: 'collarette_deform',
}

/** Превежда произволна стойност към валиден тип находка, или null. */
export function resolveFindingType(v: unknown): FindingType | null {
  if (typeof v !== 'string') return null
  if ((FINDING_TYPES as string[]).includes(v)) return v as FindingType
  return FINDING_ALIASES[v] ?? null
}

export function isFindingType(v: unknown): v is FindingType {
  return typeof v === 'string' && v in FINDINGS
}

/** Околообхватен пръstenен знак — рисува се като пълен пръsten, не секторен клин. */
/**
 * Знак без една точка: по тип (нервни пръстени, натриев пръстен…) или защото
 * е слят от много сектори (пигмент по цялата обиколка — `spread`).
 */
export function isRingFinding(f: { type: string; spread?: string }): boolean {
  return f.spread === 'circumferential' || isCircumferentialFinding(f.type)
}

export function isCircumferentialFinding(type: FindingType | string): boolean {
  if (!isFindingType(type)) return false
  const def = FINDINGS[type]
  return def.circumferential === true || def.global === true
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ПРИОРИТЕТНИ ЗОНИ
 *
 * Изискване: фокус върху метаболизъм / ендокринна функция / храносмилане.
 * Останалите зони остават, но с по-нисък приоритет при интерпретация.
 * ───────────────────────────────────────────────────────────────────────────*/

export interface PriorityZone {
  key: string
  label: string
  /** Кратко обяснение за потребителя — какво следи тази зона. */
  description: string
  system: SystemKey
  /** Минутни диапазони за всяко око: [start, end) в минути. */
  minutes: Record<Side, Array<[number, number]>>
  /** Пръстени, в които зоната се чете. */
  rings: [number, number]
  /**
   * Пояси, в които зоната се чете — по измерената коларета. Ако са зададени и
   * поясът на находката е известен, заместват `rings`.
   */
  bands?: RingBandKey[]
  /** Кои типове находки се броят с повишено тегло тук. */
  keyFindings: FindingType[]
  /**
   * `focal` — зоната е проекция на конкретен орган в няколко минути.
   * `circumferential` — зоната е цял пръстенен пояс през всички сектори.
   * Разликата има значение: поясната зона е базовият случай, не отличие.
   */
  spread: 'focal' | 'circumferential'
}

export const PRIORITY_ZONES: PriorityZone[] = [
  {
    key: 'gastro_intestinal',
    label: 'Стомашно-чревна ос',
    description:
      'Стомашният пръстен и чревното поле с коларетата — най-пряката връзка с храносмилането.',
    system: 'digestive',
    // manual.json: STOMACH_RING 12–22 % (R1–R2) + INTESTINAL_FIELD/ANW 22–38 % (R3–R4)
    minutes: { right: [[0, 60]], left: [[0, 60]] },
    rings: [1, 4],
    // По коларетата на човека: всичко вътре в нея (стомах, черва, самата коларета).
    bands: ['STOM', 'ANW'],
    keyFindings: ['collarette_deform', 'fiber_defect', 'pigment_orange'],
    spread: 'circumferential',
  },
  {
    key: 'pancreatic_metabolic',
    label: 'Панкреасна / кръвно-захарна зона',
    description: 'Панкреас — как тялото управлява захарите и енергията.',
    // Jensen: панкреас ≈7:05–7:20 (R) → S8. В лявото око картата на Jensen не
    // показва панкреас; опашката ≈4:15–4:45 (L) е по другите карти и остава.
    system: 'metabolic',
    minutes: { right: [[35, 38]], left: [[21, 24]] },
    rings: [3, 9],
    keyFindings: ['fiber_defect', 'pigment_orange', 'pigment_diffuse', 'fiber_thinning'],
    spread: 'focal',
  },
  {
    key: 'hepatobiliary',
    label: 'Чернодробно-жлъчна зона',
    description: 'Обработка на мазнини, детоксикация, поносимост към тежка храна.',
    // Jensen: жлъчка ≈7:40, черен дроб ≈7:45–8:05 (R) → S8–S9. В ляво око няма чернодробна проекция.
    system: 'detox',
    minutes: { right: [[38, 43]], left: [] },
    rings: [3, 9],
    keyFindings: ['pigment_brown', 'pigment_diffuse', 'fiber_defect', 'fiber_thinning'],
    spread: 'focal',
  },
  {
    key: 'thyroid_axis',
    label: 'Щитовидна ос',
    description: 'Базален обмен и енергийно ниво.',
    // Jensen: щитовидна ≈2:30–2:45 (R) → S3;  ≈9:15–9:30 (L) → S10 (към носа)
    system: 'endocrine',
    minutes: { right: [[12, 15]], left: [[45, 48]] },
    rings: [3, 9],
    keyFindings: ['fiber_defect', 'fiber_thinning', 'pigment_orange', 'nerve_rings'],
    spread: 'focal',
  },
  {
    key: 'adrenal_stress',
    label: 'Бъбречно-надбъбречна ос',
    description: 'Стресова реакция, апетитни колебания, водно-солев баланс.',
    // Jensen: бъбрек + надбъбречна ≈5:35–5:50 (R) → S6;  ≈6:05–6:20 (L) → S7
    system: 'endocrine',
    minutes: { right: [[27, 30]], left: [[30, 33]] },
    rings: [3, 9],
    keyFindings: ['nerve_rings', 'fiber_defect', 'pigment_yellow'],
    spread: 'focal',
  },
  {
    key: 'lipid_rim',
    label: 'Липидно-минерален ръб',
    description: 'Периферният пояс — липиден обмен и елиминиране през кожата.',
    // manual.json: OUTER_ORGAN_SUBZONE 75–92 % (R9–R10) + SCURF_RIM 92–100 % (R11);
    // диатеза LIP = „липемен пръстен по ръба".
    system: 'metabolic',
    minutes: { right: [[0, 60]], left: [[0, 60]] },
    rings: [9, 11],
    keyFindings: ['sodium_ring', 'scurf_rim', 'lymphatic_rosary'],
    spread: 'circumferential',
  },
]

/**
 * Множител за находки в приоритетна зона — СТЕПЕНУВАН.
 *
 * Плоският множител 1.4 не разграничаваше: `gastro_intestinal` покрива всички
 * 12 сектора на пръстени 1–4, тоест над една трета от картата. При проверка с
 * реален модел 8 от 11 находки получиха един и същ boost — това не е
 * приоритет, а базов случай. Поясната зона казва „находката е в
 * храносмилателния пояс"; фокусната казва „находката е върху панкреаса".
 * Второто е информация, първото — почти константа.
 */
export const PRIORITY_ZONE_BOOST = 1.4
export const CIRCUMFERENTIAL_ZONE_BOOST = 1.12
/** Таван, за да не се натрупват множителите при застъпване на зони. */
export const MAX_ZONE_BOOST = 1.5

/** Изчислява крайния множител за списък от зони, в които попада находка. */
export function zoneBoost(zones: PriorityZone[]): number {
  if (zones.length === 0) return 1
  const focal = zones.some(z => z.spread === 'focal')
  const base = focal ? PRIORITY_ZONE_BOOST : CIRCUMFERENTIAL_ZONE_BOOST
  // Всяка допълнителна фокусна зона добавя малко, но никога над тавана.
  const extra = Math.max(0, zones.filter(z => z.spread === 'focal').length - 1) * 0.08
  return Math.min(MAX_ZONE_BOOST, base + extra)
}

/** Връща приоритетните зони, в които попада дадена находка. */
export function priorityZonesFor(side: Side, minute: number, ring: number, band?: RingBandKey): PriorityZone[] {
  const m = ((Math.round(minute) % 60) + 60) % 60
  const r = Math.max(0, Math.min(11, Math.round(ring)))
  return PRIORITY_ZONES.filter(z => {
    if (band && z.bands) {
      if (!z.bands.includes(band)) return false
    } else if (r < z.rings[0] || r > z.rings[1]) return false
    // Празен списък = зоната няма проекция в това око (напр. черният дроб е
    // само в дясното).
    return z.minutes[side].some(([a, b]) => (a <= b ? m >= a && m < b : m >= a || m < b))
  })
}

/* ─────────────────────────────────────────────────────────────────────────────
 * КОНСТИТУЦИЯ
 * ───────────────────────────────────────────────────────────────────────────*/

export type Constitution = 'lymphatic' | 'hematogenic' | 'mixed' | 'unclear'

export const CONSTITUTIONS: Record<Constitution, { label: string; note: string }> = {
  lymphatic: { label: 'Лимфатична (син/сив ирис)', note: 'по-често лимфен застой и възпалителен фон' },
  hematogenic: { label: 'Хематогенна (кафяв ирис)', note: 'по-често минерален и чернодробен акцент' },
  mixed: { label: 'Смесена (зелено-кафяв)', note: 'комбиниран профил' },
  unclear: { label: 'Неопределена', note: 'цветът не позволява уверено определяне' },
}

/**
 * Твърд таван на находките за едно око (сумарно от структурния и пигментния пас).
 *
 * Промптът иска максимум 14 на пас, но това е молба, не гаранция. Двата паса
 * търсят различни категории, така че легитимният максимум е около 18; над това
 * моделът вече не разграничава, а изброява. Излишъкът се отрязва по тежест.
 *
 * Дори при пробив тук щетата е ограничена: `saturate()` насища натоварването, а
 * `irisWeight` не допуска ирисът да измести оценките с повече от ~30 точки.
 */
export const MAX_FINDINGS_PER_EYE = 18
