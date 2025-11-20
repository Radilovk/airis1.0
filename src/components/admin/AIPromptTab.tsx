import { useState, useEffect } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Robot, CheckCircle, ArrowCounterClockwise } from '@phosphor-icons/react'
import type { AIPromptTemplate } from '@/types'
import { DEFAULT_AI_PROMPT } from '@/lib/default-prompts'

export default function AIPromptTab() {
  const [aiPromptTemplate, setAiPromptTemplate] = useKVWithFallback<AIPromptTemplate>('ai-prompt-template', {
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
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <Robot className="w-5 h-5 md:w-6 md:h-6 text-primary flex-shrink-0" />
          <span>AI Промпт шаблон</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Промптът, който се изпраща към AI модела за анализ на ирисите
        </CardDescription>
        {aiPromptTemplate && (
          <Badge variant="outline" className="w-fit text-xs">
            Последна промяна: {new Date(aiPromptTemplate.lastModified).toLocaleString('bg-BG', {
              dateStyle: 'short',
              timeStyle: 'short'
            })}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-2 md:p-3 bg-accent/10 rounded-lg border border-accent/20 mb-4">
          <p className="text-xs md:text-sm font-semibold text-accent-foreground mb-2">
            📋 Променливи за замяна в промпта:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-accent-foreground/80">
            <div className="break-all"><code>{'{{side}}'}</code> - ляв/десен</div>
            <div className="break-all"><code>{'{{imageHash}}'}</code> - ID на изображението</div>
            <div className="break-all"><code>{'{{age}}'}</code> - възраст</div>
            <div className="break-all"><code>{'{{gender}}'}</code> - пол</div>
            <div className="break-all"><code>{'{{bmi}}'}</code> - индекс на телесна маса</div>
            <div className="break-all"><code>{'{{goals}}'}</code> - здравни цели</div>
            <div className="break-all"><code>{'{{complaints}}'}</code> - оплаквания</div>
            <div className="break-all"><code>{'{{knowledgeContext}}'}</code> - ръководство</div>
          </div>
        </div>

        <Textarea
          value={promptContent}
          onChange={(e) => setPromptContent(e.target.value)}
          className="min-h-[300px] md:min-h-[500px] font-mono text-xs md:text-sm"
          placeholder="Въведете AI промпт шаблона..."
        />
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSavePrompt} className="flex-1 text-sm md:text-base">
            <CheckCircle className="w-4 h-4 mr-2" />
            Запази промените
          </Button>
          <Button onClick={handleResetPrompt} variant="outline" className="sm:flex-initial text-sm md:text-base">
            <ArrowCounterClockwise className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Възстанови оригинала</span>
            <span className="sm:hidden">Възстанови</span>
          </Button>
        </div>
        
        <div className="p-2 md:p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground break-words">
            💡 Този промпт определя как AI модела ще анализира ирисите. Използвайте променливите в двойни къдрави скоби за динамично попълване на данни.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
