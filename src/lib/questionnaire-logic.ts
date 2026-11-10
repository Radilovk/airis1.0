import type { QuestionConfig, QuestionnaireData, QuestionOption, UploadedDocument } from '@/types'

/**
 * Адаптивен въпросник (v4).
 *
 * Редът е: профил → цели → състояния → уточняващи въпроси по състоянията →
 * усещания (списъкът зависи от състоянията) → подробни усещания (само ако са
 * отключени) → начин на живот → хранене.
 *
 * Всеки въпрос се показва само когато предишните отговори го правят смислен:
 *  - уточнение за автоимунно — само ако е отбелязано автоимунно;
 *  - въпросите след раждане — само при „Възстановяване след раждане“;
 *  - въпросите за менопауза — само при „Менопауза“;
 *  - подробните храносмилателни въпроси — само при храносмилателно състояние
 *    или ако човекът отбележи дискомфорт след хранене;
 *  - въпросите за кръвообращението — само при сърдечно-съдово състояние,
 *    кръвна захар, задържане на вода, целулит или ако човекът ги отбележи.
 * Опциите на състоянията и усещанията се филтрират и пренареждат по пол,
 * възраст, тегло и по вече дадените отговори.
 */

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese'
export type GateAnswer = 'yes' | 'no'

export interface QuestionnaireContext {
  gender?: 'male' | 'female' | 'other'
  age?: number
  weight?: number
  height?: number
  bmi?: number
  bmiCategory?: BmiCategory
}

export interface QuestionnaireFlowState extends QuestionnaireContext {
  goals: string[]
  healthStatus: string[]
  dietGate?: GateAnswer
  sleepHours?: number
  activityLevel?: string
  /** Има ли поне едно реално състояние (не „Нищо от изброените“). */
  hasCondition: boolean
  /** Автоматично разширяване — не показваме gate, директно хранителния блок. */
  needsDietBlock: boolean
  profileComplete: boolean
}

export const QUESTIONNAIRE_CONFIG_VERSION = '4.0'

/* ── стойности, от които зависи разклоняването ───────────────────────────── */

export const NONE_OF_THE_ABOVE = 'Нищо от изброените'
const AUTOIMMUNE = 'Автоимунно заболяване'
const POSTPARTUM = 'Възстановяване след раждане'
const MENOPAUSE = 'Менопауза'
const PREGNANCY = 'Бременност'
const DIGESTIVE_CONDITION = 'Храносмилателни смущения'
const GATE_DIGESTIVE = 'Храносмилателен дискомфорт'
const GATE_CIRCULATION = 'Студени крайници или подути крака'

/** Състояния, при които въпросите за кръвообращението са по същество. */
const CIRCULATION_CONDITIONS = [
  'Хипертония',
  'Висок холестерол',
  'Сърдечно-съдово заболяване',
  'Преддиабет или инсулинова резистентност',
  'Диабет 2 тип',
  'Задържане на вода',
  'Целулит',
]

const FEMALE_ONLY_HEALTH = new Set([
  MENOPAUSE,
  PREGNANCY,
  POSTPARTUM,
  'Поликистозни яйчници (ПКОС)',
  'Целулит',
])

/** Взаимно изключващи се здравни състояния. */
export const HEALTH_MUTUAL_EXCLUSION: Record<string, string[]> = {
  [PREGNANCY]: [POSTPARTUM, MENOPAUSE],
  [POSTPARTUM]: [PREGNANCY, MENOPAUSE],
  [MENOPAUSE]: [PREGNANCY, POSTPARTUM],
}

const SKIPPABLE_FIELDS = new Set([
  'autoimmuneType',
  'postpartumStage',
  'breastfeeding',
  'menopauseSymptoms',
  'symptoms',
  'digestiveSymptoms',
  'circulationSymptoms',
  'complaints',
  'medications',
  'dietGate',
  'dietaryProfile',
  'dietaryHabits',
  'foodRestrictions',
  'sleepQuality',
  'documents',
])

const ARRAY_FIELDS = new Set([
  'healthStatus',
  'autoimmuneType',
  'menopauseSymptoms',
  'symptoms',
  'digestiveSymptoms',
  'circulationSymptoms',
  'dietaryProfile',
  'dietaryHabits',
])

const RADIO_FIELDS = new Set(['postpartumStage', 'breastfeeding', 'dietGate', 'sleepQuality'])

/* ── контекст ────────────────────────────────────────────────────────────── */

export function computeBmi(weight: number, height: number): number | undefined {
  if (!weight || !height || height <= 0) return undefined
  const h = height / 100
  return weight / (h * h)
}

export function bmiCategory(bmi: number | undefined): BmiCategory | undefined {
  if (bmi === undefined) return undefined
  if (bmi < 18.5) return 'underweight'
  if (bmi < 25) return 'normal'
  if (bmi < 30) return 'overweight'
  return 'obese'
}

export function buildQuestionnaireContext(answers: Record<string, unknown>): QuestionnaireContext {
  const gender = answers.gender as QuestionnaireContext['gender'] | undefined
  const age = Number(answers.age)
  const weight = Number(answers.weight)
  const height = Number(answers.height)
  const bmi = computeBmi(weight, height)
  return {
    gender,
    age: Number.isFinite(age) ? age : undefined,
    weight: Number.isFinite(weight) ? weight : undefined,
    height: Number.isFinite(height) ? height : undefined,
    bmi,
    bmiCategory: bmiCategory(bmi),
  }
}

function isProfileComplete(answers: Record<string, unknown>): boolean {
  const name = String(answers.name || '').trim()
  const age = Number(answers.age)
  const gender = answers.gender
  const weight = Number(answers.weight)
  const height = Number(answers.height)
  return (
    name.length >= 2 &&
    Number.isFinite(age) &&
    age > 0 &&
    !!gender &&
    Number.isFinite(weight) &&
    weight > 0 &&
    Number.isFinite(height) &&
    height > 0
  )
}

function list(answers: Record<string, unknown>, id: string): string[] {
  const v = answers[id]
  return Array.isArray(v) ? (v as string[]) : []
}

function hasGoals(answers: Record<string, unknown>): boolean {
  return list(answers, 'goals').length > 0
}

function healthAnswered(answers: Record<string, unknown>): boolean {
  return list(answers, 'healthStatus').length > 0
}

function realConditions(health: string[]): string[] {
  return health.filter(h => h !== NONE_OF_THE_ABOVE && h !== 'other')
}

/** Профилът сам по себе си изисква хранителния блок (без gate). */
export function needsHealthBlock(ctx: QuestionnaireContext, goals: string[]): boolean {
  if (ctx.bmi !== undefined && (ctx.bmi >= 27 || ctx.bmi < 18.5)) return true
  if (ctx.age !== undefined && ctx.age >= 50) return true
  if (ctx.gender === 'female' && ctx.age !== undefined && ctx.age >= 38) return true
  if (goals.some(g => /отслаб|наддаван|здрав/i.test(g))) return true
  return false
}

/** Хранителният блок е релевантен без gate. */
export function needsDietBlock(
  ctx: QuestionnaireContext,
  goals: string[],
  healthStatus: string[]
): boolean {
  if (needsHealthBlock(ctx, goals)) return true
  if (realConditions(healthStatus).length > 0) return true
  if (goals.some(g => /отслаб|наддаван|енерг|мускул|сън/i.test(g))) return true
  if (ctx.bmi !== undefined && (ctx.bmi >= 25 || ctx.bmi < 20)) return true
  return false
}

export function buildFlowState(answers: Record<string, unknown>): QuestionnaireFlowState {
  const ctx = buildQuestionnaireContext(answers)
  const goals = list(answers, 'goals')
  const healthStatus = list(answers, 'healthStatus')
  const dietGate = answers.dietGate as GateAnswer | undefined
  const sleepHours = Number(answers.sleepHours)
  return {
    ...ctx,
    goals,
    healthStatus,
    dietGate,
    sleepHours: Number.isFinite(sleepHours) ? sleepHours : undefined,
    activityLevel: answers.activityLevel as string | undefined,
    hasCondition: realConditions(healthStatus).length > 0,
    needsDietBlock: needsDietBlock(ctx, goals, healthStatus),
    profileComplete: isProfileComplete(answers),
  }
}

function dietBlockOpen(state: QuestionnaireFlowState): boolean {
  return state.needsDietBlock || state.dietGate === 'yes'
}

export function shouldAskSleepQuality(answers: Record<string, unknown>): boolean {
  const hours = Number(answers.sleepHours)
  const goals = list(answers, 'goals')
  if (!Number.isFinite(hours)) return false
  if (hours < 7) return true
  if (list(answers, 'menopauseSymptoms').includes('Нарушен сън')) return true
  if (list(answers, 'healthStatus').includes(POSTPARTUM)) return true
  return goals.some(g => /сън/i.test(g))
}

/** Отключени ли са подробните храносмилателни въпроси. */
export function asksDigestiveDetail(answers: Record<string, unknown>): boolean {
  const health = list(answers, 'healthStatus')
  if (health.includes(DIGESTIVE_CONDITION)) return true
  if (list(answers, 'autoimmuneType').some(a => /цьолиак|черват/i.test(a))) return true
  return list(answers, 'symptoms').includes(GATE_DIGESTIVE)
}

/** Отключени ли са въпросите за кръвообращението. */
export function asksCirculationDetail(answers: Record<string, unknown>): boolean {
  const health = list(answers, 'healthStatus')
  if (health.some(h => CIRCULATION_CONDITIONS.includes(h))) return true
  return list(answers, 'symptoms').includes(GATE_CIRCULATION)
}

/* ── опции: филтър и подредба ────────────────────────────────────────────── */

function healthOptionVisible(value: string, ctx: QuestionnaireContext, health: string[]): boolean {
  if (FEMALE_ONLY_HEALTH.has(value)) {
    if (ctx.gender === 'male') return false
    if (value === MENOPAUSE && ctx.age !== undefined && ctx.age < 35) return false
    if (value === PREGNANCY && ctx.age !== undefined && (ctx.age < 15 || ctx.age > 50)) return false
    if (value === POSTPARTUM && ctx.age !== undefined && (ctx.age < 15 || ctx.age > 52)) return false
    if (value === 'Поликистозни яйчници (ПКОС)' && ctx.age !== undefined && ctx.age > 55) return false
    const excluded = Object.entries(HEALTH_MUTUAL_EXCLUSION).some(
      ([k, v]) => health.includes(k) && v.includes(value)
    )
    if (excluded) return false
  }
  if (value === 'Затлъстяване') return ctx.bmi === undefined || ctx.bmi >= 25
  return true
}

/**
 * Колко напред да се изтегли едно състояние за този профил. По-голямото
 * число — по-високо в списъка. Базовата подредба е тази в defaultQuestions.
 */
function healthBoost(value: string, ctx: QuestionnaireContext): number {
  const bmi = ctx.bmi
  const age = ctx.age ?? 35
  const female = ctx.gender === 'female'
  switch (value) {
    case AUTOIMMUNE:
      // Автоимунните състояния са значително по-чести при жените.
      return female ? 4 : 0
    case 'Затлъстяване':
    case 'Преддиабет или инсулинова резистентност':
      return bmi !== undefined && bmi >= 27 ? 6 : 0
    case 'Мастен черен дроб':
      return bmi !== undefined && bmi >= 30 ? 4 : 0
    case 'Хипертония':
    case 'Висок холестерол':
      return age >= 45 ? 4 : 0
    case MENOPAUSE:
      return female && age >= 42 && age <= 60 ? 8 : 0
    case POSTPARTUM:
      return female && age >= 20 && age <= 42 ? 5 : 0
    case 'Задържане на вода':
    case 'Целулит':
      return female ? 2 : 0
    default:
      return 0
  }
}

/** Усещания, които вече са казани чрез състоянието — не питаме повторно. */
function symptomOptionVisible(value: string, answers: Record<string, unknown>, ctx: QuestionnaireContext): boolean {
  const health = list(answers, 'healthStatus')
  const goals = list(answers, 'goals')
  if (value === GATE_DIGESTIVE) return !health.includes(DIGESTIVE_CONDITION)
  if (value === GATE_CIRCULATION) return !health.some(h => CIRCULATION_CONDITIONS.includes(h))
  if (value === 'Трудно отслабване') {
    return (ctx.bmi !== undefined && ctx.bmi >= 23) || goals.some(g => /отслаб/i.test(g)) || health.includes('Затлъстяване')
  }
  if (value === 'Зиморничавост') return !health.includes('Хипотиреоидизъм')
  if (value === 'Ставни болки или скованост') {
    return !list(answers, 'autoimmuneType').includes('Ревматоиден артрит')
  }
  return true
}

function symptomBoost(value: string, answers: Record<string, unknown>): number {
  const health = list(answers, 'healthStatus')
  const goals = list(answers, 'goals')
  const metabolic = health.some(h => /диабет|инсулин|затлъст|мастен/i.test(h))
  switch (value) {
    case 'Силен апетит за сладко':
    case 'Спад на енергия следобед':
      return metabolic ? 4 : 0
    case 'Трудно отслабване':
      return goals.some(g => /отслаб/i.test(g)) || metabolic ? 3 : 0
    case 'Трайна умора':
      return health.some(h => /щитовид|хипотиреоид|автоимун|раждане/i.test(h)) ? 4 : 0
    case 'Ставни болки или скованост':
    case 'Кожни проблеми (акне, екзема, сухота)':
      return health.includes(AUTOIMMUNE) ? 3 : 0
    case GATE_DIGESTIVE:
      return goals.some(g => /здрав|енерг/i.test(g)) ? 1 : 0
    default:
      return 0
  }
}

function rankByBoost(options: QuestionOption[], boost: (v: string) => number): QuestionOption[] {
  return options
    .map((o, i) => ({ o, key: i - boost(o.value) * 1.5 }))
    .sort((a, b) => a.key - b.key)
    .map(x => x.o)
}

export function getFilteredOptions(
  question: QuestionConfig,
  answers: Record<string, unknown>
): QuestionOption[] {
  if (!question.options) return []
  const ctx = buildQuestionnaireContext(answers)

  if (question.id === 'goals') {
    return question.options.filter(o => {
      if (o.value === 'Отслабване') return ctx.bmi === undefined || ctx.bmi >= 18.5
      if (o.value === 'Наддаване на тегло') return ctx.bmi !== undefined && ctx.bmi < 22
      return true
    })
  }

  if (question.id === 'healthStatus') {
    const health = list(answers, 'healthStatus')
    const visible = question.options.filter(o => healthOptionVisible(o.value, ctx, health))
    const none = visible.filter(o => o.value === NONE_OF_THE_ABOVE)
    const rest = visible.filter(o => o.value !== NONE_OF_THE_ABOVE)
    // „Нищо от изброените“ остава винаги последно.
    return [...rankByBoost(rest, v => healthBoost(v, ctx)), ...none]
  }

  if (question.id === 'symptoms') {
    const visible = question.options.filter(o => symptomOptionVisible(o.value, answers, ctx))
    return rankByBoost(visible, v => symptomBoost(v, answers))
  }

  if (question.id === 'digestiveSymptoms') {
    const health = list(answers, 'healthStatus').join(' ').toLowerCase()
    // При рефлукс/гастрит киселините са първи; иначе — подуването.
    return rankByBoost(question.options, v =>
      /рефлукс|гастрит/.test(health) && /киселин/i.test(v) ? 3 : 0
    )
  }

  if (question.id === 'circulationSymptoms') {
    const health = list(answers, 'healthStatus')
    const legs = health.includes('Задържане на вода') || health.includes('Целулит')
    return rankByBoost(question.options, v => (legs && /крака|вени/i.test(v) ? 3 : 0))
  }

  return question.options
}

/* ── видимост ────────────────────────────────────────────────────────────── */

function matchesConditional(
  cond: NonNullable<QuestionConfig['conditionalOn']>,
  answers: Record<string, unknown>
): boolean {
  const val = answers[cond.questionId]
  if (Array.isArray(cond.value)) return cond.value.includes(val)
  return val === cond.value
}

/** Дали целият въпрос се показва при текущите отговори. */
export function isQuestionVisible(
  question: QuestionConfig,
  answers: Record<string, unknown>
): boolean {
  if (question.conditionalOn && !matchesConditional(question.conditionalOn, answers)) {
    return false
  }

  const state = buildFlowState(answers)
  const id = question.id
  const health = state.healthStatus

  if (['name', 'age', 'gender', 'weight', 'height'].includes(id)) return true

  if (id === 'goals') return state.profileComplete

  const afterGoals = state.profileComplete && hasGoals(answers)
  if (id === 'healthStatus') return afterGoals

  const afterHealth = afterGoals && healthAnswered(answers)
  if (!afterHealth) return false

  switch (id) {
    case 'autoimmuneType':
      return health.includes(AUTOIMMUNE)
    case 'postpartumStage':
      return health.includes(POSTPARTUM)
    case 'breastfeeding':
      return health.includes(POSTPARTUM) && answers.postpartumStage !== undefined
    case 'menopauseSymptoms':
      return health.includes(MENOPAUSE)
    case 'symptoms':
      return true
    case 'digestiveSymptoms':
      return asksDigestiveDetail(answers)
    case 'circulationSymptoms':
      return asksCirculationDetail(answers)
    case 'complaints':
      return true
    case 'medications':
      // Без нито едно състояние и под 50 г. лекарствата рядко са релевантни —
      // свободният текст „Нещо друго“ ги покрива.
      return state.hasCondition || (state.age ?? 0) >= 50
    case 'activityLevel':
      return true
    case 'stressLevel':
    case 'sleepHours':
      return !!state.activityLevel
    case 'sleepQuality':
      return !!state.activityLevel && shouldAskSleepQuality(answers)
    case 'waterLitres':
      if (!state.activityLevel) return false
      if (shouldAskSleepQuality(answers)) return answers.sleepQuality !== undefined
      return answers.sleepHours !== undefined
    case 'dietGate':
      return answers.waterLitres !== undefined && !state.needsDietBlock
    case 'dietaryProfile':
    case 'dietaryHabits':
    case 'foodRestrictions':
      if (answers.waterLitres === undefined) return false
      return dietBlockOpen(state)
    case 'documents':
      return state.hasCondition && answers.waterLitres !== undefined
    default:
      return true
  }
}

export function getVisibleQuestions(
  questions: QuestionConfig[],
  answers: Record<string, unknown>
): QuestionConfig[] {
  return questions.filter(q => isQuestionVisible(q, answers))
}

export function getQuestionSectionLabel(questionId: string): string | undefined {
  if (['name', 'age', 'gender', 'weight', 'height'].includes(questionId)) return 'Профил'
  if (questionId === 'goals') return 'Цели'
  if (
    [
      'healthStatus',
      'autoimmuneType',
      'postpartumStage',
      'breastfeeding',
      'menopauseSymptoms',
      'complaints',
      'medications',
      'documents',
    ].includes(questionId)
  ) {
    return 'Здраве'
  }
  if (['symptoms', 'digestiveSymptoms', 'circulationSymptoms'].includes(questionId)) return 'Как се чувствате'
  if (['activityLevel', 'stressLevel', 'sleepHours', 'sleepQuality', 'waterLitres'].includes(questionId)) {
    return 'Начин на живот'
  }
  if (['dietGate', 'dietaryProfile', 'dietaryHabits', 'foodRestrictions'].includes(questionId)) {
    return 'Хранене'
  }
  return undefined
}

/* ── почистване ──────────────────────────────────────────────────────────── */

function applyMutualExclusion(health: string[]): string[] {
  let out = [...health]
  for (const item of health) {
    const exclude = HEALTH_MUTUAL_EXCLUSION[item]
    if (exclude) out = out.filter(h => !exclude.includes(h) || h === item)
  }
  return out
}

function isKnownSymptom(value: string, allQuestions?: QuestionConfig[]): boolean {
  const q = allQuestions?.find(x => x.id === 'symptoms')
  return !!q?.options?.some(o => o.value === value)
}

/** Премахва невалидни избори и изчиства скрити полета. */
export function sanitizeAnswers(
  answers: Record<string, unknown>,
  allQuestions?: QuestionConfig[]
): Record<string, unknown> {
  const next = { ...answers }
  const ctx = buildQuestionnaireContext(next)

  const goals = list(next, 'goals')
  const filteredGoals = goals.filter(g => {
    if (g === 'Отслабване') return ctx.bmi === undefined || ctx.bmi >= 18.5
    if (g === 'Наддаване на тегло') return ctx.bmi !== undefined && ctx.bmi < 22
    return true
  })
  if (filteredGoals.length !== goals.length) next.goals = filteredGoals

  if (Array.isArray(next.healthStatus)) {
    let health = applyMutualExclusion(next.healthStatus as string[])
    health = health.filter(h => {
      if (!FEMALE_ONLY_HEALTH.has(h) && h !== 'Затлъстяване') return true
      return healthOptionVisible(h, ctx, health.filter(x => x !== h))
    })
    if (JSON.stringify(health) !== JSON.stringify(next.healthStatus)) next.healthStatus = health
  }

  // Усещане, което вече е покрито от състояние, отпада (напр. „Зиморничавост“
  // при отбелязана намалена функция на щитовидната жлеза). Свободен текст от
  // „Друго“ остава.
  if (Array.isArray(next.symptoms)) {
    const symptoms = (next.symptoms as string[]).filter(
      s => !isKnownSymptom(s, allQuestions) || symptomOptionVisible(s, next, ctx)
    )
    if (symptoms.length !== (next.symptoms as string[]).length) next.symptoms = symptoms
  }

  if (allQuestions) {
    const visible = new Set(getVisibleQuestions(allQuestions, next).map(q => q.id))
    for (const field of SKIPPABLE_FIELDS) {
      if (visible.has(field)) continue
      if (ARRAY_FIELDS.has(field)) next[field] = []
      else if (RADIO_FIELDS.has(field)) delete next[field]
      else next[field] = ''
    }
  }

  return next
}

/** При checkbox избор — прилага взаимно изключване. */
export function applyCheckboxExclusion(
  questionId: string,
  current: string[],
  value: string,
  checked: boolean
): string[] {
  if (!checked) return current.filter(v => v !== value)
  if (questionId === 'healthStatus') {
    // „Нищо от изброените“ изключва всичко останало и обратно.
    if (value === NONE_OF_THE_ABOVE) return [NONE_OF_THE_ABOVE]
    let next = [...current.filter(v => v !== NONE_OF_THE_ABOVE), value]
    const exclude = HEALTH_MUTUAL_EXCLUSION[value]
    if (exclude) next = next.filter(v => v === value || !exclude.includes(v))
    return next
  }
  return [...current, value]
}

/* ── единен payload ──────────────────────────────────────────────────────── */

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

/** Единен payload за scoring, safety и AI промптове. */
export function normalizeQuestionnairePayload(
  answers: Record<string, unknown>,
  uploadedFiles: UploadedDocument[] = [],
  allQuestions?: QuestionConfig[]
): QuestionnaireData {
  const clean = sanitizeAnswers(answers, allQuestions)
  const complaintsText = String(clean.complaints || '').trim()
  const legacyMedical = String(clean.medicalConditions || '').trim()
  const mergedComplaints =
    complaintsText && legacyMedical
      ? `${complaintsText}\n${legacyMedical}`
      : complaintsText || legacyMedical

  const restrictions = String(clean.foodRestrictions || clean.foodIntolerances || '').trim()
  const sleepHours = Number(clean.sleepHours) || 7
  const askSleepQuality = shouldAskSleepQuality(clean)

  // Състоянията: основният избор + уточненията (вид автоимунно, кърмене).
  // Така scoring, safety и промптовете виждат „Хашимото“ и „Кърмене“ директно.
  const healthStatus = uniq([
    ...realConditions(list(clean, 'healthStatus')),
    ...list(clean, 'autoimmuneType'),
    ...(clean.breastfeeding === 'yes' ? ['Кърмене'] : []),
  ])

  // Усещанията: общият списък + подробните. Общият „вход“ (напр. „Дискомфорт
  // след хранене“) отпада, когато подробностите са дадени — те го заместват.
  const digestive = list(clean, 'digestiveSymptoms')
  const circulation = list(clean, 'circulationSymptoms')
  const general = list(clean, 'symptoms').filter(
    s =>
      !(s === GATE_DIGESTIVE && digestive.length > 0) &&
      !(s === GATE_CIRCULATION && circulation.length > 0)
  )
  const symptoms = uniq([...general, ...digestive, ...circulation, ...list(clean, 'menopauseSymptoms')])

  const postpartumNote = clean.postpartumStage ? `Време след раждането: ${clean.postpartumStage}` : ''

  // Водата е в литри; `hydration` пази еквивалента в чаши за стари потребители.
  const rawLitres =
    clean.waterLitres !== undefined && clean.waterLitres !== ''
      ? Number(clean.waterLitres)
      : clean.hydration !== undefined
        ? Number(clean.hydration) * 0.25
        : NaN
  const waterLitres = Number.isFinite(rawLitres) ? Math.max(0, rawLitres) : 2

  return {
    name: String(clean.name || ''),
    age: Number(clean.age) || 0,
    gender: (clean.gender as QuestionnaireData['gender']) || 'other',
    weight: Number(clean.weight) || 0,
    height: Number(clean.height) || 0,
    goals: list(clean, 'goals'),
    healthStatus,
    symptoms,
    complaints: [mergedComplaints, postpartumNote].filter(Boolean).join('\n'),
    medicalConditions: mergedComplaints,
    familyHistory: String(clean.familyHistory || '').trim(),
    activityLevel: (clean.activityLevel as QuestionnaireData['activityLevel']) || 'moderate',
    stressLevel: (clean.stressLevel as QuestionnaireData['stressLevel']) || 'moderate',
    sleepHours,
    sleepQuality: askSleepQuality
      ? ((clean.sleepQuality as QuestionnaireData['sleepQuality']) || 'fair')
      : sleepHours >= 7
        ? 'good'
        : 'fair',
    hydration: Math.round(waterLitres * 4),
    waterLitres,
    dietaryProfile: list(clean, 'dietaryProfile'),
    dietaryHabits: list(clean, 'dietaryHabits'),
    foodIntolerances: restrictions,
    allergies: restrictions,
    medications: String(clean.medications || '').trim(),
    uploadedDocuments: uploadedFiles,
    customAnswers: {
      ...clean,
      dietGate: clean.dietGate,
      flowVersion: QUESTIONNAIRE_CONFIG_VERSION,
    },
  }
}
