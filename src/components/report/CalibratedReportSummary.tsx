import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Info, Warning } from '@phosphor-icons/react'
import type { CalibratedAnalysisPayload } from '@/types'
import { summarizeCalibratedReport } from '@/lib/calibrated-report-summary'

interface Props {
  data: CalibratedAnalysisPayload
  avgHealth: number
  briefSummary?: string
  /** По-малко числа — за клиентския изглед. */
  compact?: boolean
  /** Скрива дублирания общ резултат (hero го показва). */
  hideScore?: boolean
}

const VERDICT_STYLE = {
  stable: {
    icon: CheckCircle,
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ring: 'from-emerald-500/20 to-teal-500/10',
  },
  mild: {
    icon: Info,
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    ring: 'from-amber-500/20 to-orange-500/10',
  },
  focus: {
    icon: Warning,
    badge: 'bg-rose-100 text-rose-900 border-rose-200',
    ring: 'from-rose-500/20 to-red-500/10',
  },
} as const

/** Единен водещ блок — какво означава анализът за клиента. */
export default function CalibratedReportSummary({ data, avgHealth, briefSummary, compact, hideScore }: Props) {
  const summary = summarizeCalibratedReport(data, { briefSummary, avgHealth })
  const style = VERDICT_STYLE[summary.verdict]
  const Icon = style.icon

  return (
    <Card className={`overflow-hidden border-0 bg-gradient-to-br ${style.ring} p-5 md:p-6`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm">
          <Icon size={24} weight="duotone" className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          {!compact && (
            <Badge variant="outline" className={`mb-2 text-[10px] ${style.badge}`}>
              Обобщение на анализа
            </Badge>
          )}
          <h3 className="text-lg font-bold leading-tight">{summary.headline}</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{summary.lead}</p>
        </div>
        {!compact && !hideScore && (
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-primary">{avgHealth}</p>
            <p className="text-[11px] text-muted-foreground">общ резултат</p>
          </div>
        )}
      </div>

      {!compact && (
        <>
          <p className="mt-4 rounded-lg border bg-background/60 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
            {summary.explanation}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Прегледани точки" value={String(summary.totalDetected)} hint="микро-зони" />
            <Stat label="За плана" value={String(summary.planRelevant)} hint="значими" />
            <Stat label="Потвърдени" value={String(summary.confirmed)} hint="два прочита" />
            <Stat label="Сектори" value={String(summary.sectorsAffected)} hint="с акцент" />
          </div>
        </>
      )}

      {compact && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{summary.explanation}</p>
      )}
    </Card>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-background/70 px-3 py-2.5 ring-1 ring-border/60">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  )
}
