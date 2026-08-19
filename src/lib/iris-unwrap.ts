/**
 * iris-unwrap.ts — пречертаване на ириса в правоъгълна калибрирана лента.
 *
 * ЗАЩО ЛЕНТАТА Е ПРЕЧЕРТАНА, А НЕ САМО ПРОМПТЪТ Е ПРОМЕНЕН
 * ────────────────────────────────────────────────────────
 * Старата лента (`method1/app.py::draw_ai_grid_map_expanded`) имаше 2400×600 px
 * и числа през 5 минути в горната лента. За да локализира находка, моделът
 * трябваше да ИНТЕРПОЛИРА позиция между редки деления върху изображение със
 * съотношение 4:1, което почти всяка визуална архитектура намалява агресивно.
 * Точно там се чупеше локализацията — не в текста на промпта.
 *
 * Затова тук се сменя самата адресация:
 *
 *   ▸ Основният адрес е ДИСКРЕТНА КЛЕТКА, а не непрекъсната координата.
 *     12 секторни колони × 12 пръстенни реда = 144 клетки. Моделът отговаря
 *     „сектор 7, пръстен R4", а не „минута 37" — задача, с която визуалните
 *     модели се справят надеждно.
 *   ▸ Номерът на всеки сектор е отпечатан ДВА ПЪТИ (горе и долу), а номерът на
 *     всеки пръстен — също два пъти (ляво и дясно). Никога не се налага броене
 *     на линии.
 *   ▸ Колоните са с редуващ се фон (зебра) — визуалната сегментация на колони
 *     става без броене.
 *   ▸ Съотношението е 2:1 вместо 4:1, а клетката е ≈120×60 px.
 *   ▸ Нечетимите зони (клепач, мигли, отблясък, извън лимбуса) се защриховат
 *     и се обявяват изрично, вместо да се боядисват в бяло — бялото се бъркаше
 *     с бледи находки (натриев ръб, лимфна броеница).
 *
 * ГЕОМЕТРИЧЕН МОДЕЛ
 * ─────────────────
 * Използва се rubber-sheet модел: центърът се интерполира линейно между центъра
 * на зеницата и центъра на лимбуса. Зеницата почти никога не е концентрична с
 * лимбуса и единичен център изкривява картата към периферията.
 *
 * ЪГЛОВА КОНВЕНЦИЯ
 * ────────────────
 * θ = минута × 6°, измерена от 12:00 по часовниковата стрелка ТАКА, КАКТО СЕ
 * ВИЖДА НА СНИМКАТА. В координати на изображението (y надолу):
 *     x = cx + r·sin θ ,  y = cy − r·cos θ
 * θ=0 → 12:00 (нагоре); θ=90° → 3:00 (надясно). Проверимо и без коментар.
 *
 * NASAL/TEMPORAL: при фронтална снимка носът е към центъра на лицето, тоест
 * за ДЯСНО око носовата страна е в дясната половина на кадъра → 3:00 (мин 15).
 * За ЛЯВО око — 9:00 (мин 45). (Старият Python код ги разменяше.)
 */

import type { IrisGeometry } from './iris-geometry'
import { RING_BANDS, sectorsFor, type Side } from './iris-map'

export type StripLayer = 'base' | 'structure' | 'pigment'

export interface UnwrapOptions {
  /** Кой филтър да се приложи преди изчертаване на мрежата. */
  layer?: StripLayer
  /** Ширина на полето с ирисова тъкан, px. По подразбиране 1440. */
  plotWidth?: number
  /** Височина на полето с ирисова тъкан, px. По подразбиране 720. */
  plotHeight?: number
  /** JPEG качество на изхода. */
  quality?: number
}

export interface UnwrapResult {
  /** Готовата лента с мрежа, като data URL (JPEG). */
  dataUrl: string
  /** Разгънатата тъкан без мрежа — за визуализация в UI. */
  rawDataUrl: string
  /** readability[ring][sector] ∈ 0..1 — колко от клетката е четима. */
  readability: number[][]
  /** Списък на клетките, които са под прага на четимост. */
  unreadableCells: Array<{ sector: number; ring: number }>
  /** Общ дял четима площ 0..1. */
  coverage: number
  side: Side
  layer: StripLayer
}

const SECTORS = 12
const RINGS = 12
const UNREADABLE_THRESHOLD = 0.55 // клетка под 55 % четими пиксели се маркира

/* ── семплиране ───────────────────────────────────────────────────────────── */

interface Src {
  data: Uint8ClampedArray
  w: number
  h: number
}

function loadSource(img: HTMLImageElement | HTMLCanvasElement): Src {
  const w = 'naturalWidth' in img ? img.naturalWidth || img.width : img.width
  const h = 'naturalHeight' in img ? img.naturalHeight || img.height : img.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  return { data: ctx.getImageData(0, 0, w, h).data, w, h }
}

/** Билинейна извадка. Връща false, ако точката е извън кадъра. */
function bilinear(src: Src, x: number, y: number, out: [number, number, number]): boolean {
  if (x < 0 || y < 0 || x >= src.w - 1 || y >= src.h - 1) return false
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i00 = (y0 * src.w + x0) * 4
  const i10 = i00 + 4
  const i01 = i00 + src.w * 4
  const i11 = i01 + 4
  for (let k = 0; k < 3; k++) {
    const a = src.data[i00 + k] * (1 - fx) + src.data[i10 + k] * fx
    const b = src.data[i01 + k] * (1 - fx) + src.data[i11 + k] * fx
    out[k] = a * (1 - fy) + b * fy
  }
  return true
}

/* ── филтри ───────────────────────────────────────────────────────────────── */

function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Разделяем box blur върху едноканален буфер. */
function boxBlur(buf: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const win = radius * 2 + 1
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -radius; x <= radius; x++) acc += buf[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / win
      const add = buf[y * w + Math.min(w - 1, x + radius + 1)]
      const sub = buf[y * w + Math.max(0, x - radius)]
      acc += add - sub
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win
      const add = tmp[Math.min(h - 1, y + radius + 1) * w + x]
      const sub = tmp[Math.max(0, y - radius) * w + x]
      acc += add - sub
    }
  }
  return out
}

/**
 * BASE — корекция на осветяването (хомоморфна): изважда силно замъгления фон,
 * така че сянката от клепача и петното от светкавицата спират да доминират,
 * без да се променят цветовете. Следва разтягане по персентили.
 */
function applyBase(px: Float32Array, w: number, h: number, valid: Uint8Array) {
  const L = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) L[i] = luma(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])

  const bg = boxBlur(L, w, h, Math.max(8, Math.round(Math.min(w, h) / 12)))

  let sum = 0
  let n = 0
  for (let i = 0; i < w * h; i++) {
    if (!valid[i]) continue
    sum += L[i]
    n++
  }
  const mean = n ? sum / n : 128

  const corrected = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) corrected[i] = L[i] - bg[i] + mean

  // разтягане по 2-и / 98-и персентил, само върху четимите пиксели
  const sample: number[] = []
  for (let i = 0; i < w * h; i += 7) if (valid[i]) sample.push(corrected[i])
  sample.sort((a, b) => a - b)
  const lo = sample.length ? sample[Math.floor(sample.length * 0.02)] : 0
  const hi = sample.length ? sample[Math.floor(sample.length * 0.98)] : 255
  const span = Math.max(24, hi - lo)

  for (let i = 0; i < w * h; i++) {
    const target = ((corrected[i] - lo) / span) * 235 + 10
    const ratio = L[i] > 1 ? target / L[i] : 1
    for (let k = 0; k < 3; k++) {
      px[i * 3 + k] = Math.max(0, Math.min(255, px[i * 3 + k] * ratio))
    }
  }
}

/**
 * STRUCTURE — unsharp mask само по яркостта. Криптите, лакуните и радиалните
 * бразди излизат по-контрастни; цветът остава непроменен, за да не се роди
 * фалшив пигмент.
 */
function applyStructure(px: Float32Array, w: number, h: number, valid: Uint8Array) {
  applyBase(px, w, h, valid)
  const L = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) L[i] = luma(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])
  const blurred = boxBlur(L, w, h, 3)
  const amount = 1.25
  for (let i = 0; i < w * h; i++) {
    const sharp = L[i] + (L[i] - blurred[i]) * amount
    const ratio = L[i] > 1 ? Math.max(0, Math.min(255, sharp)) / L[i] : 1
    // към сиво, за да не се тълкува като цветна находка
    const gray = Math.max(0, Math.min(255, sharp))
    for (let k = 0; k < 3; k++) {
      const c = px[i * 3 + k] * ratio
      px[i * 3 + k] = Math.max(0, Math.min(255, c * 0.35 + gray * 0.65))
    }
  }
}

/**
 * PIGMENT — усилване на насищането при запазена яркост. Жълто-оранжевите и
 * ръждивите петна изпъкват и в тъмни ириси, където иначе са невидими.
 */
function applyPigment(px: Float32Array, w: number, h: number, valid: Uint8Array) {
  applyBase(px, w, h, valid)
  const boost = 1.9
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 3]
    const g = px[i * 3 + 1]
    const b = px[i * 3 + 2]
    const l = luma(r, g, b)
    px[i * 3] = Math.max(0, Math.min(255, l + (r - l) * boost))
    px[i * 3 + 1] = Math.max(0, Math.min(255, l + (g - l) * boost))
    px[i * 3 + 2] = Math.max(0, Math.min(255, l + (b - l) * boost))
  }
}

/* ── основната функция ────────────────────────────────────────────────────── */

/**
 * Разгъва ириса в правоъгълна лента и рисува върху нея калибрационната мрежа.
 */
export function unwrapIris(
  img: HTMLImageElement | HTMLCanvasElement,
  geo: IrisGeometry,
  side: Side,
  options: UnwrapOptions = {}
): UnwrapResult {
  const layer = options.layer ?? 'base'
  const PW = options.plotWidth ?? 1440
  const PH = options.plotHeight ?? 720
  const quality = options.quality ?? 0.93

  const src = loadSource(img)

  const px = new Float32Array(PW * PH * 3)
  const valid = new Uint8Array(PW * PH)
  const sampleBuf: [number, number, number] = [0, 0, 0]

  const { pupil, limbus } = geo

  for (let row = 0; row < PH; row++) {
    // t = 0 при ръба на зеницата, 1 при лимбуса; центриране в средата на реда
    const t = (row + 0.5) / PH
    const cx = pupil.cx + (limbus.cx - pupil.cx) * t
    const cy = pupil.cy + (limbus.cy - pupil.cy) * t
    for (let col = 0; col < PW; col++) {
      const theta = ((col + 0.5) / PW) * Math.PI * 2 // 0 = 12:00, расте по часовника
      const sin = Math.sin(theta)
      const cos = Math.cos(theta)
      // радиусът на зеницата и на лимбуса по този лъч, спрямо съответния център
      const rIn = pupil.r
      const rOut = limbus.r
      const r = rIn + (rOut - rIn) * t
      const x = cx + r * sin
      const y = cy - r * cos

      const i = row * PW + col
      if (!bilinear(src, x, y, sampleBuf)) {
        px[i * 3] = 40
        px[i * 3 + 1] = 40
        px[i * 3 + 2] = 46
        valid[i] = 0
        continue
      }
      const l = luma(sampleBuf[0], sampleBuf[1], sampleBuf[2])
      // мигли/дълбока сянка от клепач ИЛИ спекуларен отблясък → нечетимо
      const readable = l > 20 && l < 249
      valid[i] = readable ? 1 : 0
      px[i * 3] = sampleBuf[0]
      px[i * 3 + 1] = sampleBuf[1]
      px[i * 3 + 2] = sampleBuf[2]
    }
  }

  if (layer === 'structure') applyStructure(px, PW, PH, valid)
  else if (layer === 'pigment') applyPigment(px, PW, PH, valid)
  else applyBase(px, PW, PH, valid)

  // ── readability по клетки ────────────────────────────────────────────────
  const readability: number[][] = Array.from({ length: RINGS }, () => new Array(SECTORS).fill(0))
  const cellW = PW / SECTORS
  const cellH = PH / RINGS
  for (let ring = 0; ring < RINGS; ring++) {
    for (let sec = 0; sec < SECTORS; sec++) {
      let ok = 0
      let total = 0
      const y0 = Math.floor(ring * cellH)
      const y1 = Math.floor((ring + 1) * cellH)
      const x0 = Math.floor(sec * cellW)
      const x1 = Math.floor((sec + 1) * cellW)
      for (let y = y0; y < y1; y += 3) {
        for (let x = x0; x < x1; x += 3) {
          total++
          if (valid[y * PW + x]) ok++
        }
      }
      readability[ring][sec] = total ? ok / total : 0
    }
  }

  const unreadableCells: Array<{ sector: number; ring: number }> = []
  let readableCells = 0
  for (let ring = 0; ring < RINGS; ring++) {
    for (let sec = 0; sec < SECTORS; sec++) {
      if (readability[ring][sec] < UNREADABLE_THRESHOLD) {
        unreadableCells.push({ sector: sec + 1, ring })
      } else {
        readableCells++
      }
    }
  }
  const coverage = readableCells / (RINGS * SECTORS)

  // ── растеризация ─────────────────────────────────────────────────────────
  const rawCanvas = document.createElement('canvas')
  rawCanvas.width = PW
  rawCanvas.height = PH
  const rawCtx = rawCanvas.getContext('2d')!
  const imgData = rawCtx.createImageData(PW, PH)
  for (let i = 0; i < PW * PH; i++) {
    imgData.data[i * 4] = px[i * 3]
    imgData.data[i * 4 + 1] = px[i * 3 + 1]
    imgData.data[i * 4 + 2] = px[i * 3 + 2]
    imgData.data[i * 4 + 3] = 255
  }
  rawCtx.putImageData(imgData, 0, 0)
  const rawDataUrl = rawCanvas.toDataURL('image/jpeg', quality)

  const dataUrl = drawCalibrationGrid(rawCanvas, side, layer, readability, quality)

  return { dataUrl, rawDataUrl, readability, unreadableCells, coverage, side, layer }
}

/* ── мрежата ──────────────────────────────────────────────────────────────── */

// Отгоре: 2 реда заглавие + секторна лента. Отдолу: секторна лента + NASAL/TEMPORAL.
// Отляво: групи пръстени + R-етикети. Отдясно: R-етикети.
const PAD_TOP = 140
const PAD_BOTTOM = 116
const PAD_LEFT = 136
const PAD_RIGHT = 96

const LAYER_LABEL: Record<StripLayer, string> = {
  base: 'BASE / ОБЩ СЛОЙ',
  structure: 'STRUCTURE / СТРУКТУРЕН СЛОЙ',
  pigment: 'PIGMENT / ПИГМЕНТЕН СЛОЙ',
}

/**
 * Рисува калибрационната мрежа около разгънатата тъкан.
 * Всичко, което моделът трябва да прочете, е отпечатано ДВА пъти на
 * противоположни страни, за да няма нужда от броене на деления.
 */
function drawCalibrationGrid(
  plot: HTMLCanvasElement,
  side: Side,
  layer: StripLayer,
  readability: number[][],
  quality: number
): string {
  const PW = plot.width
  const PH = plot.height
  const W = PW + PAD_LEFT + PAD_RIGHT
  const H = PH + PAD_TOP + PAD_BOTTOM

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(plot, PAD_LEFT, PAD_TOP)

  const cellW = PW / SECTORS
  const cellH = PH / RINGS
  const xOf = (sec: number) => PAD_LEFT + sec * cellW
  const yOf = (ring: number) => PAD_TOP + ring * cellH

  // 1. ЗЕБРА по колони — визуална сегментация без броене
  ctx.save()
  for (let s = 0; s < SECTORS; s += 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.055)'
    ctx.fillRect(xOf(s), PAD_TOP, cellW, PH)
  }
  ctx.restore()

  // 2. Защриховка на нечетимите клетки
  ctx.save()
  ctx.beginPath()
  ctx.rect(PAD_LEFT, PAD_TOP, PW, PH)
  ctx.clip()
  for (let ring = 0; ring < RINGS; ring++) {
    for (let s = 0; s < SECTORS; s++) {
      if (readability[ring][s] >= UNREADABLE_THRESHOLD) continue
      const x = xOf(s)
      const y = yOf(ring)
      ctx.fillStyle = 'rgba(120,120,130,0.55)'
      ctx.fillRect(x, y, cellW, cellH)
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 2
      for (let k = -cellH; k < cellW; k += 14) {
        ctx.beginPath()
        ctx.moveTo(x + k, y + cellH)
        ctx.lineTo(x + k + cellH, y)
        ctx.stroke()
      }
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 15px "Arial", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('N/A', x + cellW / 2, y + cellH / 2)
    }
  }
  ctx.restore()

  // 3. Пръстенни линии — тънки
  ctx.strokeStyle = 'rgba(255,255,255,0.42)'
  ctx.lineWidth = 1
  for (let r = 1; r < RINGS; r++) {
    ctx.beginPath()
    ctx.moveTo(PAD_LEFT, yOf(r))
    ctx.lineTo(PAD_LEFT + PW, yOf(r))
    ctx.stroke()
  }

  // 4. Секторни линии — двойни (бяло + черно) за видимост върху всеки фон
  for (let s = 1; s < SECTORS; s++) {
    const x = xOf(s)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(x, PAD_TOP)
    ctx.lineTo(x, PAD_TOP + PH)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x, PAD_TOP)
    ctx.lineTo(x, PAD_TOP + PH)
    ctx.stroke()
  }

  // 5. Рамка
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 3
  ctx.strokeRect(PAD_LEFT, PAD_TOP, PW, PH)

  const sectors = sectorsFor(side)

  // 6. Горна и долна лента със СЕКТОРИ (номерът е отпечатан два пъти)
  const drawSectorBand = (bandY: number, bandH: number, showClock: boolean) => {
    for (let s = 0; s < SECTORS; s++) {
      const x = xOf(s)
      ctx.fillStyle = s % 2 === 0 ? '#eef2ff' : '#e0e7ff'
      ctx.fillRect(x, bandY, cellW, bandH)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.strokeRect(x, bandY, cellW, bandH)

      ctx.fillStyle = '#1e1b4b'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 40px "Arial", sans-serif'
      ctx.fillText(`S${s + 1}`, x + cellW / 2, bandY + bandH * (showClock ? 0.36 : 0.42))

      ctx.font = '17px "Arial", sans-serif'
      ctx.fillStyle = '#334155'
      if (showClock) {
        ctx.fillText(sectors[s].clock, x + cellW / 2, bandY + bandH * 0.74)
      } else {
        ctx.fillText(`${s * 5}–${(s + 1) * 5}′`, x + cellW / 2, bandY + bandH * 0.78)
      }
    }
  }
  drawSectorBand(PAD_TOP - 76, 72, true)
  drawSectorBand(PAD_TOP + PH + 6, 72, false)

  // 7. Ляво и дясно — ПРЪСТЕНИ (също два пъти)
  const drawRingLabel = (x: number, wBand: number, align: 'left' | 'right') => {
    for (let r = 0; r < RINGS; r++) {
      const y = yOf(r)
      ctx.fillStyle = r % 2 === 0 ? '#eef2ff' : '#e0e7ff'
      ctx.fillRect(x, y, wBand, cellH)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, wBand, cellH)
      ctx.fillStyle = '#1e1b4b'
      ctx.font = 'bold 30px "Arial", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`R${r}`, x + wBand / 2, y + cellH / 2)
    }
    void align
  }
  drawRingLabel(PAD_LEFT - 62, 58, 'right')
  drawRingLabel(PAD_LEFT + PW + 4, 58, 'left')

  // 8. Пръстенни групи (IPB / ANW / ORG / LYM / SCU) — най-вляво
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const band of RING_BANDS) {
    const y0 = yOf(band.rings[0])
    const y1 = yOf(band.rings[1] + 1)
    ctx.strokeStyle = '#1e1b4b'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD_LEFT - 70, y0 + 3)
    ctx.lineTo(PAD_LEFT - 70, y1 - 3)
    ctx.stroke()
    ctx.save()
    ctx.translate(PAD_LEFT - 88, (y0 + y1) / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = '#1e1b4b'
    // Едноредовите пояси имат само 60 px височина — шрифтът се свива, за да не
    // прелее върху съседния пояс.
    const singleRow = band.rings[0] === band.rings[1]
    ctx.font = `bold ${singleRow ? 15 : 20}px "Arial", sans-serif`
    ctx.fillText(band.key, 0, 0)
    ctx.restore()
  }

  // 9. Заглавие: коя страна, кой слой, къде е носът
  const eyeLabel = side === 'right' ? 'RIGHT EYE / ДЯСНО ОКО' : 'LEFT EYE / ЛЯВО ОКО'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 26px "Arial", sans-serif'
  ctx.fillText(eyeLabel, 10, 22)
  ctx.font = '18px "Arial", sans-serif'
  ctx.fillStyle = '#475569'
  ctx.fillText(LAYER_LABEL[layer], 10, 48)

  ctx.textAlign = 'right'
  ctx.font = '17px "Arial", sans-serif'
  ctx.fillStyle = '#475569'
  ctx.fillText('R0 = ръб на зеницата  ·  R11 = лимбус', W - 10, 22)
  ctx.fillText('S1 = 12–1 ч  ·  по часовниковата стрелка', W - 10, 46)

  // 10. NASAL / TEMPORAL маркери на долния ръб
  //     дясно око: носът е към 3:00 (S4);  ляво око: към 9:00 (S10)
  const nasalSector = side === 'right' ? 4 : 10
  const temporalSector = side === 'right' ? 10 : 4
  ctx.textAlign = 'center'
  ctx.font = 'bold 20px "Arial", sans-serif'
  ctx.fillStyle = '#b91c1c'
  ctx.fillText('▲ NASAL / КЪМ НОСА', xOf(nasalSector - 1) + cellW / 2, H - 20)
  ctx.fillStyle = '#334155'
  ctx.fillText('▲ TEMPORAL / КЪМ СЛЕПООЧИЕТО', xOf(temporalSector - 1) + cellW / 2, H - 20)

  return c.toDataURL('image/jpeg', quality)
}

/** Създава и трите слоя наведнъж от едно зареждане на изображението. */
export function unwrapAllLayers(
  img: HTMLImageElement | HTMLCanvasElement,
  geo: IrisGeometry,
  side: Side,
  options: Omit<UnwrapOptions, 'layer'> = {}
): Record<StripLayer, UnwrapResult> {
  return {
    base: unwrapIris(img, geo, side, { ...options, layer: 'base' }),
    structure: unwrapIris(img, geo, side, { ...options, layer: 'structure' }),
    pigment: unwrapIris(img, geo, side, { ...options, layer: 'pigment' }),
  }
}

/** Обвивка за data URL. */
export function unwrapFromDataUrl(
  dataUrl: string,
  geo: IrisGeometry,
  side: Side,
  options: UnwrapOptions = {}
): Promise<UnwrapResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        resolve(unwrapIris(img, geo, side, options))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Изображението не може да бъде заредено'))
    img.src = dataUrl
  })
}

/** Обвивка за data URL, връщаща и трите слоя от едно зареждане. */
export function unwrapAllFromDataUrl(
  dataUrl: string,
  geo: IrisGeometry,
  side: Side,
  options: Omit<UnwrapOptions, 'layer'> = {}
): Promise<Record<StripLayer, UnwrapResult>> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        resolve(unwrapAllLayers(img, geo, side, options))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Изображението не може да бъде заредено'))
    img.src = dataUrl
  })
}
