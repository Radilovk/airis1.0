import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Robot, CheckCircle, ArrowCounterClockwise } from '@phosphor-icons/react'
import type { AIPromptTemplate } from '@/types'
import { DEFAULT_AI_PROMPT } from '@/lib/default-prompts'

export default function AIPromptTab() {
  const [aiPromptTemplate, setAiPromptTemplate] = useKV<AIPromptTemplate>('ai-prompt-template', {
    content: DEFAULT_AI_PROMPT,
    lastModified: new Date().toISOString()
  })
  
  const [promptContent, setPromptContent] = useState(aiPromptTemplate?.content || DEFAULT_AI_PROMPT)

  useEffect(() => {
    if (aiPromptTemplate) {
      setPromptContent(aiPromptTemplate.content)
    }
  }, [aiPromptTemplate])

  const handleSavePrompt = async () => {
    try {
      await setAiPromptTemplate({
        content: promptContent,
        lastModified: new Date().toISOString()
      })
      toast.success('AI промптът е запазен успешно')
    } catch (error) {
      console.error('Error saving prompt:', error)
      toast.error('Грешка при запазване на промпта')
    }
  }

  const handleResetPrompt = async () => {
    setPromptContent(DEFAULT_AI_PROMPT)
    await setAiPromptTemplate({
      content: DEFAULT_AI_PROMPT,
      lastModified: new Date().toISOString()
    })
    toast.success('Промптът е възстановен до оригиналната версия')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Robot className="w-5 h-5 text-primary" />
          AI Промпт шаблон
        </CardTitle>
        <CardDescription>
          Промптът, който се изпраща към AI модела за анализ на ирисите
        </CardDescription>
        {aiPromptTemplate && (
          <Badge variant="outline" className="w-fit">
            Последна промяна: {new Date(aiPromptTemplate.lastModified).toLocaleString('bg-BG')}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 mb-4">
          <p className="text-sm font-semibold text-accent-foreground mb-2">
            📋 Променливи за замяна в промпта:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-accent-foreground/80">
            <div><code>{'{{side}}'}</code> - ляв/десен</div>
            <div><code>{'{{imageHash}}'}</code> - ID на изображението</div>
            <div><code>{'{{age}}'}</code> - възраст</div>
            <div><code>{'{{gender}}'}</code> - пол</div>
            <div><code>{'{{bmi}}'}</code> - индекс на телесна маса</div>
            <div><code>{'{{goals}}'}</code> - здравни цели</div>
            <div><code>{'{{complaints}}'}</code> - оплаквания</div>
            <div><code>{'{{knowledgeContext}}'}</code> - ръководство</div>
          </div>
        </div>

        <Textarea
          value={promptContent}
          onChange={(e) => setPromptContent(e.target.value)}
          className="min-h-[500px] font-mono text-sm"
          placeholder="Въведете AI промпт шаблона..."
        />
        
        <div className="flex gap-2">
          <Button onClick={handleSavePrompt} className="flex-1">
            <CheckCircle className="w-4 h-4 mr-2" />
            Запази промените
          </Button>
          <Button onClick={handleResetPrompt} variant="outline">
            <ArrowCounterClockwise className="w-4 h-4 mr-2" />
            Възстанови оригинала
          </Button>
        </div>
        
        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground">
            💡 Този промпт определя как AI модела ще анализира ирисите. Използвайте променливите в двойни къдрави скоби за динамично попълване на данни.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
