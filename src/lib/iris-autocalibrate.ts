/**
 * iris-autocalibrate.ts — разпознаване на зеницата и ириса без ръчна стъпка.
 *
 * Досега всяка снимка минаваше през два ръчни екрана: изрязване на окото и
 * калибратор с кръгове (център → външен ръб → зеница), дори когато окото
 * беше намерено правилно. Сега кодът прави същото, което калибраторът прави
 * при отваряне — намира геометрията, разгъва ириса, оценява качеството — и
 * ако е сигурен, приема резултата сам. Калибраторът се отваря само когато
 * разпознаването е несигурно или снимката има блокиращ проблем.
 *
 * Прагът за сигурност (0.5) е измерен върху 30 синтетични очи с известна
 * истина (кафяви, тъмнокафяви, зелени, сини, сиви; с клепач, размазани, овални):
 * всички 28 вярно разпознати са над него, двата неуспешни — под него.
 */

import type { IrisGeometrySnapshot, IrisQualitySnapshot } from '@/types'
import { analyseIrisQuality, blockingIssues } from './iris-quality'
import { concentricGeometry } from './iris-geometry'
import { unwrapIris } from './iris-unwrap'

export const AUTO_ACCEPT_CONFIDENCE = 0.5

export interface AutoCalibration {
  geometry: IrisGeometrySnapshot
  quality: IrisQualitySnapshot
  /** Може ли да се приеме без човек. */
  confident: boolean
  /** Защо не — за съобщението към човека. */
  reason?: string
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function autoCalibrate(dataUrl: string, side: 'left' | 'right'): Promise<AutoCalibration | null> {
  const img = await loadImage(dataUrl)
  if (!img) return null
  const first = analyseIrisQuality(img)
  const geo = concentricGeometry(first.geometry)
  let coverage: number | undefined
  try {
    coverage = unwrapIris(img, geo, side, { plotWidth: 840, plotHeight: 420, quality: 0.8 }).coverage
  } catch {
    coverage = undefined
  }
  const report = analyseIrisQuality(img, { stripCoverage: coverage, geometry: geo })
  const certainty = Math.min(geo.pupilConfidence, geo.limbusConfidence)
  const blocking = blockingIssues(report)
  const confident = certainty >= AUTO_ACCEPT_CONFIDENCE && blocking.length === 0 && report.verdict !== 'reject'
  return {
    geometry: {
      pupil: { ...geo.pupil },
      limbus: { ...geo.limbus },
      imageWidth: geo.imageWidth,
      imageHeight: geo.imageHeight,
      pupilConfidence: geo.pupilConfidence,
      limbusConfidence: geo.limbusConfidence,
      manual: false,
    },
    quality: { verdict: report.verdict, score: report.score, issueCodes: report.issues.map(i => i.code) },
    confident,
    reason: confident
      ? undefined
      : blocking[0]?.message ?? 'Не сме напълно сигурни къде са краищата на ириса — проверете кръговете.',
  }
}
