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
    blurb: 'Стомах, черва, усвояване, чревен комфорт',
    priority: true,
  },
  {
    key: 'metabolic',
    label: 'Метаболизъм',
    blurb: 'Кръвна захар, енергиен обмен, телесен състав',
    priority: true,
  },
  {
    key: 'endocrine',
    label: 'Ендокринна регулация',
    blurb: 'Щитовидна жлеза, надбъбречни, хормонален ритъм',
    priority: true,
  },
  {
    key: 'detox',
    label: 'Детоксикация',
    blurb: 'Черен дроб, бъбреци, елиминиране',
    priority: false,
  },
  {
    key: 'immune',
    label: 'Имунитет и лимфа',
    blurb: 'Лимфен дренаж, възпалителен фон',
    priority: false,
  },
  {
    key: 'nervous',
    label: 'Нервна система',
    blurb: 'Стрес, сън, възстановяване',
    priority: false,
  },
  {
    key: 'circulatory',
    label: 'Кръвообращение',
    blurb: 'Съдов тонус, липиден профил',
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
 * КАРТАТА Е ПО JENSEN / DECK (класическата, „както я гледа изследващият").
 * Часовете са както се вижда на снимката: при дясното око носът е на 3:00, а
 * слепоочието на 9:00; при лявото — обратно. Двете карти са почти огледални,
 * с изключение на органите от едната страна на тялото:
 *   дясно око — черен дроб ≈7:30–8:30, жлъчка ≈7:45, глава на панкреаса ≈7:15;
 *   ляво око  — сърце ≈2:45–3:15, далак ≈4:15, опашка на панкреаса ≈4:30.
 * Белият дроб и бронхите са към слепоочието (дясно 9–10, ляво 2–3), гърлото и
 * щитовидната — към носа (дясно 2:30–3, ляво 9–9:30), бъбрекът — долу към
 * слепоочието (дясно ≈6:30, ляво ≈5:30), пикочният мехур — долу към носа.
 *
 * Предишната версия следваше `manual.json`, в който част от зоните бяха
 * огледални спрямо Jensen (черният дроб на 4–5 ч в дясното око, сърцето на
 * 8–9 ч в лявото). Собственикът избра класическата карта (2026-10-13).
 */
const ZONE_LABELS_RIGHT = [
  'Мозък и хормонален център',    // S1  12–1  главен мозък, хипофиза, психика
  'Сетивна област и чело',        // S2  1–2   сетивна кора, чело, нос
  'Гърло и щитовидна ос',         // S3  2–3   уста, сливици, гърло, хранопровод, ЩИТОВИДНА ≈2:45
  'Гръден кош и диафрагма',       // S4  3–4   гръдна кост, горна гърда, диафрагма
  'Коремна стена и таз',          // S5  4–5   коремна стена, слабини, таз
  'Пикочни и репродуктивни пътища', // S6 5–6  ПИКОЧЕН МЕХУР ≈5:30, матка/простата, ректум
  'Бъбречно-надбъбречна ос',      // S7  6–7   БЪБРЕК+НАДБЪБРЕЧНА ≈6:30, сляпо черво/апендикс
  'Кръвно-захарна и жлъчна ос',   // S8  7–8   ГЛАВА НА ПАНКРЕАСА ≈7:15, ЖЛЪЧКА ≈7:45, крак
  'Чернодробна ос и рамо',        // S9  8–9   ЧЕРЕН ДРОБ ≈8:00, лопатка, рамо/ръка
  'Дишане',                       // S10 9–10  бял дроб, бронхи, плевра
  'Ухо и шия',                    // S11 10–11 ухо ≈10:15, шия ≈10:45
  'Малък мозък и мозъчен ствол',  // S12 11–12 малък мозък, говорен център
]

const ZONE_LABELS_LEFT = [
  'Малък мозък и мозъчен ствол',  // S1  12–1  малък мозък, говорен център
  'Ухо и шия',                    // S2  1–2   шия ≈1:15, ухо ≈1:45
  'Дишане и сърдечна област',     // S3  2–3   бял дроб, бронхи, СЪРЦЕ ≈2:45
  'Сърдечна област и рамо',       // S4  3–4   СЪРЦЕ ≈3:00, лопатка, рамо/ръка
  'Лимфна и кръвно-захарна ос',   // S5  4–5   ДАЛАК ≈4:15, ОПАШКА НА ПАНКРЕАСА ≈4:30, низходящо дебело черво
  'Бъбречно-надбъбречна ос',      // S6  5–6   БЪБРЕК+НАДБЪБРЕЧНА ≈5:30, сигма
  'Пикочни и репродуктивни пътища', // S7 6–7  ПИКОЧЕН МЕХУР ≈6:30, матка/простата, ректум
  'Коремна стена и таз',          // S8  7–8   коремна стена, слабини, таз
  'Гръден кош и диафрагма',       // S9  8–9   гръдна кост, горна гърда, диафрагма
  'Гърло и щитовидна ос',         // S10 9–10  ЩИТОВИДНА ≈9:15, гърло, хранопровод, уста
  'Сетивна област и чело',        // S11 10–11 нос, чело, сетивна кора
  'Мозък и хормонален център',    // S12 11–12 главен мозък, хипофиза, психика
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

/** ДЯСНО ОКО — по Jensen/Deck. Носът е на 3:00, слепоочието на 9:00. */
export const SECTORS_RIGHT: SectorDef[] = [
  sectorR(1, { nervous: 0.9, endocrine: 0.8 }, 'главен мозък, хипофиза, психика'),
  sectorR(2, { nervous: 0.9, immune: 0.2 }, 'сетивна кора, чело, нос/синуси'),
  sectorR(3, { endocrine: 1.0, metabolic: 0.7, immune: 0.5, digestive: 0.3 }, 'уста, сливици, гърло, хранопровод; щитовидна ≈2:45'),
  sectorR(4, { circulatory: 0.3, digestive: 0.3 }, 'гръдна кост, горна гърда, диафрагма'),
  sectorR(5, { digestive: 0.4, immune: 0.3 }, 'коремна стена, слабини, таз'),
  sectorR(6, { detox: 0.8, endocrine: 0.5 }, 'пикочен мехур ≈5:30; матка/простата; ректум'),
  sectorR(7, { detox: 1.0, endocrine: 0.9, digestive: 0.5 }, 'бъбрек + надбъбречна ≈6:30; сляпо черво/апендикс'),
  sectorR(8, { metabolic: 1.0, digestive: 0.9, detox: 0.6 }, 'глава на панкреаса ≈7:15; жлъчка ≈7:45; крак'),
  sectorR(9, { detox: 1.0, metabolic: 0.6, digestive: 0.6 }, 'черен дроб ≈7:30–8:30; лопатка, рамо/ръка'),
  sectorR(10, { immune: 0.6, circulatory: 0.4 }, 'бял дроб, бронхи, плевра'),
  sectorR(11, { nervous: 0.5, immune: 0.2 }, 'ухо ≈10:15; шия ≈10:45'),
  sectorR(12, { nervous: 0.9, endocrine: 0.3 }, 'малък мозък, мозъчен ствол, говорен център'),
]

/**
 * ЛЯВО ОКО — по Jensen/Deck, носът е на 9:00. Огледало на дясното, освен
 * органите от едната страна: сърцето, далакът и опашката на панкреаса са само
 * тук, черният дроб и жлъчката — само в дясното око.
 */
export const SECTORS_LEFT: SectorDef[] = [
  sectorL(1, { nervous: 0.9, endocrine: 0.3 }, 'малък мозък, мозъчен ствол, говорен център'),
  sectorL(2, { nervous: 0.5, immune: 0.2 }, 'шия ≈1:15; ухо ≈1:45'),
  sectorL(3, { circulatory: 0.8, immune: 0.6 }, 'бял дроб, бронхи, плевра; сърце ≈2:45'),
  sectorL(4, { circulatory: 1.0 }, 'сърце ≈3:00; лопатка, рамо/ръка'),
  sectorL(5, { immune: 0.9, metabolic: 0.9, digestive: 0.7 }, 'далак ≈4:15; опашка на панкреаса ≈4:30; низходящо дебело черво'),
  sectorL(6, { detox: 1.0, endocrine: 0.9, digestive: 0.5 }, 'бъбрек + надбъбречна ≈5:30; сигма'),
  sectorL(7, { detox: 0.8, endocrine: 0.5 }, 'пикочен мехур ≈6:30; матка/простата; ректум'),
  sectorL(8, { digestive: 0.4, immune: 0.3 }, 'коремна стена, слабини, таз'),
  sectorL(9, { circulatory: 0.3, digestive: 0.3 }, 'гръдна кост, горна гърда, диафрагма'),
  sectorL(10, { endocrine: 1.0, metabolic: 0.7, immune: 0.5, digestive: 0.3 }, 'щитовидна ≈9:15; гърло, хранопровод, уста, сливици'),
  sectorL(11, { nervous: 0.9, immune: 0.2 }, 'нос/синуси, чело, сетивна кора'),
  sectorL(12, { nervous: 0.9, endocrine: 0.8 }, 'главен мозък, хипофиза, психика'),
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
  /** Име за потребителя. */
  label: string
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
    appearanceUnwrapped: 'тъмнокафяво до почти черно петно с ясен ръб',
    meaning: 'чернодробно натоварване',
    weight: 0.8,
    systems: { detox: 1.0, digestive: 0.4 },
    validRings: [1, 11],
  },
  pigment_yellow: {
    type: 'pigment_yellow',
    label: 'Жълт пигмент',
    appearanceUnwrapped: 'жълтеникаво петно или воал върху влакната',
    meaning: 'бъбречно натоварване',
    weight: 0.7,
    systems: { detox: 1.0 },
    validRings: [1, 11],
  },
  pigment_diffuse: {
    type: 'pigment_diffuse',
    label: 'Дифузен пигмент',
    appearanceUnwrapped: 'размита цветна мъгла без ясен ръб над няколко минути',
    meaning: 'по-общо метаболитно натоварване',
    weight: 0.5,
    systems: { detox: 0.7, metabolic: 0.6 },
    validRings: [1, 11],
  },
  nerve_rings: {
    type: 'nerve_rings',
    label: 'Стресови пръстени',
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
    keyFindings: ['collarette_deform', 'fiber_defect', 'pigment_orange'],
    spread: 'circumferential',
  },
  {
    key: 'pancreatic_metabolic',
    label: 'Панкреасна / кръвно-захарна зона',
    description: 'Панкреас — как тялото управлява захарите и енергията.',
    // Jensen: глава на панкреаса ≈7:00–7:30 (R) → S8;  опашка ≈4:15–4:45 (L) → S5
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
    // Jensen: черен дроб ≈7:30–8:30, жлъчка ≈7:45 (R) → S8–S9. В ляво око няма чернодробна проекция.
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
    // Jensen: щитовидна ≈2:30–3:00 (R) → S3;  ≈9:00–9:30 (L) → S10 (към носа)
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
    // Jensen: бъбрек+надбъбречна ≈6:15–6:45 (R) → S7;  ≈5:15–5:45 (L) → S6 (към слепоочието)
    system: 'endocrine',
    minutes: { right: [[31, 34]], left: [[26, 29]] },
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
export function priorityZonesFor(side: Side, minute: number, ring: number): PriorityZone[] {
  const m = ((Math.round(minute) % 60) + 60) % 60
  const r = Math.max(0, Math.min(11, Math.round(ring)))
  return PRIORITY_ZONES.filter(z => {
    if (r < z.rings[0] || r > z.rings[1]) return false
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
