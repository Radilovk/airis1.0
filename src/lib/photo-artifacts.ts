/**
 * photo-artifacts.ts — какво на снимката НЕ е ирисова тъкан.
 *
 * Находка може да е само в тъканта. Снимката обаче носи и неща, които
 * изглеждат като знаци, без да са:
 *
 *  1. ОТРАЖЕНИЯ (прозорец, лампа, светкавица) и ОРЕОЛЪТ около тях. Светло,
 *     слабо наситено петно — моделът го чете като „светло влакно“ или, ако
 *     отражението е цветно, като пигмент. Праг по абсолютна яркост не стига:
 *     отражение от прозорец върху тъмен ирис е 170–230, не 255. Затова прагът
 *     се извежда от яркостта и наситеността на самия ирис, а маската се
 *     разширява с ореола.
 *
 *  2. МИГЛИ И СЕНКИ ОТ МИГЛИ. Тънка тъмна линия — изглежда като радиална бразда
 *     или лакуна. Откриват се с морфологичен филтър „черна шапка“ (затваряне
 *     минус изображението: остават тънките тъмни структури). Различителното
 *     правило: миглата ПРЕСИЧА ръба на ириса и продължава навън; браздата и
 *     лакуната са изцяло вътре. Тъмният пръстен по ръба на ириса също пресича
 *     окръжността, но върви по обиколката — затова се изисква структурата да е
 *     по-дълга навътре, отколкото встрани.
 *
 *  3. ЦВЕТЕН ОТТЕНЪК на снимката. Склерата е естественият бял еталон:
 *     коефициентите, които я правят неутрално сива, се прилагат върху ириса,
 *     преди да се четат пигментите (баланс на бялото).
 *
 * Картата се смята веднъж на око (в по-ниска резолюция — ирисът ≈ 220 px
 * радиус) и я ползват и разгъвката (това, което вижда моделът), и проверката
 * на находките по пикселите.
 */

export interface ArtifactGeometry {
  pupil: { r: number; cx?: number; cy?: number }
  limbus: { cx: number; cy: number; r: number; ry?: number }
}

export const ARTIFACT_NONE = 0
export const ARTIFACT_GLARE = 1
export const ARTIFACT_LASH = 2

export interface ArtifactMap {
  /** Размер на маската. */
  w: number
  h: number
  /** Маска-пиксели на пиксел от изображението. */
  scale: number
  /** Отместване на кутията на маската (в маска-пиксели). */
  ox: number
  oy: number
  /** 0 — тъкан, 1 — отражение (с ореола), 2 — мигла/сянка. */
  mask: Uint8Array
  /** Множители R, G, B, които правят склерата неутрална. */
  gains: [number, number, number]
  /** Дял от ириса под отражения и под мигли. */
  glareShare: number
  lashShare: number
}

const TARGET_R = 220

function percentile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)))]
}

/** Плъзгащ максимум/минимум по 1D с монотонна опашка — O(n) независимо от прозореца. */
function slide(get: (i: number) => number, set: (i: number, v: number) => void, len: number, rad: number, max: boolean) {
  const q = new Int32Array(len)
  let head = 0
  let tail = 0
  const better = max ? (a: number, b: number) => a >= b : (a: number, b: number) => a <= b
  let next = 0
  for (let i = 0; i < len; i++) {
    // добавяме всичко до i + rad
    while (next <= Math.min(len - 1, i + rad)) {
      const v = get(next)
      while (tail > head && better(v, get(q[tail - 1]))) tail--
      q[tail++] = next
      next++
    }
    while (q[head] < i - rad) head++
    set(i, get(q[head]))
  }
}

/** Плъзгащ максимум/минимум в квадратен прозорец (разделимо по редове и колони). */
function morph(src: Float32Array, w: number, h: number, rad: number, max: boolean): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const o = y * w
    slide(i => src[o + i], (i, v) => (tmp[o + i] = v), w, rad, max)
  }
  for (let x = 0; x < w; x++) {
    slide(i => tmp[i * w + x], (i, v) => (out[i * w + x] = v), h, rad, max)
  }
  return out
}

/**
 * Строи картата от пикселите на изображението (RGBA, W×H) и геометрията в
 * пиксели на същото изображение.
 */
export function buildArtifactMap(
  data: Uint8ClampedArray | number[],
  W: number,
  H: number,
  geo: ArtifactGeometry
): ArtifactMap {
  const scale = Math.min(1, TARGET_R / Math.max(20, geo.limbus.r))
  // Само кутия около ириса (±1.45 радиуса) — морфологията е скъпа.
  const half = geo.limbus.r * 1.45
  const ox = Math.max(0, Math.floor((geo.limbus.cx - half) * scale))
  const oy = Math.max(0, Math.floor((geo.limbus.cy - Math.max(half, (geo.limbus.ry ?? geo.limbus.r) * 1.45)) * scale))
  const w = Math.max(1, Math.min(Math.round(W * scale), Math.ceil((geo.limbus.cx + half) * scale)) - ox)
  const h = Math.max(1, Math.min(Math.round(H * scale), Math.ceil((geo.limbus.cy + Math.max(half, (geo.limbus.ry ?? geo.limbus.r) * 1.45)) * scale)) - oy)
  const n = w * h
  const R = new Float32Array(n)
  const G = new Float32Array(n)
  const B = new Float32Array(n)
  const L = new Float32Array(n)
  // Свиване със средна стойност на блока — без шума на най-близкия пиксел.
  const step = 1 / scale
  for (let y = 0; y < h; y++) {
    const sy0 = Math.min(H - 1, Math.floor((y + oy) * step))
    const sy1 = Math.min(H, Math.max(sy0 + 1, Math.floor((y + oy + 1) * step)))
    for (let x = 0; x < w; x++) {
      const sx0 = Math.min(W - 1, Math.floor((x + ox) * step))
      const sx1 = Math.min(W, Math.max(sx0 + 1, Math.floor((x + ox + 1) * step)))
      let r = 0, g = 0, b = 0, c = 0
      for (let yy = sy0; yy < sy1; yy += Math.max(1, Math.floor((sy1 - sy0) / 3))) {
        for (let xx = sx0; xx < sx1; xx += Math.max(1, Math.floor((sx1 - sx0) / 3))) {
          const i = (yy * W + xx) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          c++
        }
      }
      const p = y * w + x
      R[p] = r / c
      G[p] = g / c
      B[p] = b / c
      L[p] = 0.299 * R[p] + 0.587 * G[p] + 0.114 * B[p]
    }
  }

  const lcx = geo.limbus.cx * scale - ox
  const lcy = geo.limbus.cy * scale - oy
  const lr = geo.limbus.r * scale
  const lry = (geo.limbus.ry ?? geo.limbus.r) * scale
  const pcx = (geo.pupil.cx ?? geo.limbus.cx) * scale - ox
  const pcy = (geo.pupil.cy ?? geo.limbus.cy) * scale - oy
  const pr = geo.pupil.r * scale
  /** Нормирано разстояние до лимбуса (1 = на ръба, елиптично). */
  const rel = (x: number, y: number) => Math.hypot((x - lcx) / lr, (y - lcy) / lry)
  const inIris = (x: number, y: number) => rel(x, y) < 1 && Math.hypot(x - pcx, y - pcy) > pr

  // ── статистика на тъканта ──
  const lums: number[] = []
  const sats: number[] = []
  const x0 = Math.max(0, Math.floor(lcx - lr))
  const x1 = Math.min(w - 1, Math.ceil(lcx + lr))
  const y0 = Math.max(0, Math.floor(lcy - lry))
  const y1 = Math.min(h - 1, Math.ceil(lcy + lry))
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      if (!inIris(x, y)) continue
      const p = y * w + x
      const mx = Math.max(R[p], G[p], B[p])
      lums.push(L[p])
      sats.push(mx < 1 ? 0 : (mx - Math.min(R[p], G[p], B[p])) / mx)
    }
  }
  lums.sort((a, b) => a - b)
  sats.sort((a, b) => a - b)
  const p50 = percentile(lums, 0.5)
  const p98 = percentile(lums, 0.98)
  const satMed = percentile(sats, 0.5)

  const mask = new Uint8Array(n)

  // ── 1. отражения ──
  // Отражението се отличава ЛОКАЛНО: много по-светло от непосредствената си
  // околност (бяла шапка = изображение − отваряне), и е близо до неутрално.
  // Общо светлите участъци на син или сив ирис (светли влакна) не са
  // отражения — те са тъкан и не бива да се трият. Безусловно се приема само
  // почти чисто бялото. Търси се само в тъканта (до 97 % от радиуса): светлата
  // склера по ръба не е отражение.
  const openR = Math.max(2, Math.round(lr * 0.08))
  const opened = morph(morph(L, w, h, openR, false), w, h, openR, true)
  const th: number[] = []
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      if (!inIris(x, y)) continue
      th.push(L[y * w + x] - opened[y * w + x])
    }
  }
  th.sort((a, b) => a - b)
  const thMed = percentile(th, 0.5)
  const thMad = percentile(th.map(v => Math.abs(v - thMed)).sort((a, b) => a - b), 0.5)
  const thThr = Math.max(45, thMed + 6 * 1.4826 * thMad)
  const neutral = Math.max(0.3, satMed * 0.9)
  const seeds = new Uint8Array(n)
  let seedCount = 0
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (rel(x, y) >= 0.97) continue
      const p = y * w + x
      const mx = Math.max(R[p], G[p], B[p])
      const sat = mx < 1 ? 0 : (mx - Math.min(R[p], G[p], B[p])) / mx
      const whitish = L[p] >= 238 && sat < 0.15
      const local = L[p] - opened[p] > thThr && L[p] > p50 * 1.3 && sat < neutral
      if (whitish || local) {
        seeds[p] = 1
        seedCount++
      }
    }
  }
  // Ореол: ~2 % от радиуса около ядрото, плюс свързаното по-светло до ~4 %.
  if (seedCount > 0) {
    const halo = Math.max(1, Math.round(lr * 0.02))
    const grown = morph(Float32Array.from(seeds), w, h, halo, true)
    const wide = morph(Float32Array.from(seeds), w, h, halo * 2, true)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        if (rel(x, y) >= 0.99) continue
        if (grown[p] > 0 || (wide[p] > 0 && L[p] > p50 * 1.25)) mask[p] = ARTIFACT_GLARE
      }
    }
  }
  void p98

  // ── 2. мигли и сенки (черна шапка) ──
  const rad = Math.max(2, Math.round(lr * 0.03))
  const closed = morph(morph(L, w, h, rad, true), w, h, rad, false)
  const bh = new Float32Array(n)
  const bhs: number[] = []
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      if (!inIris(x, y)) continue
      const p = y * w + x
      bhs.push(closed[p] - L[p])
    }
  }
  for (let p = 0; p < n; p++) bh[p] = closed[p] - L[p]
  bhs.sort((a, b) => a - b)
  const med = percentile(bhs, 0.5)
  const mad = percentile(
    bhs.map(v => Math.abs(v - med)).sort((a, b) => a - b),
    0.5
  )
  const thr = Math.max(16, med + 4 * 1.4826 * mad)
  // Двоен праг: миглата е най-контрастна върху светлата склера/кожа; върху
  // тъмен ирис контрастът ѝ пада. Областта се гради от по-ниския праг, но се
  // приема само ако съдържа и силни пиксели.
  const thrLow = Math.max(10, thr * 0.5)
  const cand = new Uint8Array(n)
  const strong = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = rel(x, y)
      if (r < 0.55 || r > 1.3) continue
      const v = bh[y * w + x]
      if (v > thrLow) cand[y * w + x] = 1
      if (v > thr) strong[y * w + x] = 1
    }
  }
  // Свързани области; мигла = пресича окръжността на лимбуса И е по-дълга
  // навътре, отколкото встрани.
  const seen = new Uint8Array(n)
  const stack: number[] = []
  const comp: number[] = []
  for (let start = 0; start < n; start++) {
    if (!cand[start] || seen[start]) continue
    comp.length = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const p = stack.pop()!
      comp.push(p)
      const x = p % w
      const y = (p / w) | 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          const q = yy * w + xx
          if (cand[q] && !seen[q]) {
            seen[q] = 1
            stack.push(q)
          }
        }
      }
    }
    if (comp.length < 4) continue
    if (!comp.some(p => strong[p])) continue
    let rMin = Infinity
    let rMax = -Infinity
    let inside = 0
    let outside = 0
    let aMin = Infinity
    let aMax = -Infinity
    const aRef = Math.atan2(((comp[0] / w) | 0) - lcy, (comp[0] % w) - lcx)
    for (const p of comp) {
      const x = p % w
      const y = (p / w) | 0
      const r = rel(x, y)
      rMin = Math.min(rMin, r)
      rMax = Math.max(rMax, r)
      if (r < 0.97) inside++
      if (r > 1.03) outside++
      // ъгъл спрямо първата точка — без скок при ±π
      let a = Math.atan2(y - lcy, x - lcx) - aRef
      if (a > Math.PI) a -= 2 * Math.PI
      if (a < -Math.PI) a += 2 * Math.PI
      aMin = Math.min(aMin, a)
      aMax = Math.max(aMax, a)
    }
    const radialSpan = rMax - rMin // в радиуси на ириса
    const tangentialSpan = (aMax - aMin) * Math.min(1, (rMin + rMax) / 2) // дъга в радиуси
    const crosses = inside >= 2 && outside >= 2
    if (!crosses || radialSpan < 0.1 || radialSpan < tangentialSpan * 0.8) continue
    for (const p of comp) {
      const x = p % w
      const y = (p / w) | 0
      // Миглите висят от клепача и не стигат по-навътре от ~30 % от ириса.
      // Ограничението пази истинска бразда, до която е опрял върхът на мигла.
      const rr = rel(x, y)
      if (rr < 1.02 && rr >= 0.7 && mask[p] === ARTIFACT_NONE) mask[p] = ARTIFACT_LASH
    }
  }
  // Сянката е малко по-широка от самата мигла.
  const lashGrow = morph(Float32Array.from(mask, v => (v === ARTIFACT_LASH ? 1 : 0)), w, h, 1, true)
  for (let p = 0; p < n; p++) if (lashGrow[p] > 0 && mask[p] === ARTIFACT_NONE) mask[p] = ARTIFACT_LASH

  // ── 3. баланс на бялото по склерата ──
  const sclera: Array<[number, number, number]> = []
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2
    // само встрани: горе и долу обикновено са клепачите
    if (Math.abs(Math.cos(a)) < 0.75) continue
    for (let t = 1.1; t <= 1.4; t += 0.05) {
      const x = Math.round(lcx + Math.cos(a) * lr * t)
      const y = Math.round(lcy + Math.sin(a) * lry * t)
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      const p = y * w + x
      if (L[p] < p50 + 20 || L[p] > 250 || R[p] - B[p] > 45) continue
      sclera.push([R[p], G[p], B[p]])
    }
  }
  let gains: [number, number, number] = [1, 1, 1]
  if (sclera.length >= 40) {
    const med3 = [0, 1, 2].map(c => percentile(sclera.map(v => v[c]).sort((a, b) => a - b), 0.5))
    const gray = (med3[0] + med3[1] + med3[2]) / 3
    gains = med3.map(v => Math.max(0.8, Math.min(1.25, gray / Math.max(1, v)))) as [number, number, number]
  }

  // ── дялове ──
  let total = 0
  let glare = 0
  let lash = 0
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      if (!inIris(x, y)) continue
      total++
      const m = mask[y * w + x]
      if (m === ARTIFACT_GLARE) glare++
      else if (m === ARTIFACT_LASH) lash++
    }
  }
  return {
    w,
    h,
    ox,
    oy,
    scale,
    mask,
    gains,
    glareShare: total ? glare / total : 0,
    lashShare: total ? lash / total : 0,
  }
}

/** Вид артефакт в точка от изображението (пиксели на оригинала). */
export function artifactAt(map: ArtifactMap, x: number, y: number): number {
  const mx = Math.round(x * map.scale) - map.ox
  const my = Math.round(y * map.scale) - map.oy
  if (mx < 0 || my < 0 || mx >= map.w || my >= map.h) return ARTIFACT_NONE
  return map.mask[my * map.w + mx]
}

/** Картата на едно изображение се смята веднъж (разгъвката минава 6 пъти). */
const cache = new WeakMap<object, Map<string, ArtifactMap>>()

export function artifactMapFor(
  key: object,
  data: Uint8ClampedArray,
  W: number,
  H: number,
  geo: ArtifactGeometry
): ArtifactMap {
  const g = `${geo.pupil.cx ?? ''},${geo.pupil.cy ?? ''},${geo.pupil.r},${geo.limbus.cx},${geo.limbus.cy},${geo.limbus.r},${geo.limbus.ry ?? ''}`
  let byGeo = cache.get(key)
  if (!byGeo) {
    byGeo = new Map()
    cache.set(key, byGeo)
  }
  let map = byGeo.get(g)
  if (!map) {
    map = buildArtifactMap(data, W, H, geo)
    byGeo.set(g, map)
  }
  return map
}
