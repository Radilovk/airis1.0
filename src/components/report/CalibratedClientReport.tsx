import type { AnalysisReport } from '@/types'
import {
  getTopClientInsights,
  topPrioritySystems,
} from '@/lib/calibrated-report-summary'
import CalibratedReportSummary from '@/components/report/CalibratedReportSummary'
import CalibratedIrisEyes from '@/components/report/CalibratedIrisEyes'
import CalibratedKeyInsights, {
  CalibratedPriorityStrip,
  CalibratedTrustFooter,
} from '@/components/report/CalibratedKeyInsights'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CaretDown, Target } from '@phosphor-icons/react'
import { useState } from 'react'

interface Props {
  report: AnalysisReport
  onOpenPlan?: () => void
}

/**
 * Клиентски изглед на калибриран отчет — един поток, без дублиране.
 * Ред: обобщение → снимки → 3 извода → фокус → (по желание) детайли.
 */
export default function CalibratedClientReport({ report, onOpenPlan }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const cal = report.calibrated!
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  const insights = getTopClientInsights(cal, 3)
  const systems = topPrioritySystems(cal)

  return (
    <div className="space-y-8">
      {report.questionnaireData.goals.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Target size={18} weight="duotone" className="text-primary" />
            Вашите цели
          </div>
          <div className="flex flex-wrap gap-1.5">
            {report.questionnaireData.goals.map(g => (
              <Badge key={g} variant="secondary" className="text-xs">
                {g}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <CalibratedReportSummary
        data={cal}
        avgHealth={avgHealth}
        briefSummary={report.briefSummary}
        compact
      />

      <CalibratedIrisEyes report={report} maxPerEye={3} />

      <CalibratedKeyInsights insights={insights} />

      <CalibratedPriorityStrip systems={systems} />

      <CalibratedTrustFooter
        constitution={cal.constitution}
        imageQuality={cal.imageQuality}
        onOpenPlan={onOpenPlan}
      />

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted/30">
          <span>Методика и технически детайли</span>
          <CaretDown size={16} className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Card className="space-y-2 p-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              Всяко око се разчита два пъти независимо. Съвпадналите находки са по-надеждни.
              {typeof cal.agreement === 'number' &&
                ` Повторяемост: ${Math.round(cal.agreement * 100)}%.`}
              {typeof cal.confirmedCount === 'number' &&
                ` Потвърдени: ${cal.confirmedCount}.`}
            </p>
            <p>
              Прегледани {cal.findings.length} точки; {cal.findings.filter(f => (f.confirmations ?? 0) >= 2 || f.confidence >= 0.65).length}{' '}
              повлияха препоръките. Тежест на ириса в оценката: {Math.round(cal.irisWeight * 100)}%.
            </p>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
