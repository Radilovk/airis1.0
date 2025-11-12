export interface QuestionnaireData {
  age: number
  gender: 'male' | 'female' | 'other'
  weight: number
  height: number
  goals: string[]
  complaints: string
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
  timestamp: string
  questionnaireData: QuestionnaireData
  leftIris: IrisAnalysis
  rightIris: IrisAnalysis
  leftIrisImage: IrisImage
  rightIrisImage: IrisImage
  recommendations: Recommendation[]
  summary: string
}

export interface AIModelConfig {
  provider: 'openai' | 'gemini'
  model: string
  apiKey: string
  useCustomKey: boolean
}

export interface IridologyTextbook {
  id: string
  name: string
  content: string
  uploadDate: string
  fileSize: number
}
