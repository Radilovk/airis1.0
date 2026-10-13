import type { AnalysisReport } from '@/types'
import CalibratedReportSummary from '@/components/report/CalibratedReportSummary'
import IrisExplorer from '@/components/report/IrisExplorer'
import EyeHealthCard from '@/components/report/EyeHealthCard'
import ConstitutionCard from '@/components/report/ConstitutionCard'
import { referralRank } from '@/lib/eye-health'
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
 * Таб „Обобщение“ — какво е важно сега, системи, насоки, методика.
 * Водещият извод и резултатът са в героя над табовете, затова тук не се повтарят.
 * Очният скрининг излиза най-горе само когато изисква преглед скоро.
 */
export function CalibratedSummaryReport({ report, withLead }: Props & { withLead?: boolean }) {
  const cal = report.calibrated!
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  const eyeUrgent = !!cal.eyeHealth && referralRank(cal.eyeHealth.referral) >= 2

  return (
    <div className="space-y-8">
      {eyeUrgent && <EyeHealthCard report={cal.eyeHealth} compact />}

      <GoalsCard report={report} />

      {withLead && (
        <CalibratedReportSummary
          data={cal}
          avgHealth={avgHealth}
          briefSummary={report.briefSummary}
          hideScore
        />
      )}

      <CalibratedSystemsChart systems={cal.systems} />

      <CalibratedInsightPanel data={cal} />
    </div>
  )
}

/**
 * Таб „Ирис и очи“ — интерактивният ирис, теренът и очният скрининг.
 */
export function CalibratedIrisReport({ report }: Props) {
  const cal = report.calibrated
  return (
    <div className="space-y-6">
      <IrisExplorer report={report} />
      {cal && <ConstitutionCard data={cal} />}
      {cal?.eyeHealth && <EyeHealthCard report={cal.eyeHealth} />}
    </div>
  )
}

/** @deprecated Използвай CalibratedSummaryReport + CalibratedIrisReport в отделни табове. */
export default function CalibratedClientReport({ report }: Props) {
  return (
    <div className="space-y-8">
      <CalibratedSummaryReport report={report} withLead />
      <CalibratedIrisReport report={report} />
    </div>
  )
}
