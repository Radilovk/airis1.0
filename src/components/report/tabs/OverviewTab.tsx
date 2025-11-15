import { Card } from '@/components/ui/card'
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
  Barbell
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import SystemScoresChart from '../SystemScoresChart'
import HealthProgressChart from '../HealthProgressChart'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useState } from 'react'

interface OverviewTabProps {
  report: AnalysisReport
  avgHealth: number
}

export default function OverviewTab({ report, avgHealth }: OverviewTabProps) {
  const goalAchievability = calculateGoalAchievability(report)
  const supportingFactors = getSupportingFactors(report)
  const limitingFactors = getLimitingFactors(report)
  const [expandedBio, setExpandedBio] = useState(false)
  
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
    const sleepScore = report.questionnaireData.sleepHours >= 7 && 
                       report.questionnaireData.sleepHours <= 9 && 
                       (report.questionnaireData.sleepQuality === 'good' || 
                        report.questionnaireData.sleepQuality === 'excellent')
    
    const metrics = [
      {
        icon: Moon,
        label: 'Сън',
        value: `${report.questionnaireData.sleepHours}ч`,
        quality: getSleepQualityLabel(report.questionnaireData.sleepQuality),
        score: sleepScore ? 'good' : 'needs-attention'
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
        value: report.questionnaireData.activityLevel === 'sedentary' ? 'Ниска' : report.questionnaireData.activityLevel === 'light' ? 'Лека' : report.questionnaireData.activityLevel === 'moderate' ? 'Умерена' : 'Висока',
        quality: '',
        score: report.questionnaireData.activityLevel !== 'sedentary' ? 'good' : 'needs-attention'
      }
    ]
    return metrics
  }

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
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Collapsible open={expandedBio} onOpenChange={setExpandedBio}>
          <Card className="p-5">
            <CollapsibleTrigger className="w-full flex items-center justify-between">
              <h3 className="font-semibold text-base">Биометрични данни</h3>
              <motion.div
                animate={{ rotate: expandedBio ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <TrendDown size={18} className="text-muted-foreground" />
              </motion.div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Възраст</p>
                  <p className="text-sm font-semibold">{report.questionnaireData.age} год.</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Пол</p>
                  <p className="text-sm font-semibold">
                    {report.questionnaireData.gender === 'male' ? 'Мъж' : report.questionnaireData.gender === 'female' ? 'Жена' : 'Друго'}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Тегло</p>
                  <p className="text-sm font-semibold">{report.questionnaireData.weight} кг</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Ръст</p>
                  <p className="text-sm font-semibold">{report.questionnaireData.height} см</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">BMI</p>
                  <p className="text-sm font-semibold">
                    {(report.questionnaireData.weight / ((report.questionnaireData.height / 100) ** 2)).toFixed(1)}
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="p-5">
          <h3 className="font-semibold text-base mb-4">Начин на живот</h3>
          <div className="grid grid-cols-2 gap-3">
            {getLifestyleMetrics().map((metric, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                className={`rounded-lg p-3 border ${
                  metric.score === 'good' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <metric.icon 
                    size={18} 
                    weight="duotone" 
                    className={metric.score === 'good' ? 'text-green-600' : 'text-orange-600'} 
                  />
                  <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                </div>
                <p className={`text-sm font-bold ${
                  metric.score === 'good' ? 'text-green-700' : 'text-orange-700'
                }`}>
                  {metric.value}
                </p>
                {metric.quality && (
                  <p className="text-xs text-muted-foreground mt-0.5">{metric.quality}</p>
                )}
              </motion.div>
            ))}
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

            <div className="space-y-3">
              {report.briefSummary ? (
                <div className="space-y-2.5">
                  {report.briefSummary.split(/\n/).filter(line => line.trim()).map((point, idx) => {
                    const cleanPoint = point.replace(/^•\s*/, '').trim()
                    return cleanPoint ? (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08, duration: 0.25 }}
                        className="flex items-start gap-3 p-3 bg-gradient-to-r from-primary/5 to-primary/0 rounded-lg border border-primary/10"
                      >
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0 shadow-sm" />
                        <p className="text-sm leading-relaxed text-foreground/90 flex-1">{cleanPoint}</p>
                      </motion.div>
                    ) : null
                  })}
                </div>
              ) : report.summary ? (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {report.summary.substring(0, 300)}...
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Резюме не е налично
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
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <HealthProgressChart report={report} />
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
  const avgHealth = (report.leftIris.overallHealth + report.rightIris.overallHealth) / 2

  const leftSystemScores = report.leftIris?.systemScores || []
  const rightSystemScores = report.rightIris?.systemScores || []
  
  const nervousSystemScores = [...leftSystemScores, ...rightSystemScores]
    .filter(s => s?.system?.toLowerCase().includes('нервна'))
  
  const nervousSystemScore = nervousSystemScores.length > 0
    ? nervousSystemScores.reduce((sum, s) => sum + s.score, 0) / nervousSystemScores.length
    : 70

  if (report.questionnaireData.sleepHours >= 7 && 
     (report.questionnaireData.sleepQuality === 'good' || report.questionnaireData.sleepQuality === 'excellent') &&
     nervousSystemScore >= 65) {
    factors.push('Добро качество на съня подкрепено от здрава нервна система')
  }

  const detoxSystemScore = [...report.leftIris.systemScores, ...report.rightIris.systemScores]
    .filter(s => s.system.toLowerCase().includes('детоксикац'))
    .reduce((sum, s) => sum + s.score, 0) / 
    Math.max(1, [...report.leftIris.systemScores, ...report.rightIris.systemScores]
      .filter(s => s.system.toLowerCase().includes('детоксикац')).length)

  if (report.questionnaireData.hydration >= 2 && detoxSystemScore >= 65) {
    factors.push('Добра хидратация и ефективна детоксикация')
  }

  const cardiovascularScore = [...report.leftIris.systemScores, ...report.rightIris.systemScores]
    .filter(s => s.system.toLowerCase().includes('сърдечно') || s.system.toLowerCase().includes('съдова'))
    .reduce((sum, s) => sum + s.score, 0) / 
    Math.max(1, [...report.leftIris.systemScores, ...report.rightIris.systemScores]
      .filter(s => s.system.toLowerCase().includes('сърдечно') || s.system.toLowerCase().includes('съдова')).length)

  if ((report.questionnaireData.activityLevel === 'active' || report.questionnaireData.activityLevel === 'very-active') &&
      cardiovascularScore >= 65) {
    factors.push('Висока физическа активност с добро сърдечно-съдово състояние')
  }

  if ((report.questionnaireData.stressLevel === 'low' || report.questionnaireData.stressLevel === 'moderate') &&
      nervousSystemScore >= 65) {
    factors.push('Управляем стрес и стабилна нервна система')
  }

  if (avgHealth >= 70) {
    factors.push('Добро базово здравословно състояние според иридологичния анализ')
  }

  const digestiveScore = [...report.leftIris.systemScores, ...report.rightIris.systemScores]
    .filter(s => s.system.toLowerCase().includes('храносмил'))
    .reduce((sum, s) => sum + s.score, 0) / 
    Math.max(1, [...report.leftIris.systemScores, ...report.rightIris.systemScores]
      .filter(s => s.system.toLowerCase().includes('храносмил')).length)

  if ((report.questionnaireData.dietaryProfile.includes('Вегетариански') || 
       report.questionnaireData.dietaryProfile.includes('Балансирана диета')) &&
      digestiveScore >= 65) {
    factors.push('Здравословен хранителен профил с добра храносмилателна система')
  }

  const immuneScores = [...leftSystemScores, ...rightSystemScores]
    .filter(s => s?.system?.toLowerCase().includes('имунна'))
  
  const immuneScore = immuneScores.length > 0
    ? immuneScores.reduce((sum, s) => sum + s.score, 0) / immuneScores.length
    : 70

  if (immuneScore >= 75) {
    factors.push('Силна имунна система според иридологичния анализ')
  }

  const concernZones = report.leftIris.zones.filter(z => z.status === 'concern').length + 
                       report.rightIris.zones.filter(z => z.status === 'concern').length
  
  if (concernZones === 0 && avgHealth >= 75) {
    factors.push('Отсъствие на притеснителни зони в ириса')
  }

  return factors
}

function getLimitingFactors(report: AnalysisReport): string[] {
  const factors: string[] = []

  const leftSystemScores = report.leftIris?.systemScores || []
  const rightSystemScores = report.rightIris?.systemScores || []
  
  const nervousSystemScores = [...leftSystemScores, ...rightSystemScores]
    .filter(s => s?.system?.toLowerCase().includes('нервна'))
  
  const nervousSystemScore = nervousSystemScores.length > 0
    ? nervousSystemScores.reduce((sum, s) => sum + s.score, 0) / nervousSystemScores.length
    : 70

  if ((report.questionnaireData.sleepHours < 6 || report.questionnaireData.sleepQuality === 'poor') &&
      nervousSystemScore < 60) {
    factors.push('Недостатъчен или лошо качество сън с отражение върху нервната система')
  }

  const detoxSystemScores = [...leftSystemScores, ...rightSystemScores]
    .filter(s => s?.system?.toLowerCase().includes('детоксикац'))
  
  const detoxSystemScore = detoxSystemScores.length > 0
    ? detoxSystemScores.reduce((sum, s) => sum + s.score, 0) / detoxSystemScores.length
    : 70

  if (report.questionnaireData.hydration < 1.5 && detoxSystemScore < 65) {
    factors.push('Недостатъчна хидратация влошаваща детоксикацията')
  }

  const cardiovascularScores = [...leftSystemScores, ...rightSystemScores]
    .filter(s => s?.system?.toLowerCase().includes('сърдечно') || s?.system?.toLowerCase().includes('съдова'))
  
  const cardiovascularScore = cardiovascularScores.length > 0
    ? cardiovascularScores.reduce((sum, s) => sum + s.score, 0) / cardiovascularScores.length
    : 70

  if (report.questionnaireData.activityLevel === 'sedentary' && cardiovascularScore < 70) {
    factors.push('Ниска физическа активност с отражение върху сърдечно-съдовата система')
  }

  if ((report.questionnaireData.stressLevel === 'high' || report.questionnaireData.stressLevel === 'very-high') &&
      nervousSystemScore < 65) {
    factors.push('Висок стрес влошаващ състоянието на нервната система')
  }

  const leftZones = report.leftIris?.zones || []
  const rightZones = report.rightIris?.zones || []
  const concernZones = leftZones.filter(z => z?.status === 'concern').length + 
                       rightZones.filter(z => z?.status === 'concern').length
  if (concernZones > 3) {
    factors.push(`${concernZones} зони с притеснения според иридологичния анализ`)
  }

  const digestiveScores = [...leftSystemScores, ...rightSystemScores]
    .filter(s => s?.system?.toLowerCase().includes('храносмил'))
  
  const digestiveScore = digestiveScores.length > 0
    ? digestiveScores.reduce((sum, s) => sum + s.score, 0) / digestiveScores.length
    : 70

  if ((report.questionnaireData.dietaryHabits.includes('Бърза храна') || 
       report.questionnaireData.dietaryHabits.includes('Много сладки храни')) &&
      digestiveScore < 65) {
    factors.push('Нездравословни хранителни навици с отражение върху храносмилателната система')
  }

  const avgHealth = (report.leftIris.overallHealth + report.rightIris.overallHealth) / 2
  if (avgHealth < 60) {
    factors.push('Общо ниско здравословно състояние според иридологичния анализ')
  }

  const attentionZones = leftZones.filter(z => z?.status === 'attention').length + 
                         rightZones.filter(z => z?.status === 'attention').length
  if (attentionZones > 5) {
    factors.push(`${attentionZones} зони изискващи внимание според иридологичния анализ`)
  }

  const allSystemScores = [...leftSystemScores, ...rightSystemScores]
  const systemAverages = new Map<string, number[]>()
  allSystemScores.forEach(s => {
    if (s?.system && typeof s.score === 'number') {
      const current = systemAverages.get(s.system) || []
      systemAverages.set(s.system, [...current, s.score])
    }
  })
  const weakSystems = Array.from(systemAverages.entries())
    .map(([system, scores]) => ({
      system,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    }))
    .filter(s => s.score < 55)
  
  if (weakSystems.length > 0) {
    factors.push(`Слаби органни системи: ${weakSystems.map(s => s.system).slice(0, 2).join(', ')}`)
  }

  return factors
}
