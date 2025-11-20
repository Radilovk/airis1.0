import { useState } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
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
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  DotsSixVertical, 
  ChatCircleDots, 
  Eye, 
  EyeSlash, 
  Trash,
  Plus,
  CheckCircle,
  Clock
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { ReportModule, ReportModuleComment, EditorModeConfig } from '@/types'
import { cn } from '@/lib/utils'

interface SortableModuleProps {
  module: ReportModule
  onToggleVisibility: (id: string) => void
  onDelete: (id: string) => void
  onAddComment: (moduleId: string, text: string) => void
  onResolveComment: (moduleId: string, commentId: string) => void
  children?: React.ReactNode
}

function SortableModule({ 
  module, 
  onToggleVisibility, 
  onDelete, 
  onAddComment,
  onResolveComment,
  children 
}: SortableModuleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: module.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const unresolvedComments = module.comments.filter(c => !c.resolved)

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddComment(module.id, commentText)
      setCommentText('')
      toast.success('Коментар добавен')
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <Card className={cn(
        "relative border-2 transition-all",
        !module.visible && "opacity-50 bg-muted/50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <button
              className="mt-1 cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <DotsSixVertical size={24} className="text-muted-foreground hover:text-foreground" />
            </button>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base">{module.title}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {module.type}
                </Badge>
                {unresolvedComments.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {unresolvedComments.length} коментар(а)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">ID: {module.id}</p>
            </div>

            <div className="flex gap-1">
              <Dialog open={showComments} onOpenChange={setShowComments}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative"
                  >
                    <ChatCircleDots size={18} />
                    {unresolvedComments.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center rounded-full">
                        {unresolvedComments.length}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Коментари за {module.title}</DialogTitle>
                    <DialogDescription>
                      Добавете коментари и инструкции за този модул
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Добавете коментар или инструкция..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={3}
                      />
                      <Button onClick={handleAddComment} size="sm" className="w-full">
                        <Plus size={16} className="mr-2" />
                        Добави Коментар
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {module.comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Все още няма коментари
                        </p>
                      ) : (
                        module.comments.map((comment) => (
                          <Card 
                            key={comment.id} 
                            className={cn(
                              "p-3",
                              comment.resolved && "bg-muted/50 border-muted"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className={cn(
                                  "text-sm whitespace-pre-wrap",
                                  comment.resolved && "line-through text-muted-foreground"
                                )}>
                                  {comment.text}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {new Date(comment.timestamp).toLocaleString('bg-BG')}
                                </p>
                              </div>
                              {!comment.resolved && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onResolveComment(module.id, comment.id)}
                                >
                                  <CheckCircle size={18} className="text-green-600" />
                                </Button>
                              )}
                              {comment.resolved && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle size={12} className="mr-1" />
                                  Resolved
                                </Badge>
                              )}
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleVisibility(module.id)}
              >
                {module.visible ? <Eye size={18} /> : <EyeSlash size={18} />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(module.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash size={18} />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {children && module.visible && (
          <CardContent className="pt-0">
            <div className="border-t pt-3">
              {children}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

interface ReportEditorModeProps {
  children: (modules: ReportModule[]) => React.ReactNode
}

export default function ReportEditorMode({ children }: ReportEditorModeProps) {
  const [editorConfig, setEditorConfig] = useKVWithFallback<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [
      { id: 'overview', type: 'overview', title: 'Обща Информация', visible: true, order: 0, comments: [], containers: [] },
      { id: 'iridology', type: 'iridology', title: 'Иридологичен Анализ', visible: true, order: 1, comments: [], containers: [] },
      { id: 'plan', type: 'plan', title: 'План за Действие', visible: true, order: 2, comments: [], containers: [] },
    ],
    lastModified: new Date().toISOString()
  })

  const [modules, setModules] = useState<ReportModule[]>(editorConfig?.moduleOrder || [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setModules((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          order: index
        }))
        
        updateConfig(newItems)
        return newItems
      })
      
      toast.success('Модулът е преместен')
    }
  }

  const handleToggleVisibility = (id: string) => {
    setModules((items) => {
      const newItems = items.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
      updateConfig(newItems)
      return newItems
    })
    toast.success('Видимостта е променена')
  }

  const handleDelete = (id: string) => {
    if (modules.length <= 1) {
      toast.error('Не можете да изтриете последния модул')
      return
    }

    if (confirm('Сигурни ли сте, че искате да изтриете този модул?')) {
      setModules((items) => {
        const newItems = items.filter((item) => item.id !== id).map((item, index) => ({
          ...item,
          order: index
        }))
        updateConfig(newItems)
        return newItems
      })
      toast.success('Модулът е изтрит')
    }
  }

  const handleAddComment = (moduleId: string, text: string) => {
    setModules((items) => {
      const newItems = items.map((item) => {
        if (item.id === moduleId) {
          return {
            ...item,
            comments: [
              ...item.comments,
              {
                id: Date.now().toString(),
                moduleId,
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

  const handleResolveComment = (moduleId: string, commentId: string) => {
    setModules((items) => {
      const newItems = items.map((item) => {
        if (item.id === moduleId) {
          return {
            ...item,
            comments: item.comments.map((comment) =>
              comment.id === commentId ? { ...comment, resolved: true } : comment
            )
          }
        }
        return item
      })
      updateConfig(newItems)
      return newItems
    })
    toast.success('Коментарът е маркиран като разрешен')
  }

  const handleAddModule = () => {
    const newId = `custom-${Date.now()}`
    const newModule: ReportModule = {
      id: newId,
      type: 'custom',
      title: `Нов Модул ${modules.length + 1}`,
      visible: true,
      order: modules.length,
      comments: [],
      containers: []
    }
    
    setModules((items) => {
      const newItems = [...items, newModule]
      updateConfig(newItems)
      return newItems
    })
    toast.success('Нов модул добавен')
  }

  const updateConfig = (newModules: ReportModule[]) => {
    setEditorConfig((current) => ({
      ...current!,
      moduleOrder: newModules,
      lastModified: new Date().toISOString()
    }))
  }

  const getTotalComments = () => {
    return modules.reduce((total, module) => total + module.comments.filter(c => !c.resolved).length, 0)
  }

  if (!editorConfig?.enabled) {
    return <>{children(modules)}</>
  }

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DotsSixVertical size={20} weight="duotone" className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Editor Mode Активен</h3>
                <p className="text-xs text-muted-foreground">
                  Плъзнете модулите, за да ги пренаредите
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getTotalComments() > 0 && (
                <Badge variant="destructive">
                  <Clock size={14} className="mr-1" />
                  {getTotalComments()} отворени коментара
                </Badge>
              )}
              <Button onClick={handleAddModule} size="sm" variant="outline">
                <Plus size={16} className="mr-2" />
                Добави Модул
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={modules.map(m => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {modules.map((module) => (
            <SortableModule
              key={module.id}
              module={module}
              onToggleVisibility={handleToggleVisibility}
              onDelete={handleDelete}
              onAddComment={handleAddComment}
              onResolveComment={handleResolveComment}
            >
              {children([module])}
            </SortableModule>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
