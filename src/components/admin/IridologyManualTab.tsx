import { useState, useEffect } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { BookOpen, CheckCircle, ArrowCounterClockwise } from '@phosphor-icons/react'
import type { IridologyManual } from '@/types'
import { DEFAULT_IRIDOLOGY_MANUAL } from '@/lib/default-prompts'

export default function IridologyManualTab() {
  const [iridologyManual, setIridologyManual] = useKVWithFallback<IridologyManual>('iridology-manual', {
    content: DEFAULT_IRIDOLOGY_MANUAL,
    lastModified: new Date().toISOString()
  })
  
  const [manualContent, setManualContent] = useState(iridologyManual?.content || DEFAULT_IRIDOLOGY_MANUAL)

  useEffect(() => {
    if (iridologyManual) {
      setManualContent(iridologyManual.content)
    }
  }, [iridologyManual])

  const handleSaveManual = async () => {
    try {
      await setIridologyManual({
        content: manualContent,
        lastModified: new Date().toISOString()
      })
      toast.success('Иридологичното ръководство е запазено успешно')
    } catch (error) {
      console.error('Error saving manual:', error)
      toast.error('Грешка при запазване на ръководството')
    }
  }

  const handleResetManual = async () => {
    setManualContent(DEFAULT_IRIDOLOGY_MANUAL)
    await setIridologyManual({
      content: DEFAULT_IRIDOLOGY_MANUAL,
      lastModified: new Date().toISOString()
    })
    toast.success('Ръководството е възстановено до оригиналната версия')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-primary flex-shrink-0" />
          <span>Иридологично ръководство</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Ръководството се използва САМО за идентификация на находките в ириса - топографска локация, тип находка и диагностично значение (кои органи/системи). Работи като RAG памет без бекенд.
        </CardDescription>
        {iridologyManual && (
          <Badge variant="outline" className="w-fit text-xs">
            Последна промяна: {new Date(iridologyManual.lastModified).toLocaleString('bg-BG', { 
              dateStyle: 'short', 
              timeStyle: 'short' 
            })}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={manualContent}
          onChange={(e) => setManualContent(e.target.value)}
          className="min-h-[300px] md:min-h-[500px] font-mono text-xs md:text-sm"
          placeholder="Въведете съдържанието на иридологичното ръководство..."
        />
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSaveManual} className="flex-1 text-sm md:text-base">
            <CheckCircle className="w-4 h-4 mr-2" />
            Запази промените
          </Button>
          <Button onClick={handleResetManual} variant="outline" className="sm:flex-initial text-sm md:text-base">
            <ArrowCounterClockwise className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Възстанови оригинала</span>
            <span className="sm:hidden">Възстанови</span>
          </Button>
        </div>
        
        <div className="p-2 md:p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground break-words">
            💡 Това ръководство се използва САМО за ИДЕНТИФИКАЦИЯ на находките в ириса: 
            <br />• Топографска позиция (къде в ириса се намира находката)
            <br />• Тип находка (лакуни, крипти, пигменти и др.)
            <br />• Диагностично значение (с кои органи и системи са свързани находките)
            <br />
            <br />Интерпретацията и корелацията с информацията за клиента се правят от LLM знанията.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
