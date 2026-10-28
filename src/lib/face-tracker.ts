/**
 * face-tracker.ts — намиране на очите на живо с AI модел (MediaPipe Face Landmarker).
 *
 * Класическият детектор (`iris-geometry.ts`) е направен за снимка, на която
 * окото вече е в средата и заема голяма част от кадъра. В живия кадър от
 * телефона окото е малко, извън центъра и наоколо има лице, вежди и фон —
 * там той не намира нищо. Моделът намира лицето и дава 478 точки, сред които
 * центъра и ръба на всеки ирис, клепачите и ъглите на очите. Работи в
 * браузъра, на телефона, 20–30 кадъра в секунда.
 *
 * Моделът и WASM файловете се зареждат при отваряне на екрана за снимки, не
 * с приложението. Ако не се заредят (няма мрежа), камерата продължава с
 * класическия детектор.
 */

import type { FaceLandmarker } from '@mediapipe/tasks-vision'

const VERSION = '0.10.21'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

/** Индекси на точките в модела: център + 4 точки по ръба на всеки ирис. */
const IRIS_A = [468, 469, 470, 471, 472]
const IRIS_B = [473, 474, 475, 476, 477]
/** Клепачите над/под центъра и двата ъгъла — за двете очи. */
const EYES = [
  { upper: 159, lower: 145, cornerA: 33, cornerB: 133 },
  { upper: 386, lower: 374, cornerA: 362, cornerB: 263 },
]

export interface TrackedIris {
  /** Кое око на човека: задната камера го гледа, затова лявото в кадъра е ДЯСНОТО му. */
  side: 'left' | 'right'
  /** Пиксели на изображението. */
  cx: number
  cy: number
  r: number
  /** Каква част от диаметъра на ириса крие горният / долният клепач (0 = нищо). */
  topCover: number
  bottomCover: number
  /**
   * Къде е ирисът между ъглите на окото, 0..1; 0.5 = гледа право. Като човек
   * гледа екрана вместо обектива, ирисът се измества.
   */
  gaze: number
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
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: 0.4,
            minFacePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
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
 * Ирисите в изображението; празен списък, ако няма лице. Работи и върху
 * видео кадър, и върху готова снимка (canvas) — моделът е в режим VIDEO,
 * затова времето трябва да расте.
 */
export function trackIrises(
  model: FaceLandmarker,
  source: HTMLVideoElement | HTMLCanvasElement,
  width: number,
  height: number,
  timestamp: number
): TrackedIris[] {
  let result
  try {
    result = model.detectForVideo(source, timestamp)
  } catch {
    return []
  }
  const pts = result.faceLandmarks?.[0]
  if (!pts || pts.length < 478) return []

  const px = (i: number) => ({ x: pts[i].x * width, y: pts[i].y * height })
  const eyes = EYES.map(e => ({ upper: px(e.upper), lower: px(e.lower), a: px(e.cornerA), b: px(e.cornerB) }))

  const irises = [IRIS_A, IRIS_B].map(idx => {
    const c = px(idx[0])
    const r = idx.slice(1).reduce((s, i) => s + Math.hypot(px(i).x - c.x, px(i).y - c.y), 0) / 4
    // Клепачите и ъглите се свързват с ириса по близост, а не по номерацията на модела.
    const eye = eyes.reduce((p, q) => (Math.abs(q.upper.x - c.x) < Math.abs(p.upper.x - c.x) ? q : p))
    const d = Math.max(1, 2 * r)
    const left = Math.min(eye.a.x, eye.b.x)
    const span = Math.max(1, Math.abs(eye.a.x - eye.b.x))
    return {
      cx: c.x,
      cy: c.y,
      r,
      topCover: Math.max(0, (eye.upper.y - (c.y - r)) / d),
      bottomCover: Math.max(0, (c.y + r - eye.lower.y) / d),
      gaze: (c.x - left) / span,
    }
  })
  irises.sort((a, b) => a.cx - b.cx)
  return [
    { side: 'right', ...irises[0] },
    { side: 'left', ...irises[1] },
  ]
}
