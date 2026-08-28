/**
 * finding-reliability.ts — метрики за достоверност на ирисови находки.
 *
 * Методология (синтез от литература + ограничения на проекта):
 *
 * 1. TEST–RETEST / повторяемост (PMC7821380, BMC Med Educ 2025)
 *    Един и същ обект, два независими прочита → proportion agreement + ICC-подобна
 *    location agreement. При нас: двойно разгъване с шев 12:00 и 6:00.
 *
 * 2. LOCATION-FIRST matching (МЕТОДИКА_2 §10)
 *    Типът на находката от LLM е нестабилен; координатата (сектор + пръstenен пояс) —
 *    стабилна. Съвпадението се мери по място, не по етикет.
 *
 * 3. OBJECT-DETECTION metrics (YOLOv8 tension rings, 2024)
 *    При етикетиран корпус: precision / recall / mAP по IoU на зоната.
 *    Тук: synthetic ground truth + ring-band „IoU" (сектор ±1, същи band).
 *
 * 4. DISCRIMINATION / guard rails
 *    Отхвърляне на находки извън validRings, partial/unreadable клетки,
 *    невалиден JSON — отделя реални сигнали от халюцинации.
 *
 * 5. КЛИНИЧЕСКА ГРАНИЦА (Australian NHMRC 2024)
 *    Ръчната иридология като диагностика ≈ шанс (~50%). Този модул валидира
 *    КОНСИСТЕНТНОСТТА на pipeline-а, не клинична чувствителност/специфичност.
 */

import { ringBand, type FindingType, type RingBandKey } from './iris-map'
import { mergeSeamReadings, type NormalizedFinding } from './iris-scoring'

export interface GroundTruthFinding {
  sector: number
  ring: number
  type: FindingType
  label?: string
}

export interface LocationMatchOptions {
  /** Максимална секторна дистанция (по подразбиране 1, както mergeSeamReadings). */
  maxSectorDistance?: number
}

export function sectorDistance(a: number, b: number): number {
  const d = Math.abs(Math.round(a) - Math.round(b)) % 12
  return Math.min(d, 12 - d)
}

/** Дали детекцията попада в същата зона като ground truth (band + сектор ±1). */
export function locationMatch(
  detected: { sector: number; ring: number },
  truth: { sector: number; ring: number },
  opts?: LocationMatchOptions
): boolean {
  const maxD = opts?.maxSectorDistance ?? 1
  return (
    ringBand(detected.ring).key === ringBand(truth.ring).key &&
    sectorDistance(detected.sector, truth.sector) <= maxD
  )
}

export interface RecallResult {
  matched: number
  total: number
  /** 0..1 — колко от ground truth са намерени на правилното място. */
  recall: number
  misses: GroundTruthFinding[]
}

/** Location recall спрямо етикетирани координати (synthetic benchmark). */
export function evaluateLocationRecall(
  detected: Array<{ sector: number; ring: number }>,
  truth: GroundTruthFinding[],
  opts?: LocationMatchOptions
): RecallResult {
  const used = new Set<number>()
  let matched = 0
  const misses: GroundTruthFinding[] = []

  for (const t of truth) {
    let hit = false
    for (let i = 0; i < detected.length; i++) {
      if (used.has(i)) continue
      if (locationMatch(detected[i], t, opts)) {
        used.add(i)
        matched++
        hit = true
        break
      }
    }
    if (!hit) misses.push(t)
  }

  return {
    matched,
    total: truth.length,
    recall: truth.length ? matched / truth.length : 1,
    misses,
  }
}

export interface PrecisionResult {
  truePositives: number
  falsePositives: number
  /** 0..1 */
  precision: number
  falsePositiveFindings: Array<{ sector: number; ring: number; type?: string }>
}

/** Precision спрямо ground truth — FP = детекции без съответстваща истина. */
export function evaluateLocationPrecision(
  detected: Array<{ sector: number; ring: number; type?: string }>,
  truth: GroundTruthFinding[],
  opts?: LocationMatchOptions
): PrecisionResult {
  const usedTruth = new Set<number>()
  let truePositives = 0
  const falsePositiveFindings: PrecisionResult['falsePositiveFindings'] = []

  for (const d of detected) {
    let hit = false
    for (let i = 0; i < truth.length; i++) {
      if (usedTruth.has(i)) continue
      if (locationMatch(d, truth[i], opts)) {
        usedTruth.add(i)
        truePositives++
        hit = true
        break
      }
    }
    if (!hit) falsePositiveFindings.push(d)
  }

  const falsePositives = falsePositiveFindings.length
  const denom = truePositives + falsePositives
  return {
    truePositives,
    falsePositives,
    precision: denom ? truePositives / denom : 1,
    falsePositiveFindings,
  }
}

export interface RejectionResult {
  submitted: number
  accepted: number
  rejected: number
  /** 0..1 — дял от невалидни входове, правилно отхвърлени. */
  rejectionRate: number
}

/** Колко от подадените raw находки са отхвърлени от normalizeFindings. */
export function evaluateRejectionGuard(
  submitted: number,
  accepted: number
): RejectionResult {
  const rejected = Math.max(0, submitted - accepted)
  return {
    submitted,
    accepted,
    rejected,
    rejectionRate: submitted ? rejected / submitted : 1,
  }
}

export interface SeamTestRetestResult {
  merge: ReturnType<typeof mergeSeamReadings>
  /** Доля потвърдени двойки с един и същ тип. */
  typeStability: number
  /** Доля потвърдени двойки (location agreement). */
  locationAgreement: number
  confirmedPairs: number
  typeMatches: number
}

function sectorDistanceForMerge(a: number, b: number): number {
  return sectorDistance(a, b)
}

/** Test–retest между два прочита (физически координати). */
export function evaluateSeamTestRetest(
  readA: NormalizedFinding[],
  readB: NormalizedFinding[]
): SeamTestRetestResult {
  const merge = mergeSeamReadings(readA, readB)
  let confirmedPairs = 0
  let typeMatches = 0

  const usedB = new Set<number>()
  for (const fa of readA) {
    let matchIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < readB.length; i++) {
      if (usedB.has(i)) continue
      const fb = readB[i]
      if (ringBand(fb.ring).key !== ringBand(fa.ring).key) continue
      const d = sectorDistanceForMerge(fa.sector, fb.sector)
      if (d > 1) continue
      if (d < bestDist) {
        bestDist = d
        matchIdx = i
      }
    }
    if (matchIdx < 0) continue
    usedB.add(matchIdx)
    confirmedPairs++
    if (readB[matchIdx].type === fa.type) typeMatches++
  }

  return {
    merge,
    typeStability: confirmedPairs ? typeMatches / confirmedPairs : 1,
    locationAgreement: merge.agreement,
    confirmedPairs,
    typeMatches,
  }
}

export interface ReliabilityThresholds {
  minLocationRecall: number
  minLocationPrecision: number
  minRejectionRate: number
  minSeamLocationAgreement: number
  minTypeStability: number
}

export const DEFAULT_RELIABILITY_THRESHOLDS: ReliabilityThresholds = {
  minLocationRecall: 0.9,
  minLocationPrecision: 0.85,
  minRejectionRate: 0.95,
  minSeamLocationAgreement: 0.7,
  minTypeStability: 0.25,
}

export interface ReliabilitySuiteResult {
  recall: RecallResult
  precision: PrecisionResult
  rejection: RejectionResult
  seam?: SeamTestRetestResult
  pass: boolean
  failures: string[]
}

export function evaluateReliabilitySuite(
  opts: {
    detected: Array<{ sector: number; ring: number; type?: string }>
    truth: GroundTruthFinding[]
    rawSubmitted?: number
    rawAccepted?: number
    seamReadA?: NormalizedFinding[]
    seamReadB?: NormalizedFinding[]
    thresholds?: Partial<ReliabilityThresholds>
  }
): ReliabilitySuiteResult {
  const t = { ...DEFAULT_RELIABILITY_THRESHOLDS, ...opts.thresholds }
  const recall = evaluateLocationRecall(opts.detected, opts.truth)
  const precision = evaluateLocationPrecision(opts.detected, opts.truth)
  const rejection = evaluateRejectionGuard(
    opts.rawSubmitted ?? opts.detected.length,
    opts.rawAccepted ?? opts.detected.length
  )
  const seam =
    opts.seamReadA && opts.seamReadB
      ? evaluateSeamTestRetest(opts.seamReadA, opts.seamReadB)
      : undefined

  const failures: string[] = []
  if (recall.recall < t.minLocationRecall) {
    failures.push(`location recall ${(recall.recall * 100).toFixed(0)}% < ${t.minLocationRecall * 100}%`)
  }
  if (precision.precision < t.minLocationPrecision) {
    failures.push(`location precision ${(precision.precision * 100).toFixed(0)}% < ${t.minLocationPrecision * 100}%`)
  }
  if (rejection.rejectionRate < t.minRejectionRate && rejection.rejected > 0 === false && (opts.rawSubmitted ?? 0) > (opts.rawAccepted ?? 0)) {
    // only check rejection when invalid inputs were submitted
  }
  if (opts.rawSubmitted !== undefined && opts.rawAccepted !== undefined) {
    const invalidCount = opts.rawSubmitted - opts.rawAccepted
    if (invalidCount > 0 && rejection.rejectionRate < t.minRejectionRate) {
      failures.push(`rejection guard ${(rejection.rejectionRate * 100).toFixed(0)}% < ${t.minRejectionRate * 100}%`)
    }
  }
  if (seam) {
    if (seam.locationAgreement < t.minSeamLocationAgreement) {
      failures.push(
        `seam location agreement ${(seam.locationAgreement * 100).toFixed(0)}% < ${t.minSeamLocationAgreement * 100}%`
      )
    }
    // typeStability се докладва, но не проваля — типът е нарочно нестабилен (§8.5)
  }

  return {
    recall,
    precision,
    rejection,
    seam,
    pass: failures.length === 0,
    failures,
  }
}

/** Форматиран отчет за test runner / конзола. */
export function formatReliabilityReport(r: ReliabilitySuiteResult): string {
  const lines = [
    `LOCATION RECALL:    ${r.recall.matched}/${r.recall.total} (${(r.recall.recall * 100).toFixed(1)}%)`,
    `LOCATION PRECISION: ${r.precision.truePositives}/${r.precision.truePositives + r.precision.falsePositives} (${(r.precision.precision * 100).toFixed(1)}%)`,
    `REJECTION GUARD:    ${r.rejection.rejected}/${r.rejection.submitted} invalid rejected (${(r.rejection.rejectionRate * 100).toFixed(1)}%)`,
  ]
  if (r.seam) {
    lines.push(
      `SEAM AGREEMENT:    ${(r.seam.locationAgreement * 100).toFixed(1)}% location · ${(r.seam.typeStability * 100).toFixed(1)}% type stability`
    )
  }
  lines.push(r.pass ? 'RESULT: PASS' : `RESULT: FAIL — ${r.failures.join('; ')}`)
  return lines.join('\n')
}

/** Band key за групиране на находки в heatmap. */
export function bandKey(ring: number): RingBandKey {
  return ringBand(ring).key
}
