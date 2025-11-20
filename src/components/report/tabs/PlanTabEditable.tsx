import { useState } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
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
import { motion } from 'framer-motion'
import type { AnalysisReport, EditorModeConfig, ReportContainer, SupplementRecommendation } from '@/types'
import { cn } from '@/lib/utils'
import EditableContainer from '../EditableContainer'
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

interface PlanTabEditableProps {
  report: AnalysisReport
}

const DEFAULT_CONTAINERS: ReportContainer[] = [
  {
    id: 'general-recommendations-container',
    moduleId: 'plan',
    type: 'collapsible',
    title: 'Общи Препоръки',
    visible: true,
    order: 0,
    comments: [],
    interactive: true,
    metadata: { icon: 'Lightbulb' }
  },
  {
    id: 'food-recommendations-container',
    moduleId: 'plan',
    type: 'collapsible',
    title: 'Хранителни Препоръки',
    visible: true,
    order: 1,
    comments: [],
    interactive: true,
    metadata: { icon: 'AppleLogo' }
  },
  {
    id: 'supplements-container',
    moduleId: 'plan',
    type: 'collapsible',
    title: 'Хранителни Добавки',
    visible: true,
    order: 2,
    comments: [],
    interactive: true,
    metadata: { icon: 'Pill' }
  },
  {
    id: 'psychological-recommendations-container',
    moduleId: 'plan',
    type: 'collapsible',
    title: 'Психологически Препоръки',
    visible: true,
    order: 3,
    comments: [],
    interactive: true,
    metadata: { icon: 'Brain' }
  },
  {
    id: 'special-recommendations-container',
    moduleId: 'plan',
    type: 'collapsible',
    title: 'Специални Препоръки',
    visible: true,
    order: 4,
    comments: [],
    interactive: true,
    metadata: { icon: 'Heart' }
  },
  {
    id: 'recommended-tests-container',
    moduleId: 'plan',
    type: 'collapsible',
    title: 'Препоръчителни Изследвания',
    visible: true,
    order: 5,
    comments: [],
    interactive: true,
    metadata: { icon: 'Flask' }
  },
]

export default function PlanTabEditable({ report }: PlanTabEditableProps) {
  const [editorConfig, setEditorConfig] = useKVWithFallback<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [],
    lastModified: new Date().toISOString()
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  if (!report.detailedPlan) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Планът не е наличен
      </div>
    )
  }

  const { detailedPlan, motivationalSummary } = report
  
  const planModule = editorConfig?.moduleOrder?.find(m => m.id === 'plan')
  const containers = planModule?.containers && planModule.containers.length > 0 
    ? planModule.containers 
    : DEFAULT_CONTAINERS

  const sortedContainers = [...containers].sort((a, b) => a.order - b.order)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id || !editorConfig) return

    const oldIndex = sortedContainers.findIndex(c => c.id === active.id)
    const newIndex = sortedContainers.findIndex(c => c.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sortedContainers, oldIndex, newIndex).map((c, idx) => ({
      ...c,
      order: idx
    }))

    const updatedModules = editorConfig.moduleOrder.map(m => 
      m.id === 'plan' ? { ...m, containers: reordered } : m
    )

    setEditorConfig(current => ({
      ...current!,
      moduleOrder: updatedModules,
      lastModified: new Date().toISOString()
    }))

    toast.success('Контейнерите са пренаредени')
  }

  const handleToggleVisibility = (containerId: string) => {
    if (!editorConfig) return
    
    const updatedContainers = sortedContainers.map(c =>
      c.id === containerId ? { ...c, visible: !c.visible } : c
    )

    const updatedModules = editorConfig.moduleOrder.map(m =>
      m.id === 'plan' ? { ...m, containers: updatedContainers } : m
    )

    setEditorConfig(current => ({
      ...current!,
      moduleOrder: updatedModules,
      lastModified: new Date().toISOString()
    }))
  }

  const handleAddComment = (containerId: string, text: string) => {
    if (!editorConfig) return
    
    const newComment = {
      id: `comment-${Date.now()}`,
      moduleId: 'plan',
      containerId,
      text,
      timestamp: new Date().toISOString(),
      resolved: false,
    }

    const updatedContainers = sortedContainers.map(c =>
      c.id === containerId 
        ? { ...c, comments: [...c.comments, newComment] } 
        : c
    )

    const updatedModules = editorConfig.moduleOrder.map(m =>
      m.id === 'plan' ? { ...m, containers: updatedContainers } : m
    )

    setEditorConfig(current => ({
      ...current!,
      moduleOrder: updatedModules,
      lastModified: new Date().toISOString()
    }))

    toast.success('Коментар добавен')
  }

  const handleDeleteComment = (containerId: string, commentId: string) => {
    if (!editorConfig) return
    
    const updatedContainers = sortedContainers.map(c =>
      c.id === containerId
        ? { ...c, comments: c.comments.filter(comment => comment.id !== commentId) }
        : c
    )

    const updatedModules = editorConfig.moduleOrder.map(m =>
      m.id === 'plan' ? { ...m, containers: updatedContainers } : m
    )

    setEditorConfig(current => ({
      ...current!,
      moduleOrder: updatedModules,
      lastModified: new Date().toISOString()
    }))

    toast.success('Коментар изтрит')
  }

  const renderContainerContent = (container: ReportContainer) => {
    switch (container.id) {
      case 'general-recommendations-container':
        const hasGeneralRecs = detailedPlan.generalRecommendations && detailedPlan.generalRecommendations.length > 0
        if (!hasGeneralRecs) return null
        return (
          <CollapsibleSection 
            section={{
              id: 'general',
              title: 'Общи Препоръки',
              icon: Lightbulb,
              content: detailedPlan.generalRecommendations.slice(0, 3)
            }} 
          />
        )
      
      case 'food-recommendations-container':
        const hasFoodRecsInContainer = (detailedPlan.recommendedFoods && detailedPlan.recommendedFoods.length > 0) || 
                                       (detailedPlan.avoidFoods && detailedPlan.avoidFoods.length > 0)
        if (!hasFoodRecsInContainer) return null
        return (
          <FoodRecommendationsSection 
            recommendedFoods={detailedPlan.recommendedFoods || []}
            avoidFoods={detailedPlan.avoidFoods || []}
          />
        )
      
      case 'supplements-container':
        const hasSupplements = detailedPlan.supplements && detailedPlan.supplements.length > 0
        if (!hasSupplements) return null
        return (
          <SupplementsSection supplements={detailedPlan.supplements.slice(0, 3)} />
        )
      
      case 'psychological-recommendations-container':
        const hasPsychRecs = detailedPlan.psychologicalRecommendations && detailedPlan.psychologicalRecommendations.length > 0
        if (!hasPsychRecs) return null
        return (
          <CollapsibleSection 
            section={{
              id: 'psychological',
              title: 'Психологически Препоръки',
              icon: Brain,
              content: detailedPlan.psychologicalRecommendations.slice(0, 3)
            }} 
          />
        )
      
      case 'special-recommendations-container':
        const hasSpecialRecs = detailedPlan.specialRecommendations && detailedPlan.specialRecommendations.length > 0
        if (!hasSpecialRecs) return null
        return (
          <CollapsibleSection 
            section={{
              id: 'special',
              title: 'Специални Препоръки',
              icon: Heart,
              content: detailedPlan.specialRecommendations.slice(0, 3)
            }} 
          />
        )
      
      case 'recommended-tests-container':
        const hasTests = detailedPlan.recommendedTests && detailedPlan.recommendedTests.length > 0
        if (!hasTests) return null
        return (
          <CollapsibleSection 
            section={{
              id: 'tests',
              title: 'Препоръчителни Изследвания',
              icon: Flask,
              content: detailedPlan.recommendedTests.slice(0, 3)
            }} 
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={sortedContainers.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedContainers.map((container) => (
            <EditableContainer
              key={container.id}
              container={container}
              editorMode={editorConfig?.enabled}
              onToggleVisibility={handleToggleVisibility}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
            >
              {renderContainerContent(container)}
            </EditableContainer>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

interface PlanSection {
  id: string
  title: string
  icon: typeof AppleLogo
  content: string[]
  priority?: 'high' | 'medium' | 'low'
}

function CollapsibleSection({ section }: { section: PlanSection }) {
  const [isOpen, setIsOpen] = useState(false)
  const Icon = section.icon
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon size={20} weight="duotone" className="text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-base">{section.title}</h3>
            <p className="text-xs text-muted-foreground">{section.content.length} препоръки</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <CaretDown size={18} className="text-muted-foreground" />
        </motion.div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-2">
          {section.content.map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-sm leading-relaxed text-foreground/90">{item}</p>
            </motion.div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function FoodRecommendationsSection({ 
  recommendedFoods, 
  avoidFoods 
}: { 
  recommendedFoods: string[]
  avoidFoods: string[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <AppleLogo size={20} weight="duotone" className="text-green-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-base">Хранителни Препоръки</h3>
            <p className="text-xs text-muted-foreground">
              {recommendedFoods.length} препоръчани • {avoidFoods.length} за избягване
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <CaretDown size={18} className="text-muted-foreground" />
        </motion.div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4">
          {recommendedFoods.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} weight="fill" className="text-green-600" />
                <h4 className="text-sm font-semibold text-green-700">Препоръчителни храни</h4>
              </div>
              <div className="space-y-2">
                {recommendedFoods.map((food, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.2 }}
                    className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-200"
                  >
                    <CheckCircle size={14} weight="fill" className="text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-900">{food}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          
          {avoidFoods.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={16} weight="fill" className="text-red-600" />
                <h4 className="text-sm font-semibold text-red-700">Храни за избягване</h4>
              </div>
              <div className="space-y-2">
                {avoidFoods.map((food, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.2 }}
                    className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-200"
                  >
                    <XCircle size={14} weight="fill" className="text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-900">{food}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function SupplementsSection({ supplements }: { supplements: SupplementRecommendation[] }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Pill size={20} weight="duotone" className="text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-base">Хранителни Добавки</h3>
            <p className="text-xs text-muted-foreground">{supplements.length} добавки</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <CaretDown size={18} className="text-muted-foreground" />
        </motion.div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-3">
          {supplements.map((supp, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              className="p-4 bg-blue-50 rounded-lg border border-blue-200"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Pill size={16} weight="fill" className="text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 mb-1">{supp.name}</h4>
                  <div className="space-y-1 text-xs text-blue-800">
                    <p><span className="font-medium">Дозировка:</span> {supp.dosage}</p>
                    <p><span className="font-medium">Прием:</span> {supp.timing}</p>
                    {supp.notes && (
                      <p className="text-blue-700 italic mt-2">{supp.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
