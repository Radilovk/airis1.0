import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkle, Leaf, ClipboardText } from '@phosphor-icons/react'
import type { ClientInsight } from '@/lib/calibrated-report-summary'
import { CONSTITUTIONS, type Constitution } from '@/lib/iris-map'

const SOURCE: Record<ClientInsight['source'], { label: string; cls: string }> = {
  both: { label: 'ирис + въпросник', cls: 'bg-indigo-100 text-indigo-800' },
  iris: { label: 'от ириса', cls: 'bg-sky-100 text-sky-800' },
  questionnaire: { label: 'от въпросника', cls: 'bg-emerald-100 text-emerald-800' },
}

/** До 3 ключови извода — какво клиентът трябва да запомни. */
export default function CalibratedKeyInsights({ insights }: { insights: ClientInsight[] }) {
  if (insights.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          Няма отделни ирисови акценти — планът се базира на вашите цели и отговори от въпросника.
        </p>
      </Card>
    )
  }

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Sparkle size={22} weight="duotone" className="text-primary" />
        Какво е важно за вас
      </h3>
      <ol className="space-y-3">
        {insights.map((item, i) => {
          const src = SOURCE[item.source]
          return (
            <Card key={i} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <Badge variant="outline" className={`text-[10px] ${src.cls}`}>
                  {src.label}
                </Badge>
              </div>
              <p className="font-semibold leading-snug">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </Card>
          )
        })}
      </ol>
    </div>
  )
}

export function CalibratedPriorityStrip({
  systems,
}: {
  systems: Array<{ label: string; score: number; description: string }>
}) {
  if (systems.length === 0) return null
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Leaf size={20} weight="duotone" className="text-primary" />
        Фокус на подкрепата
      </h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {systems.map(s => (
          <Card key={s.label} className="p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-lg font-bold tabular-nums text-primary">{s.score}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function CalibratedTrustFooter({
  constitution,
  imageQuality,
  onOpenPlan,
}: {
  constitution?: string
  imageQuality: number
  onOpenPlan?: () => void
}) {
  return (
    <Card className="border-muted bg-muted/20 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <ClipboardText size={22} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-2 text-xs leading-relaxed text-muted-foreground">
          {constitution && constitution !== 'unclear' && (
            <p>
              <strong className="text-foreground">Конституция:</strong>{' '}
              {CONSTITUTIONS[constitution as Constitution]?.label ?? constitution} — ориентир
              за метаболизма, не диагноза.
            </p>
          )}
          <p>
            Качество на снимките: {imageQuality}/100. Анализът е образователен инструмент и{' '}
            <strong>не замества</strong> медицински преглед.
          </p>
          {onOpenPlan && (
            <button
              type="button"
              onClick={onOpenPlan}
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              → Виж персоналния план с храни и стъпки
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
