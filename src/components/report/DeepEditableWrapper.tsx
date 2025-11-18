import { ReactNode, useState, cloneElement, isValidElement, Children } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ChatCircleDots,
  Eye,
  EyeSlash,
  Trash,
  DotsSixVertical,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface DeepEditableComment {
  id: string
  text: string
  timestamp: string
  resolved: boolean
}

export interface DeepEditableState {
  id: string
  visible: boolean
  comments: DeepEditableComment[]
  order: number
}

interface DeepEditableWrapperProps {
  id: string
  label: string
  editorMode: boolean
  state: DeepEditableState
  onToggleVisibility: (id: string) => void
  onAddComment: (id: string, text: string) => void
  onDeleteComment: (id: string, commentId: string) => void
  onDelete?: (id: string) => void
  children: ReactNode
  className?: string
  level?: number
  sortable?: boolean
}

export function DeepEditableWrapper({
  id,
  label,
  editorMode,
  state,
  onToggleVisibility,
  onAddComment,
  onDeleteComment,
  onDelete,
  children,
  className,
  level = 0,
  sortable = false,
}: DeepEditableWrapperProps) {
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: id,
    disabled: !sortable
  })

  const style = sortable ? {
    transform: CSS.Transform.toString(transform),
    transition,
  } : undefined

  const unresolvedComments = state.comments.filter(c => !c.resolved)

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddComment(id, commentText)
      setCommentText('')
      setShowComments(false)
      toast.success('Коментар добавен')
    }
  }

  if (!editorMode) {
    return state.visible ? <>{children}</> : null
  }

  const borderColor = level === 0 ? 'border-primary/30' : 
                      level === 1 ? 'border-accent/30' : 
                      'border-muted-foreground/20'

  const hoverBorderColor = level === 0 ? 'hover:border-primary/70' : 
                           level === 1 ? 'hover:border-accent/70' : 
                           'hover:border-muted-foreground/50'

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group/deep-editable',
        editorMode && `border-2 ${borderColor} ${hoverBorderColor} rounded-md transition-all`,
        editorMode && isHovered && 'z-50 shadow-md bg-background/50',
        isDragging && 'opacity-50 z-[999]',
        !state.visible && 'opacity-30',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: state.visible ? 1 : 0.3 }}
      animate={{ opacity: state.visible ? 1 : 0.3 }}
    >
      {editorMode && (
        <div className={cn(
          'absolute -top-8 left-0 right-0 flex items-center justify-between gap-1 px-2 py-1 bg-card border border-border rounded-t-md shadow-sm opacity-0 group-hover/deep-editable:opacity-100 transition-opacity z-[60]',
          isHovered && 'opacity-100'
        )}>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {sortable && (
              <div 
                {...attributes} 
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-accent/20 rounded"
              >
                <DotsSixVertical size={16} className="text-muted-foreground" />
              </div>
            )}
            <span className="text-[10px] font-medium text-muted-foreground truncate px-1">
              {label}
            </span>
            {unresolvedComments.length > 0 && (
              <span className="text-[9px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">
                {unresolvedComments.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onToggleVisibility(id)}
              title={state.visible ? 'Скрий' : 'Покажи'}
            >
              {state.visible ? <Eye size={14} /> : <EyeSlash size={14} />}
            </Button>

            <Dialog open={showComments} onOpenChange={setShowComments}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 relative"
                  title="Коментари"
                >
                  <ChatCircleDots size={14} />
                  {unresolvedComments.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full text-[8px] flex items-center justify-center text-accent-foreground">
                      {unresolvedComments.length}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Коментари за: {label}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {state.comments.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {state.comments.map(comment => (
                        <div key={comment.id} className="p-2 bg-muted rounded-md text-sm">
                          <p className="text-foreground/90">{comment.text}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(comment.timestamp).toLocaleString('bg-BG')}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => onDeleteComment(id, comment.id)}
                            >
                              <Trash size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Textarea
                    placeholder="Добави коментар..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <DialogFooter>
                  <Button onClick={handleAddComment} disabled={!commentText.trim()}>
                    Добави
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Сигурни ли сте, че искате да изтриете "${label}"?`)) {
                    onDelete(id)
                  }
                }}
                title="Изтрий"
              >
                <Trash size={14} />
              </Button>
            )}
          </div>
        </div>
      )}

      <div className={cn('p-2', level > 0 && 'pl-4')}>
        {children}
      </div>
    </motion.div>
  )
}

export interface DeepEditableConfig {
  elements: Map<string, DeepEditableState>
}

export function createDeepEditableState(id: string, order: number = 0): DeepEditableState {
  return {
    id,
    visible: true,
    comments: [],
    order,
  }
}
