import type { QuestionConfig, QuestionnaireData, QuestionOption, UploadedDocument } from '@/types'

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
  healthGate?: GateAnswer
  dietGate?: GateAnswer
  sleepHours?: number
  activityLevel?: string
  /** Автоматично разширяване — не показваме gate, директно здравния блок. */
  needsHealthBlock: boolean
  /** Автоматично разширяване — не показваме gate, директно хранителния блок. */
  needsDietBlock: boolean
  profileComplete: boolean
}

export const QUESTIONNAIRE_CONFIG_VERSION = '3.0'

const FEMALE_ONLY_HEALTH = new Set(['Менопауза', 'Бременност', 'Кърмене'])

/** Взаимно изключващи се здравни състояния. */
export const HEALTH_MUTUAL_EXCLUSION: Record<string, string[]> = {
  Бременност: ['Кърмене', 'Менопауза'],
  Кърмене: ['Бременност'],
}

const SKIPPABLE_FIELDS = new Set([
  'healthGate',
  'healthStatus',
  'complaints',
  'medications',
  'dietGate',
  'dietaryProfile',
  'dietaryHabits',
  'foodRestrictions',
  'sleepQuality',
  'documents',
])

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

function hasGoals(answers: Record<string, unknown>): boolean {
  return Array.isArray(answers.goals) && (answers.goals as string[]).length > 0
}

/** Здравният блок е релевантен без gate — абнормно тегло, възраст, цели. */
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
  healthStatus: string[],
  healthGate?: GateAnswer
): boolean {
  if (needsHealthBlock(ctx, goals)) return true
  if (healthGate === 'yes' || healthStatus.length > 0) return true
  if (goals.some(g => /отслаб|наддаван|енерг|мускул|сън/i.test(g))) return true
  if (ctx.bmi !== undefined && (ctx.bmi >= 25 || ctx.bmi < 20)) return true
  return false
}

export function buildFlowState(answers: Record<string, unknown>): QuestionnaireFlowState {
  const ctx = buildQuestionnaireContext(answers)
  const goals = (answers.goals as string[]) || []
  const healthStatus = (answers.healthStatus as string[]) || []
  const healthGate = answers.healthGate as GateAnswer | undefined
  const dietGate = answers.dietGate as GateAnswer | undefined
  const sleepHours = Number(answers.sleepHours)
  return {
    ...ctx,
    goals,
    healthStatus,
    healthGate,
    dietGate,
    sleepHours: Number.isFinite(sleepHours) ? sleepHours : undefined,
    activityLevel: answers.activityLevel as string | undefined,
    needsHealthBlock: needsHealthBlock(ctx, goals),
    needsDietBlock: needsDietBlock(ctx, goals, healthStatus, healthGate),
    profileComplete: isProfileComplete(answers),
  }
}

function healthBlockOpen(state: QuestionnaireFlowState): boolean {
  return state.needsHealthBlock || state.healthGate === 'yes'
}

function dietBlockOpen(state: QuestionnaireFlowState): boolean {
  return state.needsDietBlock || state.dietGate === 'yes'
}

export function shouldAskSleepQuality(answers: Record<string, unknown>): boolean {
  const hours = Number(answers.sleepHours)
  const goals = (answers.goals as string[]) || []
  if (!Number.isFinite(hours)) return false
  if (hours < 7) return true
  return goals.some(g => /сън/i.test(g))
}

function optionVisibleForQuestion(
  questionId: string,
  option: QuestionOption,
  ctx: QuestionnaireContext,
  healthStatus: string[]
): boolean {
  if (questionId === 'goals') {
    if (option.value === 'Отслабване') return ctx.bmi === undefined || ctx.bmi >= 18.5
    if (option.value === 'Наддаване на тегло') return ctx.bmi !== undefined && ctx.bmi < 22
    return true
  }

  if (questionId === 'healthStatus') {
    if (FEMALE_ONLY_HEALTH.has(option.value)) {
      if (ctx.gender === 'male') return false
      if (option.value === 'Менопауза') {
        if (ctx.age !== undefined && ctx.age < 35) return false
        if (healthStatus.includes('Бременност') || healthStatus.includes('Кърмене')) return false
      }
      if (option.value === 'Бременност') {
        if (ctx.age !== undefined && (ctx.age < 15 || ctx.age > 50)) return false
        if (healthStatus.includes('Кърмене')) return false
      }
      if (option.value === 'Кърмене') {
        if (ctx.age !== undefined && ctx.age < 15) return false
        if (healthStatus.includes('Бременност')) return false
      }
    }
    if (option.value === 'Затлъстяване') return ctx.bmi === undefined || ctx.bmi >= 25
    return true
  }

  return true
}

export function getFilteredOptions(
  question: QuestionConfig,
  answers: Record<string, unknown>
): QuestionOption[] {
  if (!question.options) return []
  const ctx = buildQuestionnaireContext(answers)
  const healthStatus = (answers.healthStatus as string[]) || []
  return question.options.filter(o => optionVisibleForQuestion(question.id, o, ctx, healthStatus))
}

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

  if (['name', 'age', 'gender', 'weight', 'height'].includes(id)) return true

  if (id === 'goals') return state.profileComplete

  if (id === 'healthGate') {
    return state.profileComplete && hasGoals(answers) && !state.needsHealthBlock
  }

  if (id === 'healthStatus' || id === 'complaints' || id === 'medications') {
    if (!state.profileComplete || !hasGoals(answers)) return false
    if (state.needsHealthBlock) return true
    return state.healthGate === 'yes'
  }

  if (id === 'activityLevel') {
    if (!state.profileComplete || !hasGoals(answers)) return false
    if (state.needsHealthBlock) return true
    if (state.healthGate === 'yes') return true
    if (state.healthGate === 'no') return true
    return false
  }

  if (id === 'stressLevel') {
    return !!state.activityLevel
  }

  if (id === 'sleepHours') {
    return !!state.activityLevel
  }

  if (id === 'sleepQuality') {
    return !!state.activityLevel && shouldAskSleepQuality(answers)
  }

  if (id === 'hydration') {
    if (!state.activityLevel) return false
    if (shouldAskSleepQuality(answers)) return answers.sleepQuality !== undefined
    return answers.sleepHours !== undefined
  }

  if (id === 'dietGate') {
    return answers.hydration !== undefined && !state.needsDietBlock
  }

  if (id === 'dietaryProfile' || id === 'dietaryHabits' || id === 'foodRestrictions') {
    if (answers.hydration === undefined) return false
    return dietBlockOpen(state)
  }

  if (id === 'documents') {
    return healthBlockOpen(state)
  }

  return true
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
  if (['healthGate', 'healthStatus', 'complaints', 'medications', 'documents'].includes(questionId)) {
    return 'Здраве'
  }
  if (['activityLevel', 'stressLevel', 'sleepHours', 'sleepQuality', 'hydration'].includes(questionId)) {
    return 'Начин на живот'
  }
  if (['dietGate', 'dietaryProfile', 'dietaryHabits', 'foodRestrictions'].includes(questionId)) {
    return 'Хранене'
  }
  return undefined
}

function applyMutualExclusion(health: string[]): string[] {
  let out = [...health]
  for (const item of health) {
    const exclude = HEALTH_MUTUAL_EXCLUSION[item]
    if (exclude) out = out.filter(h => !exclude.includes(h) || h === item)
  }
  return out
}

/** Премахва невалидни избори и изчиства скрити полета. */
export function sanitizeAnswers(
  answers: Record<string, unknown>,
  allQuestions?: QuestionConfig[]
): Record<string, unknown> {
  let next = { ...answers }
  const ctx = buildQuestionnaireContext(next)

  const goals = Array.isArray(next.goals) ? [...(next.goals as string[])] : []
  const filteredGoals = goals.filter(g => {
    if (g === 'Отслабване') return ctx.bmi === undefined || ctx.bmi >= 18.5
    if (g === 'Наддаване на тегло') return ctx.bmi !== undefined && ctx.bmi < 22
    return true
  })
  if (filteredGoals.length !== goals.length) next.goals = filteredGoals

  let health = Array.isArray(next.healthStatus) ? [...(next.healthStatus as string[])] : []
  health = health.filter(h => {
    if (FEMALE_ONLY_HEALTH.has(h)) {
      if (ctx.gender === 'male') return false
      if (h === 'Менопауза' && ctx.age !== undefined && ctx.age < 35) return false
      if (h === 'Бременност' && ctx.age !== undefined && (ctx.age < 15 || ctx.age > 50)) return false
      if (h === 'Кърмене' && ctx.age !== undefined && ctx.age < 15) return false
    }
    if (h === 'Затлъстяване') return ctx.bmi === undefined || ctx.bmi >= 25
    return true
  })
  health = applyMutualExclusion(health)
  if (JSON.stringify(health) !== JSON.stringify(next.healthStatus)) next.healthStatus = health

  if (allQuestions) {
    const visible = new Set(getVisibleQuestions(allQuestions, next).map(q => q.id))
    for (const field of SKIPPABLE_FIELDS) {
      if (!visible.has(field)) {
        if (field === 'healthStatus' || field === 'dietaryProfile' || field === 'dietaryHabits') {
          next[field] = []
        } else if (field === 'healthGate' || field === 'dietGate') {
          delete next[field]
        } else if (field === 'sleepQuality') {
          delete next[field]
        } else {
          next[field] = ''
        }
      }
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
  let next = [...current, value]
  if (questionId === 'healthStatus') {
    const exclude = HEALTH_MUTUAL_EXCLUSION[value]
    if (exclude) next = next.filter(v => v === value || !exclude.includes(v))
  }
  return next
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

  return {
    name: String(clean.name || ''),
    age: Number(clean.age) || 0,
    gender: (clean.gender as QuestionnaireData['gender']) || 'other',
    weight: Number(clean.weight) || 0,
    height: Number(clean.height) || 0,
    goals: (clean.goals as string[]) || [],
    healthStatus: (clean.healthStatus as string[]) || [],
    complaints: mergedComplaints,
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
    hydration: Number(clean.hydration) || 8,
    dietaryProfile: (clean.dietaryProfile as string[]) || [],
    dietaryHabits: (clean.dietaryHabits as string[]) || [],
    foodIntolerances: restrictions,
    allergies: restrictions,
    medications: String(clean.medications || '').trim(),
    uploadedDocuments: uploadedFiles,
    customAnswers: {
      ...clean,
      healthGate: clean.healthGate,
      dietGate: clean.dietGate,
      flowVersion: QUESTIONNAIRE_CONFIG_VERSION,
    },
  }
}
