/**
 * Editor Mode Configuration Constants
 * Shared configuration values to maintain consistency
 */

import type { EditorModeConfig, ReportModule } from '@/types'

/**
 * Default module configuration
 * This is the initial state for editor mode
 */
export const DEFAULT_MODULE_ORDER: ReportModule[] = [
  { 
    id: 'overview', 
    type: 'overview', 
    title: 'Обща Информация', 
    visible: true, 
    order: 0, 
    comments: [], 
    containers: [] 
  },
  { 
    id: 'iridology', 
    type: 'iridology', 
    title: 'Иридологичен Анализ', 
    visible: true, 
    order: 1, 
    comments: [], 
    containers: [] 
  },
  { 
    id: 'plan', 
    type: 'plan', 
    title: 'План за Действие', 
    visible: true, 
    order: 2, 
    comments: [], 
    containers: [] 
  },
]

/**
 * Create default editor mode configuration
 */
export function createDefaultEditorConfig(): EditorModeConfig {
  return {
    enabled: false,
    moduleOrder: DEFAULT_MODULE_ORDER,
    lastModified: new Date().toISOString()
  }
}

/**
 * Create enabled editor mode configuration
 */
export function createEnabledEditorConfig(): EditorModeConfig {
  return {
    enabled: true,
    moduleOrder: DEFAULT_MODULE_ORDER,
    lastModified: new Date().toISOString()
  }
}

/**
 * Tab component file paths mapping
 * Maps module IDs to their corresponding file paths
 */
export const MODULE_FILE_PATHS: Record<string, string> = {
  overview: 'src/components/report/tabs/OverviewTab.tsx',
  iridology: 'src/components/report/tabs/IridologyTab.tsx',
  plan: 'src/components/report/tabs/PlanTab.tsx',
}

/**
 * Get file path for a module
 */
export function getModuleFilePath(moduleId: string): string {
  return MODULE_FILE_PATHS[moduleId] || `src/components/report/tabs/${moduleId}Tab.tsx`
}
