import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { 
  DotsSixVertical, 
  ChatCircleDots, 
  Eye, 
  EyeSlash, 
  Trash,
  CheckCircle,
  Clock,
  Warning,
  PencilSimple
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { ReportContainer, ReportModuleComment } from '@/types'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface EditableContainerProps {
  container: ReportContainer
  editorMode?: boolean
  onToggleVisibility: (id: string) => void
  onDelete?: (id: string) => void
  onAddComment: (containerId: string, text: string) => void
  onResolveComment?: (containerId: string, commentId: string) => void
  onDeleteComment?: (containerId: string, commentId: string) => void
  onUpdateMetadata?: (containerId: string, metadata: any) => void
  children: React.ReactNode
}

export default function EditableContainer({ 
  container, 
  editorMode = true,
  onToggleVisibility, 
  onDelete, 
  onAddComment,
  onResolveComment,
  onDeleteComment,
  onUpdateMetadata,
  children 
}: EditableContainerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: container.id,
    disabled: !editorMode
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [showMetadata, setShowMetadata] = useState(false)
  const unresolvedComments = container.comments.filter(c => !c.resolved)

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddComment(container.id, commentText)
      setCommentText('')
      toast.success('Коментар добавен')
    }
  }

  if (!editorMode) {
    return container.visible ? <>{children}</> : null
  }

  return (
    <div ref={setNodeRef} style={style} className={cn("mb-3 relative", isDragging && "z-50")}>
      <AnimatePresence>
        {editorMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-3 left-4 z-10 flex items-center gap-1.5"
          >
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-5 shadow-sm">
              {container.type}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 shadow-sm">
              #{container.order}
            </Badge>
            {container.metadata?.priority && (
              <Badge 
                variant={container.metadata.priority === 'high' ? 'destructive' : 'default'} 
                className="text-[10px] px-1.5 py-0.5 h-5 shadow-sm"
              >
                {container.metadata.priority}
              </Badge>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Card className={cn(
        "relative transition-all",
        !container.visible && "opacity-40 bg-muted/30",
        editorMode && "border-2 border-dashed",
        editorMode && container.visible && "border-primary/30 hover:border-primary/60",
        editorMode && !container.visible && "border-muted",
        isDragging && "shadow-2xl scale-[1.02] rotate-1"
      )}>
        {editorMode && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-background/95 backdrop-blur-sm rounded-lg p-1 shadow-md border">
            <button
              className="cursor-grab active:cursor-grabbing touch-none p-1.5 hover:bg-muted rounded transition-colors"
              {...attributes}
              {...listeners}
            >
              <DotsSixVertical size={18} className="text-muted-foreground" />
            </button>
            
            <Dialog open={showComments} onOpenChange={setShowComments}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative h-8 w-8 p-0"
                >
                  <ChatCircleDots size={16} />
                  {unresolvedComments.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center rounded-full font-semibold">
                      {unresolvedComments.length}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Коментари: {container.title}</DialogTitle>
                  <DialogDescription>
                    Добавете коментари и инструкции за този контейнер
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Опишете какво трябва да се промени или подобри в този контейнер..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <Button 
                      onClick={handleAddComment} 
                      size="sm"
                      disabled={!commentText.trim()}
                    >
                      <ChatCircleDots size={16} className="mr-2" />
                      Добави Коментар
                    </Button>
                  </div>

                  {container.comments.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Коментари ({container.comments.length})</h4>
                      {container.comments.map((comment) => (
                        <Card key={comment.id} className={cn(
                          "p-3",
                          comment.resolved && "bg-muted/50 opacity-70"
                        )}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm">{comment.text}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(comment.timestamp).toLocaleString('bg-BG')}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {onResolveComment && (
                                <Button
                                  variant={comment.resolved ? "ghost" : "outline"}
                                  size="sm"
                                  onClick={() => onResolveComment(container.id, comment.id)}
                                >
                                  {comment.resolved ? (
                                    <CheckCircle size={16} className="text-green-600" weight="fill" />
                                  ) : (
                                    <CheckCircle size={16} />
                                  )}
                                </Button>
                              )}
                              {onDeleteComment && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteComment(container.id, comment.id)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash size={16} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      Все още няма коментари за този контейнер
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {onUpdateMetadata && (
              <Dialog open={showMetadata} onOpenChange={setShowMetadata}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <PencilSimple size={16} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Настройки на контейнера</DialogTitle>
                    <DialogDescription>
                      Редактирайте метаданните на {container.title}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    <div className="text-sm">
                      <span className="font-medium">ID:</span> {container.id}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Тип:</span> {container.type}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Интерактивен:</span> {container.interactive ? 'Да' : 'Не'}
                    </div>
                    {container.metadata && (
                      <div className="text-sm">
                        <span className="font-medium">Метаданни:</span>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(container.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setShowMetadata(false)}>
                      Затвори
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleVisibility(container.id)}
              className="h-8 w-8 p-0"
            >
              {container.visible ? (
                <Eye size={16} />
              ) : (
                <EyeSlash size={16} />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (onDelete && confirm(`Сигурни ли сте, че искате да изтриете "${container.title}"?`)) {
                  onDelete(container.id)
                  toast.success('Контейнер изтрит')
                }
              }}
              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
              disabled={!onDelete}
            >
              <Trash size={16} />
            </Button>
          </div>
        )}

        <div className={cn(
          editorMode && "pt-6",
          !container.visible && "pointer-events-none"
        )}>
          {!container.visible && editorMode && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[2px] z-10 rounded-lg">
              <Badge variant="outline" className="text-sm">
                <EyeSlash size={16} className="mr-2" />
                Скрит
              </Badge>
            </div>
          )}
          {children}
        </div>

        {editorMode && unresolvedComments.length > 0 && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10">
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 shadow-sm">
              <Warning size={12} className="mr-1" weight="fill" />
              {unresolvedComments.length} коментар(а)
            </Badge>
          </div>
        )}
      </Card>
    </div>
  )
}
