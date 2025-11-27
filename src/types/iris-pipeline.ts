export type StepStage = 'STEP1' | 'STEP2A' | 'STEP2B' | 'STEP2C' | 'STEP3' | 'STEP4' | 'STEP5'
export type IrisSide = 'R' | 'L'
export type MinuteRange = [number, number]
export type RingRange = [number, number]

export interface StepError {
  error: {
    stage: StepStage
    code: string
    message: string
    canRetry: boolean
  }
}

export interface QualityAssessment {
  score0_100: number
  focus: 'good' | 'med' | 'poor'
  glare: 'none' | 'low' | 'med' | 'high'
  occlusion: 'none' | 'low' | 'med' | 'high'
  issues: string[]
}

export interface RingGroups {
  IPB: MinuteRange
  STOM: MinuteRange
  ANW: MinuteRange
  ORG: MinuteRange
  LYM: MinuteRange
  SCU: MinuteRange
}

export interface GeoReference {
  mins: 60
  rings: 12
  degPerMin: 6
  refMinute: 15
  ringGroups: RingGroups
}

export interface InvalidRegion {
  type: 'specular'
  minuteRange: MinuteRange
  ringRange: RingRange
  confidence: number
}

export interface Step1GeoCalibrationResult {
  imgId: string
  side: IrisSide
  ok: boolean
  rejectReasons: string[]
  quality: QualityAssessment
  geo: GeoReference
  refRay15Usable: boolean
  usableUpperIris: boolean
  invalidRegions: InvalidRegion[]
}

export type StructuralFindingType =
  | 'lacuna'
  | 'crypt'
  | 'giant_lacuna'
  | 'atrophic_area'
  | 'collarette_defect_lesion'
  | 'radial_furrow'
  | 'deep_radial_cleft'
  | 'transversal_fiber'
  | 'structural_asymmetry'

export interface StructuralFinding {
  type: StructuralFindingType
  minuteRange: MinuteRange
  ringRange: RingRange
  size: 'xs' | 's' | 'm' | 'l'
  notes: string
  confidence: number
}

export interface ExcludedRegion {
  type: 'specular'
  minuteRange: MinuteRange
  ringRange: RingRange
}

export interface Step2AStructuralResult {
  imgId: string
  side: IrisSide
  findings: StructuralFinding[]
  excluded: ExcludedRegion[]
}

export type Constitution = 'LYM' | 'HEM' | 'BIL' | 'unclear'
export type Disposition = 'SILK' | 'LINEN' | 'BURLAP' | 'unclear'
export type DiathesisCode = 'HAC' | 'LRS' | 'LIP' | 'DYS'

export interface GlobalDisposition {
  constitution: Constitution
  disposition: Disposition
  diathesis: Array<{ code: DiathesisCode; confidence: number }>
}

export interface CollaretteStatus {
  ANW_status: 'expanded' | 'contracted' | 'broken' | 'normal' | 'unclear'
  minuteRange: MinuteRange
  ringRange: RingRange
  confidence: number
}

export type PigmentFindingType =
  | 'pigment_spot'
  | 'pigment_cloud'
  | 'pigment_band'
  | 'brushfield_like_spots'
  | 'nerve_rings'
  | 'lymphatic_rosary'
  | 'scurf_rim'
  | 'sodium_ring'

export interface PigmentFinding {
  type: PigmentFindingType
  subtype?: 'orange_rust' | 'brown_black' | 'yellow' | 'other'
  minuteRange: MinuteRange
  ringRange: RingRange
  severity: 'low' | 'medium' | 'high'
  notes: string
  confidence: number
}

export interface Step2BPigmentResult {
  imgId: string
  side: IrisSide
  global: GlobalDisposition
  collarette: CollaretteStatus
  findings: PigmentFinding[]
  excluded: ExcludedRegion[]
}

export interface DroppedFindingReason {
  type: string
  reason: 'contradiction' | 'specular' | 'too_wide' | 'low_confidence' | 'duplicate'
}

export interface Step2CConsistencyResult {
  imgId: string
  side: IrisSide
  findings_struct_clean: StructuralFinding[]
  findings_pigment_clean: PigmentFinding[]
  collarette_clean: CollaretteStatus
  global_clean: GlobalDisposition
  dropped: DroppedFindingReason[]
  warnings: string[]
}

export interface ZoneMapping {
  id: string
  baseId: string
  organ_bg: string
  system_bg: string
}

export interface MappedFinding {
  fid: string
  type: string
  minuteRange: MinuteRange
  ringRange: RingRange
  confidence: number
  zone: ZoneMapping
  mapped: boolean
}

export interface ZoneSummary {
  zoneId: string
  organ_bg: string
  system_bg: string
  evidenceCount: number
  topTypes: string[]
}

export interface UnmappedFinding {
  fid: string
  type: string
  reason: string
}

export interface Step3MapperResult {
  imgId: string
  side: IrisSide
  mappedFindings: MappedFinding[]
  zoneSummary: ZoneSummary[]
  unmapped: UnmappedFinding[]
  warnings: string[]
}

export interface ProfileBase {
  constitution: Constitution
  disposition: Disposition
  diathesis: DiathesisCode[]
  ANW_status: CollaretteStatus['ANW_status']
}

export interface EliminationChannelEvidence {
  fid: string
  zoneId: string
}

export interface EliminationChannelStatus {
  channel: 'gut_ANW' | 'kidney_6' | 'lymph' | 'skin_scu'
  status: 'normal' | 'attention' | 'concern'
  evidence: EliminationChannelEvidence[]
}

export interface HypothesisEvidence {
  fid: string
  zoneId: string
}

export interface Hypothesis {
  title: string
  claim: string
  evidence: HypothesisEvidence[]
  confidence0_1: number
  applicability: string
}

export interface AxesScore {
  stress0_100: number
  digestive0_100: number
  immune0_100: number
}

export interface Step4ProfileBuilderResult {
  imgId: string
  side: IrisSide
  base: ProfileBase
  axesScore: AxesScore
  elimChannels: EliminationChannelStatus[]
  hypotheses: Hypothesis[]
  verificationQuestions: string[]
}

export interface FrontendZone {
  id: number
  name: string
  organ: string
  status: 'normal' | 'attention' | 'concern'
  findings: string
  angle: [number, number]
}

export interface FrontendArtifact {
  type: string
  location: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface FrontendSystemScore {
  system: string
  score: number
  description: string
}

export interface FrontendAnalysis {
  zones: FrontendZone[]
  artifacts: FrontendArtifact[]
  overallHealth: number
  systemScores: FrontendSystemScore[]
}

export interface FrontendAdvice {
  priorities: string[]
  nutrition: { focus: string[]; limit: string[] }
  lifestyle: { sleep: string[]; stress: string[]; activity: string[] }
  followUp: string[]
}

export interface Step5FrontendReport {
  analysis: FrontendAnalysis
  advice: FrontendAdvice
}

export type StepResult =
  | Step1GeoCalibrationResult
  | Step2AStructuralResult
  | Step2BPigmentResult
  | Step2CConsistencyResult
  | Step3MapperResult
  | Step4ProfileBuilderResult
  | Step5FrontendReport
  | StepError

