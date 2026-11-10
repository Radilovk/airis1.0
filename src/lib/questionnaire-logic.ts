import type {
  DiagnosisDetail,
  QuestionConfig,
  QuestionnaireData,
  QuestionOption,
  StateDetails,
  UploadedDocument,
} from '@/types'
import { defaultQuestions } from './defaultQuestions'

/**
 * Адаптивен въпросник (v5). Строго разделени нива:
 *
 *   1. ДИАГНОЗИ — само заболявания, поставени от лекар (`diagnoses`).
 *   2. УТОЧНЕНИЯ ПО ДИАГНОЗА — за всяка избрана диагноза: вид, оплаквания при
 *      нея, лечение. Оплакванията се записват КЪМ диагнозата (`diagnosisDetails`).
 *   3. СЪСТОЯНИЯ — не са заболявания, но променят нуждите (`states`):
 *      менопауза, бременност, след раждане, задържане на вода, целулит.
 *   4. ДРУГИ УСЕЩАНИЯ — само това, което още не е питано (`generalSymptoms`).
 *      Две от тях отварят подробен въпрос (храносмилане, кръвообращение).
 *
 * Така моделът знае, че „зиморничавост“ при хипотиреоидизъм е проява на
 * диагнозата, а не нов проблем; и че „задържане на вода“ е състояние, не болест.
 * Усещане, вече питано в по-ранен въпрос, не се появява по-късно.
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

export const QUESTIONNAIRE_CONFIG_VERSION = '5.0'

/* ── речник ──────────────────────────────────────────────────────────────── */

export const NO_DIAGNOSIS = 'Нямам диагностицирано заболяване'
export const NO_STATE = 'Нищо от тези'
/** Стойности, които изключват всички останали в същия въпрос. */
export const NO_REGIME = 'Не спазвам специален режим'
export const NO_HABITS = 'Нямам такива навици'
const EXCLUSIVE: Record<string, string> = {
  diagnoses: NO_DIAGNOSIS,
  states: NO_STATE,
  dietaryProfile: NO_REGIME,
  dietaryHabits: NO_HABITS,
}

const MENOPAUSE = 'Менопауза'
const PREGNANCY = 'Бременност'
const POSTPARTUM = 'Възстановяване след раждане'
const WATER = 'Задържане на вода'
const CELLULITE = 'Целулит'
const PCOS = 'Поликистозни яйчници (ПКОС)'
const GATE_DIGESTIVE = 'Храносмилателен дискомфорт'
const GATE_CIRCULATION = 'Студени крайници или подути крака'

const FEMALE_ONLY = new Set([MENOPAUSE, PREGNANCY, POSTPARTUM, CELLULITE, PCOS])

/** Взаимно изключващи се състояния. */
export const STATE_MUTUAL_EXCLUSION: Record<string, string[]> = {
  [PREGNANCY]: [POSTPARTUM, MENOPAUSE],
  [POSTPARTUM]: [PREGNANCY, MENOPAUSE],
  [MENOPAUSE]: [PREGNANCY, POSTPARTUM],
}

type Answers = Record<string, unknown>

function list(answers: Answers, id: string): string[] {
  const v = answers[id]
  return Array.isArray(v) ? (v as string[]) : []
}

/* ── групи диагнози ──────────────────────────────────────────────────────── */

export interface DiagnosisGroup {
  key: string
  label: string
  diagnoses: string[]
  subtypeQ?: string
  symptomQ?: string
  treatmentQ?: string
  /** Допълнително включване от уточнение (напр. Хашимото → щитовидна жлеза). */
  alsoWhen?: (a: Answers) => boolean
}

export const DIAGNOSIS_GROUPS: DiagnosisGroup[] = [
  {
    key: 'autoimmune',
    label: 'Автоимунно заболяване',
    diagnoses: ['Автоимунно заболяване'],
    subtypeQ: 'dxAutoimmuneType',
    symptomQ: 'dxAutoimmuneSymptoms',
  },
  {
    key: 'thyroid',
    label: 'Щитовидна жлеза',
    diagnoses: ['Хипотиреоидизъм'],
    symptomQ: 'dxThyroidSymptoms',
    alsoWhen: a => list(a, 'dxAutoimmuneType').some(t => /хашимото/i.test(t)),
  },
  { key: 'weight', label: 'Затлъстяване', diagnoses: ['Затлъстяване'], symptomQ: 'dxWeightSymptoms' },
  {
    key: 'heart',
    label: 'Сърце и кръвно налягане',
    diagnoses: ['Хипертония', 'Сърдечно-съдово заболяване'],
    symptomQ: 'dxHeartSymptoms',
  },
  { key: 'lipids', label: 'Холестерол', diagnoses: ['Висок холестерол'], treatmentQ: 'dxLipidTreatment' },
  {
    key: 'sugar',
    label: 'Кръвна захар',
    diagnoses: ['Преддиабет или инсулинова резистентност', 'Диабет 2 тип'],
    symptomQ: 'dxSugarSymptoms',
    treatmentQ: 'dxSugarTreatment',
  },
  {
    key: 'digestive',
    label: 'Храносмилане',
    diagnoses: ['Храносмилателно заболяване'],
    subtypeQ: 'dxDigestiveType',
    symptomQ: 'dxDigestiveSymptoms',
    alsoWhen: a => list(a, 'dxAutoimmuneType').some(t => /цьолиак|черват/i.test(t)),
  },
  { key: 'liver', label: 'Черен дроб', diagnoses: ['Мастен черен дроб'], symptomQ: 'dxLiverSymptoms' },
  { key: 'pcos', label: 'ПКОС', diagnoses: [PCOS], symptomQ: 'dxPcosSymptoms' },
]

function groupSelected(g: DiagnosisGroup, a: Answers): boolean {
  return list(a, 'diagnoses').some(d => g.diagnoses.includes(d))
}

function groupActive(g: DiagnosisGroup, a: Answers): boolean {
  return groupSelected(g, a) || (g.alsoWhen?.(a) ?? false)
}

const GROUP_BY_QUESTION = new Map<string, DiagnosisGroup>()
for (const g of DIAGNOSIS_GROUPS) {
  for (const q of [g.subtypeQ, g.symptomQ, g.treatmentQ]) if (q) GROUP_BY_QUESTION.set(q, g)
}

/**
 * Въпросите с усещания — в реда, в който се задават. По-късен въпрос не
 * повтаря усещане, което вече е показано в по-ранен.
 */
const SYMPTOM_QUESTIONS = [
  ...DIAGNOSIS_GROUPS.map(g => g.symptomQ).filter((x): x is string => !!x),
  'menopauseSymptoms',
  'legsSymptoms',
  'symptoms',
  'digestiveSymptoms',
  'circulationSymptoms',
]

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

export function buildQuestionnaireContext(answers: Answers): QuestionnaireContext {
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

function isProfileComplete(a: Answers): boolean {
  const ctx = buildQuestionnaireContext(a)
  return (
    String(a.name || '').trim().length >= 2 &&
    !!a.gender &&
    (ctx.age ?? 0) > 0 &&
    (ctx.weight ?? 0) > 0 &&
    (ctx.height ?? 0) > 0
  )
}

function realDiagnoses(a: Answers): string[] {
  return list(a, 'diagnoses').filter(d => d !== NO_DIAGNOSIS && d !== 'other')
}

/** Има ли поне едно уместно състояние за този профил (иначе въпросът не съществува). */
function statesRelevant(a: Answers, all?: QuestionConfig[]): boolean {
  const ctx = buildQuestionnaireContext(a)
  // Мъжете: от състоянията остава само „задържане на вода“ — то е в общите
  // усещания („подути крака“), отделен въпрос с една опция няма смисъл.
  if (ctx.gender === 'male') return false
  const q = questionById('states', all)
  return (q?.options ?? []).some(o => o.value !== NO_STATE && profileAllows(o.value, ctx))
}

function realStates(a: Answers): string[] {
  return list(a, 'states').filter(s => s !== NO_STATE)
}

/** Профилът сам по себе си изисква хранителния блок (без gate). */
export function needsHealthBlock(ctx: QuestionnaireContext, goals: string[]): boolean {
  if (ctx.bmi !== undefined && (ctx.bmi >= 27 || ctx.bmi < 18.5)) return true
  if (ctx.age !== undefined && ctx.age >= 50) return true
  if (ctx.gender === 'female' && ctx.age !== undefined && ctx.age >= 38) return true
  return goals.some(g => /отслаб|наддаван|здрав/i.test(g))
}

export function shouldAskSleepQuality(a: Answers): boolean {
  const hours = Number(a.sleepHours)
  if (!Number.isFinite(hours)) return false
  if (hours < 7) return true
  if ([...list(a, 'menopauseSymptoms'), ...list(a, 'symptoms')].includes('Нарушен сън')) return true
  if (list(a, 'dxWeightSymptoms').includes('Хъркане или накъсан сън')) return true
  if (realStates(a).includes(POSTPARTUM)) return true
  return list(a, 'goals').some(g => /сън/i.test(g))
}

/* ── опции: филтър и подредба ────────────────────────────────────────────── */

/**
 * Дали опцията е уместна за този профил. Правилото: показваме само това, което
 * реално се среща при този пол, възраст и тегло. Рядкото остава възможно през
 * „Друго“ — но не заема място в списъка на всички.
 */
function profileAllows(value: string, ctx: QuestionnaireContext): boolean {
  const male = ctx.gender === 'male'
  if (FEMALE_ONLY.has(value) && male) return false
  const age = ctx.age
  const bmi = ctx.bmi
  const heavy = bmi !== undefined && bmi >= 27
  if (age === undefined) return value === 'Затлъстяване' ? bmi === undefined || bmi >= 25 : true
  switch (value) {
    // ── състояния ──
    case MENOPAUSE:
      // Перименопаузата започва обичайно след 40.
      return age >= 40
    case PREGNANCY:
      return age >= 16 && age <= 47
    case POSTPARTUM:
      return age >= 16 && age <= 48
    case CELLULITE:
      return age >= 16
    // ── диагнози ──
    case PCOS:
      // След менопаузата ПКОС не определя храненето.
      return age >= 14 && age <= 50
    case 'Затлъстяване':
      return bmi === undefined || bmi >= 25
    case 'Диабет 2 тип':
      return age >= 30 || heavy
    case 'Хипертония':
    case 'Висок холестерол':
      return age >= 25 || heavy
    case 'Сърдечно-съдово заболяване':
      return age >= 35
    case 'Мастен черен дроб':
      return age >= 35 || (bmi !== undefined && bmi >= 25)
    default:
      return true
  }
}

function boost(value: string, ctx: QuestionnaireContext): number {
  const bmi = ctx.bmi
  const age = ctx.age ?? 35
  const female = ctx.gender === 'female'
  switch (value) {
    case 'Автоимунно заболяване':
      // Автоимунните заболявания са значително по-чести при жените.
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
    default:
      return 0
  }
}

function rank(options: QuestionOption[], score: (v: string) => number): QuestionOption[] {
  return options
    .map((o, i) => ({ o, key: i - score(o.value) * 1.5 }))
    .sort((x, y) => x.key - y.key)
    .map(x => x.o)
}

function questionById(id: string, all?: QuestionConfig[]): QuestionConfig | undefined {
  return all?.find(q => q.id === id) ?? defaultQuestions.find(q => q.id === id)
}

/**
 * Опциите на всички въпроси с усещания — изчислени наведнъж, в реда на
 * задаване: всеки въпрос губи усещанията, вече показани в по-ранен видим
 * въпрос. Кешира се по обекта с отговорите (React създава нов при промяна).
 */
const optionCache = new WeakMap<object, Map<string, QuestionOption[]>>()

function symptomOptionMap(a: Answers, all?: QuestionConfig[]): Map<string, QuestionOption[]> {
  const hit = optionCache.get(a)
  if (hit) return hit
  const ctx = buildQuestionnaireContext(a)
  const out = new Map<string, QuestionOption[]>()
  const asked = new Set<string>()
  const digestive = DIAGNOSIS_GROUPS.find(g => g.key === 'digestive')!
  const heart = DIAGNOSIS_GROUPS.find(g => g.key === 'heart')!
  for (const id of SYMPTOM_QUESTIONS) {
    const q = questionById(id, all)
    if (!q) continue
    let opts = (q.options ?? []).filter(o => !asked.has(o.value))
    if (id === 'symptoms') {
      opts = opts.filter(o => {
        if (o.value === GATE_DIGESTIVE) return !groupActive(digestive, a)
        if (o.value === GATE_CIRCULATION) {
          return !groupActive(heart, a) && !(out.get('legsSymptoms')?.length && baseVisible(questionById('legsSymptoms', all)!, a))
        }
        if (o.value === 'Трудно отслабване') {
          return (ctx.bmi !== undefined && ctx.bmi >= 23) || list(a, 'goals').some(g => /отслаб/i.test(g))
        }
        return true
      })
    }
    out.set(id, opts)
    if (baseVisible(q, a)) for (const o of opts) asked.add(o.value)
  }
  optionCache.set(a, out)
  return out
}

/** Опциите на въпрос с усещания, без вече питаните. */
function symptomOptions(q: QuestionConfig, a: Answers, all?: QuestionConfig[]): QuestionOption[] {
  return symptomOptionMap(a, all).get(q.id) ?? q.options ?? []
}

export function getFilteredOptions(question: QuestionConfig, answers: Answers, all?: QuestionConfig[]): QuestionOption[] {
  if (!question.options) return []
  const ctx = buildQuestionnaireContext(answers)

  if (question.id === 'goals') {
    return question.options.filter(o => {
      if (o.value === 'Отслабване') return ctx.bmi === undefined || ctx.bmi >= 20
      if (o.value === 'Наддаване на тегло') return ctx.bmi !== undefined && ctx.bmi < 22
      return true
    })
  }

  if (question.id === 'diagnoses' || question.id === 'states') {
    const chosen = realStates(answers)
    const none = EXCLUSIVE[question.id]
    const visible = question.options.filter(o => {
      if (!profileAllows(o.value, ctx)) return false
      if (question.id === 'states') {
        const excluded = chosen.some(c => STATE_MUTUAL_EXCLUSION[c]?.includes(o.value))
        if (excluded) return false
      }
      return true
    })
    // „Нямам …“ остава винаги последно.
    return [
      ...rank(visible.filter(o => o.value !== none), v => boost(v, ctx)),
      ...visible.filter(o => o.value === none),
    ]
  }

  if (question.id === 'dietaryProfile') {
    // При веганско хранене „без лактоза“ е излишно.
    return question.options.filter(o => !(o.value === 'Без лактоза' && answers.eatingStyle === 'Веганско'))
  }

  if (SYMPTOM_QUESTIONS.includes(question.id)) {
    const opts = symptomOptions(question, answers, all)
    if (question.id === 'dxDigestiveSymptoms') {
      const reflux = list(answers, 'dxDigestiveType').some(t => /рефлукс|гастрит|язва/i.test(t))
      return rank(opts, v => (reflux && /киселин/i.test(v) ? 3 : 0))
    }
    return opts
  }

  return question.options
}

/* ── видимост ────────────────────────────────────────────────────────────── */

function matchesConditional(cond: NonNullable<QuestionConfig['conditionalOn']>, answers: Answers): boolean {
  const val = answers[cond.questionId]
  if (Array.isArray(cond.value)) return cond.value.includes(val)
  return val === cond.value
}

/** Видимост без проверката „има ли останали опции“ (тя зависи от по-ранни въпроси). */
function baseVisible(question: QuestionConfig, a: Answers): boolean {
  if (question.conditionalOn && !matchesConditional(question.conditionalOn, a)) return false
  const id = question.id

  if (['name', 'age', 'gender', 'weight', 'height'].includes(id)) return true
  const profile = isProfileComplete(a)
  if (id === 'goals') return profile

  const afterGoals = profile && list(a, 'goals').length > 0
  if (id === 'diagnoses') return afterGoals
  const afterDiagnoses = afterGoals && list(a, 'diagnoses').length > 0
  if (!afterDiagnoses) return false

  const group = GROUP_BY_QUESTION.get(id)
  if (group) {
    // Видът на храносмилателното заболяване се пита само при избрана диагноза
    // (при цьолиакия/Крон видът вече е известен).
    if (id === group.subtypeQ) return groupSelected(group, a)
    return groupActive(group, a)
  }

  if (id === 'states') return statesRelevant(a)
  const states = realStates(a)
  switch (id) {
    case 'postpartumStage':
      return states.includes(POSTPARTUM)
    case 'breastfeeding':
      return states.includes(POSTPARTUM) && a.postpartumStage !== undefined
    case 'menopauseSymptoms':
      return states.includes(MENOPAUSE)
    case 'legsSymptoms':
      return states.includes(WATER) || states.includes(CELLULITE)
  }

  const afterStates = !statesRelevant(a) || list(a, 'states').length > 0
  if (!afterStates) return false
  const hasDiagnosis = realDiagnoses(a).length > 0

  switch (id) {
    case 'symptoms':
    case 'complaints':
    case 'activityLevel':
      return true
    case 'digestiveSymptoms':
      return list(a, 'symptoms').includes(GATE_DIGESTIVE)
    case 'circulationSymptoms':
      return list(a, 'symptoms').includes(GATE_CIRCULATION)
    case 'medications':
      // Без диагноза и под 50 г. лекарствата рядко са релевантни — свободният
      // текст „Нещо друго“ ги покрива.
      return hasDiagnosis || (buildQuestionnaireContext(a).age ?? 0) >= 50
    case 'stressLevel':
    case 'sleepHours':
      return !!a.activityLevel
    case 'sleepQuality':
      return !!a.activityLevel && shouldAskSleepQuality(a)
    case 'waterLitres':
      if (!a.activityLevel) return false
      return shouldAskSleepQuality(a) ? a.sleepQuality !== undefined : a.sleepHours !== undefined
    // Храненето се пита при всички — без филтър „искате ли да добавите“.
    case 'eatingStyle':
    case 'dietaryProfile':
    case 'dietaryHabits':
    case 'foodRestrictions':
      return a.waterLitres !== undefined
    case 'documents':
      return hasDiagnosis && a.waterLitres !== undefined
    default:
      return true
  }
}

/** Дали въпросът се показва при текущите отговори. */
export function isQuestionVisible(question: QuestionConfig, answers: Answers, all?: QuestionConfig[]): boolean {
  if (!baseVisible(question, answers)) return false
  // Въпрос с усещания, чиито опции вече са питани, се пропуска.
  if (SYMPTOM_QUESTIONS.includes(question.id)) return symptomOptions(question, answers, all).length > 0
  return true
}

export function getVisibleQuestions(questions: QuestionConfig[], answers: Answers): QuestionConfig[] {
  return questions.filter(q => isQuestionVisible(q, answers, questions))
}

export function getQuestionSectionLabel(questionId: string): string | undefined {
  if (['name', 'age', 'gender', 'weight', 'height'].includes(questionId)) return 'Профил'
  if (questionId === 'goals') return 'Цели'
  if (questionId === 'diagnoses') return 'Диагнози'
  const group = GROUP_BY_QUESTION.get(questionId)
  if (group) return `Диагнози · ${group.label}`
  if (['states', 'postpartumStage', 'breastfeeding', 'menopauseSymptoms', 'legsSymptoms'].includes(questionId)) {
    return 'Състояния'
  }
  if (['symptoms', 'digestiveSymptoms', 'circulationSymptoms'].includes(questionId)) return 'Как се чувствате'
  if (['complaints', 'medications', 'documents'].includes(questionId)) return 'Здраве'
  if (['activityLevel', 'stressLevel', 'sleepHours', 'sleepQuality', 'waterLitres'].includes(questionId)) {
    return 'Начин на живот'
  }
  if (['eatingStyle', 'dietaryProfile', 'dietaryHabits', 'foodRestrictions'].includes(questionId)) return 'Хранене'
  return undefined
}

/* ── почистване ──────────────────────────────────────────────────────────── */

/** Задължителните полета, които не се изчистват, когато са скрити. */
const KEEP_WHEN_HIDDEN = new Set([
  'name', 'age', 'gender', 'weight', 'height', 'goals', 'diagnoses', 'states',
  'activityLevel', 'stressLevel', 'sleepHours', 'waterLitres', 'eatingStyle',
])

/** Премахва невалидни избори и изчиства скрити полета. */
export function sanitizeAnswers(answers: Answers, allQuestions?: QuestionConfig[]): Answers {
  const next = { ...answers }
  const ctx = buildQuestionnaireContext(next)

  const goals = list(next, 'goals')
  const goodGoals = goals.filter(g => {
    if (g === 'Отслабване') return ctx.bmi === undefined || ctx.bmi >= 20
    if (g === 'Наддаване на тегло') return ctx.bmi !== undefined && ctx.bmi < 22
    return true
  })
  if (goodGoals.length !== goals.length) next.goals = goodGoals

  for (const id of ['diagnoses', 'states']) {
    if (!Array.isArray(next[id])) continue
    let vals = (next[id] as string[]).filter(v => profileAllows(v, ctx))
    if (id === 'states') {
      for (const v of [...vals]) {
        const excl = STATE_MUTUAL_EXCLUSION[v]
        if (excl && vals.includes(v)) vals = vals.filter(x => x === v || !excl.includes(x))
      }
    }
    if (vals.length !== (next[id] as string[]).length) next[id] = vals
  }

  // Без уместни състояния (напр. мъж) въпросът не съществува — и отговорът му също.
  if (!statesRelevant(next, allQuestions)) next.states = []

  const questions = allQuestions ?? defaultQuestions
  // Отговор на опция, която вече не се показва (питана е по-рано), отпада.
  for (const q of questions) {
    if (!SYMPTOM_QUESTIONS.includes(q.id) || !Array.isArray(next[q.id])) continue
    const allowed = new Set(symptomOptions(q, next, questions).map(o => o.value))
    const known = new Set((q.options ?? []).map(o => o.value))
    const vals = (next[q.id] as string[]).filter(v => !known.has(v) || allowed.has(v))
    if (vals.length !== (next[q.id] as string[]).length) next[q.id] = vals
  }

  // `next` се променя на място — кешът на опциите за него вече е остарял.
  optionCache.delete(next)
  const visible = new Set(getVisibleQuestions(questions, next).map(q => q.id))
  for (const q of questions) {
    if (visible.has(q.id) || KEEP_WHEN_HIDDEN.has(q.id)) continue
    if (q.type === 'checkbox') next[q.id] = []
    else if (q.type === 'radio') delete next[q.id]
    else if (q.type === 'text' || q.type === 'textarea') next[q.id] = ''
  }
  optionCache.delete(next)
  return next
}

/** При checkbox избор — прилага „нямам“ и взаимно изключване. */
export function applyCheckboxExclusion(questionId: string, current: string[], value: string, checked: boolean): string[] {
  if (!checked) return current.filter(v => v !== value)
  const none = EXCLUSIVE[questionId]
  if (none) {
    if (value === none) return [none]
    let next = [...current.filter(v => v !== none), value]
    const excl = questionId === 'states' ? STATE_MUTUAL_EXCLUSION[value] : undefined
    if (excl) next = next.filter(v => v === value || !excl.includes(v))
    return next
  }
  return [...current, value]
}

/** Изключващата опция на въпроса („Нямам …“), ако има такава. */
export function exclusiveOption(questionId: string): string | undefined {
  return EXCLUSIVE[questionId]
}

/* ── единен payload ──────────────────────────────────────────────────────── */

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

/**
 * Единен payload. Пази структурата (диагноза → нейните оплаквания; състояние →
 * неговите; други усещания) за модела, и плоските `healthStatus`/`symptoms`
 * за оценките и защитните правила.
 */
export function normalizeQuestionnairePayload(
  answers: Answers,
  uploadedFiles: UploadedDocument[] = [],
  allQuestions?: QuestionConfig[]
): QuestionnaireData {
  const clean = sanitizeAnswers(answers, allQuestions)
  const complaints = [String(clean.complaints || '').trim(), String(clean.medicalConditions || '').trim()]
    .filter(Boolean)
    .join('\n')
  const restrictions = String(clean.foodRestrictions || clean.foodIntolerances || '').trim()
  const sleepHours = Number(clean.sleepHours) || 7

  const diagnoses = realDiagnoses(clean)
  const diagnosisDetails: DiagnosisDetail[] = DIAGNOSIS_GROUPS.filter(g => groupActive(g, clean)).map(g => {
    const subtypes = g.subtypeQ ? list(clean, g.subtypeQ).filter(v => v !== 'other') : []
    // Група, включена от уточнение (Хашимото → щитовидна), носи уточнението като диагноза.
    const fromSubtype = groupSelected(g, clean)
      ? []
      : list(clean, 'dxAutoimmuneType').filter(t =>
          g.key === 'thyroid' ? /хашимото/i.test(t) : /цьолиак|черват/i.test(t)
        )
    const treatment = g.treatmentQ ? (clean[g.treatmentQ] as string | undefined) : undefined
    return {
      key: g.key,
      label: g.label,
      diagnoses: uniq([...diagnoses.filter(d => g.diagnoses.includes(d)), ...fromSubtype]),
      subtypes,
      symptoms: g.symptomQ ? list(clean, g.symptomQ) : [],
      ...(treatment ? { treatment } : {}),
    }
  })
  // Диагноза, написана в „Друго“, няма група — остава като диагноза без уточнения.
  const grouped = new Set(DIAGNOSIS_GROUPS.flatMap(g => g.diagnoses))
  const otherDiagnoses = diagnoses.filter(d => !grouped.has(d))

  const states = realStates(clean)
  const stateDetails: StateDetails = {
    ...(clean.postpartumStage ? { postpartumStage: String(clean.postpartumStage) } : {}),
    ...(clean.breastfeeding ? { breastfeeding: clean.breastfeeding === 'yes' } : {}),
    ...(list(clean, 'menopauseSymptoms').length ? { menopauseSymptoms: list(clean, 'menopauseSymptoms') } : {}),
    ...(list(clean, 'legsSymptoms').length ? { legsSymptoms: list(clean, 'legsSymptoms') } : {}),
  }

  // Общите усещания: подробните заместват своя „вход“.
  const digestive = list(clean, 'digestiveSymptoms')
  const circulation = list(clean, 'circulationSymptoms')
  const generalSymptoms = uniq([
    ...list(clean, 'symptoms').filter(
      s => !(s === GATE_DIGESTIVE && digestive.length) && !(s === GATE_CIRCULATION && circulation.length)
    ),
    ...digestive,
    ...circulation,
  ])

  const symptoms = uniq([
    ...diagnosisDetails.flatMap(d => d.symptoms),
    ...(stateDetails.menopauseSymptoms ?? []),
    ...(stateDetails.legsSymptoms ?? []),
    ...generalSymptoms,
  ])

  const healthStatus = uniq([
    ...diagnoses,
    ...diagnosisDetails.flatMap(d => [...d.diagnoses, ...d.subtypes]),
    ...states,
    ...(stateDetails.breastfeeding ? ['Кърмене'] : []),
  ])

  // Лечението влиза и в текста за лекарства — защитните правила го търсят там
  // (напр. инсулин → без пропускане на хранене).
  const treatmentNotes = diagnosisDetails
    .filter(d => d.treatment && !/^(не|без лекарства)$/i.test(d.treatment))
    .map(d => `${d.label}: ${d.treatment}`)
  const medications = [String(clean.medications || '').trim(), ...treatmentNotes].filter(Boolean).join('\n')

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
    diagnoses: uniq([...diagnoses.filter(d => grouped.has(d)), ...otherDiagnoses]),
    diagnosisDetails,
    states,
    stateDetails,
    generalSymptoms,
    complaints,
    medicalConditions: complaints,
    familyHistory: String(clean.familyHistory || '').trim(),
    activityLevel: (clean.activityLevel as QuestionnaireData['activityLevel']) || 'moderate',
    stressLevel: (clean.stressLevel as QuestionnaireData['stressLevel']) || 'moderate',
    sleepHours,
    sleepQuality: shouldAskSleepQuality(clean)
      ? ((clean.sleepQuality as QuestionnaireData['sleepQuality']) || 'fair')
      : sleepHours >= 7
        ? 'good'
        : 'fair',
    hydration: Math.round(waterLitres * 4),
    waterLitres,
    eatingStyle: clean.eatingStyle ? String(clean.eatingStyle) : undefined,
    // Типът хранене е първи в профила — защитните правила търсят „веган“/„вегетариан“ тук.
    dietaryProfile: uniq([
      ...(clean.eatingStyle ? [String(clean.eatingStyle)] : []),
      ...list(clean, 'dietaryProfile').filter(v => v !== 'other'),
    ]),
    dietaryHabits: list(clean, 'dietaryHabits').filter(v => v !== 'other'),
    foodIntolerances: restrictions,
    allergies: restrictions,
    medications,
    uploadedDocuments: uploadedFiles,
    customAnswers: { ...clean, flowVersion: QUESTIONNAIRE_CONFIG_VERSION },
  }
}
