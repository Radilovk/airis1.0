import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Badge } from '@/components/ui/badge'
import { PencilSimple } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { EditorModeConfig } from '@/types'

export default function EditorModeIndicator() {
  const [editorConfig] = useKVWithFallback<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [],
    lastModified: new Date().toISOString()
  })

  if (!editorConfig?.enabled) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Badge 
        variant="outline" 
        className="bg-primary/10 border-primary/30 text-primary gap-1.5 px-2 py-1"
      >
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1
          }}
        >
          <PencilSimple size={14} weight="duotone" />
        </motion.div>
        <span className="text-xs font-semibold">Editor Mode</span>
      </Badge>
    </motion.div>
  )
}
