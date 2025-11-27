import {
  type Step1GeoCalibrationResult,
  type Step2AStructuralResult,
  type Step2BPigmentResult,
  type Step2CConsistencyResult,
  type Step3MapperResult,
  type Step4ProfileBuilderResult,
  type Step5FrontendReport,
  type StepError,
  type StepResult,
  type StepStage,
  type GeoReference,
  type MinuteRange,
  type RingRange,
} from '../types/iris-pipeline'
import { type PipelinePromptCatalog, getPromptForStage } from './pipeline-prompts'
import { type StepPrereqContext, validatePrerequisites } from './step-validators'

type RangeCarrier = { minuteRange: MinuteRange; ringRange: RingRange }

type StepRunner<TInput, TOutput extends StepResult> = (input: TInput) => Promise<TOutput> | TOutput

export interface IrisPipelineSteps {
  step1: StepRunner<void, Step1GeoCalibrationResult | StepError>
  step2A: StepRunner<Step1GeoCalibrationResult, Step2AStructuralResult | StepError>
  step2B: StepRunner<Step1GeoCalibrationResult, Step2BPigmentResult | StepError>
  step2C: StepRunner<
    { structural: Step2AStructuralResult; pigment: Step2BPigmentResult; normalizer: RangeNormalizer },
    Step2CConsistencyResult | StepError
  >
  step3: StepRunner<Step2CConsistencyResult, Step3MapperResult | StepError>
  step4: StepRunner<Step3MapperResult, Step4ProfileBuilderResult | StepError>
  step5: StepRunner<Step4ProfileBuilderResult, Step5FrontendReport | StepError>
}

export interface RangeNormalizer {
  normalizeMinuteRange: (range: MinuteRange) => MinuteRange[]
  normalizeRingRange: (range: RingRange) => RingRange
  normalizeFinding: <T extends RangeCarrier>(finding: T) => T[]
}

export interface IrisPipelineState extends StepPrereqContext {
  normalizer?: RangeNormalizer
  failedAt?: StepStage
  prompts?: {
    version?: string
    sources: Array<{ stage: StepStage; source: string; checksum: string }>
  }
}

export interface IrisPipelineOutcome {
  ok: boolean
  ctx: IrisPipelineState
}

export interface PipelineLogEntry {
  stage: StepStage | 'INIT'
  message: string
  details?: Record<string, unknown>
}

export type PipelineLogger = (entry: PipelineLogEntry) => void

export interface IrisPipelineOptions {
  prompts?: PipelinePromptCatalog
  logger?: PipelineLogger
}

const isError = (value: StepResult | undefined): value is StepError => Boolean(value && 'error' in value)

const prereqToError = (stage: StepStage, reason: string, blockingError?: StepError['error']): StepError => ({
  error: {
    stage,
    code: blockingError?.code ?? 'PRECONDITION_FAILED',
    message: reason,
    canRetry: true,
  },
})

const emitLog = (logger: PipelineLogger | undefined, entry: PipelineLogEntry) => {
  if (logger) logger(entry)
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const wrap = (value: number, total: number) => {
  const wrapped = value % total
  return wrapped < 0 ? wrapped + total : wrapped
}

export const createRangeNormalizer = (geo: GeoReference): RangeNormalizer => {
  const totalMinutes = geo.mins
  const maxRingIndex = geo.rings - 1

  const normalizeMinuteRange = (range: MinuteRange): MinuteRange[] => {
    const start = wrap(range[0], totalMinutes)
    const end = wrap(range[1], totalMinutes)
    if (start <= end) return [[start, end]]
    return [
      [start, totalMinutes - 1],
      [0, end],
    ]
  }

  const normalizeRingRange = (range: RingRange): RingRange => {
    const start = clamp(range[0], 0, maxRingIndex)
    const end = clamp(range[1], 0, maxRingIndex)
    return start <= end ? [start, end] : [end, start]
  }

  const normalizeFinding = <T extends RangeCarrier>(finding: T): T[] => {
    const ringRange = normalizeRingRange(finding.ringRange)
    return normalizeMinuteRange(finding.minuteRange).map((minuteRange) => ({
      ...finding,
      minuteRange,
      ringRange,
    }))
  }

  return {
    normalizeFinding,
    normalizeMinuteRange,
    normalizeRingRange,
  }
}

const storeStageResult = (ctx: IrisPipelineState, stage: StepStage, payload: StepResult | StepError) => {
  switch (stage) {
    case 'STEP1':
      ctx.geo = payload as Step1GeoCalibrationResult | StepError
      return
    case 'STEP2A':
      ctx.structural = payload as Step2AStructuralResult | StepError
      return
    case 'STEP2B':
      ctx.pigment = payload as Step2BPigmentResult | StepError
      return
    case 'STEP2C':
      ctx.cleaned = payload as Step2CConsistencyResult | StepError
      return
    case 'STEP3':
      ctx.mapping = payload as Step3MapperResult | StepError
      return
    case 'STEP4':
      ctx.profile = payload as Step4ProfileBuilderResult | StepError
      return
    case 'STEP5':
      ctx.report = payload as Step5FrontendReport | StepError
      return
    default:
      return
  }
}

const trackPromptUsage = (ctx: IrisPipelineState, stage: StepStage, prompts?: PipelinePromptCatalog) => {
  if (!ctx.prompts || !prompts) return
  const prompt = getPromptForStage(stage, prompts)
  if (prompt) {
    ctx.prompts.sources.push({
      stage,
      source: prompt.source,
      checksum: prompt.checksum,
    })
  }
}

const normalizeStep2A = (normalizer: RangeNormalizer, payload: Step2AStructuralResult): Step2AStructuralResult => ({
  ...payload,
  findings: payload.findings.flatMap((finding) => normalizer.normalizeFinding(finding)),
  excluded: payload.excluded.flatMap((region) => normalizer.normalizeFinding(region)),
})

const normalizeStep2B = (normalizer: RangeNormalizer, payload: Step2BPigmentResult): Step2BPigmentResult => ({
  ...payload,
  collarette: {
    ...payload.collarette,
    minuteRange: normalizer.normalizeMinuteRange(payload.collarette.minuteRange)[0] ?? payload.collarette.minuteRange,
    ringRange: normalizer.normalizeRingRange(payload.collarette.ringRange),
  },
  findings: payload.findings.flatMap((finding) => normalizer.normalizeFinding(finding)),
  excluded: payload.excluded.flatMap((region) => normalizer.normalizeFinding(region)),
})

interface StageRuntimeOptions {
  logger?: PipelineLogger
  promptCatalog?: PipelinePromptCatalog
}

const runStage = async <TInput, TOutput extends StepResult>(
  stage: StepStage,
  ctx: IrisPipelineState,
  runner: StepRunner<TInput, TOutput>,
  input: TInput,
  options: StageRuntimeOptions = {},
): Promise<TOutput | StepError> => {
  const { logger, promptCatalog } = options
  emitLog(logger, {
    stage,
    message: 'Starting stage execution',
    details: promptCatalog
      ? {
          promptSource: getPromptForStage(stage, promptCatalog)?.source,
          promptChecksum: getPromptForStage(stage, promptCatalog)?.checksum,
        }
      : undefined,
  })

  const prereq = validatePrerequisites(stage, ctx)
  if (!prereq.ok) {
    const error = prereqToError(stage, prereq.reason ?? 'Prerequisite failed', prereq.blockingError)
    storeStageResult(ctx, stage, error)
    ctx.failedAt = stage
    emitLog(logger, {
      stage,
      message: 'Stage blocked by prerequisites',
      details: { reason: prereq.reason, blockingError: prereq.blockingError },
    })
    return error
  }

  trackPromptUsage(ctx, stage, promptCatalog)

  const result = await runner(input)
  storeStageResult(ctx, stage, result)
  emitLog(logger, {
    stage,
    message: isError(result) ? 'Stage completed with error' : 'Stage completed',
    details: isError(result) ? result.error : undefined,
  })
  if (isError(result)) ctx.failedAt = stage
  return result
}

export const runIrisPipeline = async (
  steps: IrisPipelineSteps,
  options: IrisPipelineOptions = {},
): Promise<IrisPipelineOutcome> => {
  const { prompts, logger } = options
  const ctx: IrisPipelineState = prompts ? { prompts: { version: prompts.version, sources: [] } } : {}

  emitLog(logger, {
    stage: 'INIT',
    message: 'Launching iris pipeline',
    details: prompts ? { promptVersion: prompts.version } : undefined,
  })

  const geoResult = await runStage('STEP1', ctx, steps.step1, undefined as unknown as void, { logger, promptCatalog: prompts })
  if (isError(geoResult)) return { ok: false, ctx }

  const normalizer = createRangeNormalizer(geoResult.geo)
  ctx.normalizer = normalizer

  const structuralResult = await runStage('STEP2A', ctx, steps.step2A, geoResult, { logger, promptCatalog: prompts })
  if (isError(structuralResult)) return { ok: false, ctx }
  const normalizedStructural = normalizeStep2A(normalizer, structuralResult)
  ctx.structural = normalizedStructural

  const pigmentResult = await runStage('STEP2B', ctx, steps.step2B, geoResult, { logger, promptCatalog: prompts })
  if (isError(pigmentResult)) return { ok: false, ctx }
  const normalizedPigment = normalizeStep2B(normalizer, pigmentResult)
  ctx.pigment = normalizedPigment

  const step2CResult = await runStage(
    'STEP2C',
    ctx,
    steps.step2C,
    { structural: normalizedStructural, pigment: normalizedPigment, normalizer },
    { logger, promptCatalog: prompts },
  )
  if (isError(step2CResult)) return { ok: false, ctx }

  const step3Result = await runStage('STEP3', ctx, steps.step3, step2CResult, { logger, promptCatalog: prompts })
  if (isError(step3Result)) return { ok: false, ctx }

  const step4Result = await runStage('STEP4', ctx, steps.step4, step3Result, { logger, promptCatalog: prompts })
  if (isError(step4Result)) return { ok: false, ctx }

  const step5Result = await runStage('STEP5', ctx, steps.step5, step4Result, { logger, promptCatalog: prompts })
  if (isError(step5Result)) return { ok: false, ctx }

  emitLog(logger, { stage: 'INIT', message: 'Pipeline finished successfully' })

  return { ok: true, ctx }
}
