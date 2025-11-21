import { useState } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  PencilSimple, 
  Eye, 
  ChatCircleDots, 
  ArrowsDownUp,
  CheckCircle,
  Warning,
  Info,
  Trash
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { EditorModeConfig, ReportModuleComment } from '@/types'
import { cn } from '@/lib/utils'
import EditorCommentsExport from './EditorCommentsExport'
import GitHubSyncPanel from './GitHubSyncPanel'

export default function EditorModeTab() {
  const [editorConfig, setEditorConfig] = useKVWithFallback<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [
      { id: 'overview', type: 'overview', title: 'Обща Информация', visible: true, order: 0, comments: [], containers: [] },
      { id: 'iridology', type: 'iridology', title: 'Иридологичен Анализ', visible: true, order: 1, comments: [], containers: [] },
      { id: 'plan', type: 'plan', title: 'План за Действие', visible: true, order: 2, comments: [], containers: [] },
    ],
    lastModified: new Date().toISOString()
  })

  const handleToggleEditor = (enabled: boolean) => {
    setEditorConfig((current) => ({
      ...current!,
      enabled,
      lastModified: new Date().toISOString()
    }))
    toast.success(enabled ? 'Editor Mode активиран' : 'Editor Mode деактивиран')
  }

  const handleResetModules = () => {
    if (confirm('Сигурни ли сте, че искате да нулирате всички модули и коментари?')) {
      setEditorConfig(() => ({
        enabled: editorConfig?.enabled || false,
        moduleOrder: [
          { id: 'overview', type: 'overview', title: 'Обща Информация', visible: true, order: 0, comments: [], containers: [] },
          { id: 'iridology', type: 'iridology', title: 'Иридологичен Анализ', visible: true, order: 1, comments: [], containers: [] },
          { id: 'plan', type: 'plan', title: 'План за Действие', visible: true, order: 2, comments: [], containers: [] },
        ],
        lastModified: new Date().toISOString()
      }))
      toast.success('Модулите са нулирани')
    }
  }

  const handleClearComments = () => {
    if (confirm('Сигурни ли сте, че искате да изтриете всички коментари?')) {
      setEditorConfig((current) => ({
        ...current!,
        moduleOrder: current!.moduleOrder.map(m => ({ ...m, comments: [] })),
        lastModified: new Date().toISOString()
      }))
      toast.success('Всички коментари са изтрити')
    }
  }

  const getTotalComments = () => {
    let total = 0
    editorConfig?.moduleOrder.forEach(module => {
      total += module.comments.length
      module.containers?.forEach(container => {
        total += container.comments.length
      })
    })
    return total
  }

  const getUnresolvedComments = () => {
    let total = 0
    editorConfig?.moduleOrder.forEach(module => {
      total += module.comments.filter(c => !c.resolved).length
      module.containers?.forEach(container => {
        total += container.comments.filter(c => !c.resolved).length
      })
    })
    return total
  }

  const getTotalContainers = () => {
    return editorConfig?.moduleOrder.reduce((total, module) => 
      total + (module.containers?.length || 0), 0
    ) || 0
  }

  const getVisibleContainers = () => {
    return editorConfig?.moduleOrder.reduce((total, module) => 
      total + (module.containers?.filter(c => c.visible).length || 0), 0
    ) || 0
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PencilSimple size={24} weight="duotone" />
                Editor Mode
              </CardTitle>
              <CardDescription className="mt-2">
                Активирайте editor mode, за да управлявате модулите в репорт страницата
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="editor-mode" className="cursor-pointer">
                {editorConfig?.enabled ? 'Активен' : 'Неактивен'}
              </Label>
              <Switch
                id="editor-mode"
                checked={editorConfig?.enabled || false}
                onCheckedChange={handleToggleEditor}
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ArrowsDownUp size={20} weight="duotone" className="text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{editorConfig?.moduleOrder.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Модули</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Info size={20} weight="duotone" className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{getTotalContainers()}</p>
                    <p className="text-xs text-muted-foreground">Контейнери ({getVisibleContainers()} видими)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <ChatCircleDots size={20} weight="duotone" className="text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{getUnresolvedComments()}</p>
                    <p className="text-xs text-muted-foreground">Отворени Коментари</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle size={20} weight="duotone" className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{getTotalComments() - getUnresolvedComments()}</p>
                    <p className="text-xs text-muted-foreground">Решени Коментари</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button 
              onClick={handleClearComments} 
              variant="outline" 
              size="sm"
              disabled={getTotalComments() === 0}
            >
              <Trash size={16} className="mr-2" />
              Изтрий Всички Коментари
            </Button>
            <Button 
              onClick={handleResetModules} 
              variant="outline" 
              size="sm"
            >
              <ArrowsDownUp size={16} className="mr-2" />
              Нулирай Модули
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditorCommentsExport />

      <GitHubSyncPanel />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Какво е Editor Mode?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ArrowsDownUp size={16} weight="duotone" className="text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Пренареждане на Модули</h4>
                <p className="text-sm text-muted-foreground">
                  Плъзнете и пуснете модулите, за да промените реда им в репорта
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Eye size={16} weight="duotone" className="text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Управление на Видимост</h4>
                <p className="text-sm text-muted-foreground">
                  Скривайте или показвайте модули без да ги изтривате
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ChatCircleDots size={16} weight="duotone" className="text-orange-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Система за Коментари</h4>
                <p className="text-sm text-muted-foreground">
                  Добавяйте коментари и инструкции за промени към всеки модул и контейнер. AI ще чете тези коментари за бъдещи подобрения.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info size={16} weight="duotone" className="text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Детайлен Контрол на Контейнери</h4>
                <p className="text-sm text-muted-foreground">
                  Всеки модул съдържа множество контейнери. Можете да редактирате, премествате, скривате и коментирате всеки контейнер отделно за пълен контрол.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Trash size={16} weight="duotone" className="text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Изтриване на Модули</h4>
                <p className="text-sm text-muted-foreground">
                  Премахвайте ненужни модули от репорта
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {editorConfig && editorConfig.moduleOrder.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Текущи Модули</CardTitle>
            <CardDescription>
              Списък с всички модули и техните коментари
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {editorConfig.moduleOrder.map((module, index) => {
                  const unresolvedModuleComments = module.comments.filter(c => !c.resolved)
                  const resolvedModuleComments = module.comments.filter(c => c.resolved)
                  
                  let unresolvedContainerComments = 0
                  const totalContainers = module.containers?.length || 0
                  const visibleContainers = module.containers?.filter(c => c.visible).length || 0
                  
                  module.containers?.forEach(container => {
                    unresolvedContainerComments += container.comments.filter(c => !c.resolved).length
                  })
                  
                  return (
                    <Card key={module.id} className={cn(
                      "p-4",
                      !module.visible && "opacity-50 bg-muted/50"
                    )}>
                      <div className="space-y-3">
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
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {module.type}
                            </Badge>
                            {totalContainers > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {visibleContainers}/{totalContainers} контейнера
                              </Badge>
                            )}
                          </div>
                        </div>

                        {totalContainers > 0 && (
                          <div className="pl-4 space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Контейнери:</p>
                            <div className="grid grid-cols-2 gap-2">
                              {module.containers?.slice(0, 6).map((container) => (
                                <div 
                                  key={container.id} 
                                  className={cn(
                                    "text-xs p-2 rounded border bg-background/50",
                                    !container.visible && "opacity-50"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="truncate text-[10px]">{container.title}</span>
                                    {container.comments.filter(c => !c.resolved).length > 0 && (
                                      <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                        {container.comments.filter(c => !c.resolved).length}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {totalContainers > 6 && (
                                <div className="text-xs p-2 rounded border bg-muted/30 flex items-center justify-center text-muted-foreground">
                                  +{totalContainers - 6} още
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {(unresolvedModuleComments.length > 0 || unresolvedContainerComments > 0) && (
                          <div className="space-y-2 pl-4 border-l-2 border-orange-200">
                            {unresolvedModuleComments.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Warning size={14} className="text-orange-600" />
                                  <p className="text-xs font-semibold text-orange-600">
                                    {unresolvedModuleComments.length} коментар(а) за модула
                                  </p>
                                </div>
                                <div className="space-y-1.5">
                                  {unresolvedModuleComments.map((comment) => (
                                    <div key={comment.id} className="bg-orange-50 dark:bg-orange-950/20 p-2 rounded text-xs">
                                      <p className="text-foreground/90">{comment.text}</p>
                                      <p className="text-muted-foreground text-[10px] mt-1">
                                        {new Date(comment.timestamp).toLocaleString('bg-BG')}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {unresolvedContainerComments > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Info size={14} className="text-blue-600" />
                                  <p className="text-xs font-semibold text-blue-600">
                                    {unresolvedContainerComments} коментар(а) за контейнери
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {resolvedModuleComments.length > 0 && (
                          <div className="space-y-2 pl-4 border-l-2 border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle size={14} className="text-green-600" />
                              <p className="text-xs font-semibold text-green-600">
                                {resolvedModuleComments.length} разрешени коментара
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              {resolvedModuleComments.map((comment) => (
                                <div key={comment.id} className="bg-muted p-2 rounded text-xs opacity-60">
                                  <p className="line-through">{comment.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {module.comments.length === 0 && unresolvedContainerComments === 0 && (
                          <p className="text-xs text-muted-foreground pl-4">
                            Няма коментари
                          </p>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info size={20} weight="duotone" className="text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Важно</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Editor Mode работи само когато сте логнати като собственик</li>
                <li>Промените в модулите се запазват автоматично</li>
                <li>Коментарите са достъпни за AI агента за бъдещи подобрения</li>
                <li>Използвайте коментарите, за да дадете точни инструкции за промени</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
