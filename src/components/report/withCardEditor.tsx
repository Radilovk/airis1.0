import { ComponentType, useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { cn } from '@/lib/utils'
import CardEditorToolbar, { CardEditorState } from './CardEditorToolbar'
import type { EditorModeConfig } from '@/types'

interface WithCardEditorProps {
  cardId: string
  editorMode?: boolean
  defaultVisible?: boolean
  defaultExpanded?: boolean
  compact?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  onDelete?: (cardId: string) => void
  className?: string
  children?: React.ReactNode
}

const defaultCardState: CardEditorState = {
  id: '',
  visible: true,
  expanded: true,
  comments: [],
}

export function withCardEditor<P extends object>(
  WrappedComponent: ComponentType<P & { expanded?: boolean }>
) {
  return function CardEditorWrapper({
    cardId,
    editorMode = false,
    defaultVisible = true,
    defaultExpanded = true,
    compact = true,
    position = 'top-right',
    onDelete,
    className,
    children,
    ...props
  }: WithCardEditorProps & P) {
    const [editorConfig] = useKVWithFallback<EditorModeConfig>('editor-mode-config', {
      enabled: false,
      moduleOrder: [],
      lastModified: new Date().toISOString(),
    })

    const [cardStates, setCardStates] = useKVWithFallback<Record<string, CardEditorState>>(
      'card-editor-states',
      {}
    )

    const [currentState, setCurrentState] = useState<CardEditorState>(() => {
      const saved = cardStates?.[cardId]
      return saved || {
        ...defaultCardState,
        id: cardId,
        visible: defaultVisible,
        expanded: defaultExpanded,
      }
    })

    useEffect(() => {
      const saved = cardStates?.[cardId]
      if (saved) {
        setCurrentState(saved)
      }
    }, [cardId, cardStates])

    const handleUpdate = (cardId: string, updates: Partial<CardEditorState>) => {
      const newState = { ...currentState, ...updates }
      setCurrentState(newState)
      
      setCardStates((current) => ({
        ...current,
        [cardId]: newState,
      }))
    }

    const isEditorMode = editorMode && editorConfig?.enabled

    if (!currentState.visible && isEditorMode) {
      return (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 0.4, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={cn('relative border-2 border-dashed border-muted-foreground/30 rounded-lg p-6', className)}
        >
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <span className="text-sm font-medium">Картата е скрита</span>
          </div>
          {isEditorMode && (
            <CardEditorToolbar
              cardId={cardId}
              cardState={currentState}
              onUpdate={handleUpdate}
              onDelete={onDelete}
              compact={compact}
              position={position}
            />
          )}
        </motion.div>
      )
    }

    if (!currentState.visible) {
      return null
    }

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn('relative', className)}
        >
          {isEditorMode && (
            <CardEditorToolbar
              cardId={cardId}
              cardState={currentState}
              onUpdate={handleUpdate}
              onDelete={onDelete}
              compact={compact}
              position={position}
            />
          )}
          
          <WrappedComponent
            {...(props as P)}
            expanded={currentState.expanded}
          />
        </motion.div>
      </AnimatePresence>
    )
  }
}

export function EditableCard({
  cardId,
  editorMode = false,
  defaultVisible = true,
  defaultExpanded = true,
  compact = true,
  position = 'top-right',
  onDelete,
  className,
  children,
}: WithCardEditorProps) {
  const [editorConfig] = useKVWithFallback<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [],
    lastModified: new Date().toISOString(),
  })

  const [cardStates, setCardStates] = useKVWithFallback<Record<string, CardEditorState>>(
    'card-editor-states',
    {}
  )

  const [currentState, setCurrentState] = useState<CardEditorState>(() => {
    const saved = cardStates?.[cardId]
    return saved || {
      ...defaultCardState,
      id: cardId,
      visible: defaultVisible,
      expanded: defaultExpanded,
    }
  })

  useEffect(() => {
    const saved = cardStates?.[cardId]
    if (saved) {
      setCurrentState(saved)
    }
  }, [cardId, cardStates])

  const handleUpdate = (cardId: string, updates: Partial<CardEditorState>) => {
    const newState = { ...currentState, ...updates }
    setCurrentState(newState)
    
    setCardStates((current) => ({
      ...current,
      [cardId]: newState,
    }))
  }

  const isEditorMode = editorMode && editorConfig?.enabled

  if (!currentState.visible && !isEditorMode) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={cn('relative', className)}
      >
        {isEditorMode && (
          <CardEditorToolbar
            cardId={cardId}
            cardState={currentState}
            onUpdate={handleUpdate}
            onDelete={onDelete}
            compact={compact}
            position={position}
          />
        )}
        
        <Card className={cn(
          'transition-all',
          isEditorMode && 'ring-2 ring-primary/20 hover:ring-primary/40'
        )}>
          {!currentState.visible && isEditorMode && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 rounded-lg flex items-center justify-center pointer-events-none">
              <span className="text-sm font-medium text-muted-foreground pointer-events-none">Картата е скрита</span>
            </div>
          )}
          <div className={cn(isEditorMode && !currentState.visible && "pointer-events-none")}>
            {children}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
