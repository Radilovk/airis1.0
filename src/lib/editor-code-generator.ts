import type { EditableElementsConfig, EditableElementState } from '@/hooks/use-editable-elements'
import type { EditorModeConfig, ReportModule, ReportModuleComment } from '@/types'
import { getModuleFilePath } from './editor-config'

export interface CodeGenerationResult {
  filePath: string
  originalCode: string
  generatedCode: string
  description: string
}

interface CommentWithElement {
  elementId: string
  comment: ReportModuleComment
}

/**
 * Generate code modifications based on editor mode configuration
 */
export function generateCodeFromEditorConfig(
  editorConfig: EditorModeConfig,
  elementsConfig: EditableElementsConfig
): CodeGenerationResult[] {
  const results: CodeGenerationResult[] = []

  // Process each module
  for (const module of editorConfig.moduleOrder) {
    const moduleElements = elementsConfig[module.id] || {}
    
    // Generate tab component code
    const tabResult = generateTabComponentCode(module, moduleElements)
    if (tabResult) {
      results.push(tabResult)
    }
  }

  return results
}

/**
 * Generate updated tab component code based on edits
 */
function generateTabComponentCode(
  module: ReportModule,
  elements: Record<string, EditableElementState>
): CodeGenerationResult | null {
  const filePath = getTabComponentPath(module.id)
  
  // Collect all visibility changes
  const hiddenElements = Object.entries(elements)
    .filter(([_, state]) => state.visible === false)
    .map(([id]) => id)

  // Collect all comments with unresolved status
  const activeComments: CommentWithElement[] = Object.entries(elements)
    .flatMap(([elementId, state]) => 
      state.comments
        .filter((c) => !c.resolved)
        .map((c) => ({ elementId, comment: c }))
    )

  // Generate comment annotations
  const generatedCode = generateComponentWithComments(module, hiddenElements, activeComments)

  return {
    filePath,
    originalCode: '', // Will be filled by the sync system
    generatedCode,
    description: `Updated ${module.title} with editor mode changes`,
  }
}

/**
 * Generate component header with metadata
 */
function generateComponentHeader(
  moduleTitle: string,
  hiddenCount: number,
  commentCount: number
): string {
  const timestamp = new Date().toISOString()
  let header = `/**\n * ${moduleTitle}\n * Auto-generated from Editor Mode\n * Last modified: ${timestamp}\n`
  
  if (hiddenCount > 0 || commentCount > 0) {
    header += ' * \n * EDITOR MODE CHANGES:\n'
    if (hiddenCount > 0) {
      header += ` * - ${hiddenCount} elements are hidden\n`
    }
    if (commentCount > 0) {
      header += ` * - ${commentCount} active comments/TODO items\n`
    }
  }
  
  header += ' */\n\n'
  return header
}

/**
 * Generate component code with JSX comments and conditional rendering
 */
function generateComponentWithComments(
  module: ReportModule,
  hiddenElements: string[],
  activeComments: CommentWithElement[]
): string {
  let code = generateComponentHeader(
    module.title,
    hiddenElements.length,
    activeComments.length
  )

  // Add editor mode changes as code comments
  if (hiddenElements.length > 0) {
    code += `/**
 * EDITOR MODE: Hidden Elements
 * The following elements are hidden by editor mode configuration.
 * To show them again, edit the editor mode config in Admin Panel.
 */\n`
    hiddenElements.forEach(id => {
      code += `// HIDDEN: ${id}\n`
    })
    code += '\n'
  }

  if (activeComments.length > 0) {
    code += `/**
 * EDITOR MODE: Active Comments & TODO Items
 * These are instructions for future improvements.
 */\n`
    activeComments.forEach(({ elementId, comment }) => {
      const timestamp = new Date(comment.timestamp).toLocaleDateString('bg-BG')
      code += `// TODO [${elementId}] (${timestamp}): ${comment.text}\n`
    })
    code += '\n'
  }

  // Generate the actual conditional rendering configuration
  code += generateConditionalRenderingLogic(hiddenElements)
  
  // Generate usage example
  code += `\n/**
 * USAGE:
 * Wrap elements with conditional rendering:
 * 
 * {shouldRenderElement('element-id') && (
 *   <YourElement />
 * )}
 * 
 * Or use the helper in className:
 * <div className={cn(getElementClassName('element-id'))}>
 * 
 * INTEGRATION:
 * Import this configuration in your tab component and apply the logic.
 */\n`

  return code
}

/**
 * Generate conditional rendering helper
 */
function generateConditionalRenderingLogic(hiddenElements: string[]): string {
  if (hiddenElements.length === 0) {
    return `// No elements are hidden by editor mode\n`
  }

  return `
// Editor Mode Visibility Configuration
// Generated from editor mode settings
const EDITOR_HIDDEN_ELEMENTS = new Set([
${hiddenElements.map(id => `  '${id}',`).join('\n')}
])

/**
 * Check if an element should be rendered based on editor mode config
 * @param elementId - The unique identifier of the element
 * @returns true if the element should be rendered, false otherwise
 */
export const shouldRenderElement = (elementId: string): boolean => {
  return !EDITOR_HIDDEN_ELEMENTS.has(elementId)
}

/**
 * Get className helper for conditional styling
 * @param elementId - The unique identifier of the element
 * @returns className string for hidden elements
 */
export const getElementClassName = (elementId: string): string => {
  return EDITOR_HIDDEN_ELEMENTS.has(elementId) ? 'hidden' : ''
}

/**
 * Get all hidden element IDs
 * @returns Array of hidden element IDs
 */
export const getHiddenElements = (): string[] => {
  return Array.from(EDITOR_HIDDEN_ELEMENTS)
}

/**
 * Check if editor mode has hidden elements
 * @returns true if there are hidden elements
 */
export const hasHiddenElements = (): boolean => {
  return EDITOR_HIDDEN_ELEMENTS.size > 0
}
`
}

/**
 * Get the file path for a module's tab component
 */
function getTabComponentPath(moduleId: string): string {
  return getModuleFilePath(moduleId)
}

/**
 * Generate a patch file for the changes
 */
export function generatePatchFile(results: CodeGenerationResult[]): string {
  let patch = `# Editor Mode Code Changes\n`
  patch += `# Generated: ${new Date().toISOString()}\n\n`

  results.forEach(result => {
    patch += `## ${result.filePath}\n`
    patch += `${result.description}\n\n`
    patch += '```typescript\n'
    patch += result.generatedCode
    patch += '\n```\n\n'
  })

  return patch
}

/**
 * Generate a summary of all editor mode changes
 */
export function generateChangesSummary(
  editorConfig: EditorModeConfig,
  elementsConfig: EditableElementsConfig
): string {
  let summary = '# Editor Mode Changes Summary\n\n'
  
  editorConfig.moduleOrder.forEach(module => {
    const elements = elementsConfig[module.id] || {}
    const elementCount = Object.keys(elements).length
    const hiddenCount = Object.values(elements).filter((e: any) => !e.visible).length
    const commentCount = Object.values(elements).reduce(
      (sum: number, e: any) => sum + e.comments.filter((c: any) => !c.resolved).length,
      0
    )

    summary += `## ${module.title}\n`
    summary += `- Total Elements: ${elementCount}\n`
    summary += `- Hidden Elements: ${hiddenCount}\n`
    summary += `- Active Comments: ${commentCount}\n`
    
    if (commentCount > 0) {
      summary += '\n### Active Comments:\n'
      Object.entries(elements).forEach(([elementId, state]: [string, any]) => {
        state.comments
          .filter((c: any) => !c.resolved)
          .forEach((c: any) => {
            summary += `- **${elementId}**: ${c.text}\n`
          })
      })
    }
    
    summary += '\n'
  })

  return summary
}

/**
 * Export editor configuration as JSON
 */
export function exportEditorConfig(
  editorConfig: EditorModeConfig,
  elementsConfig: EditableElementsConfig
): string {
  return JSON.stringify(
    {
      version: '1.0',
      timestamp: new Date().toISOString(),
      editorConfig,
      elementsConfig,
    },
    null,
    2
  )
}
