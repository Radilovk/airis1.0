/**
 * Проекция sector/ring → пиксели на снимката.
 * Използва същата ъглова конвенция като iris-unwrap.ts.
 */
import type { IrisGeometrySnapshot } from '@/types'
import { fitImageInSquare } from './image-utils'
import { ringBand } from './iris-map'

/** Център на клетка (sector 1..12, ring 0..11) в пиксели на оригиналната снимка. */
export function cellCenterInImage(
  sector: number,
  ring: number,
  geometry: IrisGeometrySnapshot
): { x: number; y: number } {
  const cx = geometry.limbus.cx
  const cy = geometry.limbus.cy
  const rp = geometry.pupil.r
  const ri = geometry.limbus.r
  const minute = (sector - 1) * 5 + 2.5
  const theta = (minute / 60) * 2 * Math.PI
  const r = rp + (ri - rp) * ((ring + 0.5) / 12)
  return { x: cx + r * Math.sin(theta), y: cy - r * Math.cos(theta) }
}

/** Радиус на пръстен (център на клетката) в пиксели. */
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

/** Точка на окружност в viewBox координати (object-contain в квадрат). */
export function polarToView(
  cx: number,
  cy: number,
  radius: number,
  thetaRad: number,
  geometry: IrisGeometrySnapshot,
  viewSize: number
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = fitImageInSquare(
    geometry.imageWidth,
    geometry.imageHeight,
    viewSize
  )
  const ix = cx + radius * Math.sin(thetaRad)
  const iy = cy - radius * Math.cos(thetaRad)
  return { x: ix * scale + offsetX, y: iy * scale + offsetY }
}

/** SVG path за секторен сегмент в целия пръstenен пояс (IPB, STOM, ANW …). */
export function sectorBandWedgePath(
  sector: number,
  ring: number,
  geometry: IrisGeometrySnapshot,
  viewSize: number
): string {
  const cx = geometry.limbus.cx
  const cy = geometry.limbus.cy
  const rp = geometry.pupil.r
  const ri = geometry.limbus.r
  const span = ri - rp
  const band = ringBand(ring)
  const inner = rp + span * (band.rings[0] / 12)
  const outer = rp + span * ((band.rings[1] + 1) / 12)
  const { start, end } = sectorAngles(sector)
  const { scale } = fitImageInSquare(geometry.imageWidth, geometry.imageHeight, viewSize)
  const riScaled = outer * scale
  const roScaled = inner * scale

  const p1 = polarToView(cx, cy, inner, start, geometry, viewSize)
  const p2 = polarToView(cx, cy, outer, start, geometry, viewSize)
  const p3 = polarToView(cx, cy, outer, end, geometry, viewSize)
  const p4 = polarToView(cx, cy, inner, end, geometry, viewSize)

  const largeArc = end - start > Math.PI ? 1 : 0
  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${riScaled} ${riScaled} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
    `L ${p4.x} ${p4.y}`,
    `A ${roScaled} ${roScaled} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
    'Z',
  ].join(' ')
}

/** SVG path за секторен сегмент между два пръстена. */
export function sectorRingWedgePath(
  sector: number,
  ring: number,
  geometry: IrisGeometrySnapshot,
  viewSize: number
): string {
  const cx = geometry.limbus.cx
  const cy = geometry.limbus.cy
  const { scale } = fitImageInSquare(geometry.imageWidth, geometry.imageHeight, viewSize)
  const { start, end } = sectorAngles(sector)
  const { inner, outer } = ringBandRadii(ring, geometry)
  const ri = outer * scale
  const ro = inner * scale

  const p1 = polarToView(cx, cy, inner, start, geometry, viewSize)
  const p2 = polarToView(cx, cy, outer, start, geometry, viewSize)
  const p3 = polarToView(cx, cy, outer, end, geometry, viewSize)
  const p4 = polarToView(cx, cy, inner, end, geometry, viewSize)

  const largeArc = end - start > Math.PI ? 1 : 0
  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${ri} ${ri} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
    `L ${p4.x} ${p4.y}`,
    `A ${ro} ${ro} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
    'Z',
  ].join(' ')
}

/** Център на клетка в viewBox координати. */
export function cellCenterInView(
  sector: number,
  ring: number,
  geometry: IrisGeometrySnapshot,
  viewSize: number
): { x: number; y: number } {
  const pt = cellCenterInImage(sector, ring, geometry)
  const { scale, offsetX, offsetY } = fitImageInSquare(
    geometry.imageWidth,
    geometry.imageHeight,
    viewSize
  )
  return { x: pt.x * scale + offsetX, y: pt.y * scale + offsetY }
}
