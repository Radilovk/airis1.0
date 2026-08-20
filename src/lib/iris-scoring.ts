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
  PRIORITY_ZONE_BOOST,
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

function asSize(v: unknown): FindingSize {
  return v === 'xs' || v === 's' || v === 'm' || v === 'l' ? v : 'm'
}

/**
 * Приема суровия JSON от детекторския пас и връща само валидните находки.
 * Отхвърля: непознат тип, сектор/пръстен извън обхват, находка в пръстен,
 * в който този тип няма физически смисъл, и увереност под 0.35.
 */
export function normalizeFindings(raw: unknown, side: Side): NormalizedFinding[] {
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

    const boost = zones.length > 0 ? PRIORITY_ZONE_BOOST : 1
    const load = def.weight * SIZE_WEIGHT[size] * confidence * boost

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
    for (const [k, v] of Object.entries(def.systems)) weights[k as SystemKey] += v

    const total = Object.values(weights).reduce((a, b) => a + b, 0)
    if (total <= 0) continue

    for (const key of Object.keys(weights) as SystemKey[]) {
      if (weights[key] <= 0) continue
      load[key] += (weights[key] / total) * f.load
    }
  }

  return load
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

  // ── метаболизъм ──
  if (bmi >= 30) add('metabolic', 0.45, `ИТМ ${bmi.toFixed(1)} — изразено наднормено тегло`)
  else if (bmi >= 25) add('metabolic', 0.28, `ИТМ ${bmi.toFixed(1)} — наднормено тегло`)
  else if (bmi < 18.5) add('metabolic', 0.25, `ИТМ ${bmi.toFixed(1)} — поднормено тегло`)

  if (q.age >= 45) add('metabolic', 0.12, 'възраст над 45 г. — забавен базален обмен')
  if (q.activityLevel === 'sedentary') add('metabolic', 0.22, 'заседнал начин на живот')
  else if (q.activityLevel === 'light') add('metabolic', 0.1, 'ниска физическа активност')

  if (has(q.healthStatus, 'диабет', 'захар', 'инсулин', 'преддиабет'))
    add('metabolic', 0.4, 'посочена кръвно-захарна проблематика')
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
  if (has(q.dietaryHabits, 'нередовн', 'пропуска', 'късно', 'бърза храна'))
    add('digestive', 0.2, 'нередовен режим на хранене')
  if ((q.hydration ?? 2) < 1.5) add('digestive', 0.15, 'нисък прием на вода')

  // ── ендокринна ──
  if (has(q.healthStatus, 'щитовид', 'хашимото', 'хипотиреоид', 'хормон', 'пкос', 'поликистоз'))
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
  if (has(q.healthStatus, 'черен дроб', 'чернодроб', 'жлъч', 'бъбре', 'стеатоз'))
    add('detox', 0.4, 'посочена чернодробна/бъбречна проблематика')
  if (q.medications && q.medications.trim().length > 3)
    add('detox', 0.16, 'редовен прием на медикаменти')
  if (has(q.dietaryHabits, 'алкохол', 'пържен', 'полуфабрикат', 'консерв'))
    add('detox', 0.22, 'натоварващи храни/напитки в менюто')
  if ((q.hydration ?? 2) < 1.5) add('detox', 0.18, 'нисък прием на вода')

  // ── имунна ──
  if (has(q.healthStatus, 'алерг', 'автоимун', 'възпал', 'артрит', 'екзема', 'астма'))
    add('immune', 0.38, 'посочен алергичен/възпалителен профил')
  if (q.allergies && q.allergies.trim().length > 2)
    add('immune', 0.22, `алергии: ${q.allergies.slice(0, 40)}`)
  if (textHas(q.complaints, 'чести настинки', 'инфекц', 'възпал'))
    add('immune', 0.2, 'чести инфекции')

  // ── кръвообращение ──
  if (has(q.healthStatus, 'холестерол', 'хипертон', 'налягане', 'сърц', 'съдов', 'варик'))
    add('circulatory', 0.4, 'посочена сърдечно-съдова проблематика')
  if (bmi >= 30) add('circulatory', 0.18, 'наднормено тегло натоварва съдовата система')
  if (q.age >= 55) add('circulatory', 0.12, 'възрастов фактор')
  if (q.activityLevel === 'sedentary') add('circulatory', 0.15, 'липса на движение')

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
  const { findings, questionnaire, imageQuality, stripCoverage } = input

  const qSignals = questionnaireSignals(questionnaire)
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
        `${FINDINGS[f.type].label} — ${f.side === 'left' ? 'ляв' : 'десен'} ирис, сектор ${f.sector}, R${f.ring}`
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

  const drivers = buildDrivers(systems, findings, qSignals, questionnaire)

  return { systems, overall, drivers, irisWeight, focus, loadBySystem }
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
}

const DRIVER_RULES: DriverRule[] = [
  // ── метаболизъм ──
  {
    id: 'glycemic_load',
    system: 'metabolic',
    belowScore: 78,
    observation: 'Сигнали за напрежение в кръвно-захарната регулация.',
    action:
      'Понижи гликемичния товар: всяко хранене да съдържа белтък + мазнина + фибри; извади сладките напитки и белите брашна.',
  },
  {
    id: 'meal_rhythm',
    system: 'metabolic',
    belowScore: 72,
    observation: 'Обмяната реагира по-добре на ритъм, отколкото на ограничения.',
    action:
      '3 основни хранения през 4–5 часа, без междинни хапвания; вечеря поне 3 часа преди лягане.',
  },
  {
    id: 'protein_floor',
    system: 'metabolic',
    belowScore: 70,
    observation: 'Наднормено тегло с нисък мускулен стимул.',
    action: 'Осигури 1.2–1.6 г белтък на кг телесно тегло дневно, разпределен по 25–35 г на хранене.',
    when: q => q.weight / ((q.height / 100) ** 2) >= 25,
  },
  {
    id: 'lipid_focus',
    system: 'metabolic',
    belowScore: 66,
    observation: 'Признаци за липиден и минерален дисбаланс в периферията.',
    action:
      'Замени наситените мазнини с мононенаситени (зехтин, авокадо, ядки) и добави мазна риба 2–3 пъти седмично.',
  },

  // ── храносмилане ──
  {
    id: 'gut_calm',
    system: 'digestive',
    belowScore: 78,
    observation: 'Храносмилателният пояс показва раздразнимост.',
    action:
      'Две седмици по-щадящо меню: термично обработени зеленчуци вместо сурови, без пържено, без газирани напитки.',
  },
  {
    id: 'fiber_ramp',
    system: 'digestive',
    belowScore: 74,
    observation: 'Забавен чревен транзит.',
    action:
      'Изкачвай фибрите постепенно до 25–30 г дневно (овес, ленено семе, варива, готвени зеленчуци) с ≥2 л вода.',
  },
  {
    id: 'ferment_support',
    system: 'digestive',
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
    belowScore: 72,
    observation: 'Ос на базалния обмен под напрежение.',
    action:
      'Осигури йод (морска риба, водорасли в умерени количества), селен (2 бразилски ореха дневно) и цинк.',
  },
  {
    id: 'adrenal_load',
    system: 'endocrine',
    belowScore: 68,
    observation: 'Стресовата ос носи основната тежест.',
    action:
      'Кофеин само до 12:00 ч и максимум 2 дози; закуска с белтък до 90 мин след ставане; сол не се ограничава излишно.',
  },

  // ── детоксикация ──
  {
    id: 'liver_support',
    system: 'detox',
    belowScore: 74,
    observation: 'Чернодробно-жлъчната ос е натоварена.',
    action:
      'Кръстоцветни зеленчуци (броколи, зеле, рукола) дневно; алкохол до минимум; вечерята да е лека и ранна.',
  },
  {
    id: 'hydration',
    system: 'detox',
    belowScore: 80,
    observation: 'Приемът на течности не поддържа елиминирането.',
    action: 'Ориентир 30–35 мл вода на кг телесно тегло, разпределени през деня, не наведнъж.',
  },

  // ── имунна ──
  {
    id: 'anti_inflammatory',
    system: 'immune',
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
    belowScore: 74,
    observation: 'Съдов тонус под напрежение.',
    action:
      'Повече калий (зеленолистни, картофи, банан) и по-малко скрита сол от преработени храни и колбаси.',
  },
]

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
  questionnaire: QuestionnaireData
): NutritionDriver[] {
  const byKey = new Map(systems.map(s => [s.key, s]))
  const drivers: NutritionDriver[] = []

  for (const rule of DRIVER_RULES) {
    const sys = byKey.get(rule.system)
    if (!sys) continue
    if (sys.score >= rule.belowScore) continue
    if (rule.when && !rule.when(questionnaire, findings)) continue

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
      strength: strengthFor(sys.score, rule.belowScore),
      observation: rule.observation,
      action: rule.action,
      source:
        fromQuestionnaire && fromIris ? 'both' : fromIris ? 'iris' : 'questionnaire',
    })
  }

  // Приоритетните системи излизат първи; после по сила.
  const order: Record<DriverStrength, number> = { high: 0, medium: 1, low: 2 }
  const priority = new Set(SYSTEMS.filter(s => s.priority).map(s => s.key))
  drivers.sort((a, b) => {
    const pa = priority.has(a.system) ? 0 : 1
    const pb = priority.has(b.system) ? 0 : 1
    if (pa !== pb) return pa - pb
    return order[a.strength] - order[b.strength]
  })

  return drivers.slice(0, 12)
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
