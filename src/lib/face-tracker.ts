/**
 * face-tracker.ts — намиране на очите на живо с AI модел (MediaPipe Face Landmarker).
 *
 * Класическият детектор (`iris-geometry.ts`) е направен за снимка, на която
 * окото вече е в средата и заема голяма част от кадъра. В живия кадър от
 * телефона окото е малко, извън центъра и наоколо има лице, вежди и фон —
 * там той не намира нищо. Моделът намира лицето и дава 478 точки, сред които
 * центъра и ръба на всеки ирис и клепачите. Работи в браузъра, на телефона,
 * 20–30 кадъра в секунда.
 *
 * Моделът и WASM файловете се зареждат при отваряне на камерата, не с
 * приложението. Ако не се заредят (няма мрежа), камерата продължава с
 * класическия детектор.
 */

import type { FaceLandmarker } from '@mediapipe/tasks-vision'

const VERSION = '0.10.21'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

/** Индекси на точките в модела: център + 4 точки по ръба на всеки ирис. */
const IRIS_A = [468, 469, 470, 471, 472]
const IRIS_B = [473, 474, 475, 476, 477]
/** Горен и долен клепач над/под центъра — за двете очи. */
const LIDS = [
  { upper: 159, lower: 145 },
  { upper: 386, lower: 374 },
]

export interface TrackedIris {
  /** Кое око на човека: задната камера го гледа, затова лявото в кадъра е ДЯСНОТО му. */
  side: 'left' | 'right'
  /** Пиксели на видеото. */
  cx: number
  cy: number
  r: number
  /** Разстояние между клепачите / диаметър на ириса; под ~0.7 окото е притворено. */
  openness: number
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

/** Ирисите в текущия кадър; празен списък, ако няма лице. */
export function trackIrises(model: FaceLandmarker, video: HTMLVideoElement, timestamp: number): TrackedIris[] {
  const vw = video.videoWidth
  const vh = video.videoHeight
  let result
  try {
    result = model.detectForVideo(video, timestamp)
  } catch {
    return []
  }
  const pts = result.faceLandmarks?.[0]
  if (!pts || pts.length < 478) return []

  const px = (i: number) => ({ x: pts[i].x * vw, y: pts[i].y * vh })
  const lids = LIDS.map(l => ({ x: px(l.upper).x, gap: Math.hypot(px(l.upper).x - px(l.lower).x, px(l.upper).y - px(l.lower).y) }))

  const irises = [IRIS_A, IRIS_B].map(idx => {
    const c = px(idx[0])
    const r = idx.slice(1).reduce((s, i) => s + Math.hypot(px(i).x - c.x, px(i).y - c.y), 0) / 4
    // Клепачите се свързват с ириса по близост, а не по номерацията на модела.
    const lid = lids.reduce((a, b) => (Math.abs(b.x - c.x) < Math.abs(a.x - c.x) ? b : a))
    return { cx: c.x, cy: c.y, r, openness: r > 0 ? lid.gap / (2 * r) : 0 }
  })
  irises.sort((a, b) => a.cx - b.cx)
  return [
    { side: 'right', ...irises[0] },
    { side: 'left', ...irises[1] },
  ]
}
