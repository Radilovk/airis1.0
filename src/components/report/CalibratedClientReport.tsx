import type { AnalysisReport } from '@/types'
import CalibratedReportSummary from '@/components/report/CalibratedReportSummary'
import CalibratedIrisEyes from '@/components/report/CalibratedIrisEyes'
import CalibratedInsightPanel from '@/components/report/CalibratedInsightPanel'
import CalibratedSystemsChart from '@/components/report/CalibratedSystemsChart'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target } from '@phosphor-icons/react'

interface Props {
  report: AnalysisReport
}

function GoalsCard({ report }: { report: AnalysisReport }) {
  if (report.questionnaireData.goals.length === 0) return null
  return (
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
  )
}

/**
 * Таб „Обобщение“ — интерпретация, системи, драйвери, методика.
 * Без снимки (те са в отделен таб).
 */
export function CalibratedSummaryReport({ report }: Props) {
  const cal = report.calibrated!
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)

  return (
    <div className="space-y-8">
      <GoalsCard report={report} />

      <CalibratedReportSummary
        data={cal}
        avgHealth={avgHealth}
        briefSummary={report.briefSummary}
        hideScore
      />

      <CalibratedSystemsChart systems={cal.systems} />

      <CalibratedInsightPanel data={cal} />
    </div>
  )
}

/**
 * Таб „Ирис“ — маркери върху реалните снимки и списък на находките.
 */
export function CalibratedIrisReport({ report }: Props) {
  return (
    <div className="space-y-6">
      <CalibratedIrisEyes report={report} />
    </div>
  )
}

/** @deprecated Използвай CalibratedSummaryReport + CalibratedIrisReport в отделни табове. */
export default function CalibratedClientReport({ report }: Props) {
  return (
    <div className="space-y-8">
      <CalibratedSummaryReport report={report} />
      <CalibratedIrisReport report={report} />
    </div>
  )
}
