/// <reference types="vitest" />
import { describe, expect, it } from 'vitest'
import { createRangeNormalizer } from '../iris-pipeline-orchestrator'
import type { GeoReference } from '@/types/iris-pipeline'

const geo: GeoReference = {
  mins: 60,
  rings: 12,
  degPerMin: 6,
  refMinute: 15,
  ringGroups: { IPB: [0, 0], STOM: [1, 1], ANW: [2, 3], ORG: [4, 9], LYM: [10, 10], SCU: [11, 11] },
}

describe('createRangeNormalizer', () => {
  const normalizer = createRangeNormalizer(geo)

  it('wraps minute ranges that cross zero', () => {
    expect(normalizer.normalizeMinuteRange([58, 2])).toEqual([
      [58, 59],
      [0, 2],
    ])
    expect(normalizer.normalizeMinuteRange([-2, 4])).toEqual([
      [58, 59],
      [0, 4],
    ])
  })

  it('clamps and orders ring ranges', () => {
    expect(normalizer.normalizeRingRange([10, 2])).toEqual([2, 10])
    expect(normalizer.normalizeRingRange([20, -1])).toEqual([0, 11])
  })

  it('normalizes findings with wrapped minutes and rings', () => {
    const finding = { id: 'f1', minuteRange: [59, 1] as [number, number], ringRange: [11, 0] as [number, number] }
    const normalized = normalizer.normalizeFinding(finding)

    expect(normalized).toHaveLength(2)
    expect(normalized[0]).toMatchObject({ minuteRange: [59, 59], ringRange: [0, 11] })
    expect(normalized[1]).toMatchObject({ minuteRange: [0, 1], ringRange: [0, 11] })
  })
})
