import { useState, useCallback } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { toast } from 'sonner'
import type { EditableElementComment } from '@/components/report/EditableElement'

export interface EditableElementState {
  id: string
  visible: boolean
  comments: EditableElementComment[]
  metadata?: Record<string, any>
  customData?: any
}

export interface EditableElementsConfig {
  [moduleId: string]: {
    [elementId: string]: EditableElementState
  }
}

export function useEditableElements(moduleId: string, enabled: boolean = false) {
  const [elementsConfig, setElementsConfig] = useKVWithFallback<EditableElementsConfig>(
    'editable-elements-config',
    {}
  )

  const moduleElements = elementsConfig?.[moduleId] || {}

  const getElementState = useCallback((elementId: string): EditableElementState => {
    return moduleElements[elementId] || {
      id: elementId,
      visible: true,
      comments: [],
      metadata: {},
    }
  }, [moduleElements])

  const toggleVisibility = useCallback((elementId: string) => {
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
  }, [moduleId, setElementsConfig])

  const addComment = useCallback((elementId: string, text: string) => {
    setElementsConfig((current) => {
      const currentModule = current?.[moduleId] || {}
      const currentElement = currentModule[elementId] || { id: elementId, visible: true, comments: [] }
      
      const newComment: EditableElementComment = {
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
  }, [moduleId, setElementsConfig])

  const resolveComment = useCallback((elementId: string, commentId: string) => {
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
    
    toast.success('Статусът на коментара е променен')
  }, [moduleId, setElementsConfig])

  const deleteComment = useCallback((elementId: string, commentId: string) => {
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
  }, [moduleId, setElementsConfig])

  const deleteElement = useCallback((elementId: string) => {
    setElementsConfig((current) => {
      const currentModule = current?.[moduleId] || {}
      const { [elementId]: removed, ...rest } = currentModule

      return {
        ...current,
        [moduleId]: rest,
      }
    })
  }, [moduleId, setElementsConfig])

  const updateMetadata = useCallback((elementId: string, metadata: Record<string, any>) => {
    setElementsConfig((current) => {
      const currentModule = current?.[moduleId] || {}
      const currentElement = currentModule[elementId] || { id: elementId, visible: true, comments: [] }

      return {
        ...current,
        [moduleId]: {
          ...currentModule,
          [elementId]: {
            ...currentElement,
            metadata: { ...currentElement.metadata, ...metadata },
          },
        },
      }
    })
  }, [moduleId, setElementsConfig])

  const updateCustomData = useCallback((elementId: string, customData: any) => {
    setElementsConfig((current) => {
      const currentModule = current?.[moduleId] || {}
      const currentElement = currentModule[elementId] || { id: elementId, visible: true, comments: [] }

      return {
        ...current,
        [moduleId]: {
          ...currentModule,
          [elementId]: {
            ...currentElement,
            customData,
          },
        },
      }
    })
  }, [moduleId, setElementsConfig])

  return {
    enabled,
    getElementState,
    toggleVisibility,
    addComment,
    resolveComment,
    deleteComment,
    deleteElement,
    updateMetadata,
    updateCustomData,
  }
}
