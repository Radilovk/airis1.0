export interface QuestionnaireData {
  name: string
  age: number
  gender: 'male' | 'female' | 'other'
  weight: number
  height: number
  goals: string[]
  medicalConditions: string
  familyHistory: string
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active'
  stressLevel: 'low' | 'moderate' | 'high' | 'very-high'
  sleepHours: number
  sleepQuality: 'poor' | 'fair' | 'good' | 'excellent'
  hydration: number
  dietaryProfile: string[]
  dietaryHabits: string[]
  foodIntolerances: string
  allergies: string
  medications: string
  complaints: string
  healthStatus: string[]
  uploadedDocuments?: UploadedDocument[]
  customAnswers?: Record<string, any>
}

export interface UploadedDocument {
  id: string
  name: string
  dataUrl: string
  type: string
  size: number
  uploadDate: string
}

export type QuestionType = 'text' | 'number' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'slider' | 'file'

export interface QuestionOption {
  value: string
  label: string
}

export interface QuestionConfig {
  id: string
  type: QuestionType
  question: string
  description?: string
  required: boolean
  options?: QuestionOption[]
  allowOther?: boolean
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
  conditionalOn?: {
    questionId: string
    value: any
  }
}

export interface QuestionnaireConfig {
  questions: QuestionConfig[]
  version: string
}

export interface IrisImage {
  dataUrl: string
  side: 'left' | 'right'
  /**
   * Измерената геометрия на ириса (зеница + лимбус) в пиксели на `dataUrl`.
   * Попълва се при качването (`iris-geometry.ts`) и може да бъде коригирана
   * ръчно от потребителя в калибратора. Целият координатен апарат надолу по
   * веригата стъпва върху нея.
   */
  geometry?: IrisGeometrySnapshot
  /** Оценката на качеството, направена при качването. */
  quality?: IrisQualitySnapshot
}

/** Сериализуемо копие на геометрията (виж `src/lib/iris-geometry.ts`). */
export interface IrisGeometrySnapshot {
  pupil: { cx: number; cy: number; r: number }
  limbus: { cx: number; cy: number; r: number; ry?: number }
  imageWidth: number
  imageHeight: number
  pupilConfidence: number
  limbusConfidence: number
  manual?: boolean
}

/** Сериализуемо копие на оценката за качество (виж `src/lib/iris-quality.ts`). */
export interface IrisQualitySnapshot {
  verdict: 'pass' | 'warn' | 'reject'
  score: number
  issueCodes: string[]
}

export interface IrisZone {
  id: number
  name: string
  organ: string
  status: 'normal' | 'attention' | 'concern'
  findings: string
  angle: [number, number]
  // New unwrap coordinate system (X = minute 0-60, Y = ring R0-R11)
  minute_start?: number
  minute_end?: number
  ring_start?: number
  ring_end?: number
}

export interface IrisAnalysis {
  side: 'left' | 'right'
  zones: IrisZone[]
  artifacts: Artifact[]
  overallHealth: number
  systemScores: SystemScore[]
}

export interface Artifact {
  type: string
  location: string
  description: string
  severity: 'low' | 'medium' | 'high'
  // New unwrap coordinate system fields (optional, backward compatible)
  clock_pos?: string
  minute?: number
  ring?: number
}

export interface SystemScore {
  system: string
  score: number
  description: string
}

export interface Recommendation {
  category: 'diet' | 'supplement' | 'lifestyle'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

export interface AnalysisReport {
  id: string
  timestamp: string
  questionnaireData: QuestionnaireData
  leftIris: IrisAnalysis
  rightIris: IrisAnalysis
  leftIrisImage: IrisImage
  rightIrisImage: IrisImage
  recommendations: Recommendation[]
  summary: string
  briefSummary: string
  detailedAnalysis: string
  motivationalSummary: string
  detailedPlan: {
    generalRecommendations: string[]
    recommendedFoods: string[]
    avoidFoods: string[]
    supplements: SupplementRecommendation[]
    psychologicalRecommendations: string[]
    specialRecommendations: string[]
    recommendedTests: string[]
  }
  // Multi-stream iris maps from the method1 backend (optional – only present when backend is available)
  leftIrisMaps?: IrisStreamMaps
  rightIrisMaps?: IrisStreamMaps
  /**
   * Детерминистичната част на анализа: измерените ленти, приетите находки,
   * системните оценки и хранителните драйвери. Присъства при анализи,
   * направени с калибрирания pipeline.
   */
  calibrated?: CalibratedAnalysisPayload
}

/** Резултатът от калибрирания анализ, запазен в отчета. */
export interface CalibratedAnalysisPayload {
  /** Средно качество на двете снимки, 0–100. */
  imageQuality: number
  /** Среден дял четима площ в лентите, 0–1. */
  stripCoverage: number
  /** Тежестта, с която ирисът е повлиял на оценките, 0–1. */
  irisWeight: number
  /** Приоритетен ред на системите (ключове). */
  focus: string[]
  systems: Array<{
    key: string
    label: string
    score: number
    priority: boolean
    description: string
    reasons: string[]
  }>
  drivers: Array<{
    id: string
    system: string
    strength: 'high' | 'medium' | 'low'
    observation: string
    action: string
    source: 'questionnaire' | 'iris' | 'both'
  }>
  findings: Array<{
    side: 'left' | 'right'
    type: string
    label: string
    sector: number
    ring: number
    size: string
    confidence: number
    priorityZones: string[]
    /** В колко от двата независими прочита се е появила находката (1 или 2). */
    confirmations?: number
    /** Потвърдена ли е и от другото око. */
    bilateral?: boolean
  }>
  /**
   * ПОВТОРЯЕМОСТ на разчитането, 0–1. Всяко око се разчита ДВА пъти — веднъж с
   * шев на 12:00 и веднъж с шев на 6:00. Двете ленти са физически идентични, но
   * визуално различни, и моделът не знае, че са едно и също око. Делът находки,
   * появили се и в двата прочита, е измерена увереност, за разлика от числото
   * `confidence`, което моделът обявява сам.
   */
  agreement?: number
  /** Брой находки, потвърдени и в двата прочита. */
  confirmedCount?: number
  /** Разгънатите ленти по око и слой (data URL). */
  strips?: {
    left?: Partial<Record<'base' | 'structure' | 'pigment', string>>
    right?: Partial<Record<'base' | 'structure' | 'pigment', string>>
  }
  constitution?: string
  /**
   * Видими физиологични огради (бременност, бъбречно състояние, автоимунен
   * тиреоидит и т.н.). Показват се в отчета и обясняват защо определени
   * съвети липсват или изглеждат различно.
   */
  notices?: Array<{ level: 'critical' | 'caution'; title: string; body: string }>
}

/** Three independent filtered views of the unwrapped iris image */
export interface IrisStreamMaps {
  /** Illumination-corrected base map – general overview */
  base: string
  /** Edge-preserving structure map – crypts, grooves, nerve rings */
  structure: string
  /** Chroma-isolation pigment map – toxic deposits, lymph stagnation */
  pigment: string
}

export interface SupplementRecommendation {
  name: string
  dosage: string
  timing: string
  notes?: string
}

export interface AIModelConfig {
  provider: 'openai' | 'gemini'
  model: string
  apiKey: string
  useCustomKey: boolean
  requestDelay?: number
  /** Брой заявки, използван само за оценка на прогреса. */
  requestCount?: number
  enableDiagnostics?: boolean  // Enable AI diagnostic pre-check before analysis
  /** Старият многоетапен v9 pipeline (наследен). */
  usePipelineV9?: boolean
  /**
   * Новият анализ с калибрирана лента (`src/lib/iris-pipeline.ts`).
   * По подразбиране включен — той е единственият, който измерва геометрията
   * в браузъра и затова единственият с надеждна локализация.
   */
  useCalibratedPipeline?: boolean
}

// Pipeline preset for saving/loading configurations
export interface PipelinePreset {
  id: string
  name: string
  description: string
  config: PipelineConfig
  createdAt: string
  updatedAt: string
}

export interface IridologyTextbook {
  id: string
  name: string
  content: string
  uploadDate: string
  fileSize: number
}

export interface CustomOverlay {
  dataUrl: string
  type: 'svg' | 'png'
  name: string
  uploadDate: string
}

export interface IridologyManual {
  content: string
  lastModified: string
}

export interface AIPromptTemplate {
  content: string
  lastModified: string
}

export interface AIModelStrategy {
  manualWeight: number
  promptWeight: number
  llmKnowledgeWeight: number
  webSearchWeight: number
  useWebSearch: boolean
  temperature: number
  maxTokens: number
  topP: number
  lastModified: string
}

// Pipeline Step configuration for admin management
export interface PipelineStepConfig {
  id: string
  name: string
  description: string
  order: number
  enabled: boolean
  prompt: string
  modelSettings: {
    provider: 'openai' | 'gemini'
    model: string
    temperature: number
    maxTokens: number
    topP: number
  }
  inputFrom: string | null  // Previous step ID or null for first step
  outputTo: string | null   // Next step ID or null for last step
  lastModified: string
}

export interface PipelineConfig {
  version: string
  steps: PipelineStepConfig[]
  lastModified: string
}

export interface GitHubAdminConfig {
  apiKey: string
  repoOwner: string
  repoName: string
  branch: string
  pipelinePath: string
}
