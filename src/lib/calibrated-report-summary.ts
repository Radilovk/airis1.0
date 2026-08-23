/**
 * Единен текстов слой за калибриран отчет — превежда техническите находки
 * в разбираемо обобщение за клиента.
 */
import type { CalibratedAnalysisPayload } from '@/types'

export type CalibratedVerdict = 'stable' | 'mild' | 'focus'

export interface CalibratedReportSummary {
  totalDetected: number
  confirmed: number
  planRelevant: number
  sectorsAffected: number
  verdict: CalibratedVerdict
  headline: string
  explanation: string
  /** 1–3 изречения — водещият извод за таб „Анализ“. */
  lead: string
}

/** Находка, която заслужава да се покаже на снимката и в списъка. */
export function isPlanRelevantFinding(f: CalibratedAnalysisPayload['findings'][number]): boolean {
  return (f.confirmations ?? 1) >= 2 || f.confidence >= 0.65
}

export function summarizeCalibratedReport(
  data: CalibratedAnalysisPayload,
  opts?: { briefSummary?: string; avgHealth?: number }
): CalibratedReportSummary {
  const totalDetected = data.findings.length
  const confirmed =
    typeof data.confirmedCount === 'number'
      ? data.confirmedCount
      : data.findings.filter(f => (f.confirmations ?? 1) >= 2).length
  const relevant = data.findings.filter(isPlanRelevantFinding)
  const planRelevant = relevant.length
  const sectorsAffected = new Set(relevant.map(f => `${f.side}:${f.sector}`)).size

  const topSystem = data.systems.find(s => s.priority && data.focus[0] === s.key)
  const irisPct = Math.round(data.irisWeight * 100)

  let verdict: CalibratedVerdict = 'stable'
  if (planRelevant >= 6 || (topSystem && topSystem.score < 55)) verdict = 'focus'
  else if (planRelevant >= 2 || confirmed >= 3) verdict = 'mild'

  const headline =
    verdict === 'stable'
      ? 'Общата картина е стабилна'
      : verdict === 'mild'
        ? 'Има няколко акцента за подкрепа'
        : 'Има ясни приоритети за подкрепа'

  const explanation =
    totalDetected === 0
      ? 'Не са открити запомнящи се ирисови признаци. Планът се базира основно на въпросника.'
      : `При анализа са прегледани ${totalDetected} микро-зони в ириса. ` +
        `${planRelevant} от тях са достатъчно ясни, за да повлияят на препоръките` +
        (confirmed > 0 ? ` (${confirmed} потвърдени при повторно разчитане)` : '') +
        `. Това не означава диагноза — показва къде хранителният план може да насочи допълнителна подкрепа.` +
        (irisPct < 25 ? ` Тежестта на ириса в оценката е ${irisPct}% — основата идва от въпросника.` : '')

  const lead =
    opts?.briefSummary?.trim() ||
    (topSystem
      ? `Водещ фокус: ${topSystem.label.toLowerCase()} (${topSystem.score}/100). ${explanation.split('. ')[0]}.`
      : explanation.split('. ').slice(0, 2).join('. ') + '.')

  if (opts?.avgHealth !== undefined && opts.avgHealth >= 75 && verdict === 'stable') {
    return {
      totalDetected,
      confirmed,
      planRelevant,
      sectorsAffected,
      verdict,
      headline: `Добро общо състояние (${Math.round(opts.avgHealth)}/100)`,
      explanation,
      lead,
    }
  }

  return { totalDetected, confirmed, planRelevant, sectorsAffected, verdict, headline, explanation, lead }
}

/** Брой зони за история / карти — само значими, не всички микро-находки. */
export function significantZoneCount(report: {
  calibrated?: CalibratedAnalysisPayload
  leftIris?: { zones?: Array<{ status?: string }> }
  rightIris?: { zones?: Array<{ status?: string }> }
}): number {
  if (report.calibrated) {
    return summarizeCalibratedReport(report.calibrated).sectorsAffected
  }
  const left = report.leftIris?.zones ?? []
  const right = report.rightIris?.zones ?? []
  return left.filter(z => z.status !== 'normal').length + right.filter(z => z.status !== 'normal').length
}
