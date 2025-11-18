import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import { DeepEditableWrapper } from '../DeepEditableWrapper'
import { useDeepEditable } from '@/hooks/use-deep-editable'
import OverviewTab from './OverviewTab'

interface OverviewTabDeepEditableProps {
  report: AnalysisReport
  avgHealth: number
  editorMode?: boolean
}

export default function OverviewTabDeepEditable({ report, avgHealth, editorMode = false }: OverviewTabDeepEditableProps) {
  const editor = useDeepEditable('overview', editorMode)

  if (!editorMode) {
    return <OverviewTab report={report} avgHealth={avgHealth} />
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <DeepEditableWrapper
        id="overview-full-content"
        label="Цялото съдържание на Overview таб"
        editorMode={editorMode}
        state={editor.getElementState('overview-full-content')}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onDeleteComment={editor.deleteComment}
        level={0}
      >
        <div className="bg-muted/10 p-1 rounded">
          <OverviewTab report={report} avgHealth={avgHealth} />
        </div>
      </DeepEditableWrapper>

      <div className="mt-4 p-4 bg-accent/5 rounded-lg border border-accent/20">
        <p className="text-sm text-muted-foreground">
          <strong>ℹ️ За най-детайлна редакция:</strong> Overview таба ще получи пълна дълбока редакция в следваща итерация.
          В момента можете да добавяте коментари към цялото съдържание.
        </p>
      </div>
    </motion.div>
  )
}
