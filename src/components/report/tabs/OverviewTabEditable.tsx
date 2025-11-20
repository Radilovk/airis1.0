import { useState } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
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
import type { AnalysisReport, EditorModeConfig, ReportContainer } from '@/types'
import SystemScoresChart from '../SystemScoresChart'
import HealthProgressChart from '../HealthProgressChart'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import EditableContainer from '../EditableContainer'
import EditableElement from '../EditableElement'
import { useEditableElements } from '@/hooks/use-editable-elements'
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'

interface OverviewTabEditableProps {
  report: AnalysisReport
  avgHealth: number
  editorMode?: boolean
}

const DEFAULT_CONTAINERS: ReportContainer[] = [
  {
    id: 'goals-container',
    moduleId: 'overview',
    type: 'card',
    title: 'Вашите Цели',
    visible: true,
    order: 0,
    comments: [],
    interactive: false,
    metadata: { icon: 'Target', priority: 'high' }
  },
  {
    id: 'biometric-container',
    moduleId: 'overview',
    type: 'collapsible',
    title: 'Биометрични данни',
    visible: true,
    order: 1,
    comments: [],
    interactive: true,
    metadata: { icon: 'Activity' }
  },
  {
    id: 'lifestyle-container',
    moduleId: 'overview',
    type: 'card',
    title: 'Начин на живот',
    visible: true,
    order: 2,
    comments: [],
    interactive: false,
    metadata: { icon: 'Heart' }
  },
  {
    id: 'overall-health-container',
    moduleId: 'overview',
    type: 'card',
    title: 'Общо Състояние',
    visible: true,
    order: 3,
    comments: [],
    interactive: false,
    metadata: { icon: 'Activity', chartType: 'circular' }
  },
  {
    id: 'goal-achievability-container',
    moduleId: 'overview',
    type: 'card',
    title: 'Постижимост на целите',
    visible: true,
    order: 4,
    comments: [],
    interactive: true,
    metadata: { icon: 'CheckCircle' }
  },
  {
    id: 'system-scores-chart',
    moduleId: 'overview',
    type: 'chart',
    title: 'Системни Резултати',
    visible: true,
    order: 5,
    comments: [],
    interactive: true,
    metadata: { chartType: 'bar' }
  },
  {
    id: 'health-progress-chart',
    moduleId: 'overview',
    type: 'chart',
    title: 'Здравен Прогрес',
    visible: true,
    order: 6,
    comments: [],
    interactive: true,
    metadata: { chartType: 'line' }
  },
]

export default function OverviewTabEditable({ report, avgHealth, editorMode = true }: OverviewTabEditableProps) {
  const [editorConfig, setEditorConfig] = useKVWithFallback<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [],
    lastModified: new Date().toISOString()
  })

  const overviewModule = editorConfig?.moduleOrder.find(m => m.id === 'overview')
  const [containers, setContainers] = useState<ReportContainer[]>(
    overviewModule?.containers && overviewModule.containers.length > 0 
      ? overviewModule.containers 
      : DEFAULT_CONTAINERS
  )

  const [expandedBio, setExpandedBio] = useState(true)
  const [expandedGoalAnalysis, setExpandedGoalAnalysis] = useState(true)
  
  const elementEditor = useEditableElements('overview', editorConfig?.enabled || editorMode)
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setContainers((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
          ...item,
          order: idx
        }))
        
        updateConfig(newItems)
        return newItems
      })
    }
  }

  const updateConfig = (newContainers: ReportContainer[]) => {
    setEditorConfig((current) => {
      if (!current) {
        return {
          enabled: false,
          moduleOrder: [],
          lastModified: new Date().toISOString()
        }
      }
      const newModuleOrder = current.moduleOrder.map(m => 
        m.id === 'overview' ? { ...m, containers: newContainers } : m
      )
      return {
        ...current,
        moduleOrder: newModuleOrder,
        lastModified: new Date().toISOString()
      }
    })
  }

  const handleToggleVisibility = (id: string) => {
    setContainers((items) => {
      const newItems = items.map(item =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
      updateConfig(newItems)
      return newItems
    })
  }

  const handleDelete = (id: string) => {
    setContainers((items) => {
      const newItems = items.filter(item => item.id !== id)
      updateConfig(newItems)
      return newItems
    })
  }

  const handleAddComment = (containerId: string, text: string) => {
    setContainers((items) => {
      const newItems = items.map(item => {
        if (item.id === containerId) {
          return {
            ...item,
            comments: [
              ...item.comments,
              {
                id: `comment-${Date.now()}`,
                moduleId: 'overview',
                containerId,
                text,
                timestamp: new Date().toISOString(),
                resolved: false
              }
            ]
          }
        }
        return item
      })
      updateConfig(newItems)
      return newItems
    })
  }

  const handleResolveComment = (containerId: string, commentId: string) => {
    setContainers((items) => {
      const newItems = items.map(item => {
        if (item.id === containerId) {
          return {
            ...item,
            comments: item.comments.map(c =>
              c.id === commentId ? { ...c, resolved: !c.resolved } : c
            )
          }
        }
        return item
      })
      updateConfig(newItems)
      return newItems
    })
  }

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
        value: report.questionnaireData.activityLevel === 'sedentary' ? 'Ниска' : report.questionnaireData.activityLevel === 'light' ? 'Лека' : report.questionnaireData.activityLevel === 'moderate' ? 'Умерена' : 'Висока',
        quality: '',
        score: report.questionnaireData.activityLevel !== 'sedentary' ? 'good' : 'needs-attention'
      }
    ]
    return metrics
  }

  const getContainerContent = (container: ReportContainer) => {
    switch (container.id) {
      case 'goals-container':
        return (
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
        )

      case 'biometric-container':
        return (
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
        )

      case 'lifestyle-container':
        return (
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
        )

      case 'overall-health-container':
        return (
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
        )

      case 'goal-achievability-container':
        return (
          <Card className="p-5">
            <h3 className="font-semibold text-base mb-4">Постижимост на целите</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Обща Постижимост</span>
                  <span className="text-sm font-bold text-primary">{goalAchievability}%</span>
                </div>
                <Progress value={goalAchievability} className="h-3" />
              </div>

              {supportingFactors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-green-700 flex items-center gap-2">
                    <CheckCircle size={16} weight="fill" />
                    Подпомагащи фактори
                  </h4>
                  <div className="space-y-1.5">
                    {supportingFactors.map((factor, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                        <span className="text-foreground/80">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {limitingFactors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                    <XCircle size={16} weight="fill" />
                    Ограничаващи фактори
                  </h4>
                  <div className="space-y-1.5">
                    {limitingFactors.map((factor, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                        <span className="text-foreground/80">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )

      case 'system-scores-chart':
        return <SystemScoresChart leftScores={report.leftIris.systemScores} rightScores={report.rightIris.systemScores} />

      case 'health-progress-chart':
        return <HealthProgressChart report={report} />

      default:
        return null
    }
  }

  const sortedContainers = [...containers].sort((a, b) => a.order - b.order)

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={sortedContainers.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {sortedContainers.map((container, idx) => (
            <motion.div
              key={container.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              <EditableContainer
                container={container}
                editorMode={editorConfig?.enabled || false}
                onToggleVisibility={handleToggleVisibility}
                onDelete={handleDelete}
                onAddComment={handleAddComment}
                onResolveComment={handleResolveComment}
              >
                {getContainerContent(container)}
              </EditableContainer>
            </motion.div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function calculateGoalAchievability(report: AnalysisReport): number {
  const avgHealth = (report.leftIris.overallHealth + report.rightIris.overallHealth) / 2
  const sleepQuality = report.questionnaireData.sleepQuality
  const hydration = report.questionnaireData.hydration
  const activityLevel = report.questionnaireData.activityLevel
  
  let score = avgHealth * 0.4
  
  if (sleepQuality === 'excellent') score += 20
  else if (sleepQuality === 'good') score += 15
  else if (sleepQuality === 'fair') score += 10
  
  if (hydration >= 8) score += 15
  else if (hydration >= 6) score += 10
  
  if (activityLevel === 'very-active' || activityLevel === 'active') score += 15
  else if (activityLevel === 'moderate') score += 10
  else if (activityLevel === 'light') score += 5
  
  return Math.min(Math.round(score), 100)
}

function getSupportingFactors(report: AnalysisReport): string[] {
  const factors: string[] = []
  
  if (report.questionnaireData.sleepQuality === 'excellent' || report.questionnaireData.sleepQuality === 'good') {
    factors.push('Качествен сън')
  }
  if (report.questionnaireData.hydration >= 8) {
    factors.push('Добра хидратация')
  }
  if (report.questionnaireData.activityLevel === 'active' || report.questionnaireData.activityLevel === 'very-active') {
    factors.push('Активен начин на живот')
  }
  if (report.questionnaireData.stressLevel === 'low') {
    factors.push('Нисък стрес')
  }
  
  return factors
}

function getLimitingFactors(report: AnalysisReport): string[] {
  const factors: string[] = []
  
  if (report.questionnaireData.sleepQuality === 'poor') {
    factors.push('Лошо качество на съня')
  }
  if (report.questionnaireData.hydration < 6) {
    factors.push('Недостатъчна хидратация')
  }
  if (report.questionnaireData.activityLevel === 'sedentary') {
    factors.push('Заседнал начин на живот')
  }
  if (report.questionnaireData.stressLevel === 'high' || report.questionnaireData.stressLevel === 'very-high') {
    factors.push('Висок стрес')
  }
  
  return factors
}
