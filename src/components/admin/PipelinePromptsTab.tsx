import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { getPromptSummaries, mergePromptCatalog, pipelinePromptCatalog, simpleChecksum } from '@/lib/pipeline-prompts'
import type { PipelinePromptCatalog } from '@/lib/pipeline-prompts'
import type { StepStage } from '@/types/iris-pipeline'
import { CheckCircle, WarningCircle, ArrowClockwise, ListNumbers } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface PromptSummaryItem {
  stage: StepStage
  source: string
  checksum: string
  version: string
}

export default function PipelinePromptsTab() {
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [draftCatalog, setDraftCatalog] = useState<PipelinePromptCatalog | null>(null)
  const [catalog, setCatalog] = useKVWithFallback<PipelinePromptCatalog>('pipeline-prompt-catalog', pipelinePromptCatalog)

  useEffect(() => {
    if (catalog) {
      setDraftCatalog(mergePromptCatalog(catalog))
    }
  }, [catalog])

  const summaries = useMemo<PromptSummaryItem[]>(() => getPromptSummaries(draftCatalog ?? pipelinePromptCatalog), [draftCatalog])

  const handleRecheck = () => {
    setLastChecked(new Date())
  }

  const handleSave = async () => {
    if (!draftCatalog) return
    const normalized = mergePromptCatalog(draftCatalog)
    await setCatalog(normalized)
    setLastChecked(new Date())
    toast.success('Запази стъпките. Следващият анализ ще използва тези текстове.')
  }

  const handleReset = async () => {
    setDraftCatalog(pipelinePromptCatalog)
    await setCatalog(pipelinePromptCatalog)
    setLastChecked(new Date())
    toast.success('Възстановени са оригиналните стъпки от steps/')
  }

  const updateBody = (stage: StepStage, body: string) => {
    setDraftCatalog((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        prompts: {
          ...prev.prompts,
          [stage]: {
            ...prev.prompts[stage],
            body,
            checksum: simpleChecksum(body),
          },
        },
      }
    })
  }

  const updateVersion = (version: string) => {
    setDraftCatalog((prev) => (prev ? { ...prev, version } : prev))
  }

  const orderedStages: StepStage[] = ['STEP1', 'STEP2A', 'STEP2B', 'STEP2C', 'STEP3', 'STEP4', 'STEP5']
  const currentCatalog = draftCatalog ?? pipelinePromptCatalog
  const promptsToRender = orderedStages.map((stage) => currentCatalog.prompts[stage])

  const hasMissing = summaries.some((summary) => !summary.source || !summary.checksum)
  const duplicateSources = summaries.filter(
    (summary, index, arr) => arr.findIndex((item) => item.source === summary.source) !== index
  )
  const hasEmptyBody = promptsToRender.some((prompt) => !prompt.body || prompt.body.trim() === '')

  const statusVariant = hasMissing || hasEmptyBody ? 'destructive' : duplicateSources.length > 0 ? 'secondary' : 'default'
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
          Тук се държи работното съдържание на всичките 7 стъпки. Анализът използва точно тези текстове от настройките, а
          checksum следи за промени спрямо файловете в <code>steps/</code>.
        </CardDescription>
        <Badge variant="outline" className="w-fit text-xs">
          Заредена версия: {summaries[0]?.version || pipelinePromptCatalog.version}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 md:p-4 rounded-lg border bg-muted/60 text-xs md:text-sm space-y-1">
          <div className="font-semibold">Как влияе на анализа</div>
          <p className="text-muted-foreground">
            Целият LLM анализ тръгва от STEP1 и завършва със STEP5, като във всяка стъпка се подава текстът, запазен тук. Ако
            редактираш съдържанието и го запазиш, следващият анализ веднага ще ползва новите инструкции, без да чака build.
            Финалният UI JSON се сглобява след като всяка стъпка върне резултат в правилния ред.
          </p>
          <div className="font-semibold">Практичен пример</div>
          <p className="text-muted-foreground break-words">
            Ако добавиш ред в <code>STEP4_profile_builder</code> за конкретен симптом, натисни „Запази стъпките“. Следващият
            анализ ще използва новия текст и ще построи профила по него. Текстовите настройки в другите табове (AI Prompt,
            Manual) допълват, но не заменят тези стъпки.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="pipeline-version">
              Версия (пример: v9-final+custom)
            </label>
            <Input
              id="pipeline-version"
              value={draftCatalog?.version || ''}
              onChange={(e) => updateVersion(e.target.value)}
              placeholder="v9-final"
            />
            <p className="text-xs text-muted-foreground">
              Кратък маркер, който ще се изпише в логовете и при анализа. Използвай го, за да отличиш локални промени.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={!draftCatalog} className="w-full sm:w-auto">
              Запази стъпките
            </Button>
            <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
              Възстанови оригинала
            </Button>
          </div>
        </div>

        <div className={`p-3 md:p-4 rounded-lg border ${statusVariant === 'destructive' ? 'border-destructive/40 bg-destructive/10' : statusVariant === 'secondary' ? 'border-amber-400/50 bg-amber-400/10' : 'border-emerald-400/40 bg-emerald-400/10'}`}>
          <div className="flex items-center text-sm font-semibold">
            {statusIcon}
            {hasMissing
              ? 'Липсващ или празен prompt файл — проверете sources и checksum'
              : hasEmptyBody
                ? 'Някоя стъпка няма текст – попълни съдържание преди следващ анализ'
              : duplicateSources.length > 0
                ? 'Повторени източници: има стъпки със същия source, провери версията на каталога'
                : 'Всички стъпки са заредени коректно'}
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            {hasMissing
              ? 'Зареди отново файла в steps/ или провери дали билда включва всички txt файлове.'
              : hasEmptyBody
                ? 'Всяка стъпка трябва да има инструкции, иначе LLM няма да може да пресметне резултат.'
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

        <ScrollArea className="h-[420px] md:h-[520px] border rounded-lg">
          <div className="divide-y">
            {promptsToRender.map((prompt) => (
              <div key={prompt.stage} className="p-3 space-y-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge>{prompt.stage}</Badge>
                    <span className="font-medium text-sm">{prompt.source}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono break-all">
                    checksum: {prompt.checksum}
                  </div>
                </div>

                <Textarea
                  value={prompt.body}
                  onChange={(e) => updateBody(prompt.stage, e.target.value)}
                  className="font-mono text-xs min-h-[140px]"
                  spellCheck={false}
                  placeholder={`Пример: ${prompt.stage} инструкции...`}
                />
                <p className="text-[11px] text-muted-foreground">
                  Пример: добави конкретно правило, напр. „ако светкавицата е силна, маркирай warning в STEP1“ или
                  „в STEP5 винаги връщай arrays за zones/artifacts“. Всяка редакция обновява checksum автоматично.
                </p>
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
