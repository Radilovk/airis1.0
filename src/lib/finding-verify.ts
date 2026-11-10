/**
 * finding-verify.ts — проверка на находките по пикселите на снимката.
 *
 * Защо: моделът чете разгънатата лента и връща „знак в сектор S, пръстен R“.
 * Понякога вижда нещо, което го няма (халюцинация), или го слага в съседна
 * клетка. Двата независими прочита хващат част от това, но не всичко. Тук
 * кодът сам поглежда снимката: има ли на посоченото място участък, който
 * ИЗМЕРИМО се различава от околната тъкан на същото разстояние от зеницата
 * — по-тъмен (лакуна, бразда), по-светъл (влакно) или с друг цвят (пигмент).
 *
 * Как:
 *  1. Ирисът се разделя на малки клетки: 96 по обиколката (8 на сектор) × 24
 *     подпръстена (всеки от 12-те пръстена на две). За всяка се смята средният цвят в Lab; отблясъци и сенки се
 *     изключват.
 *  2. За всеки пръстен се взема медианата и разсейването (MAD) по обиколката —
 *     това е „нормалната“ тъкан за това разстояние от зеницата.
 *  3. За всяка находка се търси най-отклонената клетка в посочения сектор
 *     (± две клетки встрани) и пръстена ± 1. Отклонението е в единици
 *     разсейване (робастен z): по-тъмно, по-светло или по-различен цвят —
 *     според типа на знака.
 *  4. Над прага → 'seen' и центърът на тази клетка става `anchor` — там сочи
 *     стрелката на снимката. Под прага → 'not_seen': знакът не се показва на
 *     снимката, а тежестта му в оценките пада.
 *
 * Околообхватните знаци (пръстени, дифузен пигмент) и сплескването на зеницата
 * не се проверяват така — те нямат една точка. Остават 'unchecked'.
 */

import { isCircumferentialFinding, type FindingType } from './iris-map'
import { rgbToLab } from './eye-health'
import { irisPoint } from './iris-coords'
import {
  artifactAt,
  buildArtifactMap,
  ARTIFACT_GLARE,
  ARTIFACT_LASH,
  ARTIFACT_NONE,
  type ArtifactGeometry,
  type ArtifactMap,
} from './photo-artifacts'

export type PhotoCheck = 'seen' | 'not_seen' | 'unchecked'

export interface VerifiableFinding {
  type: string
  sector: number
  ring: number
}

export interface VerifyGeometry {
  pupil: { r: number; cx?: number; cy?: number }
  limbus: { cx: number; cy: number; r: number; ry?: number }
  imageWidth?: number
  imageHeight?: number
}

export interface PixelSource {
  data: Uint8ClampedArray | number[]
  width: number
  height: number
}

export interface FindingVerdict {
  check: PhotoCheck
  /** Най-голямото отклонение, в единици разсейване. */
  score: number
  anchor?: { minute: number; ring: number }
  /** Мястото е заето от артефакт от снимката, не от тъкан. */
  artifact?: 'glare' | 'lash'
}

/** Клетки по обиколката — 8 на сектор. */
const PATCHES = 96
const PER_SECTOR = PATCHES / 12
/** Подпръстени: всеки от 12-те пръстена се дели на две. */
const SUB = 2
const RINGS = 12
const ROWS = RINGS * SUB
/**
 * Праг на отклонението (робастен z). Измерено върху синтетичен ирис с влакна,
 * естествени крипти и шум (`scripts/verify-findings-check.mts`): при праг 3
 * истинско петно се намира в 15–19 от 24 случая, празно място минава в ~14 %
 * (част от тях са естествени крипти — реално видими структури). По-нисък праг
 * пропуска повече халюцинации, по-висок губи истински знаци.
 */
export const SEEN_THRESHOLD = 3

/** Типове, които нямат една точка на снимката. */
// Коларетата и зеничният ръб са промени във ФОРМАТА, не в цвета — контрастът
// на едно място не ги доказва (измерено върху демо окото: нарисувана неравна
// коларета дава 2.8, под прага). За тях остават двата независими прочита.
const UNCHECKABLE = new Set<string>(['pigment_diffuse', 'pupil_flattening', 'collarette_deform'])

type Direction = 'dark' | 'light' | 'any' | 'color' | 'color_or_dark'

const DIRECTION: Partial<Record<FindingType, Direction>> = {
  fiber_defect: 'dark',
  radial_furrow: 'dark',
  fiber_thinning: 'any',
  transversal_fiber: 'any',
  pigment_orange: 'color',
  pigment_yellow: 'color',
  pigment_brown: 'color_or_dark',
}

interface PatchStat {
  L: number
  a: number
  b: number
  ok: boolean
}

interface RingStat {
  medL: number
  scaleL: number
  medA: number
  medB: number
  medD: number
  scaleD: number
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = xs.slice().sort((p, q) => p - q)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function mad(xs: number[], med: number): number {
  return median(xs.map(x => Math.abs(x - med)))
}

/** Средният Lab цвят на всяка клетка (пръстен × клетка по обиколката). */
export function patchGrid(px: PixelSource, geo: VerifyGeometry, scale = 1, artifacts?: ArtifactMap): PatchStat[][] {
  // Същият модел „гумен лист“ като разгъвката и картата (`irisPoint`): зеницата
  // пази собствения си център, иначе клетките на проверката и стрелките на
  // снимката биха сочели различни места.
  const g = {
    pupil: {
      cx: (geo.pupil.cx ?? geo.limbus.cx) * scale,
      cy: (geo.pupil.cy ?? geo.limbus.cy) * scale,
      r: geo.pupil.r * scale,
    },
    limbus: {
      cx: geo.limbus.cx * scale,
      cy: geo.limbus.cy * scale,
      r: geo.limbus.r * scale,
      ...(geo.limbus.ry !== undefined ? { ry: geo.limbus.ry * scale } : {}),
    },
  }
  const rp = g.pupil.r
  const span = g.limbus.r - rp
  const grid: PatchStat[][] = []
  for (let ring = 0; ring < ROWS; ring++) {
    const row: PatchStat[] = []
    const r0 = rp + span * (ring / ROWS)
    const r1 = rp + span * ((ring + 1) / ROWS)
    const rMid = (r0 + r1) / 2
    // Гъстота: около една проба на пиксел по дъгата, поне 4.
    const perPatchAng = Math.max(4, Math.round((2 * Math.PI * rMid) / PATCHES))
    const radial = Math.max(2, Math.round(r1 - r0))
    for (let p = 0; p < PATCHES; p++) {
      let L = 0
      let A = 0
      let B = 0
      let n = 0
      let total = 0
      for (let j = 0; j < perPatchAng; j++) {
        const minute = ((p + (j + 0.5) / perPatchAng) / PATCHES) * 60
        for (let k = 0; k < radial; k++) {
          const ringPos = ((ring + (k + 0.5) / radial) / ROWS) * RINGS
          const pt = irisPoint(g, minute, ringPos)
          const x = Math.round(pt.x)
          const y = Math.round(pt.y)
          total++
          if (x < 0 || y < 0 || x >= px.width || y >= px.height) continue
          const i = (y * px.width + x) * 4
          const R = px.data[i]
          const G = px.data[i + 1]
          const Bl = px.data[i + 2]
          const max = Math.max(R, G, Bl)
          const min = Math.min(R, G, Bl)
          // Отблясък (почти бяло) и дълбока сянка (клепач, мигли) не са тъкан.
          if (max > 245 && max - min < 30) continue
          // Отражение (с ореола) или мигла по картата на артефактите — не е тъкан.
          if (artifacts && artifactAt(artifacts, x, y) !== ARTIFACT_NONE) continue
          if (max < 14) continue
          const lab = rgbToLab(R, G, Bl)
          L += lab[0]
          A += lab[1]
          B += lab[2]
          n++
        }
      }
      row.push(n > 0 && n >= total * 0.5 ? { L: L / n, a: A / n, b: B / n, ok: true } : { L: 0, a: 0, b: 0, ok: false })
    }
    grid.push(row)
  }
  return grid
}

function ringStats(row: PatchStat[]): RingStat | null {
  const ok = row.filter(p => p.ok)
  if (ok.length < PATCHES * 0.4) return null
  const Ls = ok.map(p => p.L)
  const medL = median(Ls)
  const medA = median(ok.map(p => p.a))
  const medB = median(ok.map(p => p.b))
  const ds = ok.map(p => Math.hypot(p.a - medA, p.b - medB))
  const medD = median(ds)
  return {
    medL,
    // Долна граница на разсейването: при много равномерен ирис дори дребен шум
    // иначе изглежда „отклонение“.
    scaleL: Math.max(1.4826 * mad(Ls, medL), 2),
    medA,
    medB,
    medD,
    scaleD: Math.max(1.4826 * mad(ds, medD), 1.5),
  }
}

function patchScore(p: PatchStat, s: RingStat, dir: Direction): number {
  const zDark = (s.medL - p.L) / s.scaleL
  const zLight = (p.L - s.medL) / s.scaleL
  const zColor = (Math.hypot(p.a - s.medA, p.b - s.medB) - s.medD) / s.scaleD
  switch (dir) {
    case 'dark':
      return zDark
    case 'light':
      return zLight
    case 'any':
      return Math.max(zDark, zLight)
    case 'color':
      return zColor
    case 'color_or_dark':
      return Math.max(zColor, zDark)
  }
}

/** Проверява една находка спрямо готовата мрежа. */
export function verifyAgainstGrid(f: VerifiableFinding, grid: PatchStat[][]): FindingVerdict {
  const type = f.type as FindingType
  if (isCircumferentialFinding(type) || UNCHECKABLE.has(type)) return { check: 'unchecked', score: 0 }
  const dir = DIRECTION[type] ?? 'any'
  const stats = grid.map(ringStats)

  // Клетките на сектора + по две от съседните (секторите са 1..12 по часовника),
  // пръстенът ± 1 (в подпръстени).
  const first = (f.sector - 1) * PER_SECTOR - 2
  const rowLo = Math.max(0, (f.ring - 1) * SUB)
  const rowHi = Math.min(ROWS - 1, (f.ring + 2) * SUB - 1)
  let best = -Infinity
  let bestAt: { patch: number; ring: number } | null = null
  let checked = 0
  for (let ring = rowLo; ring <= rowHi; ring++) {
    const s = stats[ring]
    if (!s) continue
    const inRing = Math.floor(ring / SUB) === f.ring
    for (let k = 0; k < PER_SECTOR + 4; k++) {
      const patch = (((first + k) % PATCHES) + PATCHES) % PATCHES
      const p = grid[ring][patch]
      if (!p.ok) continue
      checked++
      // Клетките в посочения сектор и пръстен имат лек приоритет пред съседните.
      const inSector = k >= 2 && k < PER_SECTOR + 2
      const sc = patchScore(p, s, dir) - (inSector ? 0 : 0.3) - (inRing ? 0 : 0.2)
      if (sc > best) {
        best = sc
        bestAt = { patch, ring }
      }
    }
  }
  // Мястото е закрито (отблясък, клепач) — не може да се провери.
  if (checked < 4 || !bestAt) return { check: 'unchecked', score: 0 }
  const anchor = { minute: ((bestAt.patch + 0.5) / PATCHES) * 60, ring: (bestAt.ring + 0.5) / SUB }
  return best >= SEEN_THRESHOLD
    ? { check: 'seen', score: best, anchor }
    : { check: 'not_seen', score: best }
}

async function loadPixels(dataUrl: string, maxSide = 900): Promise<{ px: PixelSource; scale: number } | null> {
  if (typeof document === 'undefined' || !dataUrl) return null
  const img = await new Promise<HTMLImageElement | null>(resolve => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => resolve(null)
    el.src = dataUrl
  })
  if (!img) return null
  const W = img.naturalWidth
  const H = img.naturalHeight
  const scale = Math.min(1, maxSide / Math.max(W, H))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(W * scale))
  c.height = Math.max(1, Math.round(H * scale))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  return { px: { data, width: c.width, height: c.height }, scale }
}

/**
 * Проверява находките на едно око по снимката. Връща присъда за всяка, в
 * същия ред. Ако снимката не може да се зареди — всички са 'unchecked'.
 */
export async function verifyFindingsOnPhoto(
  dataUrl: string,
  geometry: VerifyGeometry,
  findings: VerifiableFinding[]
): Promise<FindingVerdict[]> {
  if (findings.length === 0) return []
  const loaded = await loadPixels(dataUrl)
  if (!loaded) return findings.map(() => ({ check: 'unchecked' as const, score: 0 }))
  // Геометрията е в пиксели на изображението, за което е измерена.
  const geoW = geometry.imageWidth || loaded.px.width / loaded.scale
  const scale = loaded.px.width / geoW
  const scaledGeo: ArtifactGeometry = {
    pupil: {
      r: geometry.pupil.r * scale,
      cx: (geometry.pupil.cx ?? geometry.limbus.cx) * scale,
      cy: (geometry.pupil.cy ?? geometry.limbus.cy) * scale,
    },
    limbus: {
      cx: geometry.limbus.cx * scale,
      cy: geometry.limbus.cy * scale,
      r: geometry.limbus.r * scale,
      ...(geometry.limbus.ry !== undefined ? { ry: geometry.limbus.ry * scale } : {}),
    },
  }
  const artifacts = buildArtifactMap(loaded.px.data, loaded.px.width, loaded.px.height, scaledGeo)
  const grid = patchGrid(loaded.px, geometry, scale, artifacts)
  return findings.map(f => {
    // Мястото на знака е заето от отражение или мигла → това не е тъкан и
    // знакът не се приема, каквото и да е отклонението около него.
    const art = artifactShareAt(f, scaledGeo, artifacts)
    if (art.share >= ARTIFACT_REJECT_SHARE) return { check: 'not_seen' as const, score: 0, artifact: art.kind }
    return verifyAgainstGrid(f, grid)
  })
}

/**
 * Над този дял на клетката под отражение/мигла знакът се смята за артефакт
 * от снимката. Под него клетката се проверява по останалите пиксели.
 */
export const ARTIFACT_REJECT_SHARE = 0.4

/** Какъв дял от клетката на находката е отражение или мигла и кое преобладава. */
export function artifactShareAt(
  f: VerifiableFinding,
  geo: ArtifactGeometry,
  map: ArtifactMap
): { share: number; kind?: 'glare' | 'lash' } {
  if (isCircumferentialFinding(f.type as FindingType)) return { share: 0 }
  const g = { pupil: { cx: geo.pupil.cx ?? geo.limbus.cx, cy: geo.pupil.cy ?? geo.limbus.cy, r: geo.pupil.r }, limbus: geo.limbus }
  let total = 0
  let glare = 0
  let lash = 0
  for (let i = 0; i < 10; i++) {
    for (let k = 0; k < 4; k++) {
      const pt = irisPoint(g, (f.sector - 1) * 5 + ((i + 0.5) / 10) * 5, f.ring + (k + 0.5) / 4)
      total++
      const a = artifactAt(map, pt.x, pt.y)
      if (a === ARTIFACT_GLARE) glare++
      else if (a === ARTIFACT_LASH) lash++
    }
  }
  const share = (glare + lash) / total
  return share > 0 ? { share, kind: glare >= lash ? 'glare' : 'lash' } : { share: 0 }
}

/** Колко от тежестта остава на знак, който не се вижда на снимката. */
export const NOT_SEEN_LOAD_FACTOR = 0.35
