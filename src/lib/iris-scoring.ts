/**
 * iris-scoring.ts — ДЕТЕРМИНИСТИЧНОТО ЯДРО.
 *
 * ПРИНЦИП
 * ───────
 * Ирисовият анализ е ПОМОЩЕН инструмент. Логиката на храненето не бива да
 * зависи от това дали моделът е разпознал правилно една лакуна. Затова:
 *
 *   • Въпросникът дава ОСНОВАТА (base load) за всяка функционална система.
 *     Той е самоотчет, но е стабилен и проверим.
 *   • Ирисовите находки само МОДУЛИРАТ тази основа — с ограничен таван.
 *     Максималният принос на ириса е `IRIS_MAX_INFLUENCE` (35 %).
 *   • Когато качеството на снимката е ниско или покритието на лентата е малко,
 *     влиянието на ириса се СВИВА пропорционално. Лоша снимка → почти чист
 *     въпросник, вместо уверени глупости.
 *
 * Изходът е набор от `NutritionDriver` — конкретни, проследими причини за
 * всяка препоръка. LLM-ът получава тези драйвери и ги облича в текст; той не
 * решава кое е приоритет.
 */

import {
  FINDINGS,
  zoneBoost,
  SYSTEMS,
  isFindingType,
  minuteToSector,
  priorityZonesFor,
  ringBand,
  sectorsFor,
  systemLabel,
  type FindingType,
  type Side,
  type SystemKey,
} from './iris-map'
import type { QuestionnaireData } from '@/types'
import { buildSafetyProfile, safetyNotices, type SafetyNotice, type SafetyProfile } from './safety-profile'

/** Максимален дял, с който ирисът може да измести оценката на дадена система. */
export const IRIS_MAX_INFLUENCE = 0.35

export type FindingSize = 'xs' | 's' | 'm' | 'l'

/** Нормализирана находка — това, което влиза в двигателя. */
export interface NormalizedFinding {
  side: Side
  type: FindingType
  /** 1..12 */
  sector: number
  /** 0..11 */
  ring: number
  size: FindingSize
  confidence: number
  note?: string
  /** Приоритетните зони, в които попада (ключове). */
  priorityZones: string[]
  /** Изчисленото натоварване, което тази находка внася. */
  load: number
  /**
   * Има ли съответстваща находка в ДРУГОТО око — същият пръстенен пояс и обща
   * водеща система. Двустранната находка е по-силно доказателство.
   */
  bilateral?: boolean
}

export interface SystemResult {
  key: SystemKey
  label: string
  /** 0..100, по-високо = по-добре. */
  score: number
  /** 0..1 — колко от оценката идва от ириса. */
  irisShare: number
  /** Дали е приоритетна система. */
  priority: boolean
  /** Кратко обяснение на български. */
  description: string
  /** Причините, довели до оценката. */
  reasons: string[]
}

export type DriverStrength = 'high' | 'medium' | 'low'

/** В коя секция на плана попада действието. */
export type DriverCategory = 'diet' | 'supplement' | 'lifestyle'

/** Проследима причина за препоръка. */
export interface NutritionDriver {
  id: string
  system: SystemKey
  strength: DriverStrength
  /** Категория за отчета — не всичко е „хранене". */
  category: DriverCategory
  /** Какво наблюдаваме. */
  observation: string
  /** Какво следва да се направи в храненето. */
  action: string
  /** Откъде идва: въпросник, ирис, или и двете. */
  source: 'questionnaire' | 'iris' | 'both'
}

export interface ScoringInput {
  findings: NormalizedFinding[]
  questionnaire: QuestionnaireData
  /** 0..1 — среднопретеглено качество на двете снимки. */
  imageQuality: number
  /** 0..1 — среден дял четима площ в лентите. */
  stripCoverage: number
}

export interface ScoringResult {
  systems: SystemResult[]
  /** 0..100 */
  overall: number
  drivers: NutritionDriver[]
  /** Извлечените специални състояния. */
  safety: SafetyProfile
  /** Видими предупреждения към потребителя. */
  notices: SafetyNotice[]
  /** ID-та на правила, отпаднали заради противопоказание. */
  suppressed: string[]
  /** 0..1 — колко тежи ирисът в крайния резултат. */
  irisWeight: number
  /** Приоритетни системи, подредени по нужда от внимание. */
  focus: SystemKey[]
  /** Обобщение на находките по система. */
  loadBySystem: Record<SystemKey, number>
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. НОРМАЛИЗАЦИЯ НА НАХОДКИТЕ
 * ───────────────────────────────────────────────────────────────────────────*/

const SIZE_WEIGHT: Record<FindingSize, number> = { xs: 0.4, s: 0.65, m: 1.0, l: 1.4 }

/**
 * Средното тегло на 15-те типа находки. Служи за център на свиването.
 */
const MEAN_FINDING_WEIGHT = 0.68

/**
 * КОЛКО ДА ВЯРВАМЕ НА ТИПА НА НАХОДКАТА.
 *
 * Измерено при проверка с реален модел: една и съща снимка, един и същ модел,
 * два независими паса. МЯСТОТО се повтаря, ТИПЪТ — не. В сектор S10 пас 1
 * върна „радиална бразда R6", пас 2 — „лакуна R5" и „неравен автономен
 * пръстен R3". Регионът е един, името — три различни.
 *
 * Затова типът не бива да носи пълната разлика в тежестта: 0.5 срещу 0.9 е
 * почти двойно, а разликата е между два етикета, които моделът разменя. Тежестта
 * се свива към средното, така че редът се запазва, но грешният етикет не
 * променя силата на извода наполовина.
 */
const TYPE_WEIGHT_TRUST = 0.6
function typeWeight(w: number): number {
  return MEAN_FINDING_WEIGHT + (w - MEAN_FINDING_WEIGHT) * TYPE_WEIGHT_TRUST
}

/**
 * Тежест на ТИПА при определяне на ПОСОКАТА (към коя система сочи находката).
 * Секторът и поясът са координати — те са стабилни. Типът е етикет и не е.
 * Затова той участва в посоката, но не се конкурира с местоположението.
 */
const TYPE_DIRECTION_WEIGHT = 0.45

function asSize(v: unknown): FindingSize {
  return v === 'xs' || v === 's' || v === 'm' || v === 'l' ? v : 'm'
}

/**
 * Приема суровия JSON от детекторския пас и връща само валидните находки.
 * Отхвърля: непознат тип, сектор/пръстен извън обхват, находка в пръстен,
 * в който този тип няма физически смисъл, и увереност под 0.35.
 */
/**
 * Четимостта на клетките от разгъването. Подава се, за да не тежи еднакво
 * находка в чиста клетка и находка в клетка, на която една пета от площта е
 * заличен отблясък.
 */
export interface CellReadability {
  readability: number[][]
  partialCells: Array<{ sector: number; ring: number }>
}

export function normalizeFindings(
  raw: unknown,
  side: Side,
  cells?: CellReadability
): NormalizedFinding[] {
  const partialKeys = new Set((cells?.partialCells ?? []).map(c => `${c.sector}:${c.ring}`))

  const list = Array.isArray(raw) ? raw : []
  const out: NormalizedFinding[] = []

  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>

    const type = o.type
    if (!isFindingType(type)) continue
    const def = FINDINGS[type]

    // адресът е клетка: sector 1..12 + ring 0..11.
    // Приемаме и стар формат с minute, за съвместимост.
    let sector = Number(o.sector)
    if (!Number.isFinite(sector)) {
      const minute = Number(o.minute ?? (Array.isArray(o.minuteRange) ? (o.minuteRange as number[])[0] : NaN))
      sector = Number.isFinite(minute) ? minuteToSector(minute) : NaN
    }
    if (!Number.isFinite(sector)) continue
    sector = Math.round(sector)
    if (sector < 1 || sector > 12) continue

    let ring = Number(o.ring)
    if (!Number.isFinite(ring)) {
      ring = Number(Array.isArray(o.ringRange) ? (o.ringRange as number[])[0] : NaN)
    }
    if (!Number.isFinite(ring)) continue
    ring = Math.round(ring)
    if (ring < 0 || ring > 11) continue

    // находка извън физически смисления пръстенен обхват = халюцинация
    if (ring < def.validRings[0] || ring > def.validRings[1]) continue

    const confidence = Math.max(0, Math.min(1, Number(o.confidence ?? 0.6)))
    if (confidence < 0.35) continue

    const size = asSize(o.size)
    const centreMinute = (sector - 1) * 5 + 2.5
    const zones = priorityZonesFor(side, centreMinute, ring)

    const boost = zoneBoost(zones)

    // Клетка с частично маскирана площ носи по-малко доказателство. Под 55 %
    // четимост находката се отхвърля изцяло: там е било защриховано „N/A",
    // тоест моделът е докладвал върху маска.
    const readable = cells?.readability?.[ring]?.[sector - 1]
    if (readable !== undefined && readable < 0.55) continue
    // Собствената четимост на клетката, а под нея — фиксирано намаление, ако
    // клетката е в обхвата на съседен отблясък (ореолът бледнее през ръба).
    const readableFactor =
      (readable === undefined ? 1 : Math.min(1, readable / 0.9)) *
      (partialKeys.has(`${sector}:${ring}`) ? 0.6 : 1)

    const load = typeWeight(def.weight) * SIZE_WEIGHT[size] * confidence * boost * readableFactor

    out.push({
      side,
      type,
      sector,
      ring,
      size,
      confidence,
      note: typeof o.note === 'string' ? o.note.slice(0, 80) : undefined,
      priorityZones: zones.map(z => z.key),
      load,
    })
  }

  // де-дублиране: една и съща находка в същата клетка се брои веднъж
  const seen = new Set<string>()
  return out.filter(f => {
    const k = `${f.type}:${f.sector}:${f.ring}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. НАТОВАРВАНЕ ПО СИСТЕМИ ОТ ИРИСА
 * ───────────────────────────────────────────────────────────────────────────*/

function emptyLoad(): Record<SystemKey, number> {
  return {
    digestive: 0,
    metabolic: 0,
    endocrine: 0,
    detox: 0,
    immune: 0,
    nervous: 0,
    circulatory: 0,
  }
}

/**
 * Разпределя натоварването на всяка находка по системи чрез теглата на
 * сектора, пръстенния пояс и самия тип находка.
 */
export function irisLoadBySystem(findings: NormalizedFinding[]): Record<SystemKey, number> {
  const load = emptyLoad()

  for (const f of findings) {
    const sectorDef = sectorsFor(f.side)[f.sector - 1]
    const band = ringBand(f.ring)
    const def = FINDINGS[f.type]

    // събиране на теглата от трите източника
    const weights = emptyLoad()
    for (const [k, v] of Object.entries(sectorDef.systems)) weights[k as SystemKey] += v
    for (const [k, v] of Object.entries(band.systems)) weights[k as SystemKey] += v * 0.7
    for (const [k, v] of Object.entries(def.systems))
      weights[k as SystemKey] += v * TYPE_DIRECTION_WEIGHT

    const total = Object.values(weights).reduce((a, b) => a + b, 0)
    if (total <= 0) continue

    for (const key of Object.keys(weights) as SystemKey[]) {
      if (weights[key] <= 0) continue
      load[key] += (weights[key] / total) * f.load
    }
  }

  return load
}

/**
 * ДВУСТРАННО ПОТВЪРЖДЕНИЕ.
 *
 * Досега находка от едното око тежеше колкото находка, потвърдена и от двете.
 * Физиологично е обратното: системен процес се проявява двустранно, а
 * единичното петно в едно око по-често е локална особеност или артефакт.
 *
 * „Двустранна" НЕ значи „същият сектор". Картата не е огледална — черният дроб
 * е само в дясното око, сърцето и далакът само в лявото. Затова съвпадението се
 * търси по СМИСЪЛ: същият пръстенен пояс плюс обща водеща система.
 */
const BILATERAL_BOOST = 1.25

function dominantSystems(f: NormalizedFinding): SystemKey[] {
  const sectorDef = sectorsFor(f.side)[f.sector - 1]
  const band = ringBand(f.ring)
  const w = emptyLoad()
  for (const [k, v] of Object.entries(sectorDef.systems)) w[k as SystemKey] += v
  for (const [k, v] of Object.entries(band.systems)) w[k as SystemKey] += v * 0.7
  const max = Math.max(...Object.values(w))
  if (max <= 0) return []
  return (Object.keys(w) as SystemKey[]).filter(k => w[k] >= max * 0.6)
}

export function applyBilateralCorroboration(findings: NormalizedFinding[]): NormalizedFinding[] {
  const left = findings.filter(f => f.side === 'left')
  const right = findings.filter(f => f.side === 'right')
  if (left.length === 0 || right.length === 0) return findings

  const meta = new Map<NormalizedFinding, { band: string; systems: SystemKey[] }>()
  for (const f of findings) meta.set(f, { band: ringBand(f.ring).key, systems: dominantSystems(f) })

  return findings.map(f => {
    const mine = meta.get(f)!
    const others = f.side === 'left' ? right : left
    const corroborated = others.some(o => {
      const theirs = meta.get(o)!
      return theirs.band === mine.band && theirs.systems.some(k => mine.systems.includes(k))
    })
    if (!corroborated) return f
    return { ...f, bilateral: true, load: f.load * BILATERAL_BOOST }
  })
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. БАЗА ОТ ВЪПРОСНИКА
 *
 * Всяка система получава базово натоварване 0..1 от самоотчета. Това е
 * гръбнакът на плана — работи и когато ирисът не е разчетен изобщо.
 * ───────────────────────────────────────────────────────────────────────────*/

function has(list: string[] | undefined, ...needles: string[]): boolean {
  if (!list || list.length === 0) return false
  const joined = list.join(' ').toLowerCase()
  return needles.some(n => joined.includes(n.toLowerCase()))
}

function textHas(text: string | undefined, ...needles: string[]): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  return needles.some(n => t.includes(n.toLowerCase()))
}

export interface QuestionnaireSignals {
  load: Record<SystemKey, number>
  /** Човекочитаеми причини по система. */
  reasons: Record<SystemKey, string[]>
  bmi: number
}

export function questionnaireSignals(q: QuestionnaireData): QuestionnaireSignals {
  const load = emptyLoad()
  const reasons: Record<SystemKey, string[]> = {
    digestive: [],
    metabolic: [],
    endocrine: [],
    detox: [],
    immune: [],
    nervous: [],
    circulatory: [],
  }

  const add = (key: SystemKey, amount: number, reason: string) => {
    load[key] += amount
    if (reason) reasons[key].push(reason)
  }

  const heightM = (q.height || 170) / 100
  const bmi = (q.weight || 70) / (heightM * heightM)

  // Свободният текст носи повече от чеклистите — потребителите описват
  // състоянията си там. Досега `medicalConditions` и `familyHistory` се
  // събираха и не се четяха изобщо.
  const anamnesis = [q.medicalConditions, q.familyHistory, q.complaints]
    .filter(Boolean)
    .join(' ')

  // ВАЖНО: въпросникът пита за ЧАШИ вода (~250 мл), не за литри.
  // Кодът четеше стойността като литри, така че 4 чаши (1 л — реално малко)
  // не задействаше нищо, а промптът съобщаваше „вода: 8 л/ден".
  const waterLitres = (q.hydration ?? 8) * 0.25

  // ── метаболизъм ──
  if (bmi >= 30) add('metabolic', 0.45, `ИТМ ${bmi.toFixed(1)} — изразено наднормено тегло`)
  else if (bmi >= 25) add('metabolic', 0.28, `ИТМ ${bmi.toFixed(1)} — наднормено тегло`)
  else if (bmi < 18.5) add('metabolic', 0.25, `ИТМ ${bmi.toFixed(1)} — поднормено тегло`)

  if (q.age >= 45) add('metabolic', 0.12, 'възраст над 45 г. — забавен базален обмен')
  if (q.activityLevel === 'sedentary') add('metabolic', 0.22, 'заседнал начин на живот')
  else if (q.activityLevel === 'light') add('metabolic', 0.1, 'ниска физическа активност')

  if (
    has(q.healthStatus, 'диабет', 'захар', 'инсулин', 'резистентност', 'преддиабет') ||
    textHas(anamnesis, 'диабет', 'инсулинова резистентност', 'преддиабет')
  )
    add('metabolic', 0.4, 'посочена кръвно-захарна проблематика')
  if (has(q.healthStatus, 'затлъстяване') && bmi < 30)
    add('metabolic', 0.15, 'самоотчетено затлъстяване')
  if (has(q.healthStatus, 'менопауз') || textHas(anamnesis, 'менопауз'))
    add('metabolic', 0.18, 'менопауза — променен енергиен обмен')
  if (has(q.dietaryHabits, 'сладк', 'захар', 'газирани', 'бърза храна', 'тестен'))
    add('metabolic', 0.22, 'чести бързи въглехидрати в менюто')
  if (has(q.goals, 'отслабв', 'тегло', 'килограм'))
    add('metabolic', 0.15, 'заявена цел, свързана с телесното тегло')

  // ── храносмилане ──
  if (has(q.healthStatus, 'гастрит', 'рефлукс', 'киселин', 'язва', 'колит', 'храносмилане', 'запек', 'подуване'))
    add('digestive', 0.4, 'посочени храносмилателни оплаквания')
  if (textHas(q.complaints, 'подуване', 'газове', 'запек', 'диария', 'тежест', 'киселини', 'стомах'))
    add('digestive', 0.3, 'описани симптоми от храносмилателния тракт')
  if (q.foodIntolerances && q.foodIntolerances.trim().length > 2)
    add('digestive', 0.22, `непоносимост: ${q.foodIntolerances.slice(0, 40)}`)
  if (has(q.dietaryHabits, 'нередовн', 'прескач', 'пропуска', 'късно', 'бърза храна'))
    add('digestive', 0.2, 'нередовен режим на хранене')
  if (textHas(anamnesis, 'гастрит', 'рефлукс', 'колит', 'крон', 'цьолиак', 'целиак', 'ибс'))
    add('digestive', 0.3, 'посочено състояние на храносмилателния тракт')
  if (waterLitres < 1.5)
    add('digestive', 0.15, `${(q.hydration ?? 0)} чаши вода дневно (~${waterLitres.toFixed(1)} л) — под нужното`)

  // ── ендокринна ──
  // „Автоимунен тиреоидит" е опция във въпросника, но нито едно от старите
  // ключови думи не я хващаше — най-честият щитовиден запис оставаше невидим.
  if (
    has(q.healthStatus, 'тиреоид', 'щитовид', 'хашимото', 'хипотиреоид', 'хормон', 'пкос', 'поликистоз', 'менопауз') ||
    textHas(anamnesis, 'тиреоид', 'щитовид', 'хашимото', 'пкос', 'менопауз')
  )
    add('endocrine', 0.42, 'посочена хормонална/щитовидна проблематика')
  if (q.stressLevel === 'very-high') add('endocrine', 0.32, 'много високо ниво на стрес')
  else if (q.stressLevel === 'high') add('endocrine', 0.22, 'високо ниво на стрес')
  if ((q.sleepHours ?? 7) < 6) add('endocrine', 0.24, `${q.sleepHours} ч сън — под нужното`)
  if (q.sleepQuality === 'poor') add('endocrine', 0.18, 'лошо качество на съня')
  if (textHas(q.complaints, 'умора', 'изтощ', 'без енергия', 'сънлив'))
    add('endocrine', 0.18, 'описана трайна умора')

  // ── нервна ──
  if (q.stressLevel === 'very-high') add('nervous', 0.4, 'много високо ниво на стрес')
  else if (q.stressLevel === 'high') add('nervous', 0.26, 'високо ниво на стрес')
  if ((q.sleepHours ?? 7) < 6) add('nervous', 0.26, 'недостатъчен сън')
  if (q.sleepQuality === 'poor') add('nervous', 0.22, 'лошо качество на съня')
  else if (q.sleepQuality === 'fair') add('nervous', 0.1, 'средно качество на съня')
  if (textHas(q.complaints, 'тревож', 'безпокой', 'напрежение', 'главобол'))
    add('nervous', 0.2, 'описани симптоми на напрежение')

  // ── детоксикация ──
  if (
    has(q.healthStatus, 'черен дроб', 'чернодроб', 'жлъч', 'бъбре', 'стеатоз') ||
    textHas(anamnesis, 'черен дроб', 'чернодроб', 'жлъч', 'бъбре', 'стеатоз', 'хепатит')
  )
    add('detox', 0.4, 'посочена чернодробна/бъбречна проблематика')
  if (q.medications && q.medications.trim().length > 3)
    add('detox', 0.16, 'редовен прием на медикаменти')
  if (has(q.dietaryHabits, 'алкохол', 'пържен', 'полуфабрикат', 'консерв'))
    add('detox', 0.22, 'натоварващи храни/напитки в менюто')
  if (waterLitres < 1.5) add('detox', 0.18, 'нисък прием на вода')

  // ── имунна ──
  if (
    has(q.healthStatus, 'алерг', 'автоимун', 'възпал', 'артрит', 'екзема', 'астма') ||
    textHas(anamnesis, 'алерг', 'автоимун', 'артрит', 'екзема', 'астма', 'псориаз')
  )
    add('immune', 0.38, 'посочен алергичен/възпалителен профил')
  if (q.allergies && q.allergies.trim().length > 2)
    add('immune', 0.22, `алергии: ${q.allergies.slice(0, 40)}`)
  if (textHas(q.complaints, 'чести настинки', 'инфекц', 'възпал'))
    add('immune', 0.2, 'чести инфекции')

  // ── кръвообращение ──
  if (
    has(q.healthStatus, 'холестерол', 'хипертон', 'налягане', 'сърц', 'съдов', 'варик') ||
    textHas(anamnesis, 'холестерол', 'хипертон', 'налягане', 'сърц', 'съдов', 'инфаркт', 'инсулт')
  )
    add('circulatory', 0.4, 'посочена сърдечно-съдова проблематика')
  if (bmi >= 30) add('circulatory', 0.18, 'наднормено тегло натоварва съдовата система')
  if (q.age >= 55) add('circulatory', 0.12, 'възрастов фактор')
  if (q.activityLevel === 'sedentary') add('circulatory', 0.15, 'липса на движение')

  // ── специални състояния ──
  // Бременността беше напълно невидима: бременна потребителка получаваше
  // 100/100 по всички системи и нула препоръки.
  if (has(q.healthStatus, 'бременност') || textHas(anamnesis, 'бременн')) {
    add('metabolic', 0.2, 'бременност — повишени нужди, планът е поддържащ')
    add('digestive', 0.2, 'бременност — чести храносмилателни промени')
    add('endocrine', 0.15, 'бременност — изменен хормонален фон')
  }
  if (textHas(anamnesis, 'кърм', 'лактаци')) {
    add('metabolic', 0.2, 'кърмене — повишени енергийни и течностни нужди')
  }

  for (const k of Object.keys(load) as SystemKey[]) {
    load[k] = Math.max(0, Math.min(1, load[k]))
  }

  return { load, reasons, bmi }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. ОБЕДИНЯВАНЕ
 * ───────────────────────────────────────────────────────────────────────────*/

/** Нормира сурово ирисово натоварване към 0..1 с насищане. */
function saturate(load: number, scale = 3.2): number {
  return 1 - Math.exp(-load / scale)
}

export function computeScores(input: ScoringInput): ScoringResult {
  const { findings: rawFindings, questionnaire, imageQuality, stripCoverage } = input

  const qSignals = questionnaireSignals(questionnaire)
  const findings = applyBilateralCorroboration(rawFindings)
  const rawIrisLoad = irisLoadBySystem(findings)

  // Колко доверие заслужава ирисът при това качество на входа.
  const quality = Math.max(0, Math.min(1, imageQuality))
  const coverage = Math.max(0, Math.min(1, stripCoverage))
  const irisWeight = IRIS_MAX_INFLUENCE * quality * (0.35 + 0.65 * coverage)

  const loadBySystem = emptyLoad()
  const systems: SystemResult[] = []

  for (const def of SYSTEMS) {
    const qLoad = qSignals.load[def.key]
    const iLoad = saturate(rawIrisLoad[def.key])
    loadBySystem[def.key] = iLoad

    const combined = qLoad * (1 - irisWeight) + iLoad * irisWeight
    // 100 = без натоварване; 35 = максимално натоварване
    const score = Math.round(100 - combined * 65)

    const reasons = [...qSignals.reasons[def.key]]
    const relevant = findings
      .filter(f => {
        const sectorDef = sectorsFor(f.side)[f.sector - 1]
        const band = ringBand(f.ring)
        return (
          (sectorDef.systems[def.key] ?? 0) > 0 ||
          (band.systems[def.key] ?? 0) > 0 ||
          (FINDINGS[f.type].systems[def.key] ?? 0) > 0
        )
      })
      .sort((a, b) => b.load - a.load)
      .slice(0, 3)

    for (const f of relevant) {
      reasons.push(
        `${FINDINGS[f.type].label} — ${f.side === 'left' ? 'ляв' : 'десен'} ирис, сектор ${f.sector}, R${f.ring}` +
          (f.bilateral ? ' (потвърдена и в другото око)' : '')
      )
    }

    const description =
      score >= 80
        ? 'Няма съществени сигнали за натоварване.'
        : score >= 65
          ? 'Умерено натоварване — заслужава внимание в менюто.'
          : score >= 50
            ? 'Изразено натоварване — една от водещите теми в плана.'
            : 'Силно натоварване — приоритет номер едно.'

    systems.push({
      key: def.key,
      label: def.label,
      score: Math.max(30, Math.min(100, score)),
      irisShare: combined > 0 ? (iLoad * irisWeight) / combined : 0,
      priority: def.priority,
      description,
      reasons: reasons.slice(0, 5),
    })
  }

  // Общата оценка тежи приоритетните системи двойно.
  const weightSum = systems.reduce((s, x) => s + (x.priority ? 2 : 1), 0)
  const overall = Math.round(
    systems.reduce((s, x) => s + x.score * (x.priority ? 2 : 1), 0) / weightSum
  )

  const focus = systems
    .filter(s => s.priority)
    .sort((a, b) => a.score - b.score)
    .map(s => s.key)

  const safety = buildSafetyProfile(questionnaire)
  const notices = safetyNotices(safety)
  const { drivers, suppressed } = buildDrivers(systems, findings, qSignals, questionnaire, safety)

  return {
    systems,
    overall,
    drivers,
    safety,
    notices,
    suppressed,
    irisWeight,
    focus,
    loadBySystem,
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. ХРАНИТЕЛНИ ДРАЙВЕРИ
 *
 * Това е мостът към плана. Всеки драйвер е конкретно, проследимо действие.
 * LLM-ът ги превръща в текст и меню, но НЕ решава кои са.
 * ───────────────────────────────────────────────────────────────────────────*/

interface DriverRule {
  id: string
  system: SystemKey
  /** Категория за отчета. По подразбиране 'diet'. */
  category?: DriverCategory
  /** Праг на оценката, под който правилото се задейства. */
  belowScore: number
  observation: string
  action: string
  /** Допълнително условие от въпросника. */
  when?: (q: QuestionnaireData, f: NormalizedFinding[]) => boolean
  /**
   * Задейства правилото НЕЗАВИСИМО от прага, когато състоянието е разпознато.
   *
   * Без това праговете мълчаха точно за хората, които съветът засяга: човек с
   * хипертония имаше кръвообращение 82 (праг 74) и не получаваше нито дума за
   * солта; човек с автоимунен тиреоидит имаше ендокринна 73 (праг 72) и не
   * виждаше адаптирания съвет, написан именно за него.
   */
  alsoWhen?: (p: SafetyProfile) => boolean
  /**
   * ПРОТИВОПОКАЗАНИЕ. Върне ли true, правилото отпада напълно.
   * Причината се показва на потребителя чрез `safetyNotices`.
   */
  unsafeWhen?: (p: SafetyProfile) => boolean
  /**
   * Пренаписване на действието при определен профил — вместо да отпадне,
   * съветът се дава във вариант, който е приложим (растителни източници,
   * по-щадящо темпо и т.н.). Първият съвпаднал вариант печели.
   */
  variants?: Array<{ when: (p: SafetyProfile) => boolean; action: string; observation?: string }>
  /**
   * Фиксирана сила — за правилата по профил, при които силата не идва от
   * системната оценка, а от самото състояние.
   */
  fixedStrength?: DriverStrength
  /**
   * Съветът засяга безопасност (лекарствено взаимодействие, забрана по
   * диагноза). Излиза пръв в плана и не се отрязва от лимита.
   */
  critical?: boolean
}

const DRIVER_RULES: DriverRule[] = [
  // ── метаболизъм ──
  {
    id: 'glycemic_load',
    system: 'metabolic',
    alsoWhen: p => p.diabetes,
    unsafeWhen: p => p.eatingDisorder,
    belowScore: 78,
    observation: 'Сигнали за напрежение в кръвно-захарната регулация.',
    action:
      'Понижи гликемичния товар: всяко хранене да съдържа белтък + мазнина + фибри; извади сладките напитки и белите брашна.',
  },
  {
    id: 'meal_rhythm',
    system: 'metabolic',
    // При разстройство в храненето всякакво структуриране е за специалист.
    unsafeWhen: p => p.eatingDisorder,
    // Профилите, за които е писан обърнатият вариант, трябва да го ПОЛУЧАТ.
    // Иначе бременна с метаболитна оценка 91 не виждаше нищо за ритъма на
    // хранене — а точно там дългите паузи са проблем.
    alsoWhen: p =>
      p.glucoseLoweringMeds || p.pregnancy || p.breastfeeding || p.underweight || p.minor,
    // За останалите рискови профили съветът не отпада, а се ОБРЪЩА: удължените
    // паузи са проблемът, редовността е решението. Мълчанието тук би оставило
    // точно тези хора без най-важната насока.
    variants: [
      {
        when: p => p.glucoseLoweringMeds,
        observation: 'При медикаменти за кръвна захар ритъмът е въпрос на безопасност.',
        action:
          'Редовни хранения на приблизително еднакви часове, БЕЗ пропускане и без дълги ' +
          'паузи. Промени в режима се съгласуват с лекуващия лекар, защото може да ' +
          'наложат промяна в дозите.',
      },
      {
        when: p => p.pregnancy || p.breastfeeding,
        action:
          'Редовни хранения на всеки 3–4 часа плюс лека закуска между тях. Дългите паузи ' +
          'и гладуването не са подходящи в този период.',
      },
      {
        when: p => p.underweight || p.minor,
        action:
          '3 основни хранения плюс 2 подсилващи закуски (ядки, кисело мляко, плод с ' +
          'фъстъчено масло). Целта е достатъчност, не ограничение.',
      },
    ],
    belowScore: 72,
    observation: 'Обмяната реагира по-добре на ритъм, отколкото на ограничения.',
    action:
      '3 основни хранения през 4–5 часа, без междинни хапвания; вечеря поне 3 часа преди лягане.',
  },
  {
    id: 'protein_floor',
    system: 'metabolic',
    unsafeWhen: p => p.kidneyDisease || p.pregnancy || p.minor || p.eatingDisorder,
    variants: [
      {
        when: p => p.vegan,
        action:
          'Разпредели растителен белтък по 25–35 г на хранене: варива, тофу, темпе, сейтан, ' +
          'киноа. Комбинирай варива със зърнени в рамките на деня за пълен аминокиселинен профил.',
      },
      {
        when: p => p.vegetarian,
        action:
          'Разпредели белтъка по 25–35 г на хранене: яйца, млечни, варива, тофу. ' +
          'Гръцко кисело мляко и извара са най-плътните източници.',
      },
    ],
    belowScore: 70,
    observation: 'Наднормено тегло с нисък мускулен стимул.',
    action: 'Осигури 1.2–1.6 г белтък на кг телесно тегло дневно, разпределен по 25–35 г на хранене.',
    when: q => q.weight / ((q.height / 100) ** 2) >= 25,
  },
  {
    id: 'lipid_focus',
    system: 'metabolic',
    variants: [
      {
        when: p => p.vegan || p.vegetarian,
        action:
          'Замени наситените мазнини с мононенаситени (зехтин, авокадо, ядки). ' +
          'Омега-3 от смляно ленено семе, чиа и орехи ежедневно; при веган режим обсъди ' +
          'добавка с водораслово масло (DHA/EPA) с лекар.',
      },
    ],
    belowScore: 66,
    observation: 'Признаци за липиден и минерален дисбаланс в периферията.',
    action:
      'Замени наситените мазнини с мононенаситени (зехтин, авокадо, ядки) и добави мазна риба 2–3 пъти седмично.',
  },

  // ── храносмилане ──
  {
    id: 'gut_calm',
    system: 'digestive',
    alsoWhen: p => p.bowelInflammation,
    variants: [
      {
        when: p => p.bowelInflammation,
        action:
          'Щадящо меню: термично обработени и обелени зеленчуци, без люспи и семки, ' +
          'без пържено и без газирани напитки. При обостряне режимът се води от ' +
          'гастроентеролог, не от общи препоръки.',
      },
    ],
    belowScore: 78,
    observation: 'Храносмилателният пояс показва раздразнимост.',
    action:
      'Две седмици по-щадящо меню: термично обработени зеленчуци вместо сурови, без пържено, без газирани напитки.',
  },
  {
    id: 'fiber_ramp',
    system: 'digestive',
    unsafeWhen: p => p.bowelInflammation,
    variants: [
      {
        when: p => p.glutenFree,
        action:
          'Изкачвай фибрите постепенно до 25–30 г дневно от безглутенови източници ' +
          '(овес с етикет „без глутен“, ленено семе, варива, готвени зеленчуци) с ≥2 л вода.',
      },
    ],
    belowScore: 74,
    observation: 'Забавен чревен транзит.',
    action:
      'Изкачвай фибрите постепенно до 25–30 г дневно (овес, ленено семе, варива, готвени зеленчуци) с ≥2 л вода.',
  },
  {
    id: 'ferment_support',
    system: 'digestive',
    unsafeWhen: p => p.histamineIntolerance || p.bowelInflammation,
    variants: [
      {
        when: p => p.lactoseIntolerant || p.vegan,
        action:
          'Ежедневен ферментирал продукт без млечно: кисело зеле, кимчи, темпе, ' +
          'растителен кефир. Малка порция; наблюдавай поносимостта 10 дни.',
      },
    ],
    belowScore: 68,
    observation: 'Устойчиви храносмилателни оплаквания.',
    action:
      'Ежедневен ферментирал продукт (кисело мляко, кефир, кисело зеле) в малка порция; наблюдавай поносимостта 10 дни.',
  },
  {
    id: 'chew_slow',
    system: 'digestive',
    belowScore: 80,
    observation: 'Първата стъпка на храносмилането често е пропусната.',
    action: 'Хранене без екран, 20 минути минимум, задължително сядане.',
  },

  // ── ендокринна ──
  {
    id: 'circadian_anchor',
    category: 'lifestyle',
    system: 'endocrine',
    belowScore: 76,
    observation: 'Хормоналният ритъм е разместен от съня и стреса.',
    action:
      'Фиксиран час на ставане ±30 мин, дневна светлина в първия час, без екрани 60 мин преди лягане.',
  },
  {
    id: 'thyroid_minerals',
    system: 'endocrine',
    alsoWhen: p => p.autoimmuneThyroid,
    // При автоимунен тиреоидит излишъкът от йод може да влоши състоянието,
    // а „Автоимунен тиреоидит“ е опция в самия въпросник.
    variants: [
      {
        when: p => p.autoimmuneThyroid,
        observation: 'Щитовидната ос е под напрежение, но йодът тук не е безобиден.',
        action:
          'БЕЗ добавен йод и без водорасли. Заложи на селен (2 бразилски ореха дневно) ' +
          'и цинк; количествата се съгласуват с ендокринолог.',
      },
      {
        when: p => p.vegan,
        action:
          'Осигури селен (2 бразилски ореха дневно) и цинк (тиквени семки, варива). ' +
          'Йодът при веган режим е риск от недостиг — обсъди изследване и добавка с лекар.',
      },
    ],
    belowScore: 72,
    observation: 'Ос на базалния обмен под напрежение.',
    action:
      'Осигури йод (морска риба, водорасли в умерени количества), селен (2 бразилски ореха дневно) и цинк.',
  },
  {
    id: 'adrenal_load',
    system: 'endocrine',
    variants: [
      {
        when: p => p.hypertension || p.kidneyDisease,
        action:
          'Кофеин само до 12:00 ч и максимум 2 дози; закуска с белтък до 90 мин след ставане. ' +
          'Солта ОСТАВА ограничена — при повишено налягане свободният прием не е уместен.',
      },
      {
        when: p => p.pregnancy || p.breastfeeding,
        action:
          'Кофеин максимум една доза дневно и само сутрин; закуска с белтък до 90 мин ' +
          'след ставане; редовни хранения без дълги паузи.',
      },
    ],
    belowScore: 68,
    observation: 'Стресовата ос носи основната тежест.',
    action:
      'Кофеин само до 12:00 ч и максимум 2 дози; закуска с белтък до 90 мин след ставане; сол не се ограничава излишно.',
  },

  // ── детоксикация ──
  {
    id: 'liver_support',
    system: 'detox',
    variants: [
      {
        when: p => p.pregnancy || p.breastfeeding,
        action:
          'Кръстоцветни зеленчуци (броколи, зеле, рукола) дневно, добре измити и термично ' +
          'обработени. Алкохол — никакъв. Вечерята да е лека и ранна.',
      },
      {
        when: p => p.autoimmuneThyroid,
        action:
          'Кръстоцветни зеленчуци предимно ТЕРМИЧНО ОБРАБОТЕНИ (готвенето намалява ' +
          'гойтрогенния ефект); алкохол до минимум; вечерята лека и ранна.',
      },
    ],
    belowScore: 74,
    observation: 'Чернодробно-жлъчната ос е натоварена.',
    action:
      'Кръстоцветни зеленчуци (броколи, зеле, рукола) дневно; алкохол до минимум; вечерята да е лека и ранна.',
  },
  {
    id: 'hydration',
    system: 'detox',
    unsafeWhen: p => p.kidneyDisease,
    belowScore: 80,
    observation: 'Приемът на течности не поддържа елиминирането.',
    action: 'Ориентир 30–35 мл вода на кг телесно тегло, разпределени през деня, не наведнъж.',
  },

  // ── имунна ──
  {
    id: 'anti_inflammatory',
    system: 'immune',
    variants: [
      {
        when: p => p.vegan || p.vegetarian,
        action:
          'Омега-3 от смляно ленено семе, чиа и орехи ежедневно; цветни зеленчуци на всяко ' +
          'хранене; по-малко рафинирани масла. При веган режим обсъди водораслово масло с лекар.',
      },
    ],
    belowScore: 74,
    observation: 'Възпалителен фон и забавен лимфен дренаж.',
    action:
      'Омега-3 от мазна риба 2–3 пъти седмично, цветни зеленчуци на всяко хранене, по-малко рафинирани масла.',
  },
  {
    id: 'lymph_move',
    category: 'lifestyle',
    system: 'immune',
    belowScore: 68,
    observation: 'Лимфата се движи само с мускулна помпа.',
    action: 'Ежедневно 20–30 мин ходене и редуване топло/студено под душа.',
  },

  // ── нервна ──
  {
    id: 'magnesium_evening',
    system: 'nervous',
    unsafeWhen: p => p.kidneyDisease,
    belowScore: 74,
    observation: 'Нервната система не превключва към възстановяване.',
    action:
      'Магнезиеви източници вечер (тиквени семки, тъмнозелени листни, ядки); дихателна практика 5 мин преди сън.',
  },
  {
    id: 'caffeine_curfew',
    system: 'nervous',
    belowScore: 70,
    observation: 'Стимуланти върху и без това натоварена система.',
    action: 'Последно кафе 8 часа преди лягане; алкохолът не се брои за релаксант.',
  },

  // ── кръвообращение ──
  {
    id: 'sodium_potassium',
    system: 'circulatory',
    // Задейства се винаги при повишено налягане — намаляването на скритата сол е
    // най-силният единичен хранителен лост там, а прагът го пропускаше.
    alsoWhen: p => p.hypertension,
    // Калият е противопоказан при бъбречно заболяване и при АСЕ/сартани/
    // калий-съхраняващи диуретици. Натрият остава — затова вариант, не блокиране.
    variants: [
      {
        when: p => p.kidneyDisease || p.potassiumSensitiveMeds,
        observation: 'Съдов тонус под напрежение, но калият тук не е безобиден.',
        action:
          'Намали скритата сол от преработени храни, колбаси, готови сосове и хляб. ' +
          'БЕЗ добавен калий и без солеви заместители на калиева основа — при твоите ' +
          'медикаменти или бъбречно състояние това се определя само от лекар.',
      },
    ],
    belowScore: 74,
    observation: 'Съдов тонус под напрежение.',
    action:
      'Повече калий (зеленолистни, картофи, банан) и по-малко скрита сол от преработени храни и колбаси.',
  },
]

/* ── БАЗОВИ ДРАЙВЕРИ ──────────────────────────────────────────────────────────
 *
 * Одит по персони показа, че „здрав контрол", „веган спортист", „хипертония"
 * и „менопауза" получаваха НУЛА драйвера: праговете бяха толкова строги, че
 * двигателят мълчеше. Потребител, изминал 21 въпроса и две калибрирани снимки,
 * оставаше с празен план, а моделът си измисляше приоритети — точно това,
 * което разделението на отговорности трябваше да предотврати.
 *
 * Базовите драйвери се добавят ВИНАГИ. Те не са пълнеж: това са четирите неща,
 * които имат смисъл за всеки възрастен без противопоказания, и служат за
 * гръбнак, когато няма изразено натоварване.
 * ───────────────────────────────────────────────────────────────────────────*/

const FOUNDATION_RULES: DriverRule[] = [
  {
    id: 'foundation_protein_veg',
    system: 'metabolic',
    belowScore: 101, // винаги
    observation: 'Основата на всяко хранене решава повече от отделните „суперхрани".',
    action:
      'Всяко основно хранене да съдържа източник на белтък + зеленчук + мазнина. ' +
      'Това само по себе си изравнява ситостта и енергията през деня.',
    variants: [
      {
        when: p => p.vegan || p.vegetarian,
        action:
          'Всяко основно хранене да съдържа растителен белтък (варива, тофу, темпе) + ' +
          'зеленчук + мазнина (зехтин, ядки, авокадо).',
      },
    ],
  },
  {
    id: 'foundation_plants',
    system: 'digestive',
    belowScore: 101,
    observation: 'Разнообразието от растителни храни е най-добре доказаният единичен фактор.',
    action:
      'Цели към 25–30 различни растителни храни седмично — зеленчуци, плодове, варива, ' +
      'ядки, семена, подправки. Броят на видовете тежи повече от количеството.',
    // Блокирането тук оставяше човек с чревно възпаление без НИКАКЪВ съвет за
    // храносмилането. По-полезно е да получи подходящия вариант.
    variants: [
      {
        when: p => p.bowelInflammation,
        observation: 'Разнообразието помага, но формата на храната е по-важна тук.',
        action:
          'Разширявай видовете растителни храни бавно и само в термично обработен, ' +
          'обелен вид. Въвеждай по един нов продукт на няколко дни и следи реакцията.',
      },
    ],
  },
  {
    id: 'foundation_water',
    system: 'detox',
    belowScore: 101,
    observation: 'Течностите се подценяват, защото ефектът им е бавен.',
    action:
      'Ориентир 30 мл вода на кг телесно тегло дневно, разпределени през деня. ' +
      'Първата чаша веднага след ставане.',
    variants: [
      {
        when: p => p.kidneyDisease,
        observation: 'Течностите при бъбречно състояние не следват общото правило.',
        action:
          'Дневното количество течности се определя от нефролога — не следвай общи ' +
          'формули. Разпредели това, което ти е указано, равномерно през деня.',
      },
    ],
  },
  {
    id: 'foundation_movement',
    system: 'circulatory',
    category: 'lifestyle',
    belowScore: 101,
    observation: 'Движението след хранене влияе на кръвната захар повече от избора на храна.',
    action:
      '10–15 минути ходене след най-голямото хранене за деня. Не е тренировка — ' +
      'просто не сядай веднага.',
  },
]

/**
 * ПРАВИЛА ПО ПРОФИЛ.
 *
 * Задействат се САМО когато `alsoWhen` разпознае състоянието — независимо от
 * системната оценка. Ирисова находка не ги предизвиква и не ги отменя: човек,
 * който пие варфарин, се нуждае от съвета за витамин K дори при перфектни
 * оценки по всички системи.
 *
 * Отделени са от `FOUNDATION_RULES`, защото базовите се излъчват безусловно.
 * Сложени там, тези правила щяха да раздават съвет за антикоагуланти на всеки
 * потребител.
 */
const PROFILE_RULES: DriverRule[] = [
  /* ── ЖИТЕЙСКИ ЕТАПИ ─────────────────────────────────────────────────────
   * Правилата дотук третираха всички възрастни еднакво. Възрастта, менопаузата
   * и спортното натоварване променят нуждите достатъчно, че общият съвет да
   * стане грешен — най-видимо при 65+, където „по-малко белтък" е точно
   * обратното на препоръчаното.
   * ────────────────────────────────────────────────────────────────────── */
  {
    id: 'senior_protein',
    fixedStrength: 'high',
    system: 'metabolic',
    category: 'diet',
    alsoWhen: p => p.senior,
    // При бъбречно заболяване белтъкът се определя от нефролог, не оттук.
    unsafeWhen: p => p.kidneyDisease,
    belowScore: 101,
    observation:
      'След 65 г. мускулната маса намалява дори при непроменено тегло, а усвояването ' +
      'на белтъка става по-малко ефективно.',
    action:
      'Осигури 1.0–1.2 г белтък на кг телесно тегло дневно — това е ПО-ВИСОКО от общата ' +
      'норма за възрастни, не по-ниско. Разпредели го по 25–30 г на хранене, защото ' +
      'еднократна голяма доза не се усвоява по-добре. Комбинирай с движение срещу ' +
      'съпротивление; храната без стимул за мускула не спира загубата.',
    variants: [
      {
        when: p => p.vegan || p.vegetarian,
        action:
          'Осигури 1.0–1.2 г растителен белтък на кг дневно, по 25–30 г на хранене: ' +
          'варива, тофу, темпе, киноа, ядкови масла. Растителните източници се усвояват ' +
          'по-бавно, затова разпределението през деня има още по-голямо значение. ' +
          'Комбинирай с движение срещу съпротивление.',
      },
    ],
  },
  {
    id: 'menopause_bone',
    fixedStrength: 'medium',
    system: 'endocrine',
    category: 'diet',
    alsoWhen: p => p.menopause || p.osteoporosis,
    belowScore: 101,
    observation:
      'След менопаузата спадът на естрогена намалява задържането на калций и ускорява ' +
      'загубата на костна маса.',
    action:
      'Цели около 1200 мг калций дневно ОТ ХРАНАТА: млечни продукти, сардини с костите, ' +
      'тахан, бадеми, броколи, обогатени растителни напитки. Витамин D 800 IU дневно ' +
      'подпомага усвояването — стойността му се проверява с кръвно изследване, преди да ' +
      'се приема добавка. Достатъчният белтък и натоварването с тежести пазят костта ' +
      'толкова, колкото и калцият.',
    variants: [
      {
        when: p => p.lactoseIntolerant || p.vegan,
        action:
          'Цели около 1200 мг калций дневно без млечни продукти: обогатени растителни ' +
          'напитки (провери етикета — не всички са обогатени), тахан, бадеми, тофу със ' +
          'калциев сулфат, броколи, зеле. Витамин D 800 IU дневно; при веган режим ' +
          'провери източника да е D3 от лишеи или D2.',
      },
    ],
  },
  {
    id: 'athlete_fuel',
    fixedStrength: 'medium',
    system: 'metabolic',
    category: 'diet',
    alsoWhen: p => p.athlete,
    unsafeWhen: p => p.kidneyDisease || p.eatingDisorder,
    belowScore: 101,
    observation: 'Редовното интензивно натоварване вдига нуждите над общите норми.',
    action:
      'Белтък 1.4–2.0 г на кг дневно, разпределен по 25–40 г на хранене, с порция в рамките ' +
      'на 2 часа след тренировка. Въглехидратите се съобразяват с натоварването — ' +
      'ограничаването им в дните с тежка тренировка вреди на възстановяването. ' +
      'Течности и електролити според изпотяването, не по график.',
  },
  {
    id: 'pcos_insulin',
    fixedStrength: 'medium',
    system: 'endocrine',
    category: 'diet',
    alsoWhen: p => p.pcos,
    unsafeWhen: p => p.eatingDisorder || p.pregnancy,
    belowScore: 101,
    observation:
      'При поликистозни яйчници инсулиновата чувствителност е водещият фактор, върху ' +
      'който храненето може да влияе.',
    action:
      'Понижи гликемичния товар: цели зърна вместо бели брашна, белтък и мазнина към ' +
      'всяко хранене с въглехидрати, без подсладени напитки. Редовното движение ' +
      'подобрява инсулиновата чувствителност независимо от промяната в теглото — ' +
      'то не е добавка към диетата, а равностойна част.',
  },

  /* ── ЛЕКАРСТВЕНИ ВЗАИМОДЕЙСТВИЯ С ХРАНАТА ──────────────────────────────
   * Тези правила не се задействат от ирисова находка и нямат праг: те зависят
   * само от приеманите лекарства. Пропускането им е по-опасно от всяка грешна
   * находка, защото съветът „яж повече зелени зеленчуци" при варфарин може да
   * извади INR извън терапевтичния диапазон.
   * ────────────────────────────────────────────────────────────────────── */
  {
    id: 'warfarin_vitamin_k',
    critical: true,
    fixedStrength: 'high',
    system: 'circulatory',
    category: 'lifestyle',
    alsoWhen: p => p.warfarin,
    belowScore: 101,
    observation:
      'Витамин K от храната влияе пряко върху действието на антикоагуланта, а дозата му ' +
      'е нагласена спрямо обичайното ти меню.',
    action:
      'НЕ спирай зелените листни зеленчуци — приемай ги в ПОСТОЯННО количество. ' +
      'Ако сега ядеш салата 4 пъти седмично, продължавай със същата честота. ' +
      'Опасното е рязката промяна в двете посоки: и внезапното увеличаване, и ' +
      'изрязването. Планирана промяна в менюто се съобщава на лекаря, който следи INR.',
  },
  {
    id: 'levothyroxine_timing',
    critical: true,
    fixedStrength: 'high',
    system: 'endocrine',
    category: 'lifestyle',
    alsoWhen: p => p.levothyroxine,
    belowScore: 101,
    observation: 'Калцият и желязото свързват левотироксина в червата и намаляват усвояването му.',
    action:
      'Взимай таблетката сутрин на празен стомах, 30–60 минути преди първата храна или ' +
      'напитка. Отдели калция и желязото — от добавка или от млечни продукти — на поне ' +
      '4 часа от нея. Кафето и храните с много фибри също пречат, затова закуската идва ' +
      'след интервала, не заедно с таблетката.',
  },
  {
    id: 'b12_depleting_meds',
    critical: true,
    fixedStrength: 'medium',
    system: 'nervous',
    category: 'lifestyle',
    alsoWhen: p => p.metformin || p.ppi,
    belowScore: 101,
    observation:
      'Продължителният прием на метформин или на лекарство за киселини е свързан с ' +
      'понижени нива на витамин B12, а комбинацията от двете — с по-висок риск от всяко ' +
      'поотделно.',
    action:
      'Поискай изследване на витамин B12 при следващия преглед, вместо да започваш ' +
      'добавка наслуки. Ниският B12 се проявява като умора, изтръпване или трудна ' +
      'концентрация и се бърка с други неща. Решението за добавка и дозата ѝ са на лекаря.',
  },

  /* ── СЪСТОЯНИЯ, КОИТО ПРЕНАПИСВАТ МЕНЮТО ───────────────────────────── */
  {
    id: 'gout_purines',
    fixedStrength: 'medium',
    system: 'metabolic',
    category: 'diet',
    alsoWhen: p => p.gout,
    belowScore: 101,
    observation: 'Пикочната киселина се повишава от конкретна група храни и напитки.',
    action:
      'Извади вътрешностите, аншоата и сардината, бирата (включително безалкохолната) и ' +
      'подсладените с фруктоза напитки. Растителните пурини от варива и зеленчуци НЕ ' +
      'носят същия риск и не се ограничават. Течностите — поне 2 л дневно, ако няма ' +
      'бъбречно или сърдечно ограничение — помагат за извеждането.',
    variants: [
      {
        when: p => p.kidneyDisease,
        action:
          'Извади вътрешностите, аншоата и сардината, бирата и подсладените с фруктоза ' +
          'напитки. Количеството течности при бъбречно заболяване се определя от ' +
          'нефролога — не увеличавай приема по своя преценка.',
      },
    ],
  },
  {
    id: 'ibs_structured_elimination',
    fixedStrength: 'medium',
    system: 'digestive',
    category: 'diet',
    alsoWhen: p => p.ibs,
    belowScore: 101,
    observation:
      'При раздразнено черво част от въглехидратите ферментират в дебелото черво и ' +
      'предизвикват подуване и болка.',
    action:
      'Ако пробваш нискоферментационен (FODMAP) режим, той е ВРЕМЕНЕН: 2–6 седмици ' +
      'строга фаза, след което храните се връщат група по група, за да се види коя точно ' +
      'е проблемна. Постоянното изрязване обеднява чревната флора и не е целта. ' +
      'Фазата на връщане отнема 6–8 седмици и върви най-добре с диетолог. ' +
      'Дневник на храна и симптоми струва повече от всеки общ списък.',
  },
  {
    id: 'celiac_strict',
    critical: true,
    fixedStrength: 'high',
    system: 'digestive',
    category: 'diet',
    alsoWhen: p => p.celiac,
    belowScore: 101,
    observation: 'При цьолиакия глутенът уврежда чревната лигавица дори без симптоми.',
    action:
      'Глутенът отпада напълно и пожизнено — пшеница, ръж, ечемик и всичко произведено ' +
      'от тях. Внимавай за кръстосано замърсяване: общ тостер, общо олио за пържене, ' +
      'насипни продукти, овес без сертификат. Тъй като безглутеновите заместители често ' +
      'са по-бедни на фибри и желязо, дръж в менюто елда, киноа, ориз, варива и ядки.',
  },
  {
    id: 'iron_absorption',
    fixedStrength: 'medium',
    system: 'circulatory',
    category: 'diet',
    alsoWhen: p => p.anemia,
    belowScore: 101,
    observation: 'Усвояването на желязо зависи силно от това с какво е поднесено.',
    action:
      'Комбинирай източниците на желязо с витамин C (чушка, магданоз, цитрус) в същото ' +
      'хранене — усвояването се увеличава многократно. Чаят, кафето и калцият в същото ' +
      'хранене го намаляват, затова ги отдели с поне час. Добавка с желязо се приема само ' +
      'при потвърден дефицит: излишъкът е също толкова проблем, колкото и недостигът.',
    variants: [
      {
        when: p => p.vegan || p.vegetarian,
        action:
          'Растителното желязо се усвоява по-трудно, затова комбинацията с витамин C е ' +
          'задължителна, а не по избор: варива или тъмнозелени зеленчуци заедно с чушка, ' +
          'магданоз или цитрус. Накисването и покълването на варивата намаляват фитатите, ' +
          'които пречат на усвояването. Чай и кафе — най-малко час след хранене.',
      },
    ],
  },
  {
    id: 'vegan_completeness',
    critical: true,
    fixedStrength: 'high',
    system: 'nervous',
    category: 'supplement',
    alsoWhen: p => p.vegan,
    belowScore: 101,
    observation:
      'Веган режимът е пълноценен, но три хранителни вещества не се набавят надеждно ' +
      'от растения.',
    action:
      'Витамин B12 — задължителна добавка, без изключение: 25–100 µg дневно или 2000 µg ' +
      'веднъж седмично. Йод — йодирана сол в готвенето или добавка около 150 µg дневно. ' +
      'Омега-3 DHA/EPA — от водораслово масло, защото ленът и орехите дават ALA, която ' +
      'тялото превръща слабо. Желязото, цинкът и калцият се следят с изследване, преди ' +
      'да се добавят.',
    variants: [
      {
        when: p => p.autoimmuneThyroid,
        action:
          'Витамин B12 — задължителна добавка, без изключение: 25–100 µg дневно или ' +
          '2000 µg веднъж седмично. Омега-3 DHA/EPA — от водораслово масло. ' +
          'ЙОДЪТ при автоимунен тиреоидит се приема САМО по лекарска преценка — ' +
          'излишъкът може да влоши състоянието, затова тук не се препоръчва добавка. ' +
          'Желязото, цинкът и калцият се следят с изследване.',
      },
    ],
  },
]

/**
 * Прилага профила за безопасност върху едно правило.
 * Връща `null`, ако правилото е противопоказано.
 */
function applySafety(
  rule: DriverRule,
  p: SafetyProfile
): { observation: string; action: string } | null {
  if (rule.unsafeWhen?.(p)) return null
  const variant = rule.variants?.find(v => v.when(p))
  return {
    observation: variant?.observation ?? rule.observation,
    action: variant?.action ?? rule.action,
  }
}

function strengthFor(score: number, threshold: number): DriverStrength {
  const gap = threshold - score
  if (gap >= 18) return 'high'
  if (gap >= 8) return 'medium'
  return 'low'
}

function buildDrivers(
  systems: SystemResult[],
  findings: NormalizedFinding[],
  qSignals: QuestionnaireSignals,
  questionnaire: QuestionnaireData,
  safety: SafetyProfile
): { drivers: NutritionDriver[]; suppressed: string[] } {
  const byKey = new Map(systems.map(s => [s.key, s]))
  const drivers: NutritionDriver[] = []
  const suppressed: string[] = []

  const emit = (rule: DriverRule, strength: DriverStrength) => {
    const safe = applySafety(rule, safety)
    if (!safe) {
      suppressed.push(rule.id)
      return
    }

    const fromQuestionnaire = qSignals.load[rule.system] > 0.15
    const fromIris = findings.some(f => {
      const sectorDef = sectorsFor(f.side)[f.sector - 1]
      return (
        (sectorDef.systems[rule.system] ?? 0) > 0 ||
        (FINDINGS[f.type].systems[rule.system] ?? 0) > 0
      )
    })

    drivers.push({
      id: rule.id,
      system: rule.system,
      category: rule.category ?? 'diet',
      strength,
      observation: safe.observation,
      action: safe.action,
      source: fromQuestionnaire && fromIris ? 'both' : fromIris ? 'iris' : 'questionnaire',
    })
  }

  for (const rule of DRIVER_RULES) {
    const sys = byKey.get(rule.system)
    if (!sys) continue
    const forced = rule.alsoWhen?.(safety) === true
    if (!forced && sys.score >= rule.belowScore) continue
    if (rule.when && !rule.when(questionnaire, findings)) continue
    emit(rule, forced && sys.score >= rule.belowScore ? 'medium' : strengthFor(sys.score, rule.belowScore))
  }

  // Правилата по профил: задействат се от състоянието, не от оценката.
  for (const rule of PROFILE_RULES) {
    if (rule.alsoWhen?.(safety) !== true) continue
    if (drivers.some(d => d.id === rule.id)) continue
    emit(rule, rule.fixedStrength ?? 'medium')
  }

  // Базовите правила се добавят винаги — планът никога не е празен.
  for (const rule of FOUNDATION_RULES) {
    if (drivers.some(d => d.id === rule.id)) continue
    emit(rule, 'low')
  }

  // Приоритетните системи излизат първи; после по сила. Базовите остават
  // накрая, защото са гръбнак, а не акцент.
  const order: Record<DriverStrength, number> = { high: 0, medium: 1, low: 2 }
  const priority = new Set(SYSTEMS.filter(s => s.priority).map(s => s.key))
  const isFoundation = (id: string) => FOUNDATION_RULES.some(r => r.id === id)
  // Безопасността се сортира първа и не зависи от приоритетните системи:
  // взаимодействието на варфарина с витамин K е по-важно от всяка находка,
  // а системата му (кръвообращение) не е сред приоритетните.
  const criticalIds = new Set(
    [...DRIVER_RULES, ...PROFILE_RULES, ...FOUNDATION_RULES].filter(r => r.critical).map(r => r.id)
  )
  drivers.sort((a, b) => {
    const ca = criticalIds.has(a.id) ? 0 : 1
    const cb = criticalIds.has(b.id) ? 0 : 1
    if (ca !== cb) return ca - cb
    const fa = isFoundation(a.id) ? 1 : 0
    const fb = isFoundation(b.id) ? 1 : 0
    if (fa !== fb) return fa - fb
    const pa = priority.has(a.system) ? 0 : 1
    const pb = priority.has(b.system) ? 0 : 1
    if (pa !== pb) return pa - pb
    return order[a.strength] - order[b.strength]
  })

  // Лимитът пази плана четим, но никога не изяжда съвет за безопасност.
  const critical = drivers.filter(d => criticalIds.has(d.id))
  const rest = drivers.filter(d => !criticalIds.has(d.id))
  const limited = [...critical, ...rest.slice(0, Math.max(6, 16 - critical.length))]

  return { drivers: limited, suppressed }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. ПОМОЩНИ ЗА UI / ПРОМПТ
 * ───────────────────────────────────────────────────────────────────────────*/

/** Компактно текстово резюме на драйверите — влиза в промпта за плана. */
export function driversToPromptBlock(result: ScoringResult): string {
  const lines = result.drivers.map(
    (d, i) =>
      `${i + 1}. [${systemLabel(d.system)}|${d.strength}|${d.source}] ${d.observation} → ${d.action}`
  )
  return lines.join('\n')
}

/** Компактно резюме на системите — влиза в промпта. */
export function systemsToPromptBlock(result: ScoringResult): string {
  return result.systems
    .map(s => `${s.label}: ${s.score}/100${s.priority ? ' (ПРИОРИТЕТ)' : ''} — ${s.description}`)
    .join('\n')
}

/** Списък на находките в компактен вид за промпта. */
export function findingsToPromptBlock(findings: NormalizedFinding[]): string {
  if (findings.length === 0) return 'няма приети находки'
  return findings
    .map(
      f =>
        `${f.side === 'left' ? 'L' : 'R'} S${f.sector} R${f.ring} ${FINDINGS[f.type].label}` +
        ` (${f.size}, conf ${f.confidence.toFixed(2)}${f.priorityZones.length ? ', приоритетна зона' : ''})`
    )
    .join('\n')
}
