/**
 * collarette.ts — къде е коларетата на ТОЗИ ирис.
 *
 * Защо: и Jensen, и школата на Deck делят ириса спрямо коларетата (автономния
 * пръстен, Iriskrause), а не по фиксиран процент. Jensen: „първият голям
 * ориентир лежи на около 1/3 навън … често е неравен и криволичи“; вътре са
 * стомахът и червата, отвън — всички други органи. При Deck размерът на
 * вътрешната (зеничната) зона сам по себе си е знак. С фиксирана граница на
 * 38 % знак в червата на човек с коларета на 45 % се четеше като орган.
 *
 * Как: коларетата е границата между зеничната и цилиарната зона — там се
 * сменят цветът (централна хетерохромия, кафяв пръстен в зелен ирис) и/или
 * яркостта. За всеки от 12-те сектора се взема радиален профил (Lab), медиана
 * от 8 лъча — така отделните влакна и крипти не местят границата — и се търси
 * точката на промяна: разделянето на профила на „вътре“ и „вън“, при което
 * двете части са най-еднородни. Контрастът на тази промяна е увереността.
 *
 * Резултат: позиция на коларетата по сектори като дял от пътя зеница→лимбус.
 * Секторите без ясна граница взимат медианата на останалите; ако ясни сектори
 * са малко, се връща класическата 1/3 (Jensen) — тоест същото деление като
 * досега.
 */

import { irisPoint } from './iris-coords'
import { rgbToLab } from './eye-health'

export interface CollaretteGeometry {
  pupil: { r: number; cx?: number; cy?: number }
  limbus: { cx: number; cy: number; r: number; ry?: number }
}

export interface CollaretteMeasure {
  /** Позиция по сектори 1..12 (индекс 0..11), дял от пътя зеница→лимбус. */
  t: number[]
  /** 0..1 — каква част от секторите показват ясна граница. */
  confidence: number
  /** 'measured' — от снимката; 'default' — класическата 1/3. */
  source: 'measured' | 'default'
}

/** Jensen: коларетата е на около 1/3 от пътя навън. */
export const DEFAULT_COLLARETTE_T = 1 / 3
/** Правдоподобни граници — извън тях е друга граница (зеничен ръб, лимбален пръстен). */
export const MIN_COLLARETTE_T = 0.2
export const MAX_COLLARETTE_T = 0.55

const RAYS_PER_SECTOR = 8
const T_FROM = 0.06
const T_TO = 0.8
const T_STEPS = 60
/** Сектор с контраст над това е „ясен“. */
const CLEAR_CONTRAST = 1.6
/** Минимум ясни сектори, за да се приеме измерването. */
const MIN_CLEAR_SECTORS = 6

function median(xs: number[]): number {
  if (!xs.length) return NaN
  const s = xs.slice().sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function sample(data: Uint8ClampedArray | number[], W: number, H: number, x: number, y: number): [number, number, number] | null {
  if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return null
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const out: number[] = [0, 0, 0]
  for (let k = 0; k < 3; k++) {
    const i00 = (y0 * W + x0) * 4 + k
    const a = data[i00] * (1 - fx) + data[i00 + 4] * fx
    const b = data[i00 + W * 4] * (1 - fx) + data[i00 + W * 4 + 4] * fx
    out[k] = a * (1 - fy) + b * fy
  }
  return out as [number, number, number]
}

/** Позиция на промяната в един профил и контрастът ѝ. */
export function changePoint(profile: Array<[number, number, number] | null>, ts: number[]): { t: number; contrast: number } | null {
  // Тегла: цветът (a, b) носи коларетата при хетерохромия, яркостта — при еднороден цвят.
  const w = [1, 1.5, 1.5]
  let best: { t: number; contrast: number; cost: number } | null = null
  for (let k = 0; k < ts.length; k++) {
    const tk = ts[k]
    if (tk < MIN_COLLARETTE_T || tk > MAX_COLLARETTE_T) continue
    // Вътре — от близо до зеницата до границата; вън — равен по ширина пояс
    // навън (не до лимбуса: тъмният лимбален пръстен е друга граница).
    const inner: Array<[number, number, number]> = []
    const outer: Array<[number, number, number]> = []
    for (let j = 0; j < ts.length; j++) {
      const p = profile[j]
      if (!p) continue
      if (ts[j] >= 0.08 && ts[j] < tk) inner.push(p)
      else if (ts[j] >= tk && ts[j] < Math.min(0.78, tk + 0.3)) outer.push(p)
    }
    if (inner.length < 4 || outer.length < 4) continue
    const mean = (xs: Array<[number, number, number]>) =>
      [0, 1, 2].map(c => xs.reduce((s, v) => s + v[c], 0) / xs.length)
    const mi = mean(inner)
    const mo = mean(outer)
    let cost = 0
    for (const v of inner) for (let c = 0; c < 3; c++) cost += w[c] * (v[c] - mi[c]) ** 2
    for (const v of outer) for (let c = 0; c < 3; c++) cost += w[c] * (v[c] - mo[c]) ** 2
    const n = inner.length + outer.length
    const sd = Math.sqrt(cost / Math.max(1, n - 2)) || 1
    const dist = Math.sqrt([0, 1, 2].reduce((s, c) => s + w[c] * (mi[c] - mo[c]) ** 2, 0))
    // Сравнява се цената на единица точки — иначе по-късите прозорци печелят.
    const norm = cost / n
    if (!best || norm < best.cost) best = { t: tk, contrast: dist / sd, cost: norm }
  }
  return best ? { t: best.t, contrast: best.contrast } : null
}

/**
 * Измерва коларетата от пикселите (RGBA, W×H) и геометрията в пиксели на
 * същото изображение.
 */
export function measureCollarette(
  data: Uint8ClampedArray | number[],
  W: number,
  H: number,
  geo: CollaretteGeometry
): CollaretteMeasure {
  const g = {
    pupil: { cx: geo.pupil.cx ?? geo.limbus.cx, cy: geo.pupil.cy ?? geo.limbus.cy, r: geo.pupil.r },
    limbus: geo.limbus,
  }
  const ts = Array.from({ length: T_STEPS }, (_, i) => T_FROM + ((T_TO - T_FROM) * i) / (T_STEPS - 1))
  const found: Array<{ t: number; contrast: number } | null> = []
  for (let s = 0; s < 12; s++) {
    const profile: Array<[number, number, number] | null> = []
    for (const t of ts) {
      const labs: Array<[number, number, number]> = []
      for (let k = 0; k < RAYS_PER_SECTOR; k++) {
        const minute = s * 5 + ((k + 0.5) / RAYS_PER_SECTOR) * 5
        const pt = irisPoint(g, minute, t * 12)
        const rgb = sample(data, W, H, pt.x, pt.y)
        if (!rgb) continue
        const [r, gg, b] = rgb
        const mx = Math.max(r, gg, b)
        const mn = Math.min(r, gg, b)
        // Отблясък, мигла или сянка от клепача не са тъкан.
        if ((mx > 240 && mx - mn < 30) || mx < 18) continue
        labs.push(rgbToLab(r, gg, b))
      }
      profile.push(
        labs.length >= 3 ? ([0, 1, 2].map(c => median(labs.map(v => v[c]))) as [number, number, number]) : null
      )
    }
    // Леко изглаждане по радиуса.
    const smooth = profile.map((p, i) => {
      if (!p) return null
      const win = [profile[i - 1], p, profile[i + 1]].filter((v): v is [number, number, number] => !!v)
      return [0, 1, 2].map(c => win.reduce((a, v) => a + v[c], 0) / win.length) as [number, number, number]
    })
    found.push(changePoint(smooth, ts))
  }

  const clear = found.map(f => (f && f.contrast >= CLEAR_CONTRAST ? f.t : NaN))
  const clearCount = clear.filter(v => Number.isFinite(v)).length
  if (clearCount < MIN_CLEAR_SECTORS) {
    return { t: Array(12).fill(DEFAULT_COLLARETTE_T), confidence: clearCount / 12, source: 'default' }
  }
  const med = median(clear.filter(v => Number.isFinite(v)))
  // Неясните сектори — медианата; ясните — не по-далеч от ±0.1 от нея
  // (коларетата криволичи, но не скача наполовина).
  const raw = clear.map(v => (Number.isFinite(v) ? Math.max(med - 0.1, Math.min(med + 0.1, v)) : med))
  // Кръгова медиана от три съседни сектора — една грешна точка не чупи кривата.
  const t = raw.map((v, i) => median([raw[(i + 11) % 12], v, raw[(i + 1) % 12]]))
  return { t, confidence: clearCount / 12, source: 'measured' }
}

/** Измерва коларетата направо от data URL (снимката се смалява до ≤ 900 px). */
export async function measureCollaretteFromDataUrl(
  dataUrl: string,
  geo: CollaretteGeometry & { imageWidth?: number }
): Promise<CollaretteMeasure> {
  const fallback: CollaretteMeasure = { t: Array(12).fill(DEFAULT_COLLARETTE_T), confidence: 0, source: 'default' }
  if (typeof document === 'undefined' || !dataUrl) return fallback
  const img = await new Promise<HTMLImageElement | null>(resolve => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => resolve(null)
    el.src = dataUrl
  })
  if (!img) return fallback
  const W0 = img.naturalWidth
  const H0 = img.naturalHeight
  const k = Math.min(1, 900 / Math.max(W0, H0))
  const W = Math.max(1, Math.round(W0 * k))
  const H = Math.max(1, Math.round(H0 * k))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return fallback
  ctx.drawImage(img, 0, 0, W, H)
  // Геометрията е в пиксели на изображението, за което е измерена.
  const s = W / (geo.imageWidth || W0)
  const scaled: CollaretteGeometry = {
    pupil: {
      r: geo.pupil.r * s,
      cx: (geo.pupil.cx ?? geo.limbus.cx) * s,
      cy: (geo.pupil.cy ?? geo.limbus.cy) * s,
    },
    limbus: {
      cx: geo.limbus.cx * s,
      cy: geo.limbus.cy * s,
      r: geo.limbus.r * s,
      ...(geo.limbus.ry !== undefined ? { ry: geo.limbus.ry * s } : {}),
    },
  }
  return measureCollarette(ctx.getImageData(0, 0, W, H).data, W, H, scaled)
}

/** Средният пръстен на коларетата (0–12) — за надписите на лентата и за промпта. */
export function meanCollaretteRing(m: CollaretteMeasure): number {
  return (m.t.reduce((a, b) => a + b, 0) / m.t.length) * 12
}
