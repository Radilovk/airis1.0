import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Target, 
  TrendUp, 
  TrendDown,
  CheckCircle,
  XCircle,
  Activity,
  Heart,
  Brain,
  Drop,
  Moon,
  Lightning,
  Barbell,
  CaretDown
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import SystemScoresChart from '../SystemScoresChart'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { EditableCard } from '../withCardEditor'

interface OverviewTabWithEditorProps {
  report: AnalysisReport
  avgHealth: number
  editorMode?: boolean
}

function calculateGoalAchievability(report: AnalysisReport) {
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  const concernZones = [...(report.leftIris?.zones || []), ...(report.rightIris?.zones || [])]
    .filter(z => z?.status === 'concern').length
  
  let score = avgHealth
  
  if (concernZones > 8) score = Math.max(20, score - 30)
  else if (concernZones > 5) score = Math.max(30, score - 20)
  else if (concernZones > 3) score = Math.max(40, score - 10)
  
  if (report.questionnaireData.stressLevel === 'very-high') score = Math.max(30, score - 15)
  else if (report.questionnaireData.stressLevel === 'high') score = Math.max(40, score - 10)
  
  if (report.questionnaireData.sleepHours < 6) score = Math.max(35, score - 15)
  else if (report.questionnaireData.sleepHours < 7) score = Math.max(45, score - 10)
  
  if (report.questionnaireData.activityLevel === 'sedentary') score = Math.max(40, score - 10)
  
  return Math.min(95, Math.max(25, score))
}

function getSupportingFactors(report: AnalysisReport) {
  const factors: string[] = []
  
  if (report.questionnaireData.sleepHours >= 7 && report.questionnaireData.sleepHours <= 9) {
    factors.push('Добър сън')
  }
  if (report.questionnaireData.hydration >= 8) {
    factors.push('Добра хидратация')
  }
  if (report.questionnaireData.stressLevel === 'low' || report.questionnaireData.stressLevel === 'moderate') {
    factors.push('Управляем стрес')
  }
  if (report.questionnaireData.activityLevel === 'active' || report.questionnaireData.activityLevel === 'very-active' || report.questionnaireData.activityLevel === 'moderate') {
    factors.push('Редовна физическа активност')
  }
  if (report.questionnaireData.dietaryProfile.includes('balanced') || report.questionnaireData.dietaryProfile.includes('mediterranean')) {
    factors.push('Балансирана диета')
  }
  
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  if (avgHealth >= 70) {
    factors.push('Добро общо състояние')
  }
  
  return factors.length > 0 ? factors : ['Мотивация за подобрение']
}

function getLimitingFactors(report: AnalysisReport) {
  const factors: string[] = []
  
  const concernZones = [...(report.leftIris?.zones || []), ...(report.rightIris?.zones || [])]
    .filter(z => z?.status === 'concern').length
  
  if (concernZones > 5) {
    factors.push(`${concernZones} зони изискват внимание`)
  }
  
  if (report.questionnaireData.stressLevel === 'high' || report.questionnaireData.stressLevel === 'very-high') {
    factors.push('Висок стрес')
  }
  
  if (report.questionnaireData.sleepHours < 7) {
    factors.push('Недостатъчен сън')
  }
  
  if (report.questionnaireData.activityLevel === 'sedentary') {
    factors.push('Ниска физическа активност')
  }
  
  if (report.questionnaireData.hydration < 6) {
    factors.push('Ниска хидратация')
  }
  
  if (report.questionnaireData.medicalConditions && report.questionnaireData.medicalConditions.trim()) {
    factors.push('Съществуващи здравословни състояния')
  }
  
  return factors.length > 0 ? factors : ['Няма значителни ограничения']
}

export default function OverviewTabWithEditor({ report, avgHealth, editorMode = false }: OverviewTabWithEditorProps) {
  const [expandedBio, setExpandedBio] = useState(true)
  const [expandedLifestyle, setExpandedLifestyle] = useState(true)
  const [expandedGoalAnalysis, setExpandedGoalAnalysis] = useState(true)
  
  const goalAchievability = calculateGoalAchievability(report)
  const supportingFactors = getSupportingFactors(report)
  const limitingFactors = getLimitingFactors(report)
  
  const getSleepQualityLabel = (quality: string) => {
    const labels: Record<string, string> = {
      'poor': 'Лошо',
      'fair': 'Средно',
      'good': 'Добро',
      'excellent': 'Отлично'
    }
    return labels[quality] || quality
  }

  const getLifestyleMetrics = () => {
    const sleepHours = report.questionnaireData.sleepHours
    const sleepQuality = report.questionnaireData.sleepQuality
    
    let sleepScore: 'good' | 'needs-attention' = 'good'
    let sleepQualityText = getSleepQualityLabel(sleepQuality)
    
    if (sleepHours < 6) {
      sleepScore = 'needs-attention'
      sleepQualityText = 'Недостатъчен'
    } else if (sleepHours < 7) {
      sleepScore = 'needs-attention'
      sleepQualityText = sleepQuality === 'excellent' || sleepQuality === 'good' ? 'Под оптималното' : sleepQualityText
    } else if (sleepHours >= 7 && sleepHours <= 9) {
      sleepScore = 'good'
    } else if (sleepHours > 9) {
      sleepScore = 'needs-attention'
      sleepQualityText = 'Прекомерен'
    }
    
    if (sleepQuality === 'poor' || sleepQuality === 'fair') {
      sleepScore = 'needs-attention'
      if (sleepHours >= 7 && sleepHours <= 9) {
        sleepQualityText = getSleepQualityLabel(sleepQuality)
      }
    }
    
    const metrics = [
      {
        icon: Moon,
        label: 'Сън',
        value: `${sleepHours}ч`,
        quality: sleepQualityText,
        score: sleepScore
      },
      {
        icon: Drop,
        label: 'Хидратация',
        value: `${report.questionnaireData.hydration} чаши`,
        quality: report.questionnaireData.hydration >= 8 ? 'добра' : 'недостатъчна',
        score: report.questionnaireData.hydration >= 8 ? 'good' : 'needs-attention'
      },
      {
        icon: Lightning,
        label: 'Стрес',
        value: report.questionnaireData.stressLevel === 'low' ? 'Нисък' : report.questionnaireData.stressLevel === 'moderate' ? 'Умерен' : 'Висок',
        quality: '',
        score: report.questionnaireData.stressLevel === 'low' || report.questionnaireData.stressLevel === 'moderate' ? 'good' : 'needs-attention'
      },
      {
        icon: Barbell,
        label: 'Активност',
        value: report.questionnaireData.activityLevel === 'sedentary' ? 'Седяща' : report.questionnaireData.activityLevel === 'moderate' ? 'Умерена' : 'Активна',
        quality: '',
        score: report.questionnaireData.activityLevel === 'sedentary' ? 'needs-attention' : 'good'
      },
    ]

    return metrics
  }

  const lifestyleMetrics = getLifestyleMetrics()

  return (
    <div className="space-y-6">
      <EditableCard cardId="overview-health-score" editorMode={editorMode}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Activity size={24} weight="duotone" className="text-primary" />
                </div>
                Общ Здравен Резултат
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Конституционна оценка въз основа на иридологичен анализ
              </p>
            </div>
            <Badge 
              variant="outline" 
              className={
                avgHealth >= 80 ? 'bg-green-50 text-green-700 border-green-200' :
                avgHealth >= 60 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                avgHealth >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200'
              }
            >
              {avgHealth >= 80 ? 'Отлично' : avgHealth >= 60 ? 'Добро' : avgHealth >= 40 ? 'Умерено' : 'Изисква внимание'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl font-bold">{avgHealth}%</span>
                <span className="text-sm text-muted-foreground">от оптимално</span>
              </div>
              <Progress value={avgHealth} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Heart size={16} weight="duotone" />
                  <span>Ляво око</span>
                </div>
                <div className="text-2xl font-semibold">{report.leftIris.overallHealth}%</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Brain size={16} weight="duotone" />
                  <span>Дясно око</span>
                </div>
                <div className="text-2xl font-semibold">{report.rightIris.overallHealth}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </EditableCard>

      <EditableCard cardId="overview-biometric" editorMode={editorMode}>
        <Collapsible open={expandedBio} onOpenChange={setExpandedBio}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Биометрични Данни</CardTitle>
                <CaretDown
                  size={20}
                  className={`transition-transform ${expandedBio ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Възраст</p>
                <p className="text-xl font-semibold">{report.questionnaireData.age} год.</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Пол</p>
                <p className="text-xl font-semibold">{report.questionnaireData.gender === 'male' ? 'Мъж' : 'Жена'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Тегло</p>
                <p className="text-xl font-semibold">{report.questionnaireData.weight} кг</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ръст</p>
                <p className="text-xl font-semibold">{report.questionnaireData.height} см</p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </EditableCard>

      <EditableCard cardId="overview-lifestyle" editorMode={editorMode}>
        <Collapsible open={expandedLifestyle} onOpenChange={setExpandedLifestyle}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Target size={20} weight="duotone" className="text-accent" />
                  </div>
                  Начин на Живот
                </CardTitle>
                <CaretDown
                  size={20}
                  className={`transition-transform ${expandedLifestyle ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {lifestyleMetrics.map((metric, index) => {
                  const Icon = metric.icon
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-xl bg-muted/30"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        metric.score === 'good' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        <Icon size={24} weight="duotone" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-muted-foreground">{metric.label}</p>
                        <p className="text-lg font-semibold mt-1">{metric.value}</p>
                        {metric.quality && (
                          <p className={`text-xs mt-1 ${
                            metric.score === 'good' ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {metric.quality}
                          </p>
                        )}
                      </div>
                      {metric.score === 'good' ? (
                        <CheckCircle size={20} weight="fill" className="text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle size={20} weight="fill" className="text-amber-600 flex-shrink-0" />
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </EditableCard>

      <EditableCard cardId="overview-goal-analysis" editorMode={editorMode}>
        <Collapsible open={expandedGoalAnalysis} onOpenChange={setExpandedGoalAnalysis}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target size={20} weight="duotone" className="text-primary" />
                  </div>
                  Анализ на Постижимост на Цели
                </CardTitle>
                <CaretDown
                  size={20}
                  className={`transition-transform ${expandedGoalAnalysis ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Текуща постижимост</span>
                  <span className="text-2xl font-bold">{goalAchievability}%</span>
                </div>
                <Progress value={goalAchievability} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {goalAchievability >= 70 ? 'Високи шансове за постигане на здравословните цели' :
                   goalAchievability >= 50 ? 'Умерени шансове - необходими целенасочени усилия' :
                   'Предизвикателно - препоръчва се поетапен подход'}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendUp size={20} weight="duotone" className="text-green-600" />
                    <h4 className="font-semibold text-sm">Подкрепящи Фактори</h4>
                  </div>
                  <ul className="space-y-2">
                    {supportingFactors.map((factor, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle size={16} weight="fill" className="text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendDown size={20} weight="duotone" className="text-amber-600" />
                    <h4 className="font-semibold text-sm">Ограничаващи Фактори</h4>
                  </div>
                  <ul className="space-y-2">
                    {limitingFactors.map((factor, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <XCircle size={16} weight="fill" className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </EditableCard>

      <EditableCard cardId="overview-system-scores" editorMode={editorMode}>
        <CardHeader>
          <CardTitle className="text-lg">Резултати по Системи</CardTitle>
        </CardHeader>
        <CardContent>
          <SystemScoresChart 
            leftScores={report.leftIris?.systemScores || []} 
            rightScores={report.rightIris?.systemScores || []} 
          />
        </CardContent>
      </EditableCard>
    </div>
  )
}
