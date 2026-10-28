/**
 * eye-crop.ts — от снимка на лицето/двете очи към отделни снимки на ирис.
 *
 * Изрязването е от оригиналната снимка, без смаляване: от 12 MP кадър окото
 * излиза с всичките си пиксели. (Досега снимката първо се смаляваше до
 * 1600 px и чак после се търсеше окото — от снимка на лицето оставаха няколко
 * десетки пиксела ирис.)
 */
import { findIrisesInPhoto } from './face-tracker'

/** Квадратът е 2r × това — остава склера и клепачи за очния скрининг. */
const CROP_FACTOR = 2.8

export interface CroppedEye {
  side: 'left' | 'right'
  dataUrl: string
  file: File
  /** Диаметър на ириса в пиксели — под ~300 детайлите са малко. */
  irisPx: number
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** null — на снимката няма лице (обикновено: окото е снимано отблизо). */
export async function cropEyesFromPhoto(dataUrl: string): Promise<CroppedEye[] | null> {
  const img = await loadImage(dataUrl)
  if (!img) return null
  const irises = await findIrisesInPhoto(img)
  if (!irises?.length) return null

  const out: CroppedEye[] = []
  for (const iris of irises) {
    const side = Math.min(img.naturalWidth, img.naturalHeight, Math.round(iris.r * 2 * CROP_FACTOR))
    const x = Math.max(0, Math.min(img.naturalWidth - side, iris.cx - side / 2))
    const y = Math.max(0, Math.min(img.naturalHeight - side, iris.cy - side / 2))
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, x, y, side, side, 0, 0, side, side)
    const cropUrl = canvas.toDataURL('image/jpeg', 0.95)
    const blob = await (await fetch(cropUrl)).blob()
    out.push({
      side: iris.side,
      dataUrl: cropUrl,
      file: new File([blob], `iris-${iris.side}.jpg`, { type: 'image/jpeg' }),
      irisPx: Math.round(2 * iris.r),
    })
  }
  return out.length ? out : null
}
