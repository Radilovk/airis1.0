import { useState } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Eye,
  EyeSlash,
  ChatCircleDots,
  PencilLine,
  ListBullets,
  CaretDown,
  Warning,
  CheckCircle,
  Trash,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { EditableElementsConfig } from '@/hooks/use-editable-elements'
import { motion } from 'framer-motion'

interface EditorSidebarProps {
  moduleId: string
  moduleName: string
}

export default function EditorSidebar({ moduleId, moduleName }: EditorSidebarProps) {
  const [elementsConfig, setElementsConfig] = useKVWithFallback<EditableElementsConfig>(
    'editable-elements-config',
    {}
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set())
  const [commentText, setCommentText] = useState<Record<string, string>>({})

  const moduleElements = elementsConfig?.[moduleId] || {}
  const elementEntries = Object.entries(moduleElements)

  const filteredElements = elementEntries.filter(([id, state]) => {
    const query = searchQuery.toLowerCase()
    return id.toLowerCase().includes(query) || 
           state.comments.some(c => c.text.toLowerCase().includes(query))
  })

  const toggleElement = (elementId: string) => {
    setExpandedElements(prev => {
      const newSet = new Set(prev)
      if (newSet.has(elementId)) {
        newSet.delete(elementId)
      } else {
        newSet.add(elementId)
      }
      return newSet
    })
  }

  const toggleVisibility = (elementId: string) => {
    setElementsConfig((current) => {
      const currentModule = current?.[moduleId] || {}
      const currentElement = currentModule[elementId] || { id: elementId, visible: true, comments: [] }
      
      return {
        ...current,
        [moduleId]: {
          ...currentModule,
          [elementId]: {
            ...currentElement,
            visible: !currentElement.visible,
          },
        },
      }
    })
    
    toast.success('Видимостта е променена')
  }

  const addComment = (elementId: string) => {
    const text = commentText[elementId]
    if (!text?.trim()) return

    setElementsConfig((current) => {
      const currentModule = current?.[moduleId] || {}
      const currentElement = currentModule[elementId] || { id: elementId, visible: true, comments: [] }
      
      const newComment = {
        id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text,
        timestamp: new Date().toISOString(),
        resolved: false,
      }

      return {
        ...current,
        [moduleId]: {
          ...currentModule,
          [elementId]: {
            ...currentElement,
            comments: [...currentElement.comments, newComment],
          },
        },
      }
    })

    setCommentText(prev => ({ ...prev, [elementId]: '' }))
    toast.success('Коментар добавен')
  }

  const toggleResolveComment = (elementId: string, commentId: string) => {
    setElementsConfig((current) => {
      const currentModule = current?.[moduleId] || {}
      const currentElement = currentModule[elementId]
      
      if (!currentElement) return current || {}

      return {
        ...current,
        [moduleId]: {
          ...currentModule,
          [elementId]: {
            ...currentElement,
            comments: currentElement.comments.map(c =>
              c.id === commentId ? { ...c, resolved: !c.resolved } : c
            ),
          },
        },
      }
    })
  }

  const deleteComment = (elementId: string, commentId: string) => {
    setElementsConfig((current) => {
      const currentModule = current?.[moduleId] || {}
      const currentElement = currentModule[elementId]
      
      if (!currentElement) return current || {}

      return {
        ...current,
        [moduleId]: {
          ...currentModule,
          [elementId]: {
            ...currentElement,
            comments: currentElement.comments.filter(c => c.id !== commentId),
          },
        },
      }
    })
    
    toast.success('Коментарът е изтрит')
  }

  const totalElements = elementEntries.length
  const visibleElements = elementEntries.filter(([_, state]) => state.visible).length
  const totalComments = elementEntries.reduce((sum, [_, state]) => sum + state.comments.length, 0)
  const unresolvedComments = elementEntries.reduce((sum, [_, state]) => 
    sum + state.comments.filter(c => !c.resolved).length, 0
  )

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ListBullets size={16} />
          Панел на Елементите
          {unresolvedComments > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              {unresolvedComments}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[600px] sm:max-w-[600px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <PencilLine size={20} className="text-primary" />
            Редактор: {moduleName}
          </SheetTitle>
          <SheetDescription>
            Управление на всички редактируеми елементи в този модул
          </SheetDescription>
          
          <div className="grid grid-cols-4 gap-2 mt-4">
            <Card className="p-2 text-center">
              <p className="text-xs text-muted-foreground">Елементи</p>
              <p className="text-lg font-bold text-primary">{totalElements}</p>
            </Card>
            <Card className="p-2 text-center">
              <p className="text-xs text-muted-foreground">Видими</p>
              <p className="text-lg font-bold text-green-600">{visibleElements}</p>
            </Card>
            <Card className="p-2 text-center">
              <p className="text-xs text-muted-foreground">Коментари</p>
              <p className="text-lg font-bold text-blue-600">{totalComments}</p>
            </Card>
            <Card className="p-2 text-center">
              <p className="text-xs text-muted-foreground">Активни</p>
              <p className="text-lg font-bold text-destructive">{unresolvedComments}</p>
            </Card>
          </div>
        </SheetHeader>

        <div className="p-4 border-b">
          <Input
            placeholder="Търсене на елементи или коментари..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="p-4 space-y-2">
            {filteredElements.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Няма намерени елементи' : 'Няма редактируеми елементи в този модул'}
                </p>
              </Card>
            ) : (
              filteredElements.map(([elementId, elementState]) => {
                const isExpanded = expandedElements.has(elementId)
                const unresolvedCount = elementState.comments.filter(c => !c.resolved).length

                return (
                  <motion.div
                    key={elementId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Collapsible open={isExpanded} onOpenChange={() => toggleElement(elementId)}>
                      <Card className={`${!elementState.visible ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-2 p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleVisibility(elementId)}
                            className="h-8 w-8 p-0 flex-shrink-0"
                          >
                            {elementState.visible ? (
                              <Eye size={14} className="text-green-600" />
                            ) : (
                              <EyeSlash size={14} className="text-muted-foreground" />
                            )}
                          </Button>

                          <CollapsibleTrigger className="flex-1 text-left min-w-0 hover:opacity-70 transition-opacity">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium truncate">{elementId}</p>
                              {unresolvedCount > 0 && (
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                                  <Warning size={10} className="mr-0.5" weight="fill" />
                                  {unresolvedCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {elementState.comments.length} {elementState.comments.length === 1 ? 'коментар' : 'коментара'}
                            </p>
                          </CollapsibleTrigger>

                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <CaretDown size={14} className="text-muted-foreground flex-shrink-0" />
                          </motion.div>
                        </div>

                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-2 border-t pt-2">
                            {elementState.metadata && (
                              <div className="text-xs">
                                <span className="font-medium">Метаданни:</span>
                                <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-auto max-h-32">
                                  {JSON.stringify(elementState.metadata, null, 2)}
                                </pre>
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <ChatCircleDots size={14} className="text-primary" />
                                <span className="text-xs font-medium">Коментари:</span>
                              </div>

                              {elementState.comments.length > 0 ? (
                                <div className="space-y-1.5">
                                  {elementState.comments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className={`p-2 rounded border text-xs ${
                                        comment.resolved ? 'bg-muted/50 opacity-70' : 'bg-background'
                                      }`}
                                    >
                                      <p className="mb-1">{comment.text}</p>
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-muted-foreground">
                                          {new Date(comment.timestamp).toLocaleString('bg-BG')}
                                        </p>
                                        <div className="flex gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleResolveComment(elementId, comment.id)}
                                            className="h-6 w-6 p-0"
                                          >
                                            {comment.resolved ? (
                                              <CheckCircle size={12} className="text-green-600" weight="fill" />
                                            ) : (
                                              <CheckCircle size={12} />
                                            )}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteComment(elementId, comment.id)}
                                            className="h-6 w-6 p-0 hover:text-destructive"
                                          >
                                            <Trash size={12} />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">Няма коментари</p>
                              )}

                              <div className="space-y-1.5 pt-1">
                                <Textarea
                                  placeholder="Добави нов коментар..."
                                  value={commentText[elementId] || ''}
                                  onChange={(e) => setCommentText(prev => ({ ...prev, [elementId]: e.target.value }))}
                                  rows={2}
                                  className="text-xs resize-none"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => addComment(elementId)}
                                  disabled={!commentText[elementId]?.trim()}
                                  className="w-full h-7 text-xs"
                                >
                                  <ChatCircleDots size={12} className="mr-1" />
                                  Добави Коментар
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  </motion.div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
