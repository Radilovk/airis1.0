import type { QuestionConfig, QuestionnaireData, QuestionOption, UploadedDocument } from '@/types'

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese'

export interface QuestionnaireContext {
  gender?: 'male' | 'female' | 'other'
  age?: number
  weight?: number
  height?: number
  bmi?: number
  bmiCategory?: BmiCategory
}

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

const FEMALE_ONLY_HEALTH = new Set(['Менопауза', 'Бременност', 'Кърмене'])

function optionVisibleForQuestion(
  questionId: string,
  option: QuestionOption,
  ctx: QuestionnaireContext
): boolean {
  if (questionId === 'goals') {
    if (option.value === 'Отслабване') {
      return ctx.bmi === undefined || ctx.bmi >= 18.5
    }
    if (option.value === 'Наддаване на тегло') {
      return ctx.bmi !== undefined && ctx.bmi < 22
    }
    return true
  }

  if (questionId === 'healthStatus') {
    if (FEMALE_ONLY_HEALTH.has(option.value)) {
      if (ctx.gender === 'male') return false
      if (option.value === 'Менопауза' && ctx.age !== undefined && ctx.age < 35) return false
      if (option.value === 'Бременност' && ctx.age !== undefined && (ctx.age < 15 || ctx.age > 50)) return false
      if (option.value === 'Кърмене' && ctx.age !== undefined && ctx.age < 15) return false
    }
    if (option.value === 'Затлъстяване') {
      return ctx.bmi === undefined || ctx.bmi >= 25
    }
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
  return question.options.filter(o => optionVisibleForQuestion(question.id, o, ctx))
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

  const ctx = buildQuestionnaireContext(answers)

  if (question.id === 'healthStatus' && ctx.gender === 'male') {
    // Мъжете могат да отговорят на общите състояния; опциите се филтрират отделно.
    return true
  }

  return true
}

export function getVisibleQuestions(
  questions: QuestionConfig[],
  answers: Record<string, unknown>
): QuestionConfig[] {
  return questions.filter(q => isQuestionVisible(q, answers))
}

/** Премахва невалидни избори след смяна на пол, възраст или тегло. */
export function sanitizeAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const next = { ...answers }
  const ctx = buildQuestionnaireContext(next)

  const goals = Array.isArray(next.goals) ? [...(next.goals as string[])] : []
  const filteredGoals = goals.filter(g => {
    if (g === 'Отслабване') return ctx.bmi === undefined || ctx.bmi >= 18.5
    if (g === 'Наддаване на тегло') return ctx.bmi !== undefined && ctx.bmi < 22
    return true
  })
  if (filteredGoals.length !== goals.length) next.goals = filteredGoals

  const health = Array.isArray(next.healthStatus) ? [...(next.healthStatus as string[])] : []
  const filteredHealth = health.filter(h => {
    if (FEMALE_ONLY_HEALTH.has(h)) {
      if (ctx.gender === 'male') return false
      if (h === 'Менопауза' && ctx.age !== undefined && ctx.age < 35) return false
      if (h === 'Бременност' && ctx.age !== undefined && (ctx.age < 15 || ctx.age > 50)) return false
      if (h === 'Кърмене' && ctx.age !== undefined && ctx.age < 15) return false
    }
    if (h === 'Затлъстяване') return ctx.bmi === undefined || ctx.bmi >= 25
    return true
  })
  if (filteredHealth.length !== health.length) next.healthStatus = filteredHealth

  return next
}

/** Единен payload за scoring, safety и AI промптове. */
export function normalizeQuestionnairePayload(
  answers: Record<string, unknown>,
  uploadedFiles: UploadedDocument[] = []
): QuestionnaireData {
  const clean = sanitizeAnswers(answers)
  const complaintsText = String(clean.complaints || '').trim()
  const legacyMedical = String(clean.medicalConditions || '').trim()
  const mergedComplaints =
    complaintsText && legacyMedical
      ? `${complaintsText}\n${legacyMedical}`
      : complaintsText || legacyMedical

  const restrictions = String(clean.foodRestrictions || clean.foodIntolerances || '').trim()

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
    sleepHours: Number(clean.sleepHours) || 7,
    sleepQuality: (clean.sleepQuality as QuestionnaireData['sleepQuality']) || 'good',
    hydration: Number(clean.hydration) || 8,
    dietaryProfile: (clean.dietaryProfile as string[]) || [],
    dietaryHabits: (clean.dietaryHabits as string[]) || [],
    foodIntolerances: restrictions,
    allergies: restrictions,
    medications: String(clean.medications || '').trim(),
    uploadedDocuments: uploadedFiles,
    customAnswers: clean,
  }
}

export const QUESTIONNAIRE_CONFIG_VERSION = '2.0'
