import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Eye, FlipHorizontal, Lightning, LightningSlash, SpeakerHigh, SpeakerSlash, X } from '@phosphor-icons/react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { detectIrisGeometry } from '@/lib/iris-geometry'
import { loadFaceTracker, trackIrises } from '@/lib/face-tracker'
import {
  CaptureGate,
  HINT_TEXT,
  HINT_WHY,
  TARGET_BOTH,
  TARGET_SINGLE,
  irisSharpness,
  type CaptureHint,
  type CaptureState,
} from '@/lib/live-capture'

type Side = 'left' | 'right'
type Mode = 'single' | 'both'

export interface LiveCapture {
  side: Side
  file: File
}

interface LiveIrisCameraProps {
  /** С кое око да започне в режим „по едно“. */
  startSide: Side
  /** Очите, които още нямат снимка — след едното камерата минава сама на другото. */
  missing: Side[]
  onDone: (captures: LiveCapture[]) => void
  onClose: () => void
}

/** Класическият детектор работи на квадрат с тази страна. */
const ANALYSIS_SIDE = 320
/** Пауза между два анализа: AI моделът върви 20–30 кадъра/s, но 12 стигат. */
const TICK_MS = 80
/**
 * Максимална страна на снимката от сензора, която държим в паметта. Записват
 * се само изрязаните очи, така че 10 MB лимитът на качването не е проблем.
 */
const MAX_PHOTO_SIDE = 6000
/** Изрязването около окото: 2r × това — остава склера и клепачи за очния скрининг. */
const CROP_FACTOR = 2.8
/** Колко дълго следим окото без AI (лицето е излязло от кадъра) преди да го изгубим. */
const ROI_MEMORY_MS = 1500

const SIDE_LABEL: Record<Side, string> = { left: 'Ляво око', right: 'Дясно око' }

/* ── звук, вибрация, глас ─────────────────────────────────────────────────── */

/* ── звук, вибрация, глас ─────────────────────────────────────────────────── */

/**
 * Като паркинг сензор: колкото по-близо до добра снимка, толкова по-чести и
 * по-високи сигналите. Така човек снима и без да вижда екрана.
 */
class Feedback {
  private ctx: AudioContext | null = null
  private nextBeep = 0
  private lastSpoken: { hint: CaptureHint | null; at: number } = { hint: null, at: 0 }
  private voice: SpeechSynthesisVoice | null = null
  sound = true
  speech = true

  /** Извиква се от докосване — иначе браузърът не пуска звук. */
  unlock() {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = this.ctx || new AC()
      void this.ctx.resume()
    } catch {
      this.ctx = null
    }
    const pickVoice = () => {
      this.voice = window.speechSynthesis?.getVoices().find(v => v.lang.toLowerCase().startsWith('bg')) || null
    }
    pickVoice()
    window.speechSynthesis?.addEventListener?.('voiceschanged', pickVoice)
  }

  private tone(freq: number, ms: number, gain = 0.18, at = 0) {
    if (!this.sound || !this.ctx) return
    const t = this.ctx.currentTime + at
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    osc.connect(g).connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + ms / 1000 + 0.02)
  }

  tick(state: CaptureState, now: number) {
    if (now < this.nextBeep) return
    if (state.hint === 'search') {
      // Тих рядък сигнал: „работя, търся“ — за да не мисли човек, че е замръзнало.
      this.tone(420, 60, 0.06)
      this.nextBeep = now + 1400
      return
    }
    this.tone(560 + 640 * state.score, 70)
    this.nextBeep = now + Math.max(110, 900 - 780 * state.score)
  }

  say(text: string, hint: CaptureHint | null, now: number, force = false) {
    if (!this.speech || !window.speechSynthesis || !this.voice) return
    if (!force && (hint === this.lastSpoken.hint || now - this.lastSpoken.at < 2500)) return
    this.lastSpoken = { hint, at: now }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.voice = this.voice
    u.lang = this.voice.lang
    u.rate = 1.1
    window.speechSynthesis.speak(u)
  }

  shutter() {
    this.tone(1320, 90, 0.25)
    this.tone(1760, 140, 0.25, 0.1)
    navigator.vibrate?.([60, 40, 60])
  }

  close() {
    window.speechSynthesis?.cancel()
    void this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}

/* ── следене на окото ─────────────────────────────────────────────────────── */

interface EyeFix {
  cx: number
  cy: number
  r: number
  topCover?: number
  bottomCover?: number
  gaze?: number
  t: number
}

type Source = HTMLVideoElement | HTMLCanvasElement

const sizeOf = (src: Source) =>
  src instanceof HTMLVideoElement ? { w: src.videoWidth, h: src.videoHeight } : { w: src.width, h: src.height }

/**
 * Класическият детектор върху квадрат около очакваната позиция на окото.
 * Така окото се следи и когато телефонът е толкова близо, че лицето вече не
 * е в кадъра и AI моделът го губи. Квадратът е `span`·r (5–6) — ирисът е в
 * средата му и заема размера, за който детекторът е направен.
 */
function trackNear(src: Source, last: { cx: number; cy: number; r: number }, work: HTMLCanvasElement, span = 5): EyeFix | null {
  const { w, h } = sizeOf(src)
  const side = Math.min(span * last.r, w, h)
  const x = Math.max(0, Math.min(w - side, last.cx - side / 2))
  const y = Math.max(0, Math.min(h - side, last.cy - side / 2))
  return detectIn(src, x, y, side, work, last.r)
}

/** Без AI модел: търсим ирис в централния квадрат (окото трябва да е в средата). */
function detectCenter(video: HTMLVideoElement, work: HTMLCanvasElement): EyeFix | null {
  const side = Math.min(video.videoWidth, video.videoHeight)
  return detectIn(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, work)
}

function detectIn(src: Source, x: number, y: number, side: number, work: HTMLCanvasElement, expectR?: number): EyeFix | null {
  if (side < 40) return null
  work.width = ANALYSIS_SIDE
  work.height = ANALYSIS_SIDE
  work.getContext('2d')!.drawImage(src, x, y, side, side, 0, 0, ANALYSIS_SIDE, ANALYSIS_SIDE)
  const geo = detectIrisGeometry(work)
  if (geo.pupilConfidence < 0.35 || geo.limbusConfidence < 0.12) return null
  const k = side / ANALYSIS_SIDE
  const r = geo.limbus.r * k
  if (expectR && (r < expectR * 0.6 || r > expectR * 1.6)) return null
  // Клепачите от детектора — за подсказките и когато AI моделът е изгубил лицето.
  const { cx, cy, r: rw } = geo.limbus
  const lidY = (q: [number, number, number] | null | undefined) => (q ? q[0] * cx * cx + q[1] * cx + q[2] : null)
  const up = lidY(geo.eyelids?.upper)
  const down = lidY(geo.eyelids?.lower)
  return {
    cx: x + cx * k,
    cy: y + cy * k,
    r,
    topCover: up === null ? 0 : Math.max(0, (up - (cy - rw)) / (2 * rw)),
    bottomCover: down === null ? 0 : Math.max(0, (cy + rw - down) / (2 * rw)),
    t: performance.now(),
  }
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise(resolve =>
    canvas.toBlob(b => resolve(b ? new File([b], name, { type: 'image/jpeg' }) : null), 'image/jpeg', 0.95)
  )
}

/* ── снимката ─────────────────────────────────────────────────────────────── */

interface Eye {
  cx: number
  cy: number
  r: number
}

interface Still {
  canvas: HTMLCanvasElement
  /** Очите в координатите на тази снимка. */
  eyes: Eye[]
  /** Най-слабата рязкост сред очите — мярка, независима от резолюцията. */
  sharpness: number
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function sharpnessOf(canvas: HTMLCanvasElement, eyes: Eye[]): number {
  const tmp = document.createElement('canvas')
  return Math.min(...eyes.map(e => irisSharpness(canvas, e.cx, e.cy, e.r, tmp)))
}

/**
 * Серия от няколко кадъра от видеото — взема се най-рязкият. Един кадър често
 * е размазан от трептене на ръката; от пет поне един е чист.
 */
async function burstBest(video: HTMLVideoElement, eyes: Eye[], frames = 6, gapMs = 50): Promise<Still> {
  let best: Still | null = null
  for (let i = 0; i < frames; i++) {
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    c.getContext('2d')!.drawImage(video, 0, 0)
    const sharpness = sharpnessOf(c, eyes)
    if (!best || sharpness > best.sharpness) best = { canvas: c, eyes, sharpness }
    if (i < frames - 1) await sleep(gapMs)
  }
  return best!
}

type ImageCaptureLike = {
  takePhoto: (settings?: { imageWidth?: number; imageHeight?: number }) => Promise<Blob>
  getPhotoCapabilities?: () => Promise<{ imageWidth?: { max?: number }; imageHeight?: { max?: number } }>
}

/**
 * Истинска снимка от сензора (ImageCapture — Chrome за Android) в най-високата
 * резолюция, която телефонът дава. Тя е 4:3, а видеото често 16:9, затова
 * очите се търсят наново в самата снимка: първо с AI модела, после с
 * класическия детектор около мястото, където трябва да са.
 */
async function sensorPhoto(
  track: MediaStreamTrack | null,
  video: HTMLVideoElement,
  eyes: Eye[],
  findInImage: (c: HTMLCanvasElement) => Eye[] | null
): Promise<Still | null> {
  const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture
  if (!IC || !track) return null
  try {
    const ic = new IC(track)
    const caps = await ic.getPhotoCapabilities?.().catch(() => null)
    const settings = caps?.imageWidth?.max ? { imageWidth: caps.imageWidth.max, imageHeight: caps.imageHeight?.max } : undefined
    const blob = await Promise.race([ic.takePhoto(settings), sleep(3500).then(() => Promise.reject(new Error('timeout')))])
    const bmp = await createImageBitmap(blob)
    const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * k)
    canvas.height = Math.round(bmp.height * k)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()

    let found = findInImage(canvas)
    if (!found) {
      // Видеото е изрязано от средата на кадъра на сензора — пренасяме позициите така.
      const vw = video.videoWidth
      const vh = video.videoHeight
      const scale = canvas.width / canvas.height > vw / vh ? canvas.height / vh : canvas.width / vw
      const ox = (canvas.width - vw * scale) / 2
      const oy = (canvas.height - vh * scale) / 2
      const work = document.createElement('canvas')
      const refined = eyes.map(e => trackNear(canvas, { cx: ox + e.cx * scale, cy: oy + e.cy * scale, r: e.r * scale }, work, 6))
      if (refined.some(e => !e)) return null
      found = refined as Eye[]
    }
    return { canvas, eyes: found, sharpness: sharpnessOf(canvas, found) }
  } catch {
    return null
  }
}

/** Квадрат около окото: 2r × CROP_FACTOR — остава склера и клепачи за очния скрининг. */
function cropEye(still: HTMLCanvasElement, eye: Eye): HTMLCanvasElement {
  const side = Math.min(still.width, still.height, eye.r * 2 * CROP_FACTOR)
  const x = Math.max(0, Math.min(still.width - side, eye.cx - side / 2))
  const y = Math.max(0, Math.min(still.height - side, eye.cy - side / 2))
  const out = document.createElement('canvas')
  out.width = Math.round(side)
  out.height = out.width
  out.getContext('2d')!.drawImage(still, x, y, side, side, 0, 0, out.width, out.height)
  return out
}

/** Ръчна снимка без открито око: средата (едно око) или двете половини (две очи). */
function fallbackEye(side: Side, mode: Mode, vw: number, vh: number): Eye {
  const short = Math.min(vw, vh)
  if (mode === 'single') return { cx: vw / 2, cy: vh / 2, r: short / (2 * CROP_FACTOR) }
  const r = Math.min(vw / 2, vh) / (2 * CROP_FACTOR)
  return { cx: side === 'right' ? vw / 4 : (3 * vw) / 4, cy: vh / 2, r }
}

/* ── компонент ────────────────────────────────────────────────────────────── */

type AiState = 'loading' | 'ready' | 'off'

export default function LiveIrisCamera({ startSide, missing, onDone, onClose }: LiveIrisCameraProps) {
  const [phase, setPhase] = useState<'intro' | 'live' | 'error'>('intro')
  const [error, setError] = useState('')
  // По едно око е по подразбиране: окото е по-едро в кадъра — повече детайли.
  const [mode, setMode] = useState<Mode>('single')
  const [side, setSide] = useState<Side>(startSide)
  const [mirror, setMirror] = useState(false)
  const [sound, setSound] = useState(true)
  const [torch, setTorch] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [ai, setAi] = useState<AiState>('loading')
  const [state, setState] = useState<CaptureState>({ score: 0, hint: 'search', ready: false })
  const [rings, setRings] = useState<{ x: number; y: number; r: number }[]>([])
  const [flash, setFlash] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const modelRef = useRef<FaceLandmarker | null>(null)
  const feedbackRef = useRef(new Feedback())
  const gatesRef = useRef<Record<Side, CaptureGate>>({ left: new CaptureGate(TARGET_SINGLE), right: new CaptureGate(TARGET_SINGLE) })
  /** MediaPipe иска строго растящи времена — общо за видеото и за снимката. */
  const lastTsRef = useRef(0)
  const nextTs = () => (lastTsRef.current = Math.max(performance.now(), lastTsRef.current + 1))
  /** Дали вече сме казали „Гледайте в обектива“ за това око. */
  const greetedRef = useRef(false)
  const fixRef = useRef<Record<Side, EyeFix | null>>({ left: null, right: null })
  const capturesRef = useRef<LiveCapture[]>([])
  const rotationRef = useRef<number | undefined>(undefined)
  const capturingRef = useRef(false)
  const modeRef = useRef(mode)
  const sideRef = useRef(side)
  modeRef.current = mode
  sideRef.current = side

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    feedbackRef.current.close()
  }, [])

  useEffect(() => stop, [stop])

  useEffect(() => {
    feedbackRef.current.sound = sound
    feedbackRef.current.speech = sound
  }, [sound])

  // AI моделът се тегли още докато човек чете началния екран.
  useEffect(() => {
    let alive = true
    loadFaceTracker().then(m => {
      if (!alive) return
      modelRef.current = m
      setAi(m ? 'ready' : 'off')
    })
    return () => {
      alive = false
    }
  }, [])

  const track = () => streamRef.current?.getVideoTracks()[0] ?? null

  const applyTorch = async (on: boolean) => {
    const t = track()
    if (!t) return
    try {
      await t.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      setTorch(on)
    } catch {
      setTorch(false)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    const target = m === 'both' ? TARGET_BOTH : TARGET_SINGLE
    gatesRef.current.left.setTarget(target)
    gatesRef.current.right.setTarget(target)
  }

  const start = async () => {
    // Всичко, което иска докосване (звук, жироскоп на iPhone), става тук.
    feedbackRef.current.unlock()
    switchMode(modeRef.current)
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
    try {
      if (DME?.requestPermission) await DME.requestPermission()
    } catch {
      /* без жироскоп — стабилността се мери само по кадрите */
    }
    try {
      // 4:3 е целият сензор; 16:9 го реже отгоре и отдолу. Искаме възможно
      // най-много пиксели — от тях зависи колко детайл има в ириса.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 4032 }, height: { ideal: 3024 } },
      })
      streamRef.current = stream
      const t = stream.getVideoTracks()[0]
      const caps = (t.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean
        zoom?: { min: number; max: number }
        focusMode?: string[]
      }
      // Някои телефони дават по-малко, отколкото могат, докато не ги помолиш изрично.
      const maxW = caps.width?.max ?? 0
      const maxH = caps.height?.max ?? 0
      const s = t.getSettings()
      if (maxW * maxH > (s.width ?? 0) * (s.height ?? 0)) {
        const k = Math.min(1, 4096 / Math.max(maxW, maxH))
        await t.applyConstraints({ width: { ideal: Math.round(maxW * k) }, height: { ideal: Math.round(maxH * k) } }).catch(() => {})
      }
      const advanced: Record<string, unknown>[] = []
      if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' })
      // Без цифрово увеличение: то само реже кадъра и губи пиксели.
      if (caps.zoom) advanced.push({ zoom: Math.max(caps.zoom.min, Math.min(caps.zoom.max, 1)) })
      if (advanced.length) await t.applyConstraints({ advanced: advanced as MediaTrackConstraintSet[] }).catch(() => {})
      setTorchSupported(!!caps.torch)
      setPhase('live')
      if (caps.torch) {
        try {
          await t.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] })
          setTorch(true)
        } catch {
          /* без светкавица */
        }
      }
      feedbackRef.current.say(modeRef.current === 'single' ? `${SIDE_LABEL[sideRef.current]}.` : 'Насочете камерата към лицето.', null, performance.now(), true)
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Нямаме достъп до камерата. Разрешете го от настройките на браузъра или снимайте с камерата на телефона.'
          : 'Камерата не може да се включи на това устройство. Снимайте с камерата на телефона.'
      )
      setPhase('error')
    }
  }

  // Жироскоп: ако телефонът се върти, снимката ще е размазана, колкото и да е рязък кадърът.
  useEffect(() => {
    if (phase !== 'live') return
    const onMotion = (e: DeviceMotionEvent) => {
      const r = e.rotationRate
      if (!r) return
      const v = Math.hypot(r.alpha ?? 0, r.beta ?? 0, r.gamma ?? 0)
      rotationRef.current = rotationRef.current === undefined ? v : rotationRef.current * 0.6 + v * 0.4
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [phase])

  useEffect(() => {
    const v = videoRef.current
    if (phase === 'live' && v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current
      void v.play().catch(() => {})
    }
  }, [phase])

  const hintText = (h: CaptureHint) => (h === 'search' && modeRef.current === 'single' ? 'Търся окото' : HINT_TEXT[h])

  const sidesNow = (): Side[] => (modeRef.current === 'both' ? ['right', 'left'] : [sideRef.current])

  const capture = useCallback(
    async (sides: Side[]) => {
      const video = videoRef.current
      if (!video || capturingRef.current) return
      capturingRef.current = true
      setBusy(true)
      feedbackRef.current.shutter()
      setFlash(true)
      setTimeout(() => setFlash(false), 180)
      try {
        const vw = video.videoWidth
        const vh = video.videoHeight
        // Позициите се вземат ПРЕДИ снимката — тя може да отнеме секунда.
        const eyes = sides.map(s => fixRef.current[s] ?? fallbackEye(s, modeRef.current, vw, vh))
        // 1) Най-рязкият от серия видео кадри — винаги го има.
        let still = await burstBest(video, eyes)
        // 2) Истинска снимка от сензора, ако браузърът я дава. Тя е с много
        //    повече пиксели; взема се, освен ако не е явно по-размазана.
        const model = modelRef.current
        const photo = await sensorPhoto(track(), video, eyes, c => {
          if (!model) return null
          const found = trackIrises(model, c, c.width, c.height, nextTs())
          const bySide = sides.map(s => found.find(f => f.side === s))
          return bySide.every(Boolean) ? (bySide as Eye[]) : null
        })
        if (photo && photo.sharpness >= still.sharpness * 0.7) still = photo
        for (let i = 0; i < sides.length; i++) {
          const file = await canvasToFile(cropEye(still.canvas, still.eyes[i]), `iris-${sides[i]}-${Date.now()}.jpg`)
          if (file) capturesRef.current = [...capturesRef.current.filter(c => c.side !== sides[i]), { side: sides[i], file }]
        }
        const have = new Set(capturesRef.current.map(c => c.side))
        const next = missing.find(s => !have.has(s))
        if (next) {
          // Едното око е готово — минаваме на другото, без да затваряме камерата.
          gatesRef.current[next].reset()
          fixRef.current[next] = null
          greetedRef.current = false
          setMode('single')
          setSide(next)
          const msg = `Готово. Сега ${next === 'left' ? 'лявото' : 'дясното'} око.`
          setBanner(msg)
          feedbackRef.current.say(msg, null, performance.now(), true)
          setTimeout(() => setBanner(null), 2200)
          // Кратка пауза: човекът трябва да премести телефона, преди да търсим пак.
          await new Promise(r => setTimeout(r, 1500))
        } else {
          feedbackRef.current.say('Готово.', null, performance.now(), true)
          stop()
          onDone(capturesRef.current)
          return
        }
      } finally {
        capturingRef.current = false
        setBusy(false)
      }
    },
    [missing, onDone, stop]
  )

  /**
   * Видео пиксели → екран. Видеото е `object-contain`: кадърът е 4:3, а
   * екранът — тесен; при `cover` страните се режеха и окото, което камерата
   * вижда, можеше да е извън екрана.
   */
  const toScreen = (vw: number, vh: number) => {
    const box = boxRef.current
    if (!box) return null
    const { width: bw, height: bh } = box.getBoundingClientRect()
    const k = Math.min(bw / vw, bh / vh)
    const ox = (bw - vw * k) / 2
    const oy = (bh - vh * k) / 2
    return (e: { cx: number; cy: number; r: number }) => ({ x: ox + e.cx * k, y: oy + e.cy * k, r: e.r * k })
  }

  // Цикълът: кадър → AI (или класически детектор около последната позиция) →
  // рязкост → решение.
  useEffect(() => {
    if (phase !== 'live') return
    const work = document.createElement('canvas')
    const crop = document.createElement('canvas')
    let alive = true
    let timer = 0

    const loop = () => {
      if (!alive) return
      const video = videoRef.current
      if (video && video.readyState >= 2 && video.videoWidth && !capturingRef.current) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        const now = nextTs()
        const model = modelRef.current
        const tracked = model ? trackIrises(model, video, vw, vh, now) : []
        const sides = sidesNow()

        const states = sides.map(s => {
          const last = fixRef.current[s]
          let fix: EyeFix | null = null
          const fromAi = tracked.find(t => t.side === s)
          if (fromAi) fix = { ...fromAi, t: now }
          else if (last && now - last.t < ROI_MEMORY_MS) fix = trackNear(video, last, work)
          else if (!model && modeRef.current === 'single') fix = detectCenter(video, work)
          if (fix) fixRef.current[s] = fix
          else if (last && now - last.t >= ROI_MEMORY_MS) fixRef.current[s] = null

          return gatesRef.current[s].push({
            found: !!fix,
            cx: fix?.cx ?? 0,
            cy: fix?.cy ?? 0,
            r: fix?.r ?? 0,
            frameW: vw,
            frameH: vh,
            topCover: fix?.topCover,
            bottomCover: fix?.bottomCover,
            gaze: fix?.gaze,
            sharpness: fix ? irisSharpness(video, fix.cx, fix.cy, fix.r, crop) : 0,
            rotation: rotationRef.current,
            t: now,
          })
        })

        // При две очи решава по-слабото.
        const worst = states.reduce((a, b) => (b.score < a.score ? b : a))
        const ready = states.every(s => s.ready)
        setState({ ...worst, ready })
        const view = toScreen(vw, vh)
        // Само позиции от този кадър — запомнената (за следене отблизо) може да е стара.
        if (view) setRings(sides.map(s => fixRef.current[s]).filter((f): f is EyeFix => !!f && now - f.t < 2 * TICK_MS).map(view))
        feedbackRef.current.tick(worst, now)
        if (worst.hint !== 'search' && !greetedRef.current) {
          // Щом окото е намерено, първото е погледът — без него клепачите и
          // центрирането не значат нищо. После идват посоките.
          greetedRef.current = true
          feedbackRef.current.say(HINT_TEXT.gaze, 'gaze', now, true)
        } else if (worst.hint !== 'ready') {
          feedbackRef.current.say(hintText(worst.hint), worst.hint, now)
        }
        if (ready) void capture(sides)
      }
      timer = window.setTimeout(loop, TICK_MS)
    }
    loop()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [phase, capture])

  const tone = state.ready || state.hint === 'ready' ? 'emerald' : state.hint === 'search' ? 'white' : 'amber'
  const ringColor = tone === 'emerald' ? '#34d399' : tone === 'amber' ? '#fbbf24' : 'rgba(255,255,255,.55)'

  /* ── начален екран: режим и съвети ── */
  if (phase !== 'live') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-bold">Автоматично снимане</h2>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted" aria-label="Затвори">
            <X size={22} />
          </button>
        </div>
        <div className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
          {phase === 'error' ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Насочете задната камера към лицето си. AI намира окото и с глас ви казва накъде да преместите телефона. Снима сам, когато ирисът се вижда целият, телефонът е неподвижен и образът е на фокус.
              </p>
              <div className="mt-5 grid gap-3">
                {(missing.length > 1 ? (['single', 'both'] as Mode[]) : (['single'] as Mode[])).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`rounded-2xl border-2 p-4 text-left transition ${mode === m ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <Eye size={20} weight="duotone" className="text-primary" />
                      {m === 'both' ? 'Двете очи наведнъж' : missing.length > 1 ? 'По едно око' : SIDE_LABEL[startSide]}
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{m === 'single' ? 'най-ясно' : 'по-бързо'}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m === 'both'
                        ? 'Телефонът на около 15 cm. Една снимка за двете очи, но всяко е по-дребно — по-малко детайл.'
                        : 'Телефонът на около 10 cm, окото в средата. Най-много детайл в ириса. След първото око камерата минава сама на второто.'}
                    </p>
                  </button>
                ))}
              </div>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li>• Гледайте в обектива — малкото кръгче на гърба на телефона, не в екрана.</li>
                <li>• Започнете от 30–40 cm, с цялото лице в кадъра — AI го хваща веднага. После приближете бавно и следвайте гласа.</li>
                <li>• Отворете широко очите — целият ирис трябва да се вижда.</li>
                <li>• Не се приближавайте повече от 10 cm — камерата не фокусира толкова близо.</li>
                <li>• С огледало: обърнете екрана към огледалото и включете „Огледало“, за да четете надписите.</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                {ai === 'loading' ? 'Зареждам AI модела за очите…' : ai === 'ready' ? 'AI моделът е готов.' : 'AI моделът не се зареди (няма връзка?) — ще търсим окото в средата на кадъра.'}
              </p>
              <Button size="lg" className="mt-4 h-14 w-full gap-2 text-base font-bold" onClick={start}>
                <Camera size={22} weight="bold" /> Включи камерата
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ── живата камера ── */
  return (
    <div className="fixed inset-0 z-[60] bg-black text-white" style={mirror ? { transform: 'scaleX(-1)' } : undefined}>
      <div ref={boxRef} className="absolute inset-0 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {rings.map((r, i) => (
            <circle key={i} cx={r.x} cy={r.y} r={Math.max(r.r, 8)} fill="none" stroke={ringColor} strokeWidth={3} style={{ transition: 'all 80ms linear' }} />
          ))}
        </svg>
        {flash && <div className="absolute inset-0 bg-white/80" />}
      </div>

      {/* Горна лента */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button type="button" onClick={() => { stop(); onClose() }} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40" aria-label="Затвори">
          <X size={22} />
        </button>
        <span className="flex-1 text-center text-base font-bold">
          {mode === 'single' ? SIDE_LABEL[side] : 'Двете очи'}
          {ai === 'ready' && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">AI</span>}
        </span>
        {torchSupported && (
          <button type="button" onClick={() => applyTorch(!torch)} className={`flex h-11 w-11 items-center justify-center rounded-full ${torch ? 'bg-amber-400 text-black' : 'bg-black/40'}`} aria-label="Светкавица">
            {torch ? <Lightning size={20} weight="fill" /> : <LightningSlash size={20} />}
          </button>
        )}
        <button type="button" onClick={() => setSound(!sound)} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40" aria-label="Звук">
          {sound ? <SpeakerHigh size={20} /> : <SpeakerSlash size={20} />}
        </button>
        <button type="button" onClick={() => setMirror(!mirror)} className={`flex h-11 w-11 items-center justify-center rounded-full ${mirror ? 'bg-white text-black' : 'bg-black/40'}`} aria-label="Огледало">
          <FlipHorizontal size={20} />
        </button>
      </div>

      {banner && (
        <div className="absolute inset-x-4 top-24 rounded-2xl bg-emerald-500 px-4 py-3 text-center text-lg font-bold text-white shadow-xl">{banner}</div>
      )}

      {/* Долна лента: подсказка, напредък, ръчен бутон */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-10">
        <p className="text-center text-2xl font-extrabold" style={{ color: ringColor }}>
          {busy ? 'Снимам…' : hintText(state.hint)}
        </p>
        {!busy && HINT_WHY[state.hint] && <p className="mt-1 text-center text-sm text-white/75">{HINT_WHY[state.hint]}</p>}
        <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full transition-all duration-150" style={{ width: `${Math.round(state.score * 100)}%`, background: ringColor }} />
        </div>
        {!torchSupported && <p className="mt-2 text-center text-xs text-white/60">Светкавицата не се включва от този браузър — застанете с лице към светлина.</p>}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => void capture(sidesNow())}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:scale-95"
            aria-label="Снимай ръчно"
          />
        </div>
      </div>
    </div>
  )
}
