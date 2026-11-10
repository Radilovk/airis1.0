/**
 * iris-refine.ts — прецизно намиране на лимбуса и зеницата.
 *
 * Грубият детектор (`iris-geometry.ts`) работи на ~320 px и с ограничен ъгъл
 * за лимбуса. Измерено върху синтетични очи с известна истина:
 *  - при клепач, закриващ горната част на ириса, центърът се изместваше с
 *    12 % (кафяв ирис) до 32 % (светъл ирис) от радиуса;
 *  - при тъмнокафяв ирис радиусът на зеницата грешеше с до 14 %;
 *  - увереността не съответстваше на грешката (0.88 при 12 % грешка, 0.06 при
 *    вярно откриване).
 *
 * Тук геометрията се търси на снимката в по-голяма резолюция (ирисът ≈ 240 px
 * радиус), по 180 лъча от центъра:
 *  1. По всеки лъч се взимат до 3 кандидата за ръб (силни преходи).
 *  2. Окръжност се напасва с RANSAC: случайни тройки точки от различни лъчи,
 *     оценка = сумата от силите на съгласните ръбове. Клепачът, миглите и
 *     отблясъкът дават ръбове, които не лежат на една окръжност с останалите —
 *     те отпадат като изключения, вместо да изкривяват резултата.
 *  3. Започва се от няколко центъра (грубия резултат, зеницата, центъра на
 *     кадъра) и се взима най-добрият.
 *  4. Зеницата се търси в червения канал: при тъмнокафяв ирис яркостта на
 *     ирис и зеница почти съвпада, но ирисът отразява червено, а зеницата — не.
 *  5. Увереността е делът лъчи, които са съгласни с окръжността, по силата им —
 *     тоест измерима, а не догадка.
 */

import type { IrisGeometry } from './iris-geometry'

interface Plane {
  w: number
  h: number
  /** Яркост 0..255 (за лимбуса). */
  lum: Float32Array
  /** Червен канал 0..255 (за зеницата). */
  red: Float32Array
  /** Син канал — с червения различава кожата (розова) от склерата (бяла). */
  blue: Float32Array
  /** Отблясък (почти бяло) — там производната не се смята. */
  glare: Uint8Array
  /** Колко пъти е смалено спрямо оригинала. */
  scale: number
}

interface EdgePoint {
  x: number
  y: number
  /** Индекс на лъча — тройката за RANSAC е от различни лъчи. */
  ray: number
  strength: number
}

export interface FitCircle {
  cx: number
  cy: number
  r: number
  /** Вертикален радиус, ако лимбусът е измерено овален. */
  ry?: number
  /** 0..1 — дял на лъчите със съгласен ръб, претеглен по сила. */
  support: number
}

const RAYS = 180
/** Желан радиус на ириса в работната резолюция. */
const TARGET_IRIS_R = 240

/* ── подготовка ──────────────────────────────────────────────────────────── */

function makePlane(img: HTMLImageElement | HTMLCanvasElement, approxIrisR: number): Plane {
  const W = 'naturalWidth' in img ? img.naturalWidth : img.width
  const H = 'naturalHeight' in img ? img.naturalHeight : img.height
  // Мащаб: ирисът да е около TARGET_IRIS_R px, но не над 1100 px страна.
  const scale = Math.min(1, TARGET_IRIS_R / Math.max(20, approxIrisR), 1100 / Math.max(W, H))
  const w = Math.max(1, Math.round(W * scale))
  const h = Math.max(1, Math.round(H * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  const lum = new Float32Array(w * h)
  const red = new Float32Array(w * h)
  const blue = new Float32Array(w * h)
  const glare = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    lum[p] = 0.299 * r + 0.587 * g + 0.114 * b
    red[p] = r
    blue[p] = b
    // Само наистина преексponирано е отблясък. Досега прагът беше 225 и
    // светлата склера се маркираше като отблясък — ръбът ирис→склера изчезваше.
    const mx = Math.max(r, g, b)
    if (mx >= 248 && mx - Math.min(r, g, b) < 30) glare[p] = 1
  }
  return {
    w,
    h,
    lum: boxBlur(lum, w, h, 2),
    red: boxBlur(red, w, h, 2),
    blue: boxBlur(blue, w, h, 2),
    glare,
    scale,
  }
}

function boxBlur(src: Float32Array, w: number, h: number, rad: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -rad; x <= rad; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * rad + 1)
      acc += src[y * w + Math.min(w - 1, x + rad + 1)] - src[y * w + Math.max(0, x - rad)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * rad + 1)
      acc += tmp[Math.min(h - 1, y + rad + 1) * w + x] - tmp[Math.max(0, y - rad) * w + x]
    }
  }
  return out
}

function sample(p: Plane, ch: Float32Array, x: number, y: number): number {
  // Билинейна интерполация — субпикселна точност по лъча.
  if (x < 0 || y < 0 || x >= p.w - 1 || y >= p.h - 1) return NaN
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i = y0 * p.w + x0
  if (p.glare[i] || p.glare[i + 1] || p.glare[i + p.w] || p.glare[i + p.w + 1]) return NaN
  return (
    ch[i] * (1 - fx) * (1 - fy) + ch[i + 1] * fx * (1 - fy) + ch[i + p.w] * (1 - fx) * fy + ch[i + p.w + 1] * fx * fy
  )
}

/* ── ръбове по лъчи ──────────────────────────────────────────────────────── */

/**
 * По всеки лъч от (cx, cy) в диапазона [r0, r1] — до `perRay` най-силни
 * преходи „тъмно навътре → светло навън“. Производната е по разлика на
 * средни стойности от двете страни (устойчива на шум и текстура).
 */
function rayEdges(
  p: Plane,
  ch: Float32Array,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  perRay: number
): EdgePoint[] {
  const out: EdgePoint[] = []
  const step = 1
  const n = Math.max(4, Math.floor((r1 - r0) / step))
  const halfWin = Math.max(2, Math.round((r1 - r0) * 0.025))
  const prof = new Float32Array(n)
  for (let k = 0; k < RAYS; k++) {
    const a = (k / RAYS) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    for (let i = 0; i < n; i++) {
      const r = r0 + i * step
      prof[i] = sample(p, ch, cx + ca * r, cy + sa * r)
    }
    const cands: Array<{ i: number; s: number }> = []
    for (let i = halfWin; i < n - halfWin; i++) {
      let inner = 0
      let outer = 0
      let ok = true
      for (let j = 1; j <= halfWin; j++) {
        const a1 = prof[i - j]
        const b1 = prof[i + j]
        if (Number.isNaN(a1) || Number.isNaN(b1)) {
          ok = false
          break
        }
        inner += a1
        outer += b1
      }
      if (!ok) continue
      const s = (outer - inner) / halfWin
      if (s > 4) cands.push({ i, s })
    }
    // Локални максимуми, най-силните първо.
    cands.sort((x, y) => y.s - x.s)
    const picked: Array<{ i: number; s: number }> = []
    for (const c of cands) {
      if (picked.length >= perRay) break
      if (picked.some(q => Math.abs(q.i - c.i) < halfWin * 2)) continue
      picked.push(c)
    }
    for (const c of picked) {
      const r = r0 + c.i * step
      out.push({ x: cx + ca * r, y: cy + sa * r, ray: k, strength: c.s })
    }
  }
  return out
}

/* ── RANSAC окръжност ────────────────────────────────────────────────────── */

function circleFrom3(a: EdgePoint, b: EdgePoint, c: EdgePoint): { cx: number; cy: number; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(d) < 1e-6) return null
  const a2 = a.x * a.x + a.y * a.y
  const b2 = b.x * b.x + b.y * b.y
  const c2 = c.x * c.x + c.y * c.y
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
  return { cx, cy, r: Math.hypot(a.x - cx, a.y - cy) }
}

/** Най-малки квадрати (алгебрично, Kåsa) върху съгласните точки. */
function leastSquaresCircle(pts: EdgePoint[]): { cx: number; cy: number; r: number } | null {
  if (pts.length < 3) return null
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0
  for (const q of pts) {
    const z = q.x * q.x + q.y * q.y
    sx += q.x; sy += q.y; sxx += q.x * q.x; syy += q.y * q.y; sxy += q.x * q.y
    sxz += q.x * z; syz += q.y * z; sz += z
  }
  const n = pts.length
  // Решава [sxx sxy sx; sxy syy sy; sx sy n]·[A B C] = [sxz syz sz]
  const M = [
    [sxx, sxy, sx, sxz],
    [sxy, syy, sy, syz],
    [sx, sy, n, sz],
  ]
  for (let i = 0; i < 3; i++) {
    let piv = i
    for (let j = i + 1; j < 3; j++) if (Math.abs(M[j][i]) > Math.abs(M[piv][i])) piv = j
    ;[M[i], M[piv]] = [M[piv], M[i]]
    if (Math.abs(M[i][i]) < 1e-9) return null
    for (let j = 0; j < 3; j++) {
      if (j === i) continue
      const f = M[j][i] / M[i][i]
      for (let k = i; k < 4; k++) M[j][k] -= f * M[i][k]
    }
  }
  const A = M[0][3] / M[0][0]
  const B = M[1][3] / M[1][1]
  const C = M[2][3] / M[2][2]
  const cx = A / 2
  const cy = B / 2
  const r2 = C + cx * cx + cy * cy
  if (!(r2 > 0)) return null
  return { cx, cy, r: Math.sqrt(r2) }
}

interface FitOptions {
  rMin: number
  rMax: number
  /** Допуск за съгласен ръб — дял от радиуса. */
  tol: number
  /** Максимално отместване на центъра от семето. */
  maxShift: number
  seedX: number
  seedY: number
  iterations: number
  /** Колко лъча изобщо участват (при странични лъчи — по-малко от всички). */
  eligibleRays?: number
}

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

function ransacCircle(pts: EdgePoint[], o: FitOptions): FitCircle | null {
  if (pts.length < 12) return null
  const rand = rng(pts.length * 7919 + Math.round(o.seedX * 31 + o.seedY))
  // Общата „маса“ на ръбовете — нормира подкрепата към 0..1.
  const strongestPerRay = new Float32Array(RAYS)
  for (const q of pts) strongestPerRay[q.ray] = Math.max(strongestPerRay[q.ray], q.strength)
  const scoreOf = (cx: number, cy: number, r: number) => {
    const tol = Math.max(1.5, r * o.tol)
    const best = new Float32Array(RAYS)
    for (const q of pts) {
      const d = Math.abs(Math.hypot(q.x - cx, q.y - cy) - r)
      if (d <= tol) best[q.ray] = Math.max(best[q.ray], q.strength * (1 - (d / tol) * 0.5))
    }
    let s = 0
    let rays = 0
    for (let k = 0; k < RAYS; k++) {
      s += best[k]
      if (best[k] > 0) rays++
    }
    return { s, rays }
  }

  let best: { cx: number; cy: number; r: number; s: number; rays: number } | null = null
  for (let it = 0; it < o.iterations; it++) {
    const a = pts[Math.floor(rand() * pts.length)]
    const b = pts[Math.floor(rand() * pts.length)]
    const c = pts[Math.floor(rand() * pts.length)]
    // Три точки от лъчи поне на 25° една от друга — иначе окръжността е нестабилна.
    const sep = (u: number, v: number) => {
      const d = Math.abs(u - v) % RAYS
      return Math.min(d, RAYS - d) >= RAYS / 14
    }
    if (!sep(a.ray, b.ray) || !sep(b.ray, c.ray) || !sep(a.ray, c.ray)) continue
    const cand = circleFrom3(a, b, c)
    if (!cand) continue
    if (cand.r < o.rMin || cand.r > o.rMax) continue
    if (Math.hypot(cand.cx - o.seedX, cand.cy - o.seedY) > o.maxShift) continue
    const sc = scoreOf(cand.cx, cand.cy, cand.r)
    if (!best || sc.s > best.s) best = { ...cand, ...sc }
  }
  if (!best) return null

  // Прецизиране: най-малки квадрати върху съгласните точки, два пъти.
  let cur = { cx: best.cx, cy: best.cy, r: best.r }
  for (let k = 0; k < 2; k++) {
    const tol = Math.max(1.5, cur.r * o.tol)
    const inl = pts.filter(q => Math.abs(Math.hypot(q.x - cur.cx, q.y - cur.cy) - cur.r) <= tol)
    const ls = leastSquaresCircle(inl)
    if (!ls || ls.r < o.rMin || ls.r > o.rMax) break
    cur = ls
  }
  const sc = scoreOf(cur.cx, cur.cy, cur.r)
  // Подкрепа: колко лъча са съгласни (максимум ~ половината при клепачи) по
  // каква част от силата си.
  let total = 0
  for (let k = 0; k < RAYS; k++) total += strongestPerRay[k]
  const strengthShare = total > 0 ? sc.s / total : 0
  const rayShare = Math.min(1, sc.rays / (o.eligibleRays ?? RAYS))
  return { ...cur, support: Math.min(1, 0.55 * rayShare + 0.45 * strengthShare) }
}

/* ── публично ────────────────────────────────────────────────────────────── */

export interface RefinedGeometry {
  pupil: FitCircle
  limbus: FitCircle
}

/** Средна стойност в пръстен [r0, r1] около (cx, cy), без отблясъци. */
function ringMean(p: Plane, ch: Float32Array, cx: number, cy: number, r0: number, r1: number): number {
  let sum = 0
  let n = 0
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2
    for (let t = 0; t < 4; t++) {
      const r = r0 + ((t + 0.5) / 4) * (r1 - r0)
      const v = sample(p, ch, cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      if (!Number.isNaN(v)) {
        sum += v
        n++
      }
    }
  }
  return n > 20 ? sum / n : NaN
}

/** Подкрепата на дадена окръжност — за сравнение на кандидати по една мярка. */
function supportOf(p: Plane, ch: Float32Array, c: { cx: number; cy: number; r: number }, tol: number): number {
  const edges = rayEdges(p, ch, c.cx, c.cy, c.r * 0.85, c.r * 1.15, 3)
  const fit = ransacCircle(edges, {
    rMin: c.r * 0.97,
    rMax: c.r * 1.03,
    tol,
    maxShift: c.r * 0.02,
    seedX: c.cx,
    seedY: c.cy,
    iterations: 250,
  })
  return fit?.support ?? 0
}

/**
 * Обща оценка на двойка зеница + лимбус. Нула, ако е физиологично невъзможна:
 * отношение извън 0.12–0.75, центрове твърде раздалечени, или „ирисът“ не е
 * по-тъмен от това, което е извън него (склерата е светла).
 */
function pairScore(p: Plane, pupil: FitCircle, limbus: FitCircle): number {
  const ratio = pupil.r / limbus.r
  if (!(ratio > 0.12 && ratio < 0.75)) return 0
  if (Math.hypot(pupil.cx - limbus.cx, pupil.cy - limbus.cy) > limbus.r * 0.2) return 0
  const iris = ringMean(p, p.lum, limbus.cx, limbus.cy, (pupil.r + limbus.r) / 2, limbus.r * 0.95)
  const outside = ringMean(p, p.lum, limbus.cx, limbus.cy, limbus.r * 1.08, limbus.r * 1.3)
  const inner = ringMean(p, p.red, pupil.cx, pupil.cy, 0, pupil.r * 0.8)
  const irisRed = ringMean(p, p.red, pupil.cx, pupil.cy, pupil.r * 1.25, Math.min(limbus.r * 0.9, pupil.r * 2.2))
  let sc = 0.6 * limbus.support + 0.4 * pupil.support
  // Склерата (или кожата при клепач) е по-светла от ириса; зеницата — по-тъмна.
  if (!Number.isNaN(iris) && !Number.isNaN(outside) && outside <= iris + 3) sc *= 0.4
  if (!Number.isNaN(inner) && !Number.isNaN(irisRed) && inner >= irisRed - 3) sc *= 0.4
  return sc
}

/** Най-тъмното петно (зеница) при силно размазване на червения канал. */
function darkestSeed(p: Plane): { x: number; y: number } {
  const rad = Math.max(3, Math.round(Math.min(p.w, p.h) * 0.03))
  const b = boxBlur(p.red, p.w, p.h, rad)
  const m = Math.round(Math.min(p.w, p.h) * 0.08)
  let best = Infinity
  let bx = p.w / 2
  let by = p.h / 2
  for (let y = m; y < p.h - m; y += 2) {
    for (let x = m; x < p.w - m; x += 2) {
      const v = b[y * p.w + x]
      if (v < best) {
        best = v
        bx = x
        by = y
      }
    }
  }
  return { x: bx, y: by }
}

function findPupilAround(p: Plane, cx: number, cy: number, rMin: number, rMax: number, maxShift: number): FitCircle | null {
  let best: FitCircle | null = null
  for (const ch of [p.red, p.lum]) {
    const edges = rayEdges(p, ch, cx, cy, rMin * 0.7, rMax, 2)
    const fit = ransacCircle(edges, { rMin, rMax, tol: 0.04, maxShift, seedX: cx, seedY: cy, iterations: 700 })
    if (fit && (!best || fit.support > best.support)) best = fit
  }
  if (!best) return null
  // Около зеницата често има по-тъмен (кафяв) пупиларен пръстен. По яркост
  // ръбът „пръстен → ирис“ е по-силен от „зеница → пръстен“ и окръжността
  // хващаше пръстена — зеницата излизаше с ~20 % по-голяма. Ако вътре има
  // по-малка концентрична окръжност, а между двете е по-светло от вътре,
  // истинската зеница е вътрешната.
  for (let guard = 0; guard < 2; guard++) {
    const cur: FitCircle = best
    let inner: FitCircle | null = null
    for (const ch of [p.red, p.lum]) {
      const edges = rayEdges(p, ch, cur.cx, cur.cy, cur.r * 0.4, cur.r * 0.95, 2)
      const f = ransacCircle(edges, {
        rMin: Math.max(rMin * 0.6, cur.r * 0.45),
        rMax: cur.r * 0.9,
        tol: 0.04,
        maxShift: cur.r * 0.15,
        seedX: cur.cx,
        seedY: cur.cy,
        iterations: 500,
      })
      if (f && (!inner || f.support > inner.support)) inner = f
    }
    if (!inner || inner.support < Math.max(0.4, cur.support * 0.5)) break
    const core = ringMean(p, p.lum, inner.cx, inner.cy, 0, inner.r * 0.8)
    const band = ringMean(p, p.lum, inner.cx, inner.cy, inner.r * 1.08, Math.max(inner.r * 1.1, cur.r * 0.92))
    if (Number.isNaN(core) || Number.isNaN(band) || band < core + 12) break
    best = inner
  }
  return best
}

/** Лъч близо до хоризонталата (±55°): там е склерата, клепачите не пречат. */
function isLateral(ray: number): boolean {
  return Math.abs(Math.cos((ray / RAYS) * Math.PI * 2)) >= 0.574
}
const LATERAL_RAYS = Array.from({ length: RAYS }, (_, k) => k).filter(isLateral).length

/** „Розовост“: червено − синьо. Кожата е розова, склерата — бяла или синкава. */
function skinness(p: Plane, x: number, y: number): number {
  const r = sample(p, p.red, x, y)
  const b = sample(p, p.blue, x, y)
  return Number.isNaN(r) || Number.isNaN(b) ? NaN : r - b
}

function median(xs: number[]): number {
  const v = xs.filter(x => !Number.isNaN(x)).sort((a, b) => a - b)
  return v.length ? v[v.length >> 1] : NaN
}

function fitLateral(p: Plane, cx: number, cy: number, rMin: number, rMax: number, maxShift: number, tol: number, iterations: number) {
  const edges = rayEdges(p, p.lum, cx, cy, rMin * 0.85, rMax * 1.05, 3).filter(q => isLateral(q.ray))
  return ransacCircle(edges, { rMin, rMax, tol, maxShift, seedX: cx, seedY: cy, iterations, eligibleRays: LATERAL_RAYS })
}

/**
 * Лимбусът. Ръбът „ирис → клепач“ изглежда като „ирис → склера“ (тъмно →
 * светло), затова окръжността се напасва само по страничните лъчи, където
 * винаги е склерата. Горе и долу ръб се приема само ако отвън е склера (по
 * цвят, не кожа) — тогава се напасва елипса; ако там са клепачите, вертикалният
 * радиус остава равен на хоризонталния.
 */
function findLimbusAround(p: Plane, cx: number, cy: number, rMin: number, rMax: number, maxShift: number): FitCircle | null {
  let fit = fitLateral(p, cx, cy, rMin, rMax, maxShift, 0.025, 900)
  if (!fit) return null
  // Втори пас от намерения център — лъчите вече са почти перпендикулярни на ръба.
  const f2 = fitLateral(p, fit.cx, fit.cy, fit.r * 0.85, fit.r * 1.15, fit.r * 0.1, 0.02, 600)
  if (f2 && f2.support >= fit.support * 0.85) fit = f2
  // Лимбусът е ВЪНШНАТА граница: вътрешни концентрични граници (коларета,
  // по-светъл център при хетерохромия, зеницата) също дават чисти окръжности.
  // Ако навън има по-голяма окръжност със склера отвън, тя е лимбусът.
  for (let guard = 0; guard < 3; guard++) {
    const cur: FitCircle = fit
    const hi = Math.min(cur.r * 3.2, rMax * 1.6)
    if (hi <= cur.r * 1.2) break
    const bigger = fitLateral(p, cur.cx, cur.cy, cur.r * 1.2, hi, cur.r * 0.25, 0.025, 700)
    if (!bigger || bigger.support < Math.max(0.35, cur.support * 0.5)) break
    const inside = ringMean(p, p.lum, bigger.cx, bigger.cy, bigger.r * 0.85, bigger.r * 0.96)
    const outside = ringMean(p, p.lum, bigger.cx, bigger.cy, bigger.r * 1.05, bigger.r * 1.2)
    if (Number.isNaN(inside) || Number.isNaN(outside) || outside < inside + 10) break
    fit = bigger
  }

  // ── форма: елипса, ако горе и долу се вижда склера ──
  const c0 = fit
  const all = rayEdges(p, p.lum, c0.cx, c0.cy, c0.r * 0.78, c0.r * 1.15, 4)
  const lateralNear = all.filter(q => isLateral(q.ray) && Math.abs(Math.hypot(q.x - c0.cx, q.y - c0.cy) - c0.r) <= c0.r * 0.04)
  // Цветът на склерата — отвън на страничния ръб.
  const scleraSkin = median(
    lateralNear.map(q => {
      const a = (q.ray / RAYS) * Math.PI * 2
      return skinness(p, c0.cx + Math.cos(a) * c0.r * 1.1, c0.cy + Math.sin(a) * c0.r * 1.1)
    })
  )
  const irisLum = ringMean(p, p.lum, c0.cx, c0.cy, c0.r * 0.6, c0.r * 0.85)
  const vertical: EdgePoint[] = []
  if (!Number.isNaN(scleraSkin) && !Number.isNaN(irisLum)) {
    const byRay = new Map<number, EdgePoint[]>()
    for (const q of all) {
      if (isLateral(q.ray)) continue
      const d = Math.hypot(q.x - c0.cx, q.y - c0.cy)
      if (d < c0.r * 0.8 || d > c0.r * 1.08) continue
      const a = (q.ray / RAYS) * Math.PI * 2
      const ox = c0.cx + Math.cos(a) * (d + c0.r * 0.06)
      const oy = c0.cy + Math.sin(a) * (d + c0.r * 0.06)
      const sk = skinness(p, ox, oy)
      const lum = sample(p, p.lum, ox, oy)
      // Отвън: светло като склера и не по-розово от нея.
      if (Number.isNaN(sk) || Number.isNaN(lum) || sk > scleraSkin + 22 || lum < irisLum + 25) continue
      const list = byRay.get(q.ray) ?? []
      list.push(q)
      byRay.set(q.ray, list)
    }
    // По един ръб на лъч — най-силният приет.
    for (const list of byRay.values()) vertical.push(list.sort((a, b) => b.strength - a.strength)[0])
  }
  const verticalRays = RAYS - LATERAL_RAYS
  if (vertical.length >= verticalRays * 0.2 && lateralNear.length >= 20) {
    const el = axisEllipse([...lateralNear, ...vertical], c0.cx, c0.cy)
    if (el && Math.hypot(el.cx - c0.cx, el.cy - c0.cy) < c0.r * 0.1) {
      const ratio = el.ry / el.rx
      if (ratio > 0.8 && ratio < 1.15) fit = { ...fit, cx: el.cx, cy: el.cy, r: el.rx, ry: el.ry }
    }
  }
  return fit
}

/**
 * Осева елипса A·x² + B·y² + C·x + D·y = 1 (най-малки квадрати, отместена към
 * ориентировъчния център за числена устойчивост). Ръбовете по клепача вече са
 * отпаднали като несъгласни с окръжността.
 */
function axisEllipse(pts: EdgePoint[], ox: number, oy: number): { cx: number; cy: number; rx: number; ry: number } | null {
  if (pts.length < 20) return null
  // Нормални уравнения 4×4.
  const M = Array.from({ length: 4 }, () => new Float64Array(5))
  for (const q of pts) {
    const x = q.x - ox
    const y = q.y - oy
    const row = [x * x, y * y, x, y]
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) M[i][j] += row[i] * row[j]
      M[i][4] += row[i]
    }
  }
  for (let i = 0; i < 4; i++) {
    let piv = i
    for (let j = i + 1; j < 4; j++) if (Math.abs(M[j][i]) > Math.abs(M[piv][i])) piv = j
    ;[M[i], M[piv]] = [M[piv], M[i]]
    if (Math.abs(M[i][i]) < 1e-12) return null
    for (let j = 0; j < 4; j++) {
      if (j === i) continue
      const f = M[j][i] / M[i][i]
      for (let k = i; k < 5; k++) M[j][k] -= f * M[i][k]
    }
  }
  const A = M[0][4] / M[0][0]
  const B = M[1][4] / M[1][1]
  const C = M[2][4] / M[2][2]
  const D = M[3][4] / M[3][3]
  if (!(A > 0 && B > 0)) return null
  const cx = -C / (2 * A)
  const cy = -D / (2 * B)
  const G = 1 + A * cx * cx + B * cy * cy
  if (!(G > 0)) return null
  return { cx: cx + ox, cy: cy + oy, rx: Math.sqrt(G / A), ry: Math.sqrt(G / B) }
}

export interface RefinedGeometry {
  pupil: FitCircle
  limbus: FitCircle
  /** 0..1 — обща оценка; по нея се избира между грубия и прецизния резултат. */
  score: number
}

/**
 * Прецизира геометрията. `seed` е грубият резултат (в пиксели на оригинала).
 * Пробват се няколко пътя и всеки (заедно с грубия) се оценява по една мярка;
 * връща се най-добрият. Така прецизирането не може да влоши резултата.
 */
export function refineIrisGeometry(
  img: HTMLImageElement | HTMLCanvasElement,
  seed: Pick<IrisGeometry, 'pupil' | 'limbus' | 'imageWidth' | 'imageHeight'>
): RefinedGeometry | null {
  const W = seed.imageWidth
  const H = seed.imageHeight
  const short = Math.min(W, H)
  const p = makePlane(img, Math.max(seed.limbus.r, short * 0.18))
  const s = p.scale
  const S = short * s
  const candidates: RefinedGeometry[] = []
  const consider = (pupil: FitCircle | null, limbus: FitCircle | null) => {
    if (!pupil || !limbus) return
    const score = pairScore(p, pupil, limbus)
    if (score > 0) candidates.push({ pupil, limbus, score })
  }

  // Грубият резултат, оценен със същата мярка — базата за сравнение.
  const coarseL = { cx: seed.limbus.cx * s, cy: seed.limbus.cy * s, r: seed.limbus.r * s }
  const coarseP = { cx: seed.pupil.cx * s, cy: seed.pupil.cy * s, r: seed.pupil.r * s }
  consider(
    { ...coarseP, support: supportOf(p, p.red, coarseP, 0.04) },
    { ...coarseL, support: supportOf(p, p.lum, coarseL, 0.025) }
  )

  // Път 1: зеницата първо (най-тъмното кръгло петно), после лимбусът около нея.
  const pupilSeeds = [darkestSeed(p), { x: coarseP.cx, y: coarseP.cy }, { x: coarseL.cx, y: coarseL.cy }]
  for (const sd of pupilSeeds) {
    const pupil = findPupilAround(p, sd.x, sd.y, S * 0.02, S * 0.25, S * 0.12)
    if (!pupil) continue
    const limbus = findLimbusAround(p, pupil.cx, pupil.cy, pupil.r * 1.35, Math.min(pupil.r * 7, S * 0.62), pupil.r * 1.2)
    if (!limbus) continue
    // Зеницата се уточнява още веднъж от центъра на лимбуса.
    const pupil2 = findPupilAround(p, limbus.cx, limbus.cy, limbus.r * 0.12, limbus.r * 0.75, limbus.r * 0.15)
    consider(pupil2 && pupil2.support >= pupil.support * 0.9 ? pupil2 : pupil, limbus)
  }

  // Път 2: лимбусът първо, от грубия резултат и от центъра на кадъра.
  for (const sd of [{ x: coarseL.cx, y: coarseL.cy }, { x: p.w / 2, y: p.h / 2 }]) {
    const limbus = findLimbusAround(p, sd.x, sd.y, S * 0.1, S * 0.62, S * 0.25)
    if (!limbus) continue
    const pupil = findPupilAround(p, limbus.cx, limbus.cy, limbus.r * 0.12, limbus.r * 0.75, limbus.r * 0.15)
    consider(pupil, limbus)
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  const inv = 1 / s
  const back = (c: FitCircle): FitCircle => ({
    cx: c.cx * inv,
    cy: c.cy * inv,
    r: c.r * inv,
    ...(c.ry !== undefined ? { ry: c.ry * inv } : {}),
    support: c.support,
  })
  return { pupil: back(best.pupil), limbus: back(best.limbus), score: best.score }
}
