import type { AnalysisReport } from '@/types'
import CalibratedReportSummary from '@/components/report/CalibratedReportSummary'
import IrisExplorer from '@/components/report/IrisExplorer'
import EyeHealthCard from '@/components/report/EyeHealthCard'
import ConstitutionCard from '@/components/report/ConstitutionCard'
import CalibratedInsightPanel from '@/components/report/CalibratedInsightPanel'
import { ArrowRight } from '@phosphor-icons/react'

interface Props {
  report: AnalysisReport
}

/**
 * Докладът се чете в реда на разбирането:
 *   1. Анализ — какво е намерено и защо (основание: отговори + ирис), без съвети;
 *   2. Ирис — къде се вижда всеки знак и към коя област сочи;
 *   3. План — какво да правите, по областите от анализа.
 * Всеки таб завършва с бутон към следващия.
 */
export function NextStep({ label, hint, onClick }: { label: string; hint: string; onClick?: () => void }) {
  if (!onClick) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-3 text-left text-primary-foreground shadow-md transition active:scale-[0.99]"
    >
      <span>
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-xs opacity-80">{hint}</span>
      </span>
      <ArrowRight size={20} weight="bold" className="shrink-0" />
    </button>
  )
}

/** Таб „1 · Анализ“. Резултатът и водещият извод са в героя над табовете. */
export function CalibratedSummaryReport({
  report,
  withLead,
  onOpenPlan,
  onOpenIris,
}: Props & { withLead?: boolean; onOpenPlan?: () => void; onOpenIris?: () => void }) {
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

      <CalibratedInsightPanel data={cal} onOpenPlan={onOpenPlan} onOpenIris={onOpenIris} />
      <NextStep label="Напред: знаците в ириса" hint="Къде се вижда всеки знак на снимката" onClick={onOpenIris} />
    </div>
  )
}

/** Таб „2 · Ирис“ — знаците на снимката, всеки свързан с област от анализа. */
export function CalibratedIrisReport({ report, onOpenPlan }: Props & { onOpenPlan?: () => void }) {
  const cal = report.calibrated
  return (
    <div className="space-y-6">
      <IrisExplorer report={report} />
      {cal?.eyeHealth && <EyeHealthCard report={cal.eyeHealth} />}
      {cal && <ConstitutionCard data={cal} />}
      <NextStep label="Напред: вашият план" hint="Какво да ядете, добавки и навици — по областите от анализа" onClick={onOpenPlan} />
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
