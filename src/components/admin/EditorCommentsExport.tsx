import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, FileText, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { EditorModeConfig } from '@/types'

export default function EditorCommentsExport() {
  const [editorConfig] = useKV<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [],
    lastModified: new Date().toISOString()
  })

  const exportCommentsAsJSON = () => {
    if (!editorConfig || editorConfig.moduleOrder.length === 0) {
      toast.error('Няма налични модули')
      return
    }

    const unresolvedComments = editorConfig.moduleOrder
      .map(module => ({
        moduleId: module.id,
        moduleTitle: module.title,
        moduleType: module.type,
        comments: module.comments.filter(c => !c.resolved).map(c => ({
          id: c.id,
          text: c.text,
          timestamp: c.timestamp
        }))
      }))
      .filter(m => m.comments.length > 0)

    const exportData = {
      exportDate: new Date().toISOString(),
      totalModules: editorConfig.moduleOrder.length,
      modulesWithComments: unresolvedComments.length,
      totalUnresolvedComments: unresolvedComments.reduce((sum, m) => sum + m.comments.length, 0),
      modules: unresolvedComments
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `editor-comments-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Коментарите са експортирани')
  }

  const exportCommentsAsText = () => {
    if (!editorConfig || editorConfig.moduleOrder.length === 0) {
      toast.error('Няма налични модули')
      return
    }

    let text = '# AIRIS EDITOR MODE - КОМЕНТАРИ ЗА ПОДОБРЕНИЯ\n\n'
    text += `Експортиран на: ${new Date().toLocaleString('bg-BG')}\n\n`
    text += '---\n\n'

    editorConfig.moduleOrder.forEach(module => {
      const unresolvedComments = module.comments.filter(c => !c.resolved)
      if (unresolvedComments.length === 0) return

      text += `## ${module.title} (${module.type})\n\n`
      text += `**Module ID:** ${module.id}\n`
      text += `**Видим:** ${module.visible ? 'Да' : 'Не'}\n`
      text += `**Отворени коментари:** ${unresolvedComments.length}\n\n`

      unresolvedComments.forEach((comment, index) => {
        text += `### Коментар ${index + 1}\n`
        text += `**Дата:** ${new Date(comment.timestamp).toLocaleString('bg-BG')}\n\n`
        text += `${comment.text}\n\n`
        text += '---\n\n'
      })
    })

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `editor-comments-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Коментарите са експортирани като текст')
  }

  const unresolvedCount = editorConfig?.moduleOrder.reduce(
    (sum, m) => sum + m.comments.filter(c => !c.resolved).length,
    0
  ) || 0

  const resolvedCount = editorConfig?.moduleOrder.reduce(
    (sum, m) => sum + m.comments.filter(c => c.resolved).length,
    0
  ) || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText size={20} weight="duotone" />
          Експорт на Коментари
        </CardTitle>
        <CardDescription>
          Експортирайте коментарите за споделяне с AI или за архивиране
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
            <CardContent className="p-3">
              <p className="text-2xl font-bold text-orange-600">{unresolvedCount}</p>
              <p className="text-xs text-muted-foreground">Отворени коментари</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardContent className="p-3">
              <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
              <p className="text-xs text-muted-foreground">Разрешени</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={exportCommentsAsJSON} 
            variant="outline" 
            className="w-full justify-start"
            disabled={unresolvedCount === 0}
          >
            <Download size={16} className="mr-2" />
            Експорт като JSON (за AI обработка)
          </Button>
          <Button 
            onClick={exportCommentsAsText} 
            variant="outline" 
            className="w-full justify-start"
            disabled={unresolvedCount === 0}
          >
            <FileText size={16} className="mr-2" />
            Експорт като текст (за четене)
          </Button>
        </div>

        {unresolvedCount === 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <CheckCircle size={18} className="text-green-600" />
            <p className="text-sm text-muted-foreground">
              Няма отворени коментари за експортиране
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
