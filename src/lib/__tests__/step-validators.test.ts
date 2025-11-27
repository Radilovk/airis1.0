/// <reference types="vitest" />
import { describe, expect, it } from 'vitest'
import type {
  Step1GeoCalibrationResult,
  Step2AStructuralResult,
  Step2BPigmentResult,
  Step2CConsistencyResult,
  Step3MapperResult,
  Step4ProfileBuilderResult,
  StepError,
} from '@/types/iris-pipeline'
import { validatePrerequisites } from '../step-validators'

const geo: Step1GeoCalibrationResult = {
  imgId: 'img-1',
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
}

const structural: Step2AStructuralResult = {
  imgId: 'img-1',
  side: 'R',
  findings: [],
  excluded: [],
}

const pigment: Step2BPigmentResult = {
  imgId: 'img-1',
  side: 'R',
  global: { constitution: 'LYM', disposition: 'SILK', diathesis: [{ code: 'HAC', confidence: 0.8 }] },
  collarette: { ANW_status: 'normal', minuteRange: [0, 10], ringRange: [2, 3], confidence: 0.9 },
  findings: [],
  excluded: [],
}

const cleaned: Step2CConsistencyResult = {
  imgId: 'img-1',
  side: 'R',
  findings_struct_clean: [],
  findings_pigment_clean: [],
  collarette_clean: { ANW_status: 'normal', minuteRange: [0, 10], ringRange: [2, 3], confidence: 0.9 },
  global_clean: { constitution: 'LYM', disposition: 'SILK', diathesis: [{ code: 'HAC', confidence: 0.8 }] },
  dropped: [],
  warnings: [],
}

const mapping: Step3MapperResult = {
  imgId: 'img-1',
  side: 'R',
  mappedFindings: [],
  zoneSummary: [],
  unmapped: [],
  warnings: [],
}

const profile: Step4ProfileBuilderResult = {
  imgId: 'img-1',
  side: 'R',
  base: { constitution: 'LYM', disposition: 'SILK', diathesis: ['HAC'], ANW_status: 'normal' },
  axesScore: { stress0_100: 40, digestive0_100: 55, immune0_100: 60 },
  elimChannels: [],
  hypotheses: [],
  verificationQuestions: [],
}

describe('validatePrerequisites', () => {
  it('rejects missing geo context for early steps', () => {
    const status = validatePrerequisites('STEP2A', {})
    expect(status.ok).toBe(false)
    expect(status.reason).toContain('Missing geo')
  })

  it('propagates upstream errors', () => {
    const geoError: StepError = {
      error: { stage: 'STEP1', code: 'INVALID_IMAGE', message: 'blurred', canRetry: false },
    }
    const status = validatePrerequisites('STEP2C', { geo: geoError, structural, pigment })
    expect(status.ok).toBe(false)
    expect(status.blockingError?.stage).toBe('STEP1')
  })

  it('requires cleaned output before mapping', () => {
    const status = validatePrerequisites('STEP3', { geo, cleaned })
    expect(status.ok).toBe(true)
  })

  it('requires mapper output before profile builder and report', () => {
    const step4Status = validatePrerequisites('STEP4', { mapping })
    expect(step4Status.ok).toBe(true)

    const step5Status = validatePrerequisites('STEP5', { profile })
    expect(step5Status.ok).toBe(true)
  })
})
