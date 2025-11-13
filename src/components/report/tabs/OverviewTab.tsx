import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Target, 
  TrendUp, 
  TrendDown,
  CheckCircle,
  XCircle,
  Activity
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import SystemScoresChart from '../SystemScoresChart'

interface OverviewTabProps {
  report: AnalysisReport
  avgHealth: number
}

export default function OverviewTab({ report, avgHealth }: OverviewTabProps) {
  const goalAchievability = calculateGoalAchievability(report)
  const supportingFactors = getSupportingFactors(report)
  const limitingFactors = getLimitingFactors(report)

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Target size={20} weight="duotone" className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base mb-1">Вашите Цели</h3>
              <div className="flex flex-wrap gap-1.5">
                {report.questionnaireData.goals.map((goal, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="p-5">
          <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
            <Activity size={18} weight="duotone" className="text-primary" />
            Общо Състояние
          </h3>
          
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - avgHealth / 100)}`}
                    className="text-primary transition-all duration-1000"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{avgHealth}</span>
                  <span className="text-xs text-muted-foreground">от 100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {avgHealth >= 80 ? 'Отлично здраве' : avgHealth >= 60 ? 'Добро здраве' : avgHealth >= 40 ? 'Умерено здраве' : 'Нужда от внимание'}
              </p>
            </div>

            <div className="prose prose-sm max-w-none">
              {report.briefSummary ? (
                <div className="space-y-2">
                  {report.briefSummary.split('\n').filter(line => line.trim()).map((point, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <p className="text-sm leading-relaxed text-foreground/90">{point.replace(/^•\s*/, '')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {report.summary.substring(0, 300)}...
                </p>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card className="p-5">
          <h3 className="font-semibold text-base mb-4">Оценка на Органни Системи</h3>
          <SystemScoresChart 
            leftScores={report.leftIris.systemScores}
            rightScores={report.rightIris.systemScores}
          />
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <Card className="p-5">
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Target size={18} weight="duotone" className="text-primary" />
            Постижимост на Целите
          </h3>
          
          <div className="space-y-3">
            {report.questionnaireData.goals.map((goal, idx) => {
              const achievability = goalAchievability[goal] || 70
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal}</span>
                    <span className="text-xs text-muted-foreground">{achievability}%</span>
                  </div>
                  <Progress value={achievability} className="h-2" />
                </div>
              )
            })}
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <Card className="p-5">
          <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
            <TrendUp size={18} weight="duotone" className="text-green-600" />
            Подкрепящи Фактори
          </h3>
          <div className="space-y-2">
            {supportingFactors.map((factor, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 border border-green-100">
                <CheckCircle size={18} weight="fill" className="text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-green-900">{factor}</span>
              </div>
            ))}
            {supportingFactors.length === 0 && (
              <p className="text-sm text-muted-foreground">Няма идентифицирани подкрепящи фактори</p>
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        <Card className="p-5">
          <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
            <TrendDown size={18} weight="duotone" className="text-red-600" />
            Ограничаващи Фактори
          </h3>
          <div className="space-y-2">
            {limitingFactors.map((factor, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
                <XCircle size={18} weight="fill" className="text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-900">{factor}</span>
              </div>
            ))}
            {limitingFactors.length === 0 && (
              <p className="text-sm text-muted-foreground">Няма идентифицирани ограничаващи фактори</p>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

function calculateGoalAchievability(report: AnalysisReport): Record<string, number> {
  const avgHealth = (report.leftIris.overallHealth + report.rightIris.overallHealth) / 2
  const achievability: Record<string, number> = {}

  report.questionnaireData.goals.forEach(goal => {
    let score = avgHealth

    if (goal.toLowerCase().includes('отслабване')) {
      if (report.questionnaireData.activityLevel === 'very-active' || report.questionnaireData.activityLevel === 'active') {
        score += 10
      }
      if (report.questionnaireData.stressLevel === 'low' || report.questionnaireData.stressLevel === 'moderate') {
        score += 5
      }
    }
    
    if (goal.toLowerCase().includes('здраве')) {
      if (report.questionnaireData.sleepQuality === 'excellent' || report.questionnaireData.sleepQuality === 'good') {
        score += 10
      }
      if (report.questionnaireData.hydration >= 2) {
        score += 5
      }
    }

    if (goal.toLowerCase().includes('антиейджинг')) {
      if (report.questionnaireData.stressLevel === 'low') {
        score += 10
      }
      if (report.questionnaireData.sleepHours >= 7) {
        score += 5
      }
    }

    achievability[goal] = Math.min(100, Math.max(0, Math.round(score)))
  })

  return achievability
}

function getSupportingFactors(report: AnalysisReport): string[] {
  const factors: string[] = []

  if (report.questionnaireData.sleepHours >= 7 && report.questionnaireData.sleepQuality === 'good' || report.questionnaireData.sleepQuality === 'excellent') {
    factors.push('Добро качество на съня')
  }

  if (report.questionnaireData.hydration >= 2) {
    factors.push('Адекватна хидратация')
  }

  if (report.questionnaireData.activityLevel === 'active' || report.questionnaireData.activityLevel === 'very-active') {
    factors.push('Висока физическа активност')
  }

  if (report.questionnaireData.stressLevel === 'low' || report.questionnaireData.stressLevel === 'moderate') {
    factors.push('Управляем стрес')
  }

  const avgHealth = (report.leftIris.overallHealth + report.rightIris.overallHealth) / 2
  if (avgHealth >= 70) {
    factors.push('Добро базово здравословно състояние')
  }

  if (report.questionnaireData.dietaryProfile.includes('Вегетариански') || report.questionnaireData.dietaryProfile.includes('Балансирана диета')) {
    factors.push('Здравословен хранителен профил')
  }

  return factors
}

function getLimitingFactors(report: AnalysisReport): string[] {
  const factors: string[] = []

  if (report.questionnaireData.sleepHours < 6 || report.questionnaireData.sleepQuality === 'poor') {
    factors.push('Недостатъчен или лошо качество сън')
  }

  if (report.questionnaireData.hydration < 1.5) {
    factors.push('Недостатъчна хидратация')
  }

  if (report.questionnaireData.activityLevel === 'sedentary') {
    factors.push('Ниска физическа активност')
  }

  if (report.questionnaireData.stressLevel === 'high' || report.questionnaireData.stressLevel === 'very-high') {
    factors.push('Висок стрес')
  }

  const concernZones = report.leftIris.zones.filter(z => z.status === 'concern').length + 
                       report.rightIris.zones.filter(z => z.status === 'concern').length
  if (concernZones > 3) {
    factors.push(`${concernZones} зони с притеснения в ириса`)
  }

  if (report.questionnaireData.dietaryHabits.includes('Бърза храна') || report.questionnaireData.dietaryHabits.includes('Много сладки храни')) {
    factors.push('Нездравословни хранителни навици')
  }

  if (report.questionnaireData.medications && report.questionnaireData.medications.trim() !== '') {
    factors.push('Текущ прием на медикаменти')
  }

  return factors
}
