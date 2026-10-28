import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Eye, FlipHorizontal, Lightning, LightningSlash, SpeakerHigh, SpeakerSlash, X } from '@phosphor-icons/react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { detectIrisGeometry } from '@/lib/iris-geometry'
import { loadFaceTracker, trackIrises } from '@/lib/face-tracker'
import {
  CaptureGate,
  HINT_TEXT,
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
/** Максимална страна на запазената снимка — пред 10 MB лимита на качването. */
const MAX_PHOTO_SIDE = 4032
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
  openness?: number
  t: number
}

/**
 * Класическият детектор върху квадрат около последната позиция на окото.
 * Така окото се следи и когато телефонът е толкова близо, че лицето вече не
 * е в кадъра и AI моделът го губи. Квадратът е 5r — ирисът е в средата му и
 * заема размера, за който детекторът е направен.
 */
function trackNear(video: HTMLVideoElement, last: EyeFix, work: HTMLCanvasElement): EyeFix | null {
  const side = Math.min(5 * last.r, video.videoWidth, video.videoHeight)
  const x = Math.max(0, Math.min(video.videoWidth - side, last.cx - side / 2))
  const y = Math.max(0, Math.min(video.videoHeight - side, last.cy - side / 2))
  return detectIn(video, x, y, side, work, last.r)
}

/** Без AI модел: търсим ирис в централния квадрат (окото трябва да е в средата). */
function detectCenter(video: HTMLVideoElement, work: HTMLCanvasElement): EyeFix | null {
  const side = Math.min(video.videoWidth, video.videoHeight)
  return detectIn(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, work)
}

function detectIn(video: HTMLVideoElement, x: number, y: number, side: number, work: HTMLCanvasElement, expectR?: number): EyeFix | null {
  if (side < 40) return null
  work.width = ANALYSIS_SIDE
  work.height = ANALYSIS_SIDE
  work.getContext('2d')!.drawImage(video, x, y, side, side, 0, 0, ANALYSIS_SIDE, ANALYSIS_SIDE)
  const geo = detectIrisGeometry(work)
  if (geo.pupilConfidence < 0.35 || geo.limbusConfidence < 0.12) return null
  const k = side / ANALYSIS_SIDE
  const r = geo.limbus.r * k
  if (expectR && (r < expectR * 0.6 || r > expectR * 1.6)) return null
  return { cx: x + geo.limbus.cx * k, cy: y + geo.limbus.cy * k, r, t: performance.now() }
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise(resolve =>
    canvas.toBlob(b => resolve(b ? new File([b], name, { type: 'image/jpeg' }) : null), 'image/jpeg', 0.95)
  )
}

/**
 * Снимката: при наличен ImageCapture (Chrome за Android) — пълната резолюция
 * на сензора; иначе текущият кадър от видеото. Снимката от сензора се приема
 * само ако окото е в същия квадрат — иначе е била направена в друг момент.
 */
async function grabStill(video: HTMLVideoElement, track: MediaStreamTrack | null): Promise<HTMLCanvasElement> {
  const frame = document.createElement('canvas')
  frame.width = video.videoWidth
  frame.height = video.videoHeight
  frame.getContext('2d')!.drawImage(video, 0, 0)

  const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture
  if (!IC || !track) return frame
  try {
    const blob = await Promise.race([
      new IC(track).takePhoto(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500)),
    ])
    const bmp = await createImageBitmap(blob)
    // Снимката трябва да е със същите пропорции като видеото, иначе квадратите не съвпадат.
    if (Math.abs(bmp.width / bmp.height - frame.width / frame.height) > 0.02) return frame
    const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(bmp.width, bmp.height))
    const photo = document.createElement('canvas')
    photo.width = Math.round(bmp.width * k)
    photo.height = Math.round(bmp.height * k)
    photo.getContext('2d')!.drawImage(bmp, 0, 0, photo.width, photo.height)
    bmp.close()
    return photo
  } catch {
    return frame
  }
}

/** Квадрат около окото от снимката; координатите на окото са във видеото. */
function cropEye(still: HTMLCanvasElement, vw: number, eye: { cx: number; cy: number; r: number }): HTMLCanvasElement {
  const k = still.width / vw
  const side = Math.min(still.width, still.height, eye.r * 2 * CROP_FACTOR * k)
  const x = Math.max(0, Math.min(still.width - side, eye.cx * k - side / 2))
  const y = Math.max(0, Math.min(still.height - side, eye.cy * k - side / 2))
  const out = document.createElement('canvas')
  out.width = Math.round(side)
  out.height = out.width
  out.getContext('2d')!.drawImage(still, x, y, side, side, 0, 0, out.width, out.height)
  return out
}

/** Ръчна снимка без открито око: средата (едно око) или двете половини (две очи). */
function fallbackEye(side: Side, mode: Mode, vw: number, vh: number) {
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
  const [mode, setMode] = useState<Mode>(missing.length > 1 ? 'both' : 'single')
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
  const gatesRef = useRef<Record<Side, CaptureGate>>({ left: new CaptureGate(TARGET_BOTH), right: new CaptureGate(TARGET_BOTH) })
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      })
      streamRef.current = stream
      const t = stream.getVideoTracks()[0]
      const caps = (t.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean
        zoom?: { min: number; max: number }
        focusMode?: string[]
      }
      const advanced: Record<string, unknown>[] = []
      if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' })
      // По едно око: 1.5× увеличение дава по-едър ирис от разстояние, на което
      // камерата фокусира. При двете очи — без увеличение, за да влязат и двете.
      if (caps.zoom) advanced.push({ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, modeRef.current === 'single' ? 1.5 : 1)) })
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
        const eyes = sides.map(s => ({ side: s, eye: fixRef.current[s] ?? fallbackEye(s, modeRef.current, vw, vh) }))
        const still = await grabStill(video, track())
        for (const { side: s, eye } of eyes) {
          const file = await canvasToFile(cropEye(still, vw, eye), `iris-${s}-${Date.now()}.jpg`)
          if (file) capturesRef.current = [...capturesRef.current.filter(c => c.side !== s), { side: s, file }]
        }
        const have = new Set(capturesRef.current.map(c => c.side))
        const next = missing.find(s => !have.has(s))
        if (next) {
          // Едното око е готово — минаваме на другото, без да затваряме камерата.
          gatesRef.current[next].reset()
          fixRef.current[next] = null
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

  /** Видео пиксели → екран; видеото е `object-cover`. */
  const toScreen = (vw: number, vh: number) => {
    const box = boxRef.current
    if (!box) return null
    const { width: bw, height: bh } = box.getBoundingClientRect()
    const k = Math.max(bw / vw, bh / vh)
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
    let lastTs = 0

    const loop = () => {
      if (!alive) return
      const video = videoRef.current
      if (video && video.readyState >= 2 && video.videoWidth && !capturingRef.current) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        // MediaPipe иска строго растящи времена.
        const now = Math.max(performance.now(), lastTs + 1)
        lastTs = now
        const model = modelRef.current
        const tracked = model ? trackIrises(model, video, now) : []
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
            openness: fix?.openness,
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
        if (view) setRings(sides.map(s => fixRef.current[s]).filter((f): f is EyeFix => !!f).map(view))
        feedbackRef.current.tick(worst, now)
        if (worst.hint !== 'ready') feedbackRef.current.say(HINT_TEXT[worst.hint], worst.hint, now)
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
  const hintText = (h: CaptureHint) => (h === 'center' && mode === 'single' ? 'Окото в средата' : h === 'search' && mode === 'single' ? 'Търся окото' : HINT_TEXT[h])

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
                Насочете задната камера към лицето си. AI намира очите сам и телефонът снима в момента, в който са отворени, неподвижни и на фокус. Сигналите зачестяват, колкото по-близо сте.
              </p>
              <div className="mt-5 grid gap-3">
                {(missing.length > 1 ? (['both', 'single'] as Mode[]) : (['single'] as Mode[])).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`rounded-2xl border-2 p-4 text-left transition ${mode === m ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <Eye size={20} weight="duotone" className="text-primary" />
                      {m === 'both' ? 'Двете очи наведнъж' : missing.length > 1 ? 'По едно око' : SIDE_LABEL[startSide]}
                      {m === 'both' && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">най-лесно</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m === 'both'
                        ? 'Телефонът на около 15 cm от лицето. Една снимка — и двете очи.'
                        : 'Телефонът на около 10–12 cm, окото в средата. По-едро око, но по-бавно.'}
                    </p>
                  </button>
                ))}
              </div>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li>• Започнете от 30–40 cm, с цялото лице в кадъра — AI го хваща веднага. После приближете бавно.</li>
                <li>• Отворете широко очите и гледайте право в камерата.</li>
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
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
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
