import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getPromptSummaries, pipelinePromptCatalog } from '@/lib/pipeline-prompts'
import type { StepStage } from '@/types/iris-pipeline'
import { CheckCircle, WarningCircle, ArrowClockwise, ListNumbers } from '@phosphor-icons/react'

interface PromptSummaryItem {
  stage: StepStage
  source: string
  checksum: string
  version: string
}

export default function PipelinePromptsTab() {
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const summaries = useMemo<PromptSummaryItem[]>(() => getPromptSummaries(), [])

  const handleRecheck = () => {
    setLastChecked(new Date())
  }

  const hasMissing = summaries.some((summary) => !summary.source || !summary.checksum)
  const duplicateSources = summaries.filter(
    (summary, index, arr) => arr.findIndex((item) => item.source === summary.source) !== index
  )

  const statusVariant = hasMissing ? 'destructive' : duplicateSources.length > 0 ? 'secondary' : 'default'
  const statusIcon = hasMissing ? (
    <WarningCircle className="w-4 h-4 mr-2" />
  ) : duplicateSources.length > 0 ? (
    <ListNumbers className="w-4 h-4 mr-2" />
  ) : (
    <CheckCircle className="w-4 h-4 mr-2" weight="fill" />
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <ListNumbers className="w-5 h-5 md:w-6 md:h-6 text-primary flex-shrink-0" />
          <span>LLM pipeline стъпки</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Виж текущо заредените prompt файлове, тяхната версия и checksum. Бърза проверка дали всичките 7 стъпки са налични.
        </CardDescription>
        <Badge variant="outline" className="w-fit text-xs">
          Заредена версия: {summaries[0]?.version || pipelinePromptCatalog.version}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`p-3 md:p-4 rounded-lg border ${statusVariant === 'destructive' ? 'border-destructive/40 bg-destructive/10' : statusVariant === 'secondary' ? 'border-amber-400/50 bg-amber-400/10' : 'border-emerald-400/40 bg-emerald-400/10'}`}>
          <div className="flex items-center text-sm font-semibold">
            {statusIcon}
            {hasMissing
              ? 'Липсващ или празен prompt файл — проверете sources и checksum'
              : duplicateSources.length > 0
                ? 'Повторени източници: има стъпки със същия source, провери версията на каталога'
                : 'Всички стъпки са заредени коректно'}
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            {hasMissing
              ? 'Зареди отново файла в steps/ или провери дали билда включва всички txt файлове.'
              : duplicateSources.length > 0
                ? 'Прегледай файловете в steps/ и се увери, че всяка стъпка сочи към уникален source.'
                : 'Checksum помагат да засечеш грешно кеширани версии при deployment.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Натисни „Провери стъпките“ за моментна проверка. Последна проверка:{' '}
            {lastChecked ? lastChecked.toLocaleString('bg-BG') : 'още няма'}
          </div>
          <Button variant="outline" size="sm" onClick={handleRecheck} className="w-full sm:w-auto text-sm">
            <ArrowClockwise className="w-4 h-4 mr-2" />
            Провери стъпките
          </Button>
        </div>

        <Separator />

        <ScrollArea className="h-[360px] md:h-[420px] border rounded-lg">
          <div className="divide-y">
            {summaries.map((summary) => (
              <div key={summary.stage} className="flex flex-col md:flex-row md:items-center gap-2 px-3 py-3">
                <div className="flex items-center gap-2">
                  <Badge>{summary.stage}</Badge>
                  <span className="font-medium text-sm">{summary.source}</span>
                </div>
                <div className="flex-1 md:text-right text-xs text-muted-foreground break-all font-mono">
                  checksum: {summary.checksum}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 md:p-4 bg-muted/60 rounded-lg border border-border space-y-2 text-xs md:text-sm">
          <div className="font-semibold">Кратък пример</div>
          <p className="text-muted-foreground break-words">
            STEP5 използва <code>steps/STEP5_frontend_report_bg.txt</code> и композира финалния UI JSON от резултатите на стъпки 1–4.
            Ако checksum тук се промени, обнови билд артефактите, за да избегнеш несъответствия между фронтенд и LLM.
          </p>
          <div className="font-semibold">Оптимизации</div>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Добави автоматичен health-check при зареждане на Admin панела, който логва липсващи стъпки.</li>
            <li>Позволи избор на алтернативен <code>pipelinePromptCatalog</code> (A/B) за бързо сравнение на версии.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
