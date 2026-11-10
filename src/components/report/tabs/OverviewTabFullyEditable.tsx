import { waterLitresOf, formatLitres, waterIsEnough, waterIsLow } from '@/lib/water'
import { useState } from 'react'
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
  Barbell,
  CaretDown
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
import EditableElement from '../EditableElement'
import { useEditableElements } from '@/hooks/use-editable-elements'

interface OverviewTabFullyEditableProps {
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
  if (waterIsEnough(report.questionnaireData)) {
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
  
  if (waterIsLow(report.questionnaireData)) {
    factors.push('Ниска хидратация')
  }
  
  if (report.questionnaireData.medicalConditions && report.questionnaireData.medicalConditions.trim()) {
    factors.push('Съществуващи здравословни състояния')
  }
  
  return factors.length > 0 ? factors : ['Няма значителни ограничения']
}

export default function OverviewTabFullyEditable({ report, avgHealth, editorMode = true }: OverviewTabFullyEditableProps) {
  const [expandedBio, setExpandedBio] = useState(true)
  const [expandedLifestyle, setExpandedLifestyle] = useState(true)
  const [expandedGoalAnalysis, setExpandedGoalAnalysis] = useState(true)
  
  const editor = useEditableElements('overview-tab', editorMode)
  
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
        value: formatLitres(waterLitresOf(report.questionnaireData)),
        quality: waterIsEnough(report.questionnaireData) ? 'добра' : 'недостатъчна',
        score: waterIsEnough(report.questionnaireData) ? 'good' : 'needs-attention'
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

  const lifestyleMetrics = getLifestyleMetrics()
  const bmi = (report.questionnaireData.weight / ((report.questionnaireData.height / 100) ** 2)).toFixed(1)

  return (
    <div className="space-y-3">
      <EditableElement
        id="goals-section"
        type="card"
        label="Секция: Цели"
        editorMode={editorMode}
        visible={editor.getElementState('goals-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('goals-section').comments}
        metadata={{ type: 'goals', priority: 'high' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/10">
            <EditableElement
              id="goals-header"
              type="heading"
              label="Заглавие: Цели"
              editorMode={editorMode}
              visible={editor.getElementState('goals-header').visible}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onResolveComment={editor.resolveComment}
              onDeleteComment={editor.deleteComment}
              comments={editor.getElementState('goals-header').comments}
              showInlineControls={true}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Target size={20} weight="duotone" className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-1">Вашите Цели</h3>
                </div>
              </div>
            </EditableElement>
            
            <EditableElement
              id="goals-badges-container"
              type="list"
              label="Списък: Цели"
              editorMode={editorMode}
              visible={editor.getElementState('goals-badges-container').visible}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onResolveComment={editor.resolveComment}
              onDeleteComment={editor.deleteComment}
              comments={editor.getElementState('goals-badges-container').comments}
            >
              <div className="flex flex-wrap gap-1.5">
                {report.questionnaireData.goals.map((goal, idx) => (
                  <EditableElement
                    key={idx}
                    id={`goal-badge-${idx}`}
                    type="badge"
                    label={`Цел #${idx + 1}`}
                    editorMode={editorMode}
                    visible={editor.getElementState(`goal-badge-${idx}`).visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState(`goal-badge-${idx}`).comments}
                    metadata={{ goalText: goal }}
                    wrapperClassName="inline-block"
                  >
                    <Badge variant="secondary" className="text-xs">
                      {goal}
                    </Badge>
                  </EditableElement>
                ))}
              </div>
            </EditableElement>
          </Card>
        </motion.div>
      </EditableElement>

      <EditableElement
        id="biometric-section"
        type="card"
        label="Секция: Биометрични данни"
        editorMode={editorMode}
        visible={editor.getElementState('biometric-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('biometric-section').comments}
        metadata={{ type: 'biometric' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Collapsible open={expandedBio} onOpenChange={setExpandedBio}>
            <Card className="p-5">
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                <EditableElement
                  id="biometric-header"
                  type="heading"
                  label="Заглавие: Биометрика"
                  editorMode={editorMode}
                  visible={editor.getElementState('biometric-header').visible}
                  onToggleVisibility={editor.toggleVisibility}
                  onAddComment={editor.addComment}
                  onResolveComment={editor.resolveComment}
                  onDeleteComment={editor.deleteComment}
                  comments={editor.getElementState('biometric-header').comments}
                  wrapperClassName="flex-1 text-left"
                >
                  <h3 className="font-semibold text-base">Биометрични данни</h3>
                </EditableElement>
                <motion.div
                  animate={{ rotate: expandedBio ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CaretDown size={18} className="text-muted-foreground" />
                </motion.div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <EditableElement
                    id="biometric-age"
                    type="data"
                    label="Данни: Възраст"
                    editorMode={editorMode}
                    visible={editor.getElementState('biometric-age').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('biometric-age').comments}
                    metadata={{ value: report.questionnaireData.age }}
                  >
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Възраст</p>
                      <p className="text-sm font-semibold">{report.questionnaireData.age} год.</p>
                    </div>
                  </EditableElement>
                  
                  <EditableElement
                    id="biometric-gender"
                    type="data"
                    label="Данни: Пол"
                    editorMode={editorMode}
                    visible={editor.getElementState('biometric-gender').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('biometric-gender').comments}
                    metadata={{ value: report.questionnaireData.gender }}
                  >
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Пол</p>
                      <p className="text-sm font-semibold">
                        {report.questionnaireData.gender === 'male' ? 'Мъж' : report.questionnaireData.gender === 'female' ? 'Жена' : 'Друго'}
                      </p>
                    </div>
                  </EditableElement>
                  
                  <EditableElement
                    id="biometric-weight"
                    type="data"
                    label="Данни: Тегло"
                    editorMode={editorMode}
                    visible={editor.getElementState('biometric-weight').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('biometric-weight').comments}
                    metadata={{ value: report.questionnaireData.weight }}
                  >
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Тегло</p>
                      <p className="text-sm font-semibold">{report.questionnaireData.weight} кг</p>
                    </div>
                  </EditableElement>
                  
                  <EditableElement
                    id="biometric-height"
                    type="data"
                    label="Данни: Ръст"
                    editorMode={editorMode}
                    visible={editor.getElementState('biometric-height').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('biometric-height').comments}
                    metadata={{ value: report.questionnaireData.height }}
                  >
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Ръст</p>
                      <p className="text-sm font-semibold">{report.questionnaireData.height} см</p>
                    </div>
                  </EditableElement>
                  
                  <EditableElement
                    id="biometric-bmi"
                    type="data"
                    label="Данни: BMI"
                    editorMode={editorMode}
                    visible={editor.getElementState('biometric-bmi').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('biometric-bmi').comments}
                    metadata={{ value: bmi, calculated: true }}
                    className="col-span-2"
                  >
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">BMI</p>
                      <p className="text-sm font-semibold">{bmi}</p>
                    </div>
                  </EditableElement>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>
      </EditableElement>

      <EditableElement
        id="lifestyle-section"
        type="card"
        label="Секция: Начин на живот"
        editorMode={editorMode}
        visible={editor.getElementState('lifestyle-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('lifestyle-section').comments}
        metadata={{ type: 'lifestyle' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Collapsible open={expandedLifestyle} onOpenChange={setExpandedLifestyle}>
            <Card className="p-5">
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Heart size={20} weight="duotone" className="text-accent" />
                  </div>
                  <EditableElement
                    id="lifestyle-header"
                    type="heading"
                    label="Заглавие: Начин на живот"
                    editorMode={editorMode}
                    visible={editor.getElementState('lifestyle-header').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('lifestyle-header').comments}
                    wrapperClassName="text-left"
                  >
                    <h3 className="font-semibold text-base">Начин на живот</h3>
                  </EditableElement>
                </div>
                <motion.div
                  animate={{ rotate: expandedLifestyle ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CaretDown size={18} className="text-muted-foreground" />
                </motion.div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {lifestyleMetrics.map((metric, idx) => {
                    const IconComponent = metric.icon
                    return (
                      <EditableElement
                        key={idx}
                        id={`lifestyle-metric-${metric.label.toLowerCase()}`}
                        type="data"
                        label={`Метрика: ${metric.label}`}
                        editorMode={editorMode}
                        visible={editor.getElementState(`lifestyle-metric-${metric.label.toLowerCase()}`).visible}
                        onToggleVisibility={editor.toggleVisibility}
                        onAddComment={editor.addComment}
                        onResolveComment={editor.resolveComment}
                        onDeleteComment={editor.deleteComment}
                        comments={editor.getElementState(`lifestyle-metric-${metric.label.toLowerCase()}`).comments}
                        metadata={{ metric: metric.label, value: metric.value, score: metric.score }}
                      >
                        <div className={`rounded-lg p-3 ${metric.score === 'good' ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <IconComponent size={14} className={metric.score === 'good' ? 'text-green-600' : 'text-amber-600'} />
                            <p className="text-xs font-medium">{metric.label}</p>
                          </div>
                          <p className="text-sm font-semibold">{metric.value}</p>
                          {metric.quality && <p className="text-xs text-muted-foreground">{metric.quality}</p>}
                        </div>
                      </EditableElement>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>
      </EditableElement>

      <EditableElement
        id="overall-health-section"
        type="card"
        label="Секция: Общо Състояние"
        editorMode={editorMode}
        visible={editor.getElementState('overall-health-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('overall-health-section').comments}
        metadata={{ type: 'health-score', value: avgHealth }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <EditableElement
                id="overall-health-header"
                type="heading"
                label="Заглавие: Общо Състояние"
                editorMode={editorMode}
                visible={editor.getElementState('overall-health-header').visible}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onResolveComment={editor.resolveComment}
                onDeleteComment={editor.deleteComment}
                comments={editor.getElementState('overall-health-header').comments}
                wrapperClassName="flex-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Activity size={20} weight="duotone" className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-base">Общо Състояние</h3>
                </div>
              </EditableElement>
              
              <EditableElement
                id="overall-health-percentage"
                type="data"
                label="Данни: Процент Здраве"
                editorMode={editorMode}
                visible={editor.getElementState('overall-health-percentage').visible}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onResolveComment={editor.resolveComment}
                onDeleteComment={editor.deleteComment}
                comments={editor.getElementState('overall-health-percentage').comments}
                metadata={{ value: avgHealth, type: 'percentage' }}
              >
                <div className="text-3xl font-bold text-primary">{avgHealth}%</div>
              </EditableElement>
            </div>
            
            <EditableElement
              id="overall-health-progress"
              type="custom"
              label="Компонент: Progress Bar"
              editorMode={editorMode}
              visible={editor.getElementState('overall-health-progress').visible}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onResolveComment={editor.resolveComment}
              onDeleteComment={editor.deleteComment}
              comments={editor.getElementState('overall-health-progress').comments}
              metadata={{ value: avgHealth }}
            >
              <Progress value={avgHealth} className="h-3 mb-3" />
            </EditableElement>
            
            <EditableElement
              id="overall-health-description"
              type="text"
              label="Текст: Описание"
              editorMode={editorMode}
              visible={editor.getElementState('overall-health-description').visible}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onResolveComment={editor.resolveComment}
              onDeleteComment={editor.deleteComment}
              comments={editor.getElementState('overall-health-description').comments}
            >
              <p className="text-sm text-muted-foreground">
                {avgHealth >= 80 ? 'Отлично общо състояние' : avgHealth >= 60 ? 'Добро общо състояние' : 'Необходимо внимание'}
              </p>
            </EditableElement>
          </Card>
        </motion.div>
      </EditableElement>

      <EditableElement
        id="goal-achievability-section"
        type="card"
        label="Секция: Постижимост на целите"
        editorMode={editorMode}
        visible={editor.getElementState('goal-achievability-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('goal-achievability-section').comments}
        metadata={{ type: 'goal-analysis', score: goalAchievability }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Collapsible open={expandedGoalAnalysis} onOpenChange={setExpandedGoalAnalysis}>
            <Card className="p-5">
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Target size={20} weight="duotone" className="text-accent" />
                  </div>
                  <div className="flex-1 text-left">
                    <EditableElement
                      id="goal-achievability-header"
                      type="heading"
                      label="Заглавие: Постижимост"
                      editorMode={editorMode}
                      visible={editor.getElementState('goal-achievability-header').visible}
                      onToggleVisibility={editor.toggleVisibility}
                      onAddComment={editor.addComment}
                      onResolveComment={editor.resolveComment}
                      onDeleteComment={editor.deleteComment}
                      comments={editor.getElementState('goal-achievability-header').comments}
                    >
                      <h3 className="font-semibold text-base">Постижимост на целите</h3>
                    </EditableElement>
                    <EditableElement
                      id="goal-achievability-score"
                      type="data"
                      label="Данни: Резултат"
                      editorMode={editorMode}
                      visible={editor.getElementState('goal-achievability-score').visible}
                      onToggleVisibility={editor.toggleVisibility}
                      onAddComment={editor.addComment}
                      onResolveComment={editor.resolveComment}
                      onDeleteComment={editor.deleteComment}
                      comments={editor.getElementState('goal-achievability-score').comments}
                      metadata={{ value: goalAchievability }}
                    >
                      <p className="text-2xl font-bold text-primary mt-1">{goalAchievability}%</p>
                    </EditableElement>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: expandedGoalAnalysis ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CaretDown size={18} className="text-muted-foreground" />
                </motion.div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="space-y-3 mt-4">
                  <EditableElement
                    id="goal-achievability-progress"
                    type="custom"
                    label="Компонент: Progress"
                    editorMode={editorMode}
                    visible={editor.getElementState('goal-achievability-progress').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('goal-achievability-progress').comments}
                    metadata={{ value: goalAchievability }}
                  >
                    <Progress value={goalAchievability} className="h-2" />
                  </EditableElement>
                  
                  <EditableElement
                    id="supporting-factors-section"
                    type="list"
                    label="Списък: Подпомагащи фактори"
                    editorMode={editorMode}
                    visible={editor.getElementState('supporting-factors-section').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('supporting-factors-section').comments}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={16} weight="fill" className="text-green-600" />
                        <p className="text-sm font-semibold">Подпомагащи фактори:</p>
                      </div>
                      <ul className="space-y-1 ml-6">
                        {supportingFactors.map((factor, idx) => (
                          <EditableElement
                            key={idx}
                            id={`supporting-factor-${idx}`}
                            type="text"
                            label={`Фактор #${idx + 1}`}
                            editorMode={editorMode}
                            visible={editor.getElementState(`supporting-factor-${idx}`).visible}
                            onToggleVisibility={editor.toggleVisibility}
                            onAddComment={editor.addComment}
                            onResolveComment={editor.resolveComment}
                            onDeleteComment={editor.deleteComment}
                            comments={editor.getElementState(`supporting-factor-${idx}`).comments}
                            metadata={{ factorText: factor }}
                          >
                            <li className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-green-600 font-semibold">•</span>
                              {factor}
                            </li>
                          </EditableElement>
                        ))}
                      </ul>
                    </div>
                  </EditableElement>
                  
                  <EditableElement
                    id="limiting-factors-section"
                    type="list"
                    label="Списък: Ограничаващи фактори"
                    editorMode={editorMode}
                    visible={editor.getElementState('limiting-factors-section').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('limiting-factors-section').comments}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle size={16} weight="fill" className="text-amber-600" />
                        <p className="text-sm font-semibold">Ограничаващи фактори:</p>
                      </div>
                      <ul className="space-y-1 ml-6">
                        {limitingFactors.map((factor, idx) => (
                          <EditableElement
                            key={idx}
                            id={`limiting-factor-${idx}`}
                            type="text"
                            label={`Фактор #${idx + 1}`}
                            editorMode={editorMode}
                            visible={editor.getElementState(`limiting-factor-${idx}`).visible}
                            onToggleVisibility={editor.toggleVisibility}
                            onAddComment={editor.addComment}
                            onResolveComment={editor.resolveComment}
                            onDeleteComment={editor.deleteComment}
                            comments={editor.getElementState(`limiting-factor-${idx}`).comments}
                            metadata={{ factorText: factor }}
                          >
                            <li className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-amber-600 font-semibold">•</span>
                              {factor}
                            </li>
                          </EditableElement>
                        ))}
                      </ul>
                    </div>
                  </EditableElement>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>
      </EditableElement>

      <EditableElement
        id="system-scores-chart-section"
        type="chart"
        label="График: Системни Резултати"
        editorMode={editorMode}
        visible={editor.getElementState('system-scores-chart-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('system-scores-chart-section').comments}
        metadata={{ chartType: 'bar', dataPoints: report.leftIris.systemScores.length }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <SystemScoresChart leftScores={report.leftIris.systemScores} rightScores={report.rightIris.systemScores} />
        </motion.div>
      </EditableElement>

      <EditableElement
        id="health-progress-chart-section"
        type="chart"
        label="График: Здравен Прогрес"
        editorMode={editorMode}
        visible={editor.getElementState('health-progress-chart-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('health-progress-chart-section').comments}
        metadata={{ chartType: 'line' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <HealthProgressChart report={report} />
        </motion.div>
      </EditableElement>
    </div>
  )
}
