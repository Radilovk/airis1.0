/**
 * Historical Report Editor
 * Allows editing historical reports with editor mode
 */

import { useState } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ClockClockwise,
  PencilSimple,
  Eye,
  Download,
  CheckCircle
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { AnalysisReport, EditorModeConfig } from '@/types'
import type { EditableElementsConfig } from '@/hooks/use-editable-elements'
import { ScrollArea } from '@/components/ui/scroll-area'

interface HistoricalReportEditorProps {
  report: AnalysisReport
  onSaveChanges: (report: AnalysisReport, editorConfig: any) => void
  onClose: () => void
}

export default function HistoricalReportEditor({ 
  report, 
  onSaveChanges, 
  onClose 
}: HistoricalReportEditorProps) {
  // Load the editor config for this specific report
  const storageKey = `editor-config-${report.id}`
  const [reportEditorConfig, setReportEditorConfig] = useKVWithFallback<EditorModeConfig>(
    storageKey,
    {
      enabled: true,
      moduleOrder: [
        { id: 'overview', type: 'overview', title: 'Обща Информация', visible: true, order: 0, comments: [], containers: [] },
        { id: 'iridology', type: 'iridology', title: 'Иридологичен Анализ', visible: true, order: 1, comments: [], containers: [] },
        { id: 'plan', type: 'plan', title: 'План за Действие', visible: true, order: 2, comments: [], containers: [] },
      ],
      lastModified: new Date().toISOString()
    }
  )

  const elementsStorageKey = `editable-elements-${report.id}`
  const [reportElementsConfig] = useKVWithFallback<EditableElementsConfig>(
    elementsStorageKey,
    {}
  )

  const [hasChanges, setHasChanges] = useState(false)

  const handleSave = () => {
    onSaveChanges(report, {
      editorConfig: reportEditorConfig,
      elementsConfig: reportElementsConfig
    })
    setHasChanges(false)
    toast.success('Промените са запазени')
  }

  const getTotalComments = () => {
    let total = 0
    reportEditorConfig?.moduleOrder.forEach(module => {
      total += module.comments.length
      module.containers?.forEach(container => {
        total += container.comments.length
      })
    })
    
    // Add elements comments
    Object.values(reportElementsConfig || {}).forEach((moduleElements: any) => {
      Object.values(moduleElements).forEach((element: any) => {
        total += element.comments?.length || 0
      })
    })
    
    return total
  }

  const getUnresolvedComments = () => {
    let total = 0
    reportEditorConfig?.moduleOrder.forEach(module => {
      total += module.comments.filter(c => !c.resolved).length
      module.containers?.forEach(container => {
        total += container.comments.filter(c => !c.resolved).length
      })
    })
    
    // Add elements comments
    Object.values(reportElementsConfig || {}).forEach((moduleElements: any) => {
      Object.values(moduleElements).forEach((element: any) => {
        total += element.comments?.filter((c: any) => !c.resolved).length || 0
      })
    })
    
    return total
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('bg-BG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClockClockwise size={24} weight="duotone" className="text-primary" />
              </div>
              <div>
                <CardTitle>Редактиране на Исторически Репорт</CardTitle>
                <CardDescription>
                  {report.questionnaireData.name} · {formatDate(report.timestamp)}
                </CardDescription>
              </div>
            </div>
            <Badge variant={hasChanges ? 'default' : 'outline'}>
              {hasChanges ? 'Има промени' : 'Без промени'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <PencilSimple size={24} className="mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{getTotalComments()}</p>
                <p className="text-xs text-muted-foreground">Всичко коментари</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <Eye size={24} className="mx-auto mb-2 text-orange-500" />
                <p className="text-2xl font-bold">{getUnresolvedComments()}</p>
                <p className="text-xs text-muted-foreground">Отворени коментари</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <CheckCircle size={24} className="mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold">{getTotalComments() - getUnresolvedComments()}</p>
                <p className="text-xs text-muted-foreground">Решени коментари</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!hasChanges} className="flex-1">
              <Download size={16} className="mr-2" />
              Запази Промените
            </Button>
            <Button onClick={onClose} variant="outline">
              Затвори
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Модули</CardTitle>
          <CardDescription>
            Преглед на модулите и техните коментари
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {reportEditorConfig?.moduleOrder.map((module, index) => (
                <Card key={module.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <h4 className="font-semibold text-sm">{module.title}</h4>
                        {!module.visible && (
                          <Badge variant="secondary" className="text-xs">
                            Скрит
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {module.comments.filter(c => !c.resolved).length} коментара
                      </Badge>
                    </div>

                    {module.comments.filter(c => !c.resolved).length > 0 && (
                      <div className="space-y-1.5 pl-4 border-l-2 border-orange-200">
                        {module.comments
                          .filter(c => !c.resolved)
                          .map((comment) => (
                            <div key={comment.id} className="bg-orange-50 dark:bg-orange-950/20 p-2 rounded text-xs">
                              <p className="text-foreground/90">{comment.text}</p>
                              <p className="text-muted-foreground text-[10px] mt-1">
                                {new Date(comment.timestamp).toLocaleString('bg-BG')}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
