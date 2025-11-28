import step1 from '../../steps/STEP1_geo_calibration.txt?raw'
import step2A from '../../steps/STEP2A_structural_detector.txt?raw'
import step2B from '../../steps/STEP2B_pigment_rings_detector.txt?raw'
import step2C from '../../steps/STEP2C_consistency_validator.txt?raw'
import step3 from '../../steps/STEP3_mapper_v9.txt?raw'
import step4 from '../../steps/STEP4_profile_builder.txt?raw'
import step5 from '../../steps/STEP5_frontend_report_bg.txt?raw'
import { type StepStage } from '@/types/iris-pipeline'

export interface PipelinePrompt {
  stage: StepStage
  title: string
  source: string
  body: string
  checksum: string
}

export interface PipelinePromptCatalog {
  version: string
  prompts: Record<StepStage, PipelinePrompt>
}

const simpleChecksum = (value: string): string => {
  let acc = 0
  for (let i = 0; i < value.length; i++) {
    acc = (acc + value.charCodeAt(i) * (i + 1)) % 0xffffffff
  }
  return acc.toString(16)
}

const buildPrompt = (stage: StepStage, title: string, source: string, body: string): PipelinePrompt => ({
  stage,
  title,
  source,
  body,
  checksum: simpleChecksum(body),
})

export const pipelinePromptCatalog: PipelinePromptCatalog = {
  version: 'v9-final',
  prompts: {
    STEP1: buildPrompt('STEP1', 'Geo calibration', 'steps/STEP1_geo_calibration.txt', step1),
    STEP2A: buildPrompt('STEP2A', 'Structural detector', 'steps/STEP2A_structural_detector.txt', step2A),
    STEP2B: buildPrompt('STEP2B', 'Pigment + rings detector', 'steps/STEP2B_pigment_rings_detector.txt', step2B),
    STEP2C: buildPrompt('STEP2C', 'Consistency validator', 'steps/STEP2C_consistency_validator.txt', step2C),
    STEP3: buildPrompt('STEP3', 'Mapper', 'steps/STEP3_mapper_v9.txt', step3),
    STEP4: buildPrompt('STEP4', 'Profile builder', 'steps/STEP4_profile_builder.txt', step4),
    STEP5: buildPrompt('STEP5', 'Frontend report', 'steps/STEP5_frontend_report_bg.txt', step5),
  },
}

export const getPromptForStage = (stage: StepStage, catalog: PipelinePromptCatalog = pipelinePromptCatalog) =>
  catalog.prompts[stage]

export const getPromptSummaries = (catalog: PipelinePromptCatalog = pipelinePromptCatalog) =>
  Object.values(catalog.prompts).map(({ stage, source, checksum }) => ({
    stage,
    source,
    checksum,
    version: catalog.version,
  }))
