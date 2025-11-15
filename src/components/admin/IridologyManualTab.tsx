import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { BookOpen, CheckCircle, ArrowCounterClockwise } from '@phosphor-icons/react'
import type { IridologyManual } from '@/types'
import { DEFAULT_IRIDOLOGY_MANUAL } from '@/lib/default-prompts'

export default function IridologyManualTab() {
  const [iridologyManual, setIridologyManual] = useKV<IridologyManual>('iridology-manual', {
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
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Иридологично ръководство
        </CardTitle>
        <CardDescription>
          Ръководството, по което се води разчитането на ирисите при анализ
        </CardDescription>
        {iridologyManual && (
          <Badge variant="outline" className="w-fit">
            Последна промяна: {new Date(iridologyManual.lastModified).toLocaleString('bg-BG')}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={manualContent}
          onChange={(e) => setManualContent(e.target.value)}
          className="min-h-[500px] font-mono text-sm"
          placeholder="Въведете съдържанието на иридологичното ръководство..."
        />
        
        <div className="flex gap-2">
          <Button onClick={handleSaveManual} className="flex-1">
            <CheckCircle className="w-4 h-4 mr-2" />
            Запази промените
          </Button>
          <Button onClick={handleResetManual} variant="outline">
            <ArrowCounterClockwise className="w-4 h-4 mr-2" />
            Възстанови оригинала
          </Button>
        </div>
        
        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground">
            💡 Това ръководство се използва като референтна база знания при AI анализа на ирисите. 
            Промените тук ще повлияят на интерпретацията на находките.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
