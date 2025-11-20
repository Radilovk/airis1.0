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
}

export interface IrisZone {
  id: number
  name: string
  organ: string
  status: 'normal' | 'attention' | 'concern'
  findings: string
  angle: [number, number]
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
}

export interface SupplementRecommendation {
  name: string
  dosage: string
  timing: string
  notes?: string
}

export interface AIModelConfig {
  provider: 'openai' | 'gemini' | 'github-spark'
  model: string
  apiKey: string
  useCustomKey: boolean
  requestDelay?: number
  requestCount?: number
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

export interface ReportModuleComment {
  id: string
  moduleId: string
  containerId?: string
  text: string
  timestamp: string
  resolved: boolean
  author?: string
}

export interface ReportContainer {
  id: string
  moduleId: string
  type: 'card' | 'chart' | 'list' | 'text' | 'image' | 'collapsible' | 'custom'
  title: string
  visible: boolean
  order: number
  comments: ReportModuleComment[]
  interactive: boolean
  metadata?: {
    icon?: string
    priority?: 'high' | 'medium' | 'low'
    chartType?: string
    dataKey?: string
    [key: string]: any
  }
}

export interface ReportModule {
  id: string
  type: 'overview' | 'iridology' | 'plan' | 'custom'
  title: string
  visible: boolean
  order: number
  comments: ReportModuleComment[]
  containers: ReportContainer[]
}

export interface EditorModeConfig {
  enabled: boolean
  moduleOrder: ReportModule[]
  lastModified: string
  showContainerBorders?: boolean
  showContainerLabels?: boolean
}
