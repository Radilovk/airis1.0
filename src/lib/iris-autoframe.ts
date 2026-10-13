/**
 * iris-autoframe.ts — автоматично центриране и изрязване на окото.
 *
 * Досега след всяко качване се отваряше ръчен редактор (местене, мащаб,
 * завъртане), а след него — калибраторът. Две ръчни стъпки на око. Тук окото
 * се намира с кода от `iris-geometry.ts` и, ако откриването е уверено, снимката
 * се изрязва квадратно около ириса с поле за склерата и клепачите. Тогава
 * ръчният редактор се прескача и човек вижда директно калибратора с готови
 * кръгове — обикновено остава само „Потвърди".
 *
 * При несигурно откриване функцията връща null и потокът пада обратно към
 * ръчния редактор, тоест нищо не се губи.
 */
import { detectIrisGeometry } from './iris-geometry'

/** Под тази увереност не режем автоматично — по-добре ръчно, отколкото грешно. */
export const AUTOFRAME_MIN_CONFIDENCE = 0.45

/** Квадратът е 2×радиус×този коефициент: оставя склера за очния скрининг. */
const FRAME_MARGIN = 1.75

export interface AutoFrameResult {
  dataUrl: string
  confidence: number
}

function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

export async function autoFrameIris(dataUrl: string, maxSide = 1600): Promise<AutoFrameResult | null> {
  const img = await loadImage(dataUrl)
  if (!img) return null
  const W = img.naturalWidth
  const H = img.naturalHeight
  if (!W || !H) return null

  const geo = detectIrisGeometry(img)
  const confidence = Math.min(geo.pupilConfidence, geo.limbusConfidence)
  if (confidence < AUTOFRAME_MIN_CONFIDENCE) return null

  const r = geo.limbus.r
  // Ирис, по-малък от 6 % от кадъра, е снимка от твърде далеч — изрязването би
  // дало размазана картинка. Тогава човекът трябва да реши сам.
  if (r < Math.min(W, H) * 0.06) return null
  // Ирисът трябва да е изцяло в кадъра (с малък толеранс за клепачите).
  const tol = r * 0.08
  if (geo.limbus.cx - r < -tol || geo.limbus.cy - r < -tol || geo.limbus.cx + r > W + tol || geo.limbus.cy + r > H + tol) {
    return null
  }

  const side = Math.min(Math.max(W, H), Math.round(2 * r * FRAME_MARGIN))
  let sx = Math.round(geo.limbus.cx - side / 2)
  let sy = Math.round(geo.limbus.cy - side / 2)
  // Квадратът се плъзга навътре, вместо да излиза извън снимката; ако снимката
  // е по-тясна от квадрата, остатъкът става черно поле, а окото остава в центъра.
  sx = Math.max(Math.min(sx, W - side), Math.min(0, sx))
  sy = Math.max(Math.min(sy, H - side), Math.min(0, sy))

  const out = Math.min(side, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, out, out)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), confidence }
}
