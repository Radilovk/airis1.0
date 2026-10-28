/**
 * face-tracker.ts — намиране на очите в готова снимка с AI модел
 * (MediaPipe Face Landmarker).
 *
 * Класическият детектор (`iris-geometry.ts`) е направен за снимка отблизо, на
 * която окото е в средата. Ако човек снима цялото лице или двете очи, той не
 * намира нищо. Моделът намира лицето и дава 478 точки, сред които центъра и
 * ръба на всеки ирис. Тогава всяко око се изрязва от снимката в ПЪЛНАТА ѝ
 * резолюция — една снимка на двете очи дава две снимки на ирис.
 *
 * Моделът (~4 MB) и WASM се зареждат при отваряне на екрана за снимки, не с
 * приложението. Без мрежа просто не се ползва — остава класическият детектор.
 */

import type { FaceLandmarker } from '@mediapipe/tasks-vision'

const VERSION = '0.10.21'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

/** Индекси на точките в модела: център + 4 точки по ръба на всеки ирис. */
const IRIS_A = [468, 469, 470, 471, 472]
const IRIS_B = [473, 474, 475, 476, 477]

/** Моделът работи на смалено копие; позициите се връщат към оригинала. */
const MODEL_SIDE = 1280
/**
 * Над този размер (диаметър / къса страна) окото е снимано отблизо — тогава
 * класическият детектор е по-точен, а моделът може да „види“ лице, което го няма.
 */
const MAX_FACE_IRIS = 0.22

export interface FoundIris {
  /** Кое око на човека: снимката е от задната камера, лявото в кадъра е ДЯСНОТО му. */
  side: 'left' | 'right'
  /** Пиксели на оригиналната снимка. */
  cx: number
  cy: number
  r: number
}

let loading: Promise<FaceLandmarker | null> | null = null

/** Зарежда модела веднъж за сесията; връща null, ако не може. */
export function loadFaceTracker(): Promise<FaceLandmarker | null> {
  if (!loading) {
    loading = (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
        const make = (delegate: 'GPU' | 'CPU') =>
          FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: 'IMAGE',
            numFaces: 1,
            minFaceDetectionConfidence: 0.4,
            minFacePresenceConfidence: 0.4,
          })
        // GPU е многократно по-бърз, но не върви на всеки телефон.
        return await make('GPU').catch(() => make('CPU'))
      } catch {
        loading = null
        return null
      }
    })()
  }
  return loading
}

/**
 * Ирисите на лице в снимката. Връща null, ако няма лице, ако окото е снимано
 * отблизо (тогава е за класическия детектор) или ако моделът не е зареден.
 */
export async function findIrisesInPhoto(img: HTMLImageElement | ImageBitmap): Promise<FoundIris[] | null> {
  const model = await loadFaceTracker()
  if (!model) return null
  const W = img.width
  const H = img.height
  const k = Math.min(1, MODEL_SIDE / Math.max(W, H))
  const small = document.createElement('canvas')
  small.width = Math.round(W * k)
  small.height = Math.round(H * k)
  small.getContext('2d')!.drawImage(img, 0, 0, small.width, small.height)

  let pts
  try {
    pts = model.detect(small).faceLandmarks?.[0]
  } catch {
    return null
  }
  if (!pts || pts.length < 478) return null

  const at = (i: number) => ({ x: pts[i].x * W, y: pts[i].y * H })
  const irises = [IRIS_A, IRIS_B].map(idx => {
    const c = at(idx[0])
    const r = idx.slice(1).reduce((s, i) => s + Math.hypot(at(i).x - c.x, at(i).y - c.y), 0) / 4
    return { cx: c.x, cy: c.y, r }
  })
  const short = Math.min(W, H)
  if (irises.some(i => (2 * i.r) / short > MAX_FACE_IRIS || i.r < 4)) return null
  irises.sort((a, b) => a.cx - b.cx)
  return [
    { side: 'right' as const, ...irises[0] },
    { side: 'left' as const, ...irises[1] },
    // Око, отрязано от ръба на снимката, не става за анализ.
  ].filter(i => i.cx - i.r >= 0 && i.cy - i.r >= 0 && i.cx + i.r <= W && i.cy + i.r <= H)
}
