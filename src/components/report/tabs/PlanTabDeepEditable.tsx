import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { 
  CaretDown,
  Leaf,
  Pill,
  Heart,
  Brain,
  Flask,
  Lightbulb,
  AppleLogo,
  WarningCircle,
  CheckCircle,
  XCircle
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnalysisReport, SupplementRecommendation } from '@/types'
import { cn } from '@/lib/utils'
import NutritionChart from '../NutritionChart'
import ActionTimeline from '../ActionTimeline'
import { DeepEditableWrapper } from '../DeepEditableWrapper'
import { useDeepEditable } from '@/hooks/use-deep-editable'
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

interface PlanTabFullyEditableProps {
  report: AnalysisReport
  editorMode?: boolean
}

export default function PlanTabFullyEditable({ report, editorMode = false }: PlanTabFullyEditableProps) {
  const editor = useDeepEditable('plan', editorMode)
  
  const detailedPlan = report.detailedPlan || {}
  const motivationalSummary = report.motivationalSummary || ''

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const mainElements = [
    { id: 'motivational-summary', label: 'План за Действие', order: 0 },
    { id: 'nutrition-chart', label: 'Хранителна Визуализация', order: 1 },
    { id: 'action-timeline', label: 'График на Действията', order: 2 },
    { id: 'general-recommendations', label: 'Общи Препоръки', order: 3 },
    { id: 'food-recommendations', label: 'Хранителни Препоръки', order: 4 },
    { id: 'supplement-recommendations', label: 'Добавки', order: 5 },
    { id: 'exercise-recommendations', label: 'Физическа Активност', order: 6 },
    { id: 'lifestyle-recommendations', label: 'Начин на Живот', order: 7 },
    { id: 'stress-management', label: 'Управление на Стреса', order: 8 },
    { id: 'sleep-optimization', label: 'Оптимизация на Съня', order: 9 },
    { id: 'hydration-tips', label: 'Хидратация', order: 10 },
    { id: 'special-considerations', label: 'Специални Указания', order: 11 },
  ]

  const sortedElements = mainElements
    .map(el => ({
      ...el,
      state: editor.getElementState(el.id),
    }))
    .sort((a, b) => a.state.order - b.state.order)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedElements.findIndex(el => el.id === active.id)
    const newIndex = sortedElements.findIndex(el => el.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sortedElements, oldIndex, newIndex)
    editor.bulkUpdateOrder(reordered.map((el, idx) => ({ id: el.id, order: idx })))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedElements.map(el => el.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {sortedElements.map((element) => (
            <DeepEditableWrapper
              key={element.id}
              id={element.id}
              label={element.label}
              editorMode={editorMode}
              state={element.state}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onDeleteComment={editor.deleteComment}
              sortable={editorMode}
              level={0}
            >
              {renderElement(element.id, report, editorMode, editor)}
            </DeepEditableWrapper>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function renderElement(
  elementId: string, 
  report: AnalysisReport, 
  editorMode: boolean,
  editor: ReturnType<typeof useDeepEditable>
) {
  const detailedPlan = report.detailedPlan || {}

  switch (elementId) {
    case 'motivational-summary':
      return <MotivationalSummary text={report.motivationalSummary || ''} editorMode={editorMode} editor={editor} />
    
    case 'nutrition-chart':
      return <NutritionChartWrapper report={report} editorMode={editorMode} editor={editor} />
    
    case 'action-timeline':
      return <ActionTimelineWrapper report={report} editorMode={editorMode} editor={editor} />
    
    case 'general-recommendations':
      return <GeneralRecommendations items={detailedPlan.generalRecommendations || []} editorMode={editorMode} editor={editor} />
    
    case 'food-recommendations':
      return <FoodRecommendations 
        recommended={detailedPlan.recommendedFoods || []} 
        avoid={detailedPlan.avoidFoods || []} 
        editorMode={editorMode} 
        editor={editor} 
      />
    
    case 'supplement-recommendations':
      return <SupplementRecommendations items={detailedPlan.supplements || []} editorMode={editorMode} editor={editor} />
    
    case 'exercise-recommendations':
      return <ExerciseRecommendations items={detailedPlan.psychologicalRecommendations || []} editorMode={editorMode} editor={editor} />
    
    case 'lifestyle-recommendations':
      return <LifestyleRecommendations items={detailedPlan.specialRecommendations || []} editorMode={editorMode} editor={editor} />
    
    case 'stress-management':
      return <StressManagement items={detailedPlan.psychologicalRecommendations || []} editorMode={editorMode} editor={editor} />
    
    case 'sleep-optimization':
      return <SleepOptimization items={detailedPlan.generalRecommendations || []} editorMode={editorMode} editor={editor} />
    
    case 'hydration-tips':
      return <HydrationTips items={detailedPlan.generalRecommendations || []} editorMode={editorMode} editor={editor} />
    
    case 'special-considerations':
      return <SpecialConsiderations items={detailedPlan.recommendedTests || []} editorMode={editorMode} editor={editor} />
    
    default:
      return null
  }
}

function MotivationalSummary({ 
  text, 
  editorMode, 
  editor 
}: { 
  text: string
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  if (!text) return null

  return (
    <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/10">
      <DeepEditableWrapper
        id="motivational-summary-heading"
        label="Заглавие 'План за Действие'"
        editorMode={editorMode}
        state={editor.getElementState('motivational-summary-heading')}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onDeleteComment={editor.deleteComment}
        level={1}
      >
        <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
          <Lightbulb size={20} weight="duotone" className="text-primary" />
          План за Действие
        </h3>
      </DeepEditableWrapper>

      <DeepEditableWrapper
        id="motivational-summary-text"
        label="Мотивационен текст"
        editorMode={editorMode}
        state={editor.getElementState('motivational-summary-text')}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onDeleteComment={editor.deleteComment}
        level={1}
      >
        <p className="text-sm leading-relaxed text-foreground/90">
          {text}
        </p>
      </DeepEditableWrapper>
    </Card>
  )
}

function NutritionChartWrapper({ 
  report, 
  editorMode, 
  editor 
}: { 
  report: AnalysisReport
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const hasFoodRecs = (report.detailedPlan?.recommendedFoods && report.detailedPlan.recommendedFoods.length > 0) || 
                      (report.detailedPlan?.avoidFoods && report.detailedPlan.avoidFoods.length > 0)
  if (!hasFoodRecs) return null

  return <NutritionChart report={report} />
}

function ActionTimelineWrapper({ 
  report, 
  editorMode, 
  editor 
}: { 
  report: AnalysisReport
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  return <ActionTimeline report={report} />
}

function GeneralRecommendations({ 
  items, 
  editorMode, 
  editor 
}: { 
  items: string[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <DeepEditableWrapper
            id="general-recommendations-heading"
            label="Заглавие 'Общи Препоръки'"
            editorMode={editorMode}
            state={editor.getElementState('general-recommendations-heading')}
            onToggleVisibility={editor.toggleVisibility}
            onAddComment={editor.addComment}
            onDeleteComment={editor.deleteComment}
            level={1}
          >
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Lightbulb size={20} weight="duotone" className="text-accent" />
              Общи Препоръки
            </h3>
          </DeepEditableWrapper>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-2">
            {items.slice(0, 3).map((item, index) => (
              <DeepEditableWrapper
                key={`general-rec-${index}`}
                id={`general-rec-${index}`}
                label={`Препоръка ${index + 1}`}
                editorMode={editorMode}
                state={editor.getElementState(`general-rec-${index}`)}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <CheckCircle size={16} weight="fill" className="text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              </DeepEditableWrapper>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function FoodRecommendations({ 
  recommended, 
  avoid, 
  editorMode, 
  editor 
}: { 
  recommended: string[]
  avoid: string[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (recommended.length === 0 && avoid.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <DeepEditableWrapper
            id="food-recommendations-heading"
            label="Заглавие 'Хранителни Препоръки'"
            editorMode={editorMode}
            state={editor.getElementState('food-recommendations-heading')}
            onToggleVisibility={editor.toggleVisibility}
            onAddComment={editor.addComment}
            onDeleteComment={editor.deleteComment}
            level={1}
          >
            <h3 className="font-semibold text-base flex items-center gap-2">
              <AppleLogo size={20} weight="duotone" className="text-accent" />
              Хранителни Препоръки
            </h3>
          </DeepEditableWrapper>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            {recommended.length > 0 && (
              <DeepEditableWrapper
                id="recommended-foods-section"
                label="Препоръчани Храни (секция)"
                editorMode={editorMode}
                state={editor.getElementState('recommended-foods-section')}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle size={16} weight="fill" className="text-accent" />
                    Препоръчани
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {recommended.slice(0, 5).map((food, index) => (
                      <DeepEditableWrapper
                        key={`food-rec-${index}`}
                        id={`food-rec-${index}`}
                        label={`Храна: ${food}`}
                        editorMode={editorMode}
                        state={editor.getElementState(`food-rec-${index}`)}
                        onToggleVisibility={editor.toggleVisibility}
                        onAddComment={editor.addComment}
                        onDeleteComment={editor.deleteComment}
                        level={3}
                      >
                        <Badge variant="secondary" className="bg-accent/10 text-accent-foreground hover:bg-accent/20">
                          {food}
                        </Badge>
                      </DeepEditableWrapper>
                    ))}
                  </div>
                </div>
              </DeepEditableWrapper>
            )}

            {avoid.length > 0 && (
              <DeepEditableWrapper
                id="avoid-foods-section"
                label="Храни за Избягване (секция)"
                editorMode={editorMode}
                state={editor.getElementState('avoid-foods-section')}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <XCircle size={16} weight="fill" className="text-destructive" />
                    За Избягване
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {avoid.slice(0, 5).map((food, index) => (
                      <DeepEditableWrapper
                        key={`food-avoid-${index}`}
                        id={`food-avoid-${index}`}
                        label={`Избягвай: ${food}`}
                        editorMode={editorMode}
                        state={editor.getElementState(`food-avoid-${index}`)}
                        onToggleVisibility={editor.toggleVisibility}
                        onAddComment={editor.addComment}
                        onDeleteComment={editor.deleteComment}
                        level={3}
                      >
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                          {food}
                        </Badge>
                      </DeepEditableWrapper>
                    ))}
                  </div>
                </div>
              </DeepEditableWrapper>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function SupplementRecommendations({ 
  items, 
  editorMode, 
  editor 
}: { 
  items: SupplementRecommendation[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Pill size={20} weight="duotone" className="text-accent" />
            Хранителни Добавки
          </h3>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3">
            {items.slice(0, 3).map((item, index) => (
              <DeepEditableWrapper
                key={`supplement-${index}`}
                id={`supplement-${index}`}
                label={`Добавка: ${item.name}`}
                editorMode={editorMode}
                state={editor.getElementState(`supplement-${index}`)}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div className="p-3 bg-muted/30 rounded-md space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.dosage}</p>
                  {item.timing && <p className="text-xs text-foreground/80">{item.timing}</p>}
                  {item.notes && <p className="text-xs text-foreground/80">{item.notes}</p>}
                </div>
              </DeepEditableWrapper>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function ExerciseRecommendations({ 
  items, 
  editorMode, 
  editor 
}: { 
  items: string[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Heart size={20} weight="duotone" className="text-accent" />
            Физическа Активност
          </h3>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-2">
            {items.slice(0, 3).map((item, index) => (
              <DeepEditableWrapper
                key={`exercise-${index}`}
                id={`exercise-${index}`}
                label={`Упражнение ${index + 1}`}
                editorMode={editorMode}
                state={editor.getElementState(`exercise-${index}`)}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <CheckCircle size={16} weight="fill" className="text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              </DeepEditableWrapper>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function LifestyleRecommendations({ 
  items, 
  editorMode, 
  editor 
}: { 
  items: string[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Leaf size={20} weight="duotone" className="text-accent" />
            Начин на Живот
          </h3>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-2">
            {items.slice(0, 3).map((item, index) => (
              <DeepEditableWrapper
                key={`lifestyle-${index}`}
                id={`lifestyle-${index}`}
                label={`Препоръка ${index + 1}`}
                editorMode={editorMode}
                state={editor.getElementState(`lifestyle-${index}`)}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <CheckCircle size={16} weight="fill" className="text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              </DeepEditableWrapper>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function StressManagement({ 
  items, 
  editorMode, 
  editor 
}: { 
  items: string[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Brain size={20} weight="duotone" className="text-accent" />
            Управление на Стреса
          </h3>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-2">
            {items.slice(0, 3).map((item, index) => (
              <DeepEditableWrapper
                key={`stress-${index}`}
                id={`stress-${index}`}
                label={`Техника ${index + 1}`}
                editorMode={editorMode}
                state={editor.getElementState(`stress-${index}`)}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <CheckCircle size={16} weight="fill" className="text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              </DeepEditableWrapper>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function SleepOptimization({ 
  items, 
  editorMode, 
  editor 
}: { 
  items: string[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Heart size={20} weight="duotone" className="text-accent" />
            Оптимизация на Съня
          </h3>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-2">
            {items.slice(0, 3).map((item, index) => (
              <DeepEditableWrapper
                key={`sleep-${index}`}
                id={`sleep-${index}`}
                label={`Съвет ${index + 1}`}
                editorMode={editorMode}
                state={editor.getElementState(`sleep-${index}`)}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <CheckCircle size={16} weight="fill" className="text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              </DeepEditableWrapper>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function HydrationTips({ 
  items, 
  editorMode, 
  editor 
}: { 
  items: string[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Flask size={20} weight="duotone" className="text-accent" />
            Хидратация
          </h3>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-2">
            {items.slice(0, 3).map((item, index) => (
              <DeepEditableWrapper
                key={`hydration-${index}`}
                id={`hydration-${index}`}
                label={`Съвет ${index + 1}`}
                editorMode={editorMode}
                state={editor.getElementState(`hydration-${index}`)}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <CheckCircle size={16} weight="fill" className="text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              </DeepEditableWrapper>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function SpecialConsiderations({ 
  items, 
  editorMode, 
  editor 
}: { 
  items: string[]
  editorMode: boolean
  editor: ReturnType<typeof useDeepEditable>
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!items || items.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <WarningCircle size={20} weight="duotone" className="text-accent" />
            Специални Указания
          </h3>
          <CaretDown 
            size={20} 
            className={cn('transition-transform text-muted-foreground', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-2">
            {items.slice(0, 3).map((item, index) => (
              <DeepEditableWrapper
                key={`special-${index}`}
                id={`special-${index}`}
                label={`Указание ${index + 1}`}
                editorMode={editorMode}
                state={editor.getElementState(`special-${index}`)}
                onToggleVisibility={editor.toggleVisibility}
                onAddComment={editor.addComment}
                onDeleteComment={editor.deleteComment}
                level={2}
              >
                <div className="flex items-start gap-2 p-2 bg-accent/10 rounded-md border border-accent/30">
                  <WarningCircle size={16} weight="fill" className="text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              </DeepEditableWrapper>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
