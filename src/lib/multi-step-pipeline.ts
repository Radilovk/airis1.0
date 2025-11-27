import { AIRIS_KNOWLEDGE } from './airis-knowledge'
import {
  type IrisPipelineOutcome,
  type IrisPipelineSteps,
  runIrisPipeline,
} from './iris-pipeline-orchestrator'
import { pipelinePromptCatalog } from './pipeline-prompts'
import type {
  QuestionnaireData,
  IrisImage,
  Step1GeoCalibrationResult,
  Step2AStructuralResult,
  Step2BPigmentResult,
  Step2CConsistencyResult,
  Step3MapperResult,
  Step4ProfileBuilderResult,
  Step5FrontendReport,
  StepError,
} from '@/types'

export interface PipelineLLMClient {
  callModel: (prompt: string, allowJson: boolean, maxRetries?: number, imageDataUrl?: string) => Promise<string>
}

const stringify = (value: unknown) => JSON.stringify(value, null, 2)

const fillTemplate = (template: string, values: Record<string, string>) =>
  template.replace(/{{\s*([^}]+?)\s*}}/g, (_, key: string) => values[key] ?? '')

const parseJson = <T>(raw: string, context: string): T => {
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new Error(`Грешка при парсване на ${context}: ${(error as Error).message}`)
  }
}

const buildManualContext = () => {
  const zones = AIRIS_KNOWLEDGE.irisMap.zones
    .map(zone => `${zone.hour}:${zone.organ}(${zone.system})`)
    .join(' | ')

  const artifacts = AIRIS_KNOWLEDGE.artifacts.types
    .map(artifact => `${artifact.name}:${artifact.interpretation}`)
    .join(' | ')

  const constitutions = AIRIS_KNOWLEDGE.constitutions.types
    .map(type => `${type.name}:${type.description}`)
    .join(' | ')

  return `ЗОНИ:${zones}\nАРТЕФАКТИ:${artifacts}\nКОНСТИТУЦИИ:${constitutions}`
}

const buildV9Map = () =>
  AIRIS_KNOWLEDGE.irisMap.zones.map((zone, index) => ({
    id: `Z${index + 1}`,
    side: 'ANY',
    mins: zone.angle,
    rings: [0, 11],
    organ_bg: zone.organ,
    system_bg: zone.system,
  }))

const withImageHash = (image: IrisImage) => image.dataUrl.slice(0, 18)

export interface MultistepPipelineParams {
  side: 'left' | 'right'
  image: IrisImage
  questionnaire: QuestionnaireData
  llm: PipelineLLMClient
}

export interface MultistepPipelineResult {
  report?: Step5FrontendReport
  outcome: IrisPipelineOutcome
}

export const runMultistepPipeline = async ({ side, image, questionnaire, llm }: MultistepPipelineParams): Promise<MultistepPipelineResult> => {
  const sideCode = side === 'left' ? 'L' : 'R'
  const manual = buildManualContext()
  const coordV9 = buildV9Map()
  const bmi = Number((questionnaire.weight / ((questionnaire.height / 100) ** 2)).toFixed(1))

  let geoResult: Step1GeoCalibrationResult | StepError | undefined
  let structuralResult: Step2AStructuralResult | StepError | undefined
  let pigmentResult: Step2BPigmentResult | StepError | undefined
  let cleanedResult: Step2CConsistencyResult | StepError | undefined
  let mappingResult: Step3MapperResult | StepError | undefined
  let profileResult: Step4ProfileBuilderResult | StepError | undefined

  const steps: IrisPipelineSteps = {
    step1: async () => {
      const prompt = fillTemplate(pipelinePromptCatalog.prompts.STEP1.body, {
        side: sideCode,
        imageHash: withImageHash(image),
      })
      const raw = await llm.callModel(prompt, true, 2, image.dataUrl)
      geoResult = parseJson<Step1GeoCalibrationResult | StepError>(raw, 'STEP1')
      return geoResult
    },
    step2A: async (geo) => {
      const prompt = fillTemplate(pipelinePromptCatalog.prompts.STEP2A.body, {
        step1_json: stringify(geo),
        imageHash: withImageHash(image),
      })
      const raw = await llm.callModel(prompt, true)
      structuralResult = parseJson<Step2AStructuralResult | StepError>(raw, 'STEP2A')
      return structuralResult
    },
    step2B: async (geo) => {
      const prompt = fillTemplate(pipelinePromptCatalog.prompts.STEP2B.body, {
        step1_json: stringify(geo),
        imageHash: withImageHash(image),
      })
      const raw = await llm.callModel(prompt, true)
      pigmentResult = parseJson<Step2BPigmentResult | StepError>(raw, 'STEP2B')
      return pigmentResult
    },
    step2C: async ({ structural, pigment }) => {
      const prompt = fillTemplate(pipelinePromptCatalog.prompts.STEP2C.body, {
        step1_json: stringify(geoResult ?? structural),
        step2a_json: stringify(structuralResult ?? structural),
        step2b_json: stringify(pigmentResult ?? pigment),
      })
      const raw = await llm.callModel(prompt, true)
      cleanedResult = parseJson<Step2CConsistencyResult | StepError>(raw, 'STEP2C')
      return cleanedResult
    },
    step3: async (cleaned) => {
      const prompt = fillTemplate(pipelinePromptCatalog.prompts.STEP3.body, {
        side: sideCode,
        coord_v9_json: stringify(coordV9),
        step1_json: stringify(geoResult ?? cleaned),
        step2c_json: stringify(cleanedResult ?? cleaned),
        imageHash: withImageHash(image),
      })
      const raw = await llm.callModel(prompt, true)
      mappingResult = parseJson<Step3MapperResult | StepError>(raw, 'STEP3')
      return mappingResult
    },
    step4: async (mapping) => {
      const prompt = fillTemplate(pipelinePromptCatalog.prompts.STEP4.body, {
        step1_json: stringify(geoResult ?? mapping),
        step2c_json: stringify(cleanedResult ?? mapping),
        step3_json: stringify(mappingResult ?? mapping),
        coord_v9_json: stringify(coordV9),
        IRIS_RAG_v2_text: manual,
        age: String(questionnaire.age),
        gender: questionnaire.gender,
        bmi: String(bmi),
        weight: String(questionnaire.weight),
        height: String(questionnaire.height),
        goals: questionnaire.goals.join(', '),
        healthStatus: questionnaire.healthStatus.join(', '),
        complaints: questionnaire.complaints,
        dietaryHabits: questionnaire.dietaryHabits.join(', '),
        stressLevel: questionnaire.stressLevel,
        sleepHours: String(questionnaire.sleepHours),
        sleepQuality: questionnaire.sleepQuality,
        activityLevel: questionnaire.activityLevel,
        medications: questionnaire.medications,
        allergies: questionnaire.allergies,
      })
      const raw = await llm.callModel(prompt, true)
      profileResult = parseJson<Step4ProfileBuilderResult | StepError>(raw, 'STEP4')
      return profileResult
    },
    step5: async (profile) => {
      const prompt = fillTemplate(pipelinePromptCatalog.prompts.STEP5.body, {
        step1_json: stringify(geoResult ?? profile),
        step2c_json: stringify(cleanedResult ?? profile),
        step3_json: stringify(mappingResult ?? profile),
        step4_json: stringify(profileResult ?? profile),
        IRIS_RAG_v2_text: manual,
        age: String(questionnaire.age),
        gender: questionnaire.gender,
        bmi: String(bmi),
        weight: String(questionnaire.weight),
        height: String(questionnaire.height),
        goals: questionnaire.goals.join(', '),
        healthStatus: questionnaire.healthStatus.join(', '),
        complaints: questionnaire.complaints,
        dietaryHabits: questionnaire.dietaryHabits.join(', '),
        stressLevel: questionnaire.stressLevel,
        sleepHours: String(questionnaire.sleepHours),
        sleepQuality: questionnaire.sleepQuality,
        activityLevel: questionnaire.activityLevel,
        medications: questionnaire.medications,
        allergies: questionnaire.allergies,
      })
      const raw = await llm.callModel(prompt, true)
      return parseJson<Step5FrontendReport | StepError>(raw, 'STEP5')
    },
  }

  const outcome = await runIrisPipeline(steps, {
    prompts: pipelinePromptCatalog,
    logger: (entry) => {
      console.log(`[PIPELINE][${entry.stage}] ${entry.message}`, entry.details ?? '')
    },
  })

  return { report: outcome.ctx.report as Step5FrontendReport | undefined, outcome }
}
