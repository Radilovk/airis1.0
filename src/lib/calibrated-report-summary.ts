/**
 * Единен текстов слой за калибриран отчет — превежда техническите находки
 * в разбираемо обобщение за клиента.
 */
import type { CalibratedAnalysisPayload } from '@/types'
import { ringBand, isCircumferentialFinding, boundaryRingNote } from '@/lib/iris-map'

export type CalibratedVerdict = 'stable' | 'mild' | 'focus'

export interface CalibratedReportSummary {
  totalDetected: number
  planRelevant: number
  sectorsAffected: number
  verdict: CalibratedVerdict
  headline: string
  explanation: string
  /** 1–3 изречения — водещият извод. */
  lead: string
}

/** Находка, която заслужава да се покаже на снимката и в списъка. */
export function isPlanRelevantFinding(f: CalibratedAnalysisPayload['findings'][number]): boolean {
  return f.confidence >= 0.6
}

/**
 * Групира находки по сектор + пръstenен пояс + тип.
 * Околообхватните знаци (nerve_rings, sodium_ring …) се сливат по око+тип+пояс.
 * R1 и R2 в STOM стават един маркер — така е в manual.json / RING_BANDS.
 */
export function groupFindingsForDisplay(
  findings: CalibratedAnalysisPayload['findings']
): CalibratedAnalysisPayload['findings'] {
  const map = new Map<string, CalibratedAnalysisPayload['findings'][number]>()

  for (const f of findings) {
    const band = ringBand(f.ring)
    const circum = isCircumferentialFinding(f.type)
    const key = circum
      ? `${f.side}:${f.type}:${band.key}`
      : `${f.side}:${f.type}:${f.sector}:${band.key}`
    const prev = map.get(key)
    if (!prev || f.confidence > prev.confidence) {
      const midRing = Math.round((band.rings[0] + band.rings[1]) / 2)
      map.set(key, { ...f, ring: midRing, sector: circum ? 1 : f.sector })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence)
}

/** Подзаглавие за списък с находки — пояс с %, сектор или околообхватен знак. */
export function findingLocationLabel(
  f: CalibratedAnalysisPayload['findings'][number],
  sectorLabel?: string
): string {
  const band = ringBand(f.ring)
  const parts: string[] = [`${band.label} (${band.pct[0]}–${band.pct[1]}%)`]
  if (isCircumferentialFinding(f.type)) {
    parts.unshift('околообхватен пръsten')
  } else if (sectorLabel) {
    parts.push(sectorLabel)
  }
  const boundary = boundaryRingNote(f.ring)
  if (boundary) parts.push(boundary)
  return parts.join(' · ')
}

export function summarizeCalibratedReport(
  data: CalibratedAnalysisPayload,
  opts?: { briefSummary?: string; avgHealth?: number }
): CalibratedReportSummary {
  const totalDetected = data.findings.length
  const relevant = data.findings.filter(isPlanRelevantFinding)
  const planRelevant = relevant.length
  const sectorsAffected = new Set(relevant.map(f => `${f.side}:${f.sector}`)).size

  const topSystem = data.systems.find(s => s.priority && data.focus[0] === s.key)

  let verdict: CalibratedVerdict = 'stable'
  if (planRelevant >= 6 || (topSystem && topSystem.score < 55)) verdict = 'focus'
  else if (planRelevant >= 2) verdict = 'mild'

  const headline =
    verdict === 'stable'
      ? 'Общата картина е стабилна'
      : verdict === 'mild'
        ? 'Има няколко акцента за подкрепа'
        : 'Има ясни приоритети за подкрепа'

  const explanation =
    totalDetected === 0
      ? 'Не са открити ясни ирисови признаци. Планът се базира на вашите отговори и цели.'
      : `Прегледани са ${totalDetected} зони в ириса. ${planRelevant} от тях са достатъчно ясни, за да повлияят на препоръките. Това не е диагноза — показва къде хранителният план може да насочи допълнителна подкрепа.`

  const lead =
    opts?.briefSummary?.trim() ||
    (topSystem
      ? `Основен фокус: ${topSystem.label.toLowerCase()} (${topSystem.score}/100). ${explanation.split('. ')[0]}.`
      : explanation.split('. ').slice(0, 2).join('. ') + '.')

  if (opts?.avgHealth !== undefined && opts.avgHealth >= 75 && verdict === 'stable') {
    return {
      totalDetected,
      planRelevant,
      sectorsAffected,
      verdict,
      headline: `Добро общо състояние (${Math.round(opts.avgHealth)}/100)`,
      explanation,
      lead,
    }
  }

  return { totalDetected, planRelevant, sectorsAffected, verdict, headline, explanation, lead }
}

export interface ClientInsight {
  title: string
  body: string
}

export function getTopClientInsights(
  data: CalibratedAnalysisPayload,
  limit = 3
): ClientInsight[] {
  const out: ClientInsight[] = []

  for (const d of data.drivers.slice(0, limit)) {
    out.push({ title: d.observation, body: d.action })
    if (out.length >= limit) return out
  }

  const topFindings = data.findings
    .filter(isPlanRelevantFinding)
    .sort((a, b) => b.confidence - a.confidence)

  for (const f of topFindings) {
    if (out.length >= limit) break
    if (out.some(i => i.title.includes(f.label))) continue
    out.push({
      title: f.label,
      body: `${f.side === 'left' ? 'Ляв' : 'Десен'} ирис · сектор ${f.sector}`,
    })
  }

  return out.slice(0, limit)
}

export function topPrioritySystems(data: CalibratedAnalysisPayload) {
  const ordered = data.focus
    .map(key => data.systems.find(s => s.key === key))
    .filter(Boolean) as CalibratedAnalysisPayload['systems']
  return ordered.slice(0, 3)
}

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
