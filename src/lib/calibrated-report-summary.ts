/**
 * Единен текстов слой за калибриран отчет — превежда техническите находки
 * в разбираемо обобщение за клиента.
 */
import type { CalibratedAnalysisPayload } from '@/types'
import { ringBand, isRingFinding, boundaryRingNote, sectorsFor, FINDINGS, type FindingType } from '@/lib/iris-map'

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
  // Знак, който проверката по снимката не намери, не се показва на клиента:
  // ако нещо е посочено, то трябва да се вижда.
  if (f.photoCheck === 'not_seen') return false
  return f.confidence >= 0.6
}

type DisplayFinding = CalibratedAnalysisPayload['findings'][number]

/** Две отметки на снимката по-близо от това са едно място (минути / пръстени). */
const SAME_PLACE_MINUTES = 2.5
const SAME_PLACE_RINGS = 1.25

function minuteGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 60
  return Math.min(d, 60 - d)
}

/**
 * Едно и също място на снимката. Моделът често описва един знак с два-три
 * типа (дефект + изтъняване + бразда) или го отчита в два съседни пръстена,
 * а проверката по снимката ги закотвя в една и съща най-тъмна клетка. Без
 * сливане на снимката излизат няколко номера върху една точка.
 */
function samePlace(a: DisplayFinding, b: DisplayFinding): boolean {
  if (a.side !== b.side || isRingFinding(a) || isRingFinding(b)) return false
  if (a.anchor && b.anchor) {
    return (
      minuteGap(a.anchor.minute, b.anchor.minute) <= SAME_PLACE_MINUTES &&
      Math.abs(a.anchor.ring - b.anchor.ring) <= SAME_PLACE_RINGS
    )
  }
  // Единият е измерен, другият е само зона: зоната покрива измереното място.
  const pinned = a.anchor ? a : b.anchor ? b : null
  if (pinned) {
    const zone = pinned === a ? b : a
    const anchor = pinned.anchor!
    const zoneFrom = (zone.sector - 1) * 5
    const inSector = minuteGap(anchor.minute, zoneFrom + 2.5) <= 2.5 + 0.5
    return inSector && Math.abs(zone.ring + 0.5 - anchor.ring) <= SAME_PLACE_RINGS + 0.5
  }
  // Без измерено място: същият знак в същия сектор и съседен пръстен.
  return a.type === b.type && a.sector === b.sector && Math.abs(a.ring - b.ring) <= 1
}

/** Кой от слетите знаци води: потвърденият, после по-сигурният и по-тежкият. */
function displayRank(f: DisplayFinding): number {
  const weight = FINDINGS[f.type as FindingType]?.weight ?? 0.5
  return f.confidence * ((f.confirmations ?? 1) >= 2 ? 1.6 : 1) * (f.bilateral ? 1.25 : 1) * weight
}

/** Слива знаците на едно място в един — водещият носи останалите в `alsoLabels`. */
export function mergeSamePlace(findings: DisplayFinding[]): DisplayFinding[] {
  const ordered = findings.slice().sort((a, b) => displayRank(b) - displayRank(a))
  const out: DisplayFinding[] = []
  for (const f of ordered) {
    const i = out.findIndex(o => samePlace(o, f))
    if (i < 0) {
      out.push({ ...f })
      continue
    }
    const lead = out[i]
    const also = new Set(lead.alsoLabels ?? [])
    if (f.type !== lead.type) also.add(f.label)
    for (const l of f.alsoLabels ?? []) if (l !== lead.label) also.add(l)
    out[i] = {
      ...lead,
      confidence: Math.max(lead.confidence, f.confidence),
      confirmations: Math.max(lead.confirmations ?? 1, f.confirmations ?? 1),
      bilateral: lead.bilateral || f.bilateral,
      // Измереното място остава, дори ако водещият знак е само зона.
      ...(lead.anchor || !f.anchor ? {} : { anchor: f.anchor, photoCheck: f.photoCheck }),
      ...(also.size ? { alsoLabels: [...also] } : {}),
    }
  }
  return out
}

/**
 * Групира находки за показване: първо знаците на едно и също място стават един
 * (`mergeSamePlace`), после — по сектор + пръстенен пояс + тип.
 * Околообхватните знаци (nerve_rings, sodium_ring, пигмент по цялата обиколка …)
 * се сливат по око+тип+пояс. R1 и R2 в STOM стават един маркер — така е в
 * manual.json / RING_BANDS.
 */
export function groupFindingsForDisplay(
  findings: CalibratedAnalysisPayload['findings']
): CalibratedAnalysisPayload['findings'] {
  const map = new Map<string, CalibratedAnalysisPayload['findings'][number]>()

  for (const f of mergeSamePlace(findings)) {
    const band = ringBand(f.ring)
    const circum = isRingFinding(f)
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
  if (isRingFinding(f)) {
    parts.unshift('околообхватен пръстен')
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

  const topSystem = data.systems.find(s => data.focus[0] === s.key)

  let verdict: CalibratedVerdict = 'stable'
  if (planRelevant >= 6 || (topSystem && topSystem.score < 55)) verdict = 'focus'
  else if (planRelevant >= 2) verdict = 'mild'

  const headline =
    verdict === 'stable'
      ? 'Общата картина е стабилна'
      : verdict === 'mild'
        ? 'Има няколко неща, на които да обърнете внимание'
        : 'Ясно е откъде да започнете'

  const explanation =
    totalDetected === 0
      ? 'Не са открити ясни ирисови признаци. Планът се базира на вашите отговори и цели.'
      : `Прегледани са ${totalDetected} зони в ириса. ${planRelevant} от тях са достатъчно ясни, за да повлияят на препоръките. Това не е диагноза — показва къде планът да обърне повече внимание.`

  const lead =
    opts?.briefSummary?.trim() ||
    (topSystem
      ? `Основен фокус: ${topSystem.label.toLowerCase()} (${topSystem.score}/100). ${planRelevant > 0 ? `${planRelevant} зони с ясен сигнал насочват препоръките.` : 'Планът се базира главно на вашите отговори и цели.'}`
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
    const sector = sectorsFor(f.side)[f.sector - 1]
    out.push({
      title: f.label,
      body: `${f.side === 'left' ? 'Ляв' : 'Десен'} ирис · ${findingLocationLabel(f, sector?.label)}`,
    })
  }

  return out.slice(0, limit)
}

/** От 80 нагоре областта е „без съществени сигнали“ (същата граница като в описанието от `computeScores`). */
export const FOCUS_MAX_SCORE = 80

export function topPrioritySystems(data: CalibratedAnalysisPayload) {
  const ordered = data.focus
    .map(key => data.systems.find(s => s.key === key))
    .filter(Boolean) as CalibratedAnalysisPayload['systems']
  // Редът на фокуса винаги дава три системи, дори третата да е 85/100 и „без
  // сигнали“. Приоритет без проблем обърква — показват се само тези със сигнал.
  return ordered.filter(s => s.score < FOCUS_MAX_SCORE).slice(0, 3)
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
