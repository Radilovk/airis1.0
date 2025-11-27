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
} from '../types/iris-pipeline'

export interface PrereqStatus {
  ok: boolean
  stage?: StepStage
  reason?: string
  blockingError?: StepError['error']
}

export interface StepPrereqContext {
  geo?: Step1GeoCalibrationResult | StepError
  structural?: Step2AStructuralResult | StepError
  pigment?: Step2BPigmentResult | StepError
  cleaned?: Step2CConsistencyResult | StepError
  mapping?: Step3MapperResult | StepError
  profile?: Step4ProfileBuilderResult | StepError
  report?: Step5FrontendReport | StepError
}

const hasError = (value?: StepResult | undefined): value is StepError =>
  Boolean(value && typeof value === 'object' && 'error' in value)

const fail = (stage: StepStage, reason: string, blockingError?: StepError['error']): PrereqStatus => ({
  ok: false,
  stage,
  reason,
  blockingError,
})

const ensureGeoReady = (geo: Step1GeoCalibrationResult | StepError | undefined, stage: StepStage): PrereqStatus => {
  if (!geo) return fail(stage, 'Missing geo calibration payload')
  if (hasError(geo)) return fail(stage, 'Upstream error detected', geo.error)
  if (!geo.ok) return fail(stage, 'geo.ok must be true before continuing')
  return { ok: true }
}

const ensureNoError = (payload: StepResult | undefined, stage: StepStage, missingMessage: string): PrereqStatus => {
  if (!payload) return fail(stage, missingMessage)
  if (hasError(payload)) return fail(stage, 'Upstream error detected', payload.error)
  return { ok: true }
}

export const validatePrerequisites = (stage: StepStage, ctx: StepPrereqContext): PrereqStatus => {
  switch (stage) {
    case 'STEP1':
      return { ok: true }
    case 'STEP2A':
    case 'STEP2B':
      return ensureGeoReady(ctx.geo, stage)
    case 'STEP2C': {
      const geoGate = ensureGeoReady(ctx.geo, stage)
      if (!geoGate.ok) return geoGate
      const structGate = ensureNoError(ctx.structural, stage, 'Structural findings are required before STEP2C')
      if (!structGate.ok) return structGate
      const pigmentGate = ensureNoError(ctx.pigment, stage, 'Pigment findings are required before STEP2C')
      if (!pigmentGate.ok) return pigmentGate
      return { ok: true }
    }
    case 'STEP3': {
      const geoGate = ensureGeoReady(ctx.geo, stage)
      if (!geoGate.ok) return geoGate
      const cleanedGate = ensureNoError(ctx.cleaned, stage, 'Cleaned findings are required before STEP3')
      if (!cleanedGate.ok) return cleanedGate
      return { ok: true }
    }
    case 'STEP4': {
      const mappingGate = ensureNoError(ctx.mapping, stage, 'Mapper output is required before STEP4')
      if (!mappingGate.ok) return mappingGate
      return { ok: true }
    }
    case 'STEP5': {
      const profileGate = ensureNoError(ctx.profile, stage, 'Profile builder output is required before STEP5')
      if (!profileGate.ok) return profileGate
      return { ok: true }
    }
    default:
      return fail(stage, 'Unknown stage')
  }
}

export const canRunStage = (stage: StepStage, ctx: StepPrereqContext): boolean => validatePrerequisites(stage, ctx).ok

export const examplePipelineGuard = () =>
  canRunStage('STEP2A', {
    geo: {
      imgId: 'hash123',
      side: 'R',
      ok: true,
      rejectReasons: [],
      quality: { score0_100: 95, focus: 'good', glare: 'none', occlusion: 'low', issues: [] },
      geo: {
        mins: 60,
        rings: 12,
        degPerMin: 6,
        refMinute: 15,
        ringGroups: { IPB: [0, 0], STOM: [1, 1], ANW: [2, 3], ORG: [4, 9], LYM: [10, 10], SCU: [11, 11] },
      },
      refRay15Usable: true,
      usableUpperIris: true,
      invalidRegions: [],
    },
  })
