import { useState } from 'react'
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
  Activity,
  CaretDown
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import IrisWithOverlay from '@/components/iris/IrisWithOverlay'
import IrisVisualization from '../IrisVisualization'
import ZoneHeatmap from '../ZoneHeatmap'
import ZoneStatusPieChart from '../ZoneStatusPieChart'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import EditableElement from '../EditableElement'
import { useEditableElements } from '@/hooks/use-editable-elements'
import { cn } from '@/lib/utils'

interface IridologyTabFullyEditableProps {
  report: AnalysisReport
  editorMode?: boolean
}

export default function IridologyTabFullyEditable({ report, editorMode = true }: IridologyTabFullyEditableProps) {
  const [activeIris, setActiveIris] = useState<'left' | 'right'>('left')
  const [expandedZones, setExpandedZones] = useState(true)
  const editor = useEditableElements('iridology-tab', editorMode)
  
  const leftZones = report.leftIris?.zones || []
  const rightZones = report.rightIris?.zones || []
  const concernZones = leftZones.filter(z => z?.status === 'concern').concat(
    rightZones.filter(z => z?.status === 'concern')
  )
  const attentionZones = leftZones.filter(z => z?.status === 'attention').concat(
    rightZones.filter(z => z?.status === 'attention')
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concern':
        return <Warning size={16} weight="fill" className="text-destructive" />
      case 'attention':
        return <SealWarning size={16} weight="fill" className="text-amber-500" />
      case 'normal':
        return <CheckCircle size={16} weight="fill" className="text-green-500" />
      default:
        return <ShieldCheck size={16} weight="fill" className="text-muted-foreground" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'concern':
        return 'Притеснение'
      case 'attention':
        return 'Внимание'
      case 'normal':
        return 'Нормално'
      default:
        return 'Неизвестно'
    }
  }

  return (
    <div className="space-y-3">
      <EditableElement
        id="zone-pie-chart-section"
        type="card"
        label="Секция: Статистика"
        editorMode={editorMode}
        visible={editor.getElementState('zone-pie-chart-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('zone-pie-chart-section').comments}
        metadata={{ type: 'chart', chartType: 'pie' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-5">
            <EditableElement
              id="zone-pie-chart-header"
              type="heading"
              label="Заглавие: Статистика"
              editorMode={editorMode}
              visible={editor.getElementState('zone-pie-chart-header').visible}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onResolveComment={editor.resolveComment}
              onDeleteComment={editor.deleteComment}
              comments={editor.getElementState('zone-pie-chart-header').comments}
            >
              <h3 className="font-semibold text-base mb-4">Статистика по Зони</h3>
            </EditableElement>
            
            <EditableElement
              id="zone-pie-chart"
              type="chart"
              label="Диаграма: Зони"
              editorMode={editorMode}
              visible={editor.getElementState('zone-pie-chart').visible}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onResolveComment={editor.resolveComment}
              onDeleteComment={editor.deleteComment}
              comments={editor.getElementState('zone-pie-chart').comments}
              metadata={{ chartType: 'pie' }}
            >
              <ZoneStatusPieChart leftIris={report.leftIris} rightIris={report.rightIris} />
            </EditableElement>
          </Card>
        </motion.div>
      </EditableElement>

      <EditableElement
        id="detailed-analysis-section"
        type="card"
        label="Секция: Детайлен Анализ"
        editorMode={editorMode}
        visible={editor.getElementState('detailed-analysis-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('detailed-analysis-section').comments}
        metadata={{ type: 'analysis', interactive: true }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Collapsible open={expandedZones} onOpenChange={setExpandedZones}>
            <Card className="p-5">
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                <EditableElement
                  id="detailed-analysis-header"
                  type="heading"
                  label="Заглавие: Детайлен Анализ"
                  editorMode={editorMode}
                  visible={editor.getElementState('detailed-analysis-header').visible}
                  onToggleVisibility={editor.toggleVisibility}
                  onAddComment={editor.addComment}
                  onResolveComment={editor.resolveComment}
                  onDeleteComment={editor.deleteComment}
                  comments={editor.getElementState('detailed-analysis-header').comments}
                  wrapperClassName="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Activity size={20} weight="duotone" className="text-primary" />
                    <h3 className="font-semibold text-base">Детайлен Иридологичен Анализ</h3>
                  </div>
                </EditableElement>
                <motion.div
                  animate={{ rotate: expandedZones ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CaretDown size={18} className="text-muted-foreground" />
                </motion.div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="mt-4 space-y-4">
                  {concernZones.length > 0 && (
                    <EditableElement
                      id="concern-zones-list"
                      type="list"
                      label="Списък: Зони с Притеснение"
                      editorMode={editorMode}
                      visible={editor.getElementState('concern-zones-list').visible}
                      onToggleVisibility={editor.toggleVisibility}
                      onAddComment={editor.addComment}
                      onResolveComment={editor.resolveComment}
                      onDeleteComment={editor.deleteComment}
                      comments={editor.getElementState('concern-zones-list').comments}
                    >
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <Warning size={16} weight="fill" className="text-destructive" />
                          Зони изискващи притеснение
                        </h4>
                        <div className="space-y-2">
                          {concernZones.map((zone, idx) => (
                            <EditableElement
                              key={idx}
                              id={`concern-zone-${idx}`}
                              type="card"
                              label={`Зона: ${zone.name}`}
                              editorMode={editorMode}
                              visible={editor.getElementState(`concern-zone-${idx}`).visible}
                              onToggleVisibility={editor.toggleVisibility}
                              onAddComment={editor.addComment}
                              onResolveComment={editor.resolveComment}
                              onDeleteComment={editor.deleteComment}
                              comments={editor.getElementState(`concern-zone-${idx}`).comments}
                              metadata={{ zoneName: zone.name, status: zone.status }}
                            >
                              <Card className="p-3 bg-destructive/5 border-destructive/20">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{zone.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{zone.findings}</p>
                                  </div>
                                  <Badge variant="destructive" className="text-xs">
                                    {getStatusLabel(zone.status)}
                                  </Badge>
                                </div>
                              </Card>
                            </EditableElement>
                          ))}
                        </div>
                      </div>
                    </EditableElement>
                  )}

                  {attentionZones.length > 0 && (
                    <EditableElement
                      id="attention-zones-list"
                      type="list"
                      label="Списък: Зони с Внимание"
                      editorMode={editorMode}
                      visible={editor.getElementState('attention-zones-list').visible}
                      onToggleVisibility={editor.toggleVisibility}
                      onAddComment={editor.addComment}
                      onResolveComment={editor.resolveComment}
                      onDeleteComment={editor.deleteComment}
                      comments={editor.getElementState('attention-zones-list').comments}
                    >
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <SealWarning size={16} weight="fill" className="text-amber-500" />
                          Зони изискващи внимание
                        </h4>
                        <div className="space-y-2">
                          {attentionZones.map((zone, idx) => (
                            <EditableElement
                              key={idx}
                              id={`attention-zone-${idx}`}
                              type="card"
                              label={`Зона: ${zone.name}`}
                              editorMode={editorMode}
                              visible={editor.getElementState(`attention-zone-${idx}`).visible}
                              onToggleVisibility={editor.toggleVisibility}
                              onAddComment={editor.addComment}
                              onResolveComment={editor.resolveComment}
                              onDeleteComment={editor.deleteComment}
                              comments={editor.getElementState(`attention-zone-${idx}`).comments}
                              metadata={{ zoneName: zone.name, status: zone.status }}
                            >
                              <Card className="p-3 bg-amber-50 border-amber-200">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{zone.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{zone.findings}</p>
                                  </div>
                                  <Badge className="text-xs bg-amber-100 text-amber-900 border-amber-300">
                                    {getStatusLabel(zone.status)}
                                  </Badge>
                                </div>
                              </Card>
                            </EditableElement>
                          ))}
                        </div>
                      </div>
                    </EditableElement>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>
      </EditableElement>

      <EditableElement
        id="iris-visualization-section"
        type="card"
        label="Секция: Визуализация"
        editorMode={editorMode}
        visible={editor.getElementState('iris-visualization-section').visible}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onResolveComment={editor.resolveComment}
        onDeleteComment={editor.deleteComment}
        comments={editor.getElementState('iris-visualization-section').comments}
        metadata={{ type: 'visualization', interactive: true }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="p-5">
            <EditableElement
              id="iris-visualization-header"
              type="heading"
              label="Заглавие: Визуализация"
              editorMode={editorMode}
              visible={editor.getElementState('iris-visualization-header').visible}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onResolveComment={editor.resolveComment}
              onDeleteComment={editor.deleteComment}
              comments={editor.getElementState('iris-visualization-header').comments}
            >
              <h3 className="font-semibold text-base mb-4">Визуализация на Ирисите</h3>
            </EditableElement>

            <EditableElement
              id="iris-tabs"
              type="custom"
              label="Табове: Ирис"
              editorMode={editorMode}
              visible={editor.getElementState('iris-tabs').visible}
              onToggleVisibility={editor.toggleVisibility}
              onAddComment={editor.addComment}
              onResolveComment={editor.resolveComment}
              onDeleteComment={editor.deleteComment}
              comments={editor.getElementState('iris-tabs').comments}
              metadata={{ interactive: true }}
            >
              <Tabs value={activeIris} onValueChange={(v) => setActiveIris(v as 'left' | 'right')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="left">Ляв Ирис</TabsTrigger>
                  <TabsTrigger value="right">Десен Ирис</TabsTrigger>
                </TabsList>

                <TabsContent value="left" className="space-y-4">
                  <EditableElement
                    id="left-iris-image"
                    type="custom"
                    label="Изображение: Ляв Ирис"
                    editorMode={editorMode}
                    visible={editor.getElementState('left-iris-image').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('left-iris-image').comments}
                  >
                    <IrisWithOverlay
                      imageDataUrl={report.leftIrisImage.dataUrl}
                      side="left"
                    />
                  </EditableElement>

                  <EditableElement
                    id="left-iris-visualization"
                    type="chart"
                    label="Диаграма: Ляв Ирис"
                    editorMode={editorMode}
                    visible={editor.getElementState('left-iris-visualization').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('left-iris-visualization').comments}
                  >
                    <IrisVisualization analysis={report.leftIris} side="left" />
                  </EditableElement>

                  <EditableElement
                    id="left-iris-heatmap"
                    type="chart"
                    label="Heatmap: Ляв Ирис"
                    editorMode={editorMode}
                    visible={editor.getElementState('left-iris-heatmap').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('left-iris-heatmap').comments}
                  >
                    <ZoneHeatmap zones={leftZones} side="left" />
                  </EditableElement>
                </TabsContent>

                <TabsContent value="right" className="space-y-4">
                  <EditableElement
                    id="right-iris-image"
                    type="custom"
                    label="Изображение: Десен Ирис"
                    editorMode={editorMode}
                    visible={editor.getElementState('right-iris-image').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('right-iris-image').comments}
                  >
                    <IrisWithOverlay
                      imageDataUrl={report.rightIrisImage.dataUrl}
                      side="right"
                    />
                  </EditableElement>

                  <EditableElement
                    id="right-iris-visualization"
                    type="chart"
                    label="Диаграма: Десен Ирис"
                    editorMode={editorMode}
                    visible={editor.getElementState('right-iris-visualization').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('right-iris-visualization').comments}
                  >
                    <IrisVisualization analysis={report.rightIris} side="right" />
                  </EditableElement>

                  <EditableElement
                    id="right-iris-heatmap"
                    type="chart"
                    label="Heatmap: Десен Ирис"
                    editorMode={editorMode}
                    visible={editor.getElementState('right-iris-heatmap').visible}
                    onToggleVisibility={editor.toggleVisibility}
                    onAddComment={editor.addComment}
                    onResolveComment={editor.resolveComment}
                    onDeleteComment={editor.deleteComment}
                    comments={editor.getElementState('right-iris-heatmap').comments}
                  >
                    <ZoneHeatmap zones={rightZones} side="right" />
                  </EditableElement>
                </TabsContent>
              </Tabs>
            </EditableElement>
          </Card>
        </motion.div>
      </EditableElement>
    </div>
  )
}
