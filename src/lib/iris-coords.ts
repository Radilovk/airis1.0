/**
 * Проекция sector/ring → пиксели на снимката.
 * Използва същата ъглова конвенция като iris-unwrap.ts.
 */
import type { IrisGeometrySnapshot } from '@/types'
import { fitImageInSquare } from './image-utils'
import { ringBand, isCircumferentialFinding, type RingBandDef } from './iris-map'

/**
 * Точка в ириса по модела „гумен лист“ — същият, по който се разгъва лентата
 * (`iris-unwrap.ts`). Зеницата НЕ е в центъра на ириса (естествено е отместена
 * към носа с до ~10 % от радиуса), затова центърът се плъзга от центъра на
 * зеницата (t = 0) към центъра на лимбуса (t = 1), а радиусът — от ръба на
 * зеницата към ръба на лимбуса (елиптичен, ако е измерен такъв).
 *
 * `minute` — 0..60 по часовника (0 = 12:00), `ringPos` — 0..12 (дробно).
 */
export function irisPoint(
  geometry: Pick<IrisGeometrySnapshot, 'pupil' | 'limbus'>,
  minute: number,
  ringPos: number
): { x: number; y: number } {
  const { pupil, limbus } = geometry
  const t = Math.max(0, Math.min(1, ringPos / 12))
  const theta = (minute / 60) * 2 * Math.PI
  const sin = Math.sin(theta)
  const cos = Math.cos(theta)
  const pcx = pupil.cx ?? limbus.cx
  const pcy = pupil.cy ?? limbus.cy
  const cx = pcx + (limbus.cx - pcx) * t
  const cy = pcy + (limbus.cy - pcy) * t
  const ry = limbus.ry
  const rOut = ry === undefined ? limbus.r : (limbus.r * ry) / Math.sqrt((ry * sin) ** 2 + (limbus.r * cos) ** 2 || 1)
  const r = pupil.r + (rOut - pupil.r) * t
  return { x: cx + r * sin, y: cy - r * cos }
}

function toView(pt: { x: number; y: number }, geometry: IrisGeometrySnapshot, viewSize: number) {
  const { scale, offsetX, offsetY } = fitImageInSquare(geometry.imageWidth, geometry.imageHeight, viewSize)
  return { x: pt.x * scale + offsetX, y: pt.y * scale + offsetY }
}

/** Затворен контур между два пръстена и два ъгъла (минути), като полилиния. */
function bandPolygon(
  geometry: IrisGeometrySnapshot,
  viewSize: number,
  m0: number,
  m1: number,
  ring0: number,
  ring1: number
): string {
  const steps = Math.max(6, Math.ceil((m1 - m0) * 2))
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= steps; i++) pts.push(toView(irisPoint(geometry, m0 + ((m1 - m0) * i) / steps, ring1), geometry, viewSize))
  for (let i = steps; i >= 0; i--) pts.push(toView(irisPoint(geometry, m0 + ((m1 - m0) * i) / steps, ring0), geometry, viewSize))
  return pts.map((q, i) => `${i ? 'L' : 'M'} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ') + ' Z'
}

/** Пълен пояс между два пръстена (360°) — два затворени контура (evenodd дупка). */
function fullAnnulus(geometry: IrisGeometrySnapshot, viewSize: number, ring0: number, ring1: number): string {
  const ring = (rp: number) => {
    const pts: string[] = []
    for (let i = 0; i <= 120; i++) {
      const q = toView(irisPoint(geometry, (i / 120) * 60, rp), geometry, viewSize)
      pts.push(`${i ? 'L' : 'M'} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`)
    }
    return pts.join(' ') + ' Z'
  }
  return `${ring(ring1)} ${ring(ring0)}`
}

/** Център на клетка (sector 1..12, ring 0..11) в пиксели на оригиналната снимка. */
export function cellCenterInImage(
  sector: number,
  ring: number,
  geometry: IrisGeometrySnapshot
): { x: number; y: number } {
  return irisPoint(geometry, (sector - 1) * 5 + 2.5, ring + 0.5)
}

/** Среден радиус на пръстен (център на клетката) в пиксели — за оразмеряване. */
export function ringRadius(ring: number, geometry: IrisGeometrySnapshot): number {
  const rp = geometry.pupil.r
  const ri = geometry.limbus.r
  return rp + (ri - rp) * ((ring + 0.5) / 12)
}

/** Вътрешен/външен радиус на пръстен R0..R11. */
export function ringBandRadii(ring: number, geometry: IrisGeometrySnapshot): { inner: number; outer: number } {
  const rp = geometry.pupil.r
  const ri = geometry.limbus.r
  const span = ri - rp
  return {
    inner: rp + span * (ring / 12),
    outer: rp + span * ((ring + 1) / 12),
  }
}

/** Ъгли (радиани) за сектор 1..12: от 12:00 по часовниковата стрелка. */
export function sectorAngles(sector: number): { start: number; end: number } {
  const startMin = (sector - 1) * 5
  const endMin = sector * 5
  return {
    start: (startMin / 60) * 2 * Math.PI,
    end: (endMin / 60) * 2 * Math.PI,
  }
}

/** Точка на окръжност в viewBox координати (object-contain в квадрат). */
export function polarToView(
  cx: number,
  cy: number,
  radius: number,
  thetaRad: number,
  geometry: IrisGeometrySnapshot,
  viewSize: number
): { x: number; y: number } {
  return toView({ x: cx + radius * Math.sin(thetaRad), y: cy - radius * Math.cos(thetaRad) }, geometry, viewSize)
}

/** SVG path за пълен пръстенен пояс (360°) — околообхватни находки. */
export function fullBandAnnulusPath(band: RingBandDef, geometry: IrisGeometrySnapshot, viewSize: number): string {
  return fullAnnulus(geometry, viewSize, band.rings[0], band.rings[1] + 1)
}

/** SVG path за един пръстен R0..R11 по цялата окръжност. */
export function fullRingAnnulusPath(ring: number, geometry: IrisGeometrySnapshot, viewSize: number): string {
  return fullAnnulus(geometry, viewSize, ring, ring + 1)
}

/** Избира overlay path: околообхватна дъга или секторен клин по пояс. */
export function findingOverlayPath(
  finding: { type: string; sector: number; ring: number },
  geometry: IrisGeometrySnapshot,
  viewSize: number
): string {
  if (isCircumferentialFinding(finding.type)) {
    const band = ringBand(finding.ring)
    const spansFullBand =
      finding.type === 'sodium_ring' ||
      finding.type === 'scurf_rim' ||
      finding.type === 'lymphatic_rosary'
    if (spansFullBand) return fullBandAnnulusPath(band, geometry, viewSize)
    return fullRingAnnulusPath(finding.ring, geometry, viewSize)
  }
  return sectorBandWedgePath(finding.sector, finding.ring, geometry, viewSize)
}

/** Точка на 12:00 по пръстена — за маркер при околообхватни находки. */
export function ringTopCenterInView(ring: number, geometry: IrisGeometrySnapshot, viewSize: number): { x: number; y: number } {
  return toView(irisPoint(geometry, 0, ring + 0.5), geometry, viewSize)
}

/** SVG path за секторен сегмент в целия пръстенен пояс (IPB, STOM, ANW …). */
export function sectorBandWedgePath(sector: number, ring: number, geometry: IrisGeometrySnapshot, viewSize: number): string {
  const band = ringBand(ring)
  return bandPolygon(geometry, viewSize, (sector - 1) * 5, sector * 5, band.rings[0], band.rings[1] + 1)
}

/** SVG path за секторен сегмент между два пръстена. */
export function sectorRingWedgePath(sector: number, ring: number, geometry: IrisGeometrySnapshot, viewSize: number): string {
  return bandPolygon(geometry, viewSize, (sector - 1) * 5, sector * 5, ring, ring + 1)
}

/** Център на клетка в viewBox координати. */
export function cellCenterInView(sector: number, ring: number, geometry: IrisGeometrySnapshot, viewSize: number): { x: number; y: number } {
  return toView(cellCenterInImage(sector, ring, geometry), geometry, viewSize)
}
