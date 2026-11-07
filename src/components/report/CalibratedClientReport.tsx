import type { AnalysisReport } from '@/types'
import CalibratedReportSummary from '@/components/report/CalibratedReportSummary'
import IrisExplorer from '@/components/report/IrisExplorer'
import EyeHealthCard from '@/components/report/EyeHealthCard'
import ConstitutionCard from '@/components/report/ConstitutionCard'
import CalibratedInsightPanel from '@/components/report/CalibratedInsightPanel'

interface Props {
  report: AnalysisReport
}

/**
 * Таб „Вашият фокус“ — до три хранителни приоритета с конкретна стъпка и
 * основание, останалото е свито. Водещият извод и резултатът са в героя над
 * табовете, затова тук не се повтарят.
 */
export function CalibratedSummaryReport({
  report,
  withLead,
  onOpenPlan,
}: Props & { withLead?: boolean; onOpenPlan?: () => void }) {
  const cal = report.calibrated!
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)

  return (
    <div className="space-y-8">
      {withLead && (
        <CalibratedReportSummary
          data={cal}
          avgHealth={avgHealth}
          briefSummary={report.briefSummary}
          hideScore
        />
      )}

      <CalibratedInsightPanel data={cal} onOpenPlan={onOpenPlan} />
    </div>
  )
}

/**
 * Таб „Ирис“ — интерактивният ирис, теренът и очният скрининг.
 */
export function CalibratedIrisReport({ report }: Props) {
  const cal = report.calibrated
  return (
    <div className="space-y-6">
      <IrisExplorer report={report} />
      {cal?.eyeHealth && <EyeHealthCard report={cal.eyeHealth} />}
      {cal && <ConstitutionCard data={cal} />}
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
