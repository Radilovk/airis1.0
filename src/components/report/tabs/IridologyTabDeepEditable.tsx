import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import { DeepEditableWrapper } from '../DeepEditableWrapper'
import { useDeepEditable } from '@/hooks/use-deep-editable'
import IridologyTab from './IridologyTab'

interface IridologyTabDeepEditableProps {
  report: AnalysisReport
  editorMode?: boolean
}

export default function IridologyTabDeepEditable({ report, editorMode = false }: IridologyTabDeepEditableProps) {
  const editor = useDeepEditable('iridology', editorMode)

  if (!editorMode) {
    return <IridologyTab report={report} />
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <DeepEditableWrapper
        id="iridology-full-content"
        label="Цялото съдържание на Iridology таб"
        editorMode={editorMode}
        state={editor.getElementState('iridology-full-content')}
        onToggleVisibility={editor.toggleVisibility}
        onAddComment={editor.addComment}
        onDeleteComment={editor.deleteComment}
        level={0}
      >
        <div className="bg-muted/10 p-1 rounded">
          <IridologyTab report={report} />
        </div>
      </DeepEditableWrapper>

      <div className="mt-4 p-4 bg-accent/5 rounded-lg border border-accent/20">
        <p className="text-sm text-muted-foreground">
          <strong>ℹ️ За най-детайлна редакция:</strong> Iridology таба ще получи пълна дълбока редакция в следваща итерация.
          В момента можете да добавяте коментари към цялото съдържание.
        </p>
      </div>
    </motion.div>
  )
}
