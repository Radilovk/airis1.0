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
 * проектира само в десния ирис, сърцето и далакът — само в левия. Затова
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
 * за да не се създава впечатление за медицинска диагноза.
 *
 * Списъците са РАЗЛИЧНИ за двете очи, защото картите са огледални. Първата
 * версия ползваше един общ списък по индекс — тогава етикетът на ляво S4 казваше
 * „Дишане и гръден кош", докато теглата на същия сектор бяха 100 % кръвообращение.
 * Етикет, който противоречи на изчислението под него, е по-лош от липсващ.
 */
const ZONE_LABELS_RIGHT = [
  'Глава и нервна регулация',      // S1  12–1
  'Хормонален контрол',            // S2  1–2
  'Обмяна и щитовидна ос',         // S3  2–3
  'Дишане и гръден кош',           // S4  3–4
  'Горно храносмилане',            // S5  4–5
  'Чернодробно-жлъчна ос',         // S6  5–6
  'Долно храносмилане',            // S7  6–7
  'Отделяне и водно-солев баланс', // S8  7–8
  'Стресова ос и надбъбречни',     // S9  8–9
  'Кръвообращение',                // S10 9–10
  'Лимфа и имунен фон',            // S11 10–11
  'Възстановяване и сън',          // S12 11–12
]

/** Огледален ред: ляво Sk съответства функционално на дясно S(14−k), k≥2. */
const ZONE_LABELS_LEFT = [
  'Глава и нервна регулация',      // S1  12–1
  'Възстановяване и сън',          // S2  1–2
  'Лимфа и имунен фон',            // S3  2–3
  'Кръвообращение',                // S4  3–4
  'Стресова ос и надбъбречни',     // S5  4–5
  'Отделяне и водно-солев баланс', // S6  5–6
  'Долно храносмилане',            // S7  6–7
  'Кръвно-захарна регулация',      // S8  7–8
  'Горно храносмилане',            // S9  8–9
  'Дишане и гръден кош',           // S10 9–10
  'Обмяна и щитовидна ос',         // S11 10–11
  'Хормонален контрол',            // S12 11–12
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

/**
 * ДЕСЕН ИРИС. Черният дроб и жлъчката се проектират в дясното око
 * (сектори 6–7, приблизително 5:00–7:00), апендиксът и илеоцекалната област — 6–7 ч.
 */
export const SECTORS_RIGHT: SectorDef[] = [
  sectorR(1, { nervous: 1.0, endocrine: 0.2 }, 'мозъчна кора, нервна регулация'),
  sectorR(2, { endocrine: 0.9, nervous: 0.3 }, 'хипофизно-хипоталамична ос'),
  sectorR(3, { endocrine: 1.0, metabolic: 0.7 }, 'щитовидна жлеза, базален обмен'),
  sectorR(4, { immune: 0.5, circulatory: 0.4 }, 'бял дроб, бронхи (дясно)'),
  sectorR(5, { digestive: 1.0, metabolic: 0.5 }, 'стомах, дуоденум'),
  sectorR(6, { detox: 1.0, digestive: 0.6, metabolic: 0.5 }, 'черен дроб, жлъчка (дясно)'),
  sectorR(7, { digestive: 1.0, immune: 0.4 }, 'тънко и дебело черво, илеоцекална област'),
  sectorR(8, { detox: 0.8, metabolic: 0.3 }, 'бъбрек, пикочни пътища (дясно)'),
  sectorR(9, { endocrine: 1.0, metabolic: 0.6, nervous: 0.5 }, 'надбъбречна жлеза (дясно)'),
  sectorR(10, { circulatory: 0.9 }, 'съдов тонус, периферно кръвообращение'),
  sectorR(11, { immune: 1.0, detox: 0.4 }, 'лимфен дренаж (дясно)'),
  sectorR(12, { nervous: 0.8, endocrine: 0.4 }, 'епифиза, сън и възстановяване'),
]

/**
 * ЛЯВ ИРИС. Сърцето, далакът и панкреасът се проектират в лявото око.
 * Секторите са огледални по функция, но не по номер — номерацията остава
 * часовникова, за да съвпада с визуализацията.
 */
export const SECTORS_LEFT: SectorDef[] = [
  sectorL(1, { nervous: 1.0, endocrine: 0.2 }, 'мозъчна кора, нервна регулация'),
  sectorL(2, { nervous: 0.8, endocrine: 0.4 }, 'епифиза, сън и възстановяване'),
  sectorL(3, { immune: 1.0, detox: 0.4 }, 'лимфен дренаж (ляво), далак'),
  sectorL(4, { circulatory: 1.0 }, 'сърце, съдов тонус'),
  sectorL(5, { endocrine: 1.0, metabolic: 0.6, nervous: 0.5 }, 'надбъбречна жлеза (ляво)'),
  sectorL(6, { detox: 0.8, metabolic: 0.3 }, 'бъбрек, пикочни пътища (ляво)'),
  sectorL(7, { digestive: 1.0, immune: 0.4 }, 'дебело черво, сигма'),
  sectorL(8, { digestive: 1.0, metabolic: 1.0 }, 'панкреас, кръвно-захарна регулация'),
  sectorL(9, { digestive: 1.0, metabolic: 0.5 }, 'стомах, кардия'),
  sectorL(10, { immune: 0.5, circulatory: 0.4 }, 'бял дроб, бронхи (ляво)'),
  sectorL(11, { endocrine: 1.0, metabolic: 0.7 }, 'щитовидна жлеза, базален обмен'),
  sectorL(12, { endocrine: 0.9, nervous: 0.3 }, 'хипофизно-хипоталамична ос'),
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
  /** Пръстени [от, до] включително. */
  rings: [number, number]
  label: string
  /** Какво тежи, когато находка попадне тук. */
  systems: Partial<Record<SystemKey, number>>
}

export const RING_BANDS: RingBandDef[] = [
  { key: 'IPB', rings: [0, 0], label: 'Ръб на зеницата', systems: { nervous: 0.6 } },
  { key: 'STOM', rings: [1, 1], label: 'Стомашен пръстен', systems: { digestive: 1.0 } },
  { key: 'ANW', rings: [2, 3], label: 'Автономен нервен пръстен', systems: { digestive: 0.9, nervous: 0.8 } },
  { key: 'ORG', rings: [4, 9], label: 'Органна зона', systems: {} },
  { key: 'LYM', rings: [10, 10], label: 'Лимфен пояс', systems: { immune: 1.0, detox: 0.5 } },
  { key: 'SCU', rings: [11, 11], label: 'Кожен пояс / лимбус', systems: { detox: 0.8, circulatory: 0.6 } },
]

export function ringBand(ring: number): RingBandDef {
  const r = Math.max(0, Math.min(11, Math.round(ring)))
  return RING_BANDS.find(b => r >= b.rings[0] && r <= b.rings[1]) ?? RING_BANDS[3]
}

/* ─────────────────────────────────────────────────────────────────────────────
 * РЕЧНИК НА НАХОДКИТЕ
 *
 * Затворен списък. AI-ят няма право да измисля типове — това е единственият
 * начин находките да бъдат обработени детерминистично надолу по веригата.
 * ───────────────────────────────────────────────────────────────────────────*/

export type FindingType =
  // структурни
  | 'lacuna'
  | 'crypt'
  | 'radial_furrow'
  | 'transversal_fiber'
  | 'fiber_loosening'
  | 'collarette_irregularity'
  // пигментни / пръстеновидни
  | 'pigment_spot'
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
}

export const FINDINGS: Record<FindingType, FindingDef> = {
  lacuna: {
    type: 'lacuna',
    label: 'Лакуна',
    appearanceUnwrapped: 'затворен тъмен овал/лист, който прекъсва хода на влакната',
    meaning: 'локално по-рехава тъкан; зона за поддръжка',
    weight: 0.8,
    systems: {},
    validRings: [1, 11],
  },
  crypt: {
    type: 'crypt',
    label: 'Крипта',
    appearanceUnwrapped: 'малка дълбока тъмна ромбовидна дупка',
    meaning: 'по-дълбок структурен дефицит в сектора',
    weight: 0.7,
    systems: {},
    validRings: [1, 9],
  },
  radial_furrow: {
    type: 'radial_furrow',
    label: 'Радиална бразда',
    appearanceUnwrapped: 'ВЕРТИКАЛНА тъмна ивица (в разгъвката радиалното е вертикално)',
    meaning: 'нервно-стресов и чревно-транзитен маркер',
    weight: 0.6,
    systems: { nervous: 0.8, digestive: 0.5 },
    validRings: [2, 11],
  },
  transversal_fiber: {
    type: 'transversal_fiber',
    label: 'Напречно влакно',
    appearanceUnwrapped: 'ХОРИЗОНТАЛНА линия, пресичаща няколко минути',
    meaning: 'локално напрежение в тъканта',
    weight: 0.5,
    systems: {},
    validRings: [2, 11],
  },
  fiber_loosening: {
    type: 'fiber_loosening',
    label: 'Разреждане на влакната',
    appearanceUnwrapped: 'участък с по-размита, по-рядка текстура без ясни линии',
    meaning: 'по-нисък тъканен тонус в сектора',
    weight: 0.5,
    systems: {},
    validRings: [2, 11],
  },
  collarette_irregularity: {
    type: 'collarette_irregularity',
    label: 'Неравен автономен пръстен',
    appearanceUnwrapped: 'вълнообразна/накъсана граница около редове R2–R3',
    meaning: 'храносмилателен и вегетативен дисбаланс',
    weight: 0.9,
    systems: { digestive: 1.0, nervous: 0.7 },
    validRings: [1, 4],
  },
  pigment_spot: {
    type: 'pigment_spot',
    label: 'Пигментно петно',
    appearanceUnwrapped: 'ясно очертано жълто/оранжево/кафяво петно върху влакната',
    meaning: 'метаболитно-детоксикационно натоварване',
    weight: 0.8,
    systems: { detox: 0.9, metabolic: 0.5 },
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
  },
  lymphatic_rosary: {
    type: 'lymphatic_rosary',
    label: 'Лимфна броеница',
    appearanceUnwrapped: 'верига от бледи топчета по ред R10',
    meaning: 'забавен лимфен дренаж',
    weight: 0.8,
    systems: { immune: 1.0, detox: 0.6 },
    validRings: [9, 11],
  },
  scurf_rim: {
    type: 'scurf_rim',
    label: 'Кожен ръб',
    appearanceUnwrapped: 'тъмна лента по най-долния ред R11',
    meaning: 'по-слабо кожно елиминиране',
    weight: 0.6,
    systems: { detox: 1.0 },
    validRings: [10, 11],
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

export function isFindingType(v: unknown): v is FindingType {
  return typeof v === 'string' && v in FINDINGS
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
}

export const PRIORITY_ZONES: PriorityZone[] = [
  {
    key: 'gastro_intestinal',
    label: 'Стомашно-чревна ос',
    description:
      'Вътрешните пръстени около зеницата и автономният нервен пръстен — най-пряката връзка с храносмилането.',
    system: 'digestive',
    minutes: {
      // цялата обиколка в R1–R3 се чете като храносмилателен пояс
      right: [[0, 60]],
      left: [[0, 60]],
    },
    rings: [1, 3],
    keyFindings: ['collarette_irregularity', 'radial_furrow', 'lacuna', 'crypt', 'pigment_spot'],
  },
  {
    key: 'pancreatic_metabolic',
    label: 'Инсулинова / кръвно-захарна зона',
    description: 'Панкреас и горно храносмилане — как тялото управлява захарите и енергията.',
    system: 'metabolic',
    minutes: {
      right: [[20, 30]],
      left: [[35, 50]],
    },
    rings: [3, 8],
    keyFindings: ['lacuna', 'crypt', 'pigment_spot', 'pigment_diffuse', 'fiber_loosening'],
  },
  {
    key: 'hepatobiliary',
    label: 'Чернодробно-жлъчна зона',
    description: 'Обработка на мазнини, детоксикация, поносимост към тежка храна.',
    system: 'detox',
    minutes: {
      right: [[25, 35]],
      left: [[25, 32]],
    },
    rings: [3, 9],
    keyFindings: ['pigment_spot', 'pigment_diffuse', 'lacuna', 'fiber_loosening'],
  },
  {
    key: 'thyroid_axis',
    label: 'Щитовидна ос',
    description: 'Базален обмен и енергийно ниво.',
    system: 'endocrine',
    minutes: {
      right: [[10, 15]],
      left: [[50, 55]],
    },
    rings: [3, 8],
    keyFindings: ['lacuna', 'fiber_loosening', 'pigment_spot', 'nerve_rings'],
  },
  {
    key: 'adrenal_stress',
    label: 'Надбъбречно-стресова ос',
    description: 'Стресова реакция, апетитни колебания, сутрешна енергия.',
    system: 'endocrine',
    minutes: {
      right: [[40, 45]],
      left: [[20, 25]],
    },
    rings: [3, 8],
    keyFindings: ['nerve_rings', 'radial_furrow', 'lacuna', 'crypt'],
  },
  {
    key: 'lipid_rim',
    label: 'Липидно-минерален ръб',
    description: 'Периферният пояс — липиден и минерален обмен.',
    system: 'metabolic',
    minutes: {
      right: [[0, 60]],
      left: [[0, 60]],
    },
    rings: [10, 11],
    keyFindings: ['sodium_ring', 'scurf_rim', 'lymphatic_rosary'],
  },
]

/** Множител за находки, попадащи в приоритетна зона. */
export const PRIORITY_ZONE_BOOST = 1.4

/** Връща приоритетните зони, в които попада дадена находка. */
export function priorityZonesFor(side: Side, minute: number, ring: number): PriorityZone[] {
  const m = ((Math.round(minute) % 60) + 60) % 60
  const r = Math.max(0, Math.min(11, Math.round(ring)))
  return PRIORITY_ZONES.filter(z => {
    if (r < z.rings[0] || r > z.rings[1]) return false
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
