import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { CalendarDots, CheckSquare, Clock } from '@phosphor-icons/react'
import type { AnalysisReport } from '@/types'

interface ActionTimelineProps {
  report: AnalysisReport
}

interface TimelineItem {
  phase: string
  duration: string
  actions: string[]
  priority: 'high' | 'medium' | 'low'
  color: string
}

export default function ActionTimeline({ report }: ActionTimelineProps) {
  const [activePhase, setActivePhase] = useState<number | null>(null)
  
  const generateTimeline = (): TimelineItem[] => {
    const timeline: TimelineItem[] = []
    const avgHealth = (report.leftIris.overallHealth + report.rightIris.overallHealth) / 2
    
    const phase1Actions: string[] = []
    if (report.detailedPlan?.generalRecommendations && report.detailedPlan.generalRecommendations.length > 0) {
      phase1Actions.push(report.detailedPlan.generalRecommendations[0])
    }
    if (report.detailedPlan?.recommendedFoods && report.detailedPlan.recommendedFoods.length > 0) {
      phase1Actions.push(`Започнете с ${report.detailedPlan.recommendedFoods.slice(0, 2).join(', ')}`)
    }
    if (report.questionnaireData.hydration < 8) {
      phase1Actions.push('Увеличете дневния прием на вода до 8-10 чаши (2-2.5л)')
    }
    
    timeline.push({
      phase: 'Фаза 1: Първи стъпки',
      duration: 'Седмица 1-2',
      actions: phase1Actions.length > 0 ? phase1Actions : ['Започнете с основните препоръки'],
      priority: 'high',
      color: 'oklch(0.65 0.20 25)'
    })
    
    const phase2Actions: string[] = []
    if (report.detailedPlan?.supplements && report.detailedPlan.supplements.length > 0) {
      phase2Actions.push(`Добавете ${report.detailedPlan.supplements[0]?.name || 'хранителни добавки'}`)
    }
    if (report.detailedPlan?.avoidFoods && report.detailedPlan.avoidFoods.length > 0) {
      phase2Actions.push(`Елиминирайте ${report.detailedPlan.avoidFoods.slice(0, 2).join(', ')}`)
    }
    if (report.questionnaireData.activityLevel === 'sedentary') {
      phase2Actions.push('Добавете 30 мин физическа активност дневно')
    }
    
    timeline.push({
      phase: 'Фаза 2: Навици',
      duration: 'Седмица 3-6',
      actions: phase2Actions.length > 0 ? phase2Actions : ['Изградете здравословни навици'],
      priority: 'high',
      color: 'oklch(0.75 0.18 85)'
    })
    
    const phase3Actions: string[] = []
    if (report.detailedPlan?.psychologicalRecommendations && report.detailedPlan.psychologicalRecommendations.length > 0) {
      phase3Actions.push(report.detailedPlan.psychologicalRecommendations[0])
    }
    if (report.detailedPlan?.specialRecommendations && report.detailedPlan.specialRecommendations.length > 0) {
      phase3Actions.push(report.detailedPlan.specialRecommendations[0])
    }
    phase3Actions.push('Оценете напредъка и адаптирайте плана')
    
    timeline.push({
      phase: 'Фаза 3: Оптимизация',
      duration: 'Седмица 7-12',
      actions: phase3Actions,
      priority: 'medium',
      color: 'oklch(0.55 0.15 230)'
    })
    
    const phase4Actions: string[] = []
    if (report.detailedPlan?.recommendedTests && report.detailedPlan.recommendedTests.length > 0) {
      phase4Actions.push(`Направете ${report.detailedPlan.recommendedTests[0]}`)
    }
    phase4Actions.push('Повторен иридологичен анализ')
    phase4Actions.push('Поддържане на постигнатите резултати')
    
    timeline.push({
      phase: 'Фаза 4: Поддръжка',
      duration: 'След месец 3',
      actions: phase4Actions,
      priority: 'low',
      color: 'oklch(0.75 0.15 145)'
    })
    
    return timeline
  }
  
  const timeline = generateTimeline()
  
  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    const configs = {
      high: { text: 'Висок приоритет', variant: 'destructive' as const },
      medium: { text: 'Среден приоритет', variant: 'secondary' as const },
      low: { text: 'Нисък приоритет', variant: 'default' as const }
    }
    const config = configs[priority]
    return <Badge variant={config.variant} className="text-xs">{config.text}</Badge>
  }
  
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <CalendarDots size={22} weight="duotone" className="text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">План за Действие</h3>
          <p className="text-xs text-muted-foreground">Поетапна реализация на препоръките</p>
        </div>
      </div>
      
      <div className="relative space-y-6">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-muted" />
        
        {timeline.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.15, duration: 0.4 }}
            className="relative"
          >
            <div className="flex gap-4">
              <div className="flex-shrink-0 relative z-10">
                <motion.div
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: item.color }}
                  whileHover={{ scale: 1.1 }}
                  animate={activePhase === idx ? { scale: 1.15 } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Clock size={20} weight="duotone" className="text-white" />
                </motion.div>
              </div>
              
              <div 
                className={`flex-1 pb-6 cursor-pointer transition-all ${
                  activePhase === idx ? 'transform scale-105' : ''
                }`}
                onMouseEnter={() => setActivePhase(idx)}
                onMouseLeave={() => setActivePhase(null)}
              >
                <Card className={`p-4 transition-all ${
                  activePhase === idx 
                    ? 'shadow-lg border-2 border-primary' 
                    : 'hover:shadow-md border'
                }`}>
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div>
                      <h4 className="font-bold text-sm mb-1">{item.phase}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDots size={14} />
                        <span>{item.duration}</span>
                      </div>
                    </div>
                    {getPriorityBadge(item.priority)}
                  </div>
                  
                  <div className="space-y-2">
                    {item.actions.map((action, actionIdx) => (
                      <motion.div
                        key={actionIdx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.15 + actionIdx * 0.05 }}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <CheckSquare 
                          size={16} 
                          weight="duotone" 
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: item.color }}
                        />
                        <p className="text-sm leading-relaxed text-foreground/90">{action}</p>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
        <p className="text-sm text-foreground/80">
          <span className="font-semibold">Важно:</span> Този план е приблизителен и може да бъде адаптиран според вашия напредък и индивидуални нужди. Консултирайте се с лекар преди да предприемате значителни промени.
        </p>
      </div>
    </Card>
  )
}
