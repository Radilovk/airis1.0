import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Warning,
  CheckCircle,
  Info,
  Eye,
  SealWarning,
  ShieldCheck,
  Activity
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport, EditorModeConfig, ReportContainer } from '@/types'
import IrisWithOverlay from '@/components/iris/IrisWithOverlay'
import IrisVisualization from '../IrisVisualization'
import ZoneHeatmap from '../ZoneHeatmap'
import ZoneStatusPieChart from '../ZoneStatusPieChart'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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

interface IridologyTabEditableProps {
  report: AnalysisReport
}

const DEFAULT_CONTAINERS: ReportContainer[] = [
  {
    id: 'zone-pie-chart-container',
    moduleId: 'iridology',
    type: 'chart',
    title: 'Статистика по Зони',
    visible: true,
    order: 0,
    comments: [],
    interactive: false,
    metadata: { chartType: 'pie' }
  },
  {
    id: 'detailed-analysis-container',
    moduleId: 'iridology',
    type: 'collapsible',
    title: 'Детайлен Иридологичен Анализ',
    visible: true,
    order: 1,
    comments: [],
    interactive: true,
    metadata: { icon: 'Activity' }
  },
  {
    id: 'zone-stats-container',
    moduleId: 'iridology',
    type: 'card',
    title: 'Статистика на Зоните',
    visible: true,
    order: 2,
    comments: [],
    interactive: false,
    metadata: { icon: 'Activity' }
  },
  {
    id: 'iris-tabs-container',
    moduleId: 'iridology',
    type: 'custom',
    title: 'Визуализация на Ирисите',
    visible: true,
    order: 3,
    comments: [],
    interactive: true,
    metadata: { icon: 'Eye' }
  },
]

export default function IridologyTabEditable({ report }: IridologyTabEditableProps) {
  const [editorConfig, setEditorConfig] = useKV<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [],
    lastModified: new Date().toISOString()
  })

  const [expandedAnalysis, setExpandedAnalysis] = useState(false)
  const [activeIrisTab, setActiveIrisTab] = useState('left')
  
  const iridologyModule = editorConfig?.moduleOrder?.find(m => m.id === 'iridology')
  const containers = iridologyModule?.containers && iridologyModule.containers.length > 0 
    ? iridologyModule.containers 
    : DEFAULT_CONTAINERS

  const sortedContainers = [...containers].sort((a, b) => a.order - b.order)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
      m.id === 'iridology' ? { ...m, containers: reordered } : m
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
      m.id === 'iridology' ? { ...m, containers: updatedContainers } : m
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
      moduleId: 'iridology',
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
      m.id === 'iridology' ? { ...m, containers: updatedContainers } : m
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
      m.id === 'iridology' ? { ...m, containers: updatedContainers } : m
    )

    setEditorConfig(current => ({
      ...current!,
      moduleOrder: updatedModules,
      lastModified: new Date().toISOString()
    }))

    toast.success('Коментар изтрит')
  }
  
  const getStatusBadge = (status: 'normal' | 'attention' | 'concern') => {
    const variants = {
      normal: { variant: 'default' as const, icon: CheckCircle, text: 'Норма', color: 'text-green-600', bg: 'bg-green-50' },
      attention: { variant: 'secondary' as const, icon: Info, text: 'Внимание', color: 'text-yellow-600', bg: 'bg-yellow-50' },
      concern: { variant: 'destructive' as const, icon: Warning, text: 'Притеснение', color: 'text-red-600', bg: 'bg-red-50' }
    }
    const config = variants[status]
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="gap-1 text-xs">
        <Icon size={12} weight="fill" className={config.color} />
        {config.text}
      </Badge>
    )
  }
  
  const getZoneStats = (zones: any[]) => {
    const stats = {
      total: zones.length,
      normal: zones.filter(z => z?.status === 'normal').length,
      attention: zones.filter(z => z?.status === 'attention').length,
      concern: zones.filter(z => z?.status === 'concern').length
    }
    return stats
  }
  
  const leftStats = getZoneStats(report.leftIris?.zones || [])
  const rightStats = getZoneStats(report.rightIris?.zones || [])

  const renderContainerContent = (container: ReportContainer) => {
    switch (container.id) {
      case 'zone-pie-chart-container':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ZoneStatusPieChart leftIris={report.leftIris} rightIris={report.rightIris} />
          </motion.div>
        )
      
      case 'detailed-analysis-container':
        if (!report.detailedAnalysis) return null
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Collapsible open={expandedAnalysis} onOpenChange={setExpandedAnalysis}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full p-5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Activity size={20} weight="duotone" className="text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-base">Детайлен Иридологичен Анализ</h3>
                      <p className="text-xs text-muted-foreground">Пълно обяснение на находките</p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedAnalysis ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Warning size={18} className="text-muted-foreground" />
                  </motion.div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 space-y-3">
                    {report.detailedAnalysis.split(/\n\n+/).filter(p => p.trim()).map((paragraph, idx) => {
                      const cleanParagraph = paragraph.trim()
                      return cleanParagraph ? (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, duration: 0.25 }}
                          className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl"
                        >
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <p className="text-sm leading-relaxed text-foreground/90">{cleanParagraph}</p>
                        </motion.div>
                      ) : null
                    })}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        )
      
      case 'zone-stats-container':
        return (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-to-br from-green-50/50 to-green-100/30">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} weight="duotone" className="text-green-600" />
                <span className="text-xs font-semibold text-green-700">Здрави Зони</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{leftStats.normal + rightStats.normal}</p>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-yellow-50/50 to-yellow-100/30">
              <div className="flex items-center gap-2 mb-2">
                <Info size={18} weight="duotone" className="text-yellow-600" />
                <span className="text-xs font-semibold text-yellow-700">Внимание</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{leftStats.attention + rightStats.attention}</p>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-orange-50/50 to-orange-100/30">
              <div className="flex items-center gap-2 mb-2">
                <SealWarning size={18} weight="duotone" className="text-orange-600" />
                <span className="text-xs font-semibold text-orange-700">Притеснение</span>
              </div>
              <p className="text-2xl font-bold text-orange-700">{leftStats.concern + rightStats.concern}</p>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={18} weight="duotone" className="text-primary" />
                <span className="text-xs font-semibold text-primary">Общо Зони</span>
              </div>
              <p className="text-2xl font-bold text-primary">{leftStats.total + rightStats.total}</p>
            </Card>
          </div>
        )
      
      case 'iris-tabs-container':
        return (
          <Tabs value={activeIrisTab} onValueChange={setActiveIrisTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="left">Ляв Ирис</TabsTrigger>
              <TabsTrigger value="right">Десен Ирис</TabsTrigger>
            </TabsList>
            
            <TabsContent value="left">
              <IrisDetailsSection 
                iris={report.leftIris} 
                irisImage={report.leftIrisImage}
                side="left"
              />
            </TabsContent>
            
            <TabsContent value="right">
              <IrisDetailsSection 
                iris={report.rightIris} 
                irisImage={report.rightIrisImage}
                side="right"
              />
            </TabsContent>
          </Tabs>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
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

function IrisDetailsSection({ iris, irisImage, side }: { 
  iris: any
  irisImage: any
  side: 'left' | 'right'
}) {
  const [expandedZone, setExpandedZone] = useState<number | null>(null)
  
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="p-5">
          <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
            <Eye size={20} weight="duotone" className="text-primary" />
            {side === 'left' ? 'Ляв' : 'Десен'} Ирис - Визуализация
          </h3>
          <div className="flex justify-center">
            <IrisVisualization 
              analysis={iris}
              side={side}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-base mb-4">Тепловна Карта на Зоните</h3>
        <ZoneHeatmap zones={iris.zones} side={side} />
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-base mb-4">Детайли по Зони</h3>
        <div className="space-y-2">
          {iris.zones?.filter((z: any) => z && z.status !== 'normal').map((zone: any, idx: number) => (
            <Collapsible 
              key={idx}
              open={expandedZone === idx}
              onOpenChange={(open) => setExpandedZone(open ? idx : null)}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-2 h-2 rounded-full ${
                      zone.status === 'concern' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{zone.name}</span>
                        <Badge variant={zone.status === 'concern' ? 'destructive' : 'secondary'} className="text-xs">
                          {zone.status === 'concern' ? 'Притеснение' : 'Внимание'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{zone.organ}</p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedZone === idx ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Warning size={16} className="text-muted-foreground" />
                  </motion.div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 pt-2">
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {zone.findings}
                    </p>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </Card>
    </div>
  )
}
