/**
 * Editor Code Generator
 * Generates actual React component code based on editor mode changes
 * This allows editor mode edits to be persisted directly in the repository
 */

import type { EditableElementsConfig } from '@/hooks/use-editable-elements'
import type { EditorModeConfig, ReportModule } from '@/types'

export interface CodeGenerationResult {
  filePath: string
  originalCode: string
  generatedCode: string
  description: string
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
  elements: Record<string, any>
): CodeGenerationResult | null {
  const filePath = getTabComponentPath(module.id)
  
  // Collect all visibility changes
  const hiddenElements = Object.entries(elements)
    .filter(([_, state]) => state.visible === false)
    .map(([id]) => id)

  // Collect all comments with unresolved status
  const activeComments = Object.entries(elements)
    .flatMap(([elementId, state]) => 
      state.comments
        .filter((c: any) => !c.resolved)
        .map((c: any) => ({ elementId, comment: c }))
    )

  // Generate comment annotations
  let generatedCode = generateComponentWithComments(module, hiddenElements, activeComments)

  return {
    filePath,
    originalCode: '', // Will be filled by the sync system
    generatedCode,
    description: `Updated ${module.title} with editor mode changes`,
  }
}

/**
 * Generate component code with JSX comments and conditional rendering
 */
function generateComponentWithComments(
  module: ReportModule,
  hiddenElements: string[],
  activeComments: Array<{ elementId: string; comment: any }>
): string {
  let code = `/**
 * ${module.title}
 * Auto-generated from Editor Mode
 * Last modified: ${new Date().toISOString()}
 */\n\n`

  // Add editor mode changes as code comments
  if (hiddenElements.length > 0) {
    code += `// EDITOR MODE: Hidden Elements\n`
    code += `// The following elements are hidden by editor mode:\n`
    hiddenElements.forEach(id => {
      code += `//   - ${id}\n`
    })
    code += '\n'
  }

  if (activeComments.length > 0) {
    code += `// EDITOR MODE: Active Comments\n`
    activeComments.forEach(({ elementId, comment }) => {
      code += `// TODO [${elementId}]: ${comment.text}\n`
    })
    code += '\n'
  }

  // Generate conditional rendering logic
  code += generateConditionalRenderingLogic(hiddenElements)

  return code
}

/**
 * Generate conditional rendering helper
 */
function generateConditionalRenderingLogic(hiddenElements: string[]): string {
  if (hiddenElements.length === 0) return ''

  return `
// Editor Mode visibility configuration
const editorHiddenElements = new Set([
${hiddenElements.map(id => `  '${id}',`).join('\n')}
])

// Helper function to check if element should be rendered
const shouldRenderElement = (elementId: string): boolean => {
  return !editorHiddenElements.has(elementId)
}
`
}

/**
 * Get the file path for a module's tab component
 */
function getTabComponentPath(moduleId: string): string {
  const pathMap: Record<string, string> = {
    overview: 'src/components/report/tabs/OverviewTab.tsx',
    iridology: 'src/components/report/tabs/IridologyTab.tsx',
    plan: 'src/components/report/tabs/PlanTab.tsx',
  }
  
  return pathMap[moduleId] || `src/components/report/tabs/${moduleId}Tab.tsx`
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
