import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { DeepEditableState, DeepEditableComment } from '@/components/report/DeepEditableWrapper'
import { toast } from 'sonner'

export interface DeepEditableStore {
  [moduleId: string]: {
    [elementId: string]: DeepEditableState
  }
}

export function useDeepEditable(moduleId: string, editorMode: boolean = false) {
  const [store, setStore] = useKVWithFallback<DeepEditableStore>('deep-editable-store', {})

  const moduleStore = (store || {})[moduleId] || {}

  const getElementState = (elementId: string): DeepEditableState => {
    return moduleStore[elementId] || {
      id: elementId,
      visible: true,
      comments: [],
      order: 0,
    }
  }

  const setElementState = (elementId: string, state: Partial<DeepEditableState>) => {
    setStore((current) => ({
      ...(current || {}),
      [moduleId]: {
        ...(current || {})[moduleId],
        [elementId]: {
          ...getElementState(elementId),
          ...state,
        },
      },
    }))
  }

  const toggleVisibility = (elementId: string) => {
    const currentState = getElementState(elementId)
    setElementState(elementId, { visible: !currentState.visible })
    toast.success(currentState.visible ? 'Елемент скрит' : 'Елемент показан')
  }

  const addComment = (elementId: string, text: string) => {
    const currentState = getElementState(elementId)
    const newComment: DeepEditableComment = {
      id: `comment-${Date.now()}-${Math.random()}`,
      text,
      timestamp: new Date().toISOString(),
      resolved: false,
    }
    setElementState(elementId, {
      comments: [...currentState.comments, newComment],
    })
  }

  const deleteComment = (elementId: string, commentId: string) => {
    const currentState = getElementState(elementId)
    setElementState(elementId, {
      comments: currentState.comments.filter(c => c.id !== commentId),
    })
    toast.success('Коментар изтрит')
  }

  const resolveComment = (elementId: string, commentId: string) => {
    const currentState = getElementState(elementId)
    setElementState(elementId, {
      comments: currentState.comments.map(c =>
        c.id === commentId ? { ...c, resolved: true } : c
      ),
    })
    toast.success('Коментар разрешен')
  }

  const deleteElement = (elementId: string) => {
    setElementState(elementId, { visible: false })
    toast.success('Елемент изтрит')
  }

  const setOrder = (elementId: string, order: number) => {
    setElementState(elementId, { order })
  }

  const bulkUpdateOrder = (updates: Array<{ id: string; order: number }>) => {
    setStore((current) => {
      const updated = { ...(current || {}) }
      if (!updated[moduleId]) updated[moduleId] = {}
      
      updates.forEach(({ id, order }) => {
        updated[moduleId][id] = {
          ...getElementState(id),
          order,
        }
      })
      
      return updated
    })
  }

  const getAllElements = (): DeepEditableState[] => {
    return Object.values(moduleStore).sort((a, b) => a.order - b.order)
  }

  const clearModule = () => {
    setStore((current) => {
      const updated = { ...(current || {}) }
      delete updated[moduleId]
      return updated
    })
    toast.success('Модул изчистен')
  }

  return {
    getElementState,
    setElementState,
    toggleVisibility,
    addComment,
    deleteComment,
    resolveComment,
    deleteElement,
    setOrder,
    bulkUpdateOrder,
    getAllElements,
    clearModule,
    editorMode,
  }
}
