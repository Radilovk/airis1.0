import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Eye, FlipHorizontal, Lightning, LightningSlash, SpeakerHigh, SpeakerSlash, X } from '@phosphor-icons/react'
import { detectIrisGeometry } from '@/lib/iris-geometry'
import { CaptureGate, HINT_TEXT, irisSharpness, type CaptureHint, type CaptureState, type FrameReading } from '@/lib/live-capture'

type Side = 'left' | 'right'
type Mode = 'single' | 'both'

export interface LiveCapture {
  side: Side
  file: File
}

interface LiveIrisCameraProps {
  /** С кое око да започне в режим „едно по едно“. */
  startSide: Side
  /** Очите, които още нямат снимка — след едното камерата минава сама на другото. */
  missing: Side[]
  onDone: (captures: LiveCapture[]) => void
  onClose: () => void
}

/** Анализираният квадрат е до толкова пиксела — детекцията работи на 320. */
const ANALYSIS_SIDE = 320
/** Пауза между два анализа; телефонът остава хладен, а 6–8 кадъра/s стигат. */
const TICK_MS = 120
/** Максимална страна на запазената снимка — пред 10 MB лимита на качването. */
const MAX_PHOTO_SIDE = 4032

const SIDE_LABEL: Record<Side, string> = { left: 'Ляво око', right: 'Дясно око' }

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

/* ── геометрия на кадъра ──────────────────────────────────────────────────── */

interface Region {
  /** Кое око е в този квадрат. */
  side: Side
  /** Квадратът в пиксели на видеото. */
  x: number
  y: number
  s: number
}

/**
 * Квадратите, в които търсим ирис. При „едно око“ — централният квадрат.
 * При „двете очи“ — два съседни квадрата в средата: задната камера гледа
 * човека, затова лявата половина на кадъра е неговото ДЯСНО око.
 */
function regionsFor(mode: Mode, side: Side, vw: number, vh: number): Region[] {
  if (mode === 'single') {
    const s = Math.min(vw, vh)
    return [{ side, x: (vw - s) / 2, y: (vh - s) / 2, s }]
  }
  const s = Math.min(vw / 2, vh)
  const y = (vh - s) / 2
  return [
    { side: 'right', x: vw / 2 - s, y, s },
    { side: 'left', x: vw / 2, y, s },
  ]
}

interface Detection {
  region: Region
  reading: FrameReading
}

function analyseRegion(src: CanvasImageSource, region: Region, work: HTMLCanvasElement, crop: HTMLCanvasElement, rotation: number | undefined): Detection {
  const k = ANALYSIS_SIDE / region.s
  work.width = ANALYSIS_SIDE
  work.height = ANALYSIS_SIDE
  work.getContext('2d')!.drawImage(src, region.x, region.y, region.s, region.s, 0, 0, ANALYSIS_SIDE, ANALYSIS_SIDE)
  const geo = detectIrisGeometry(work)
  const found = geo.pupilConfidence > 0
  // Рязкостта се мери в пълната резолюция — на 320 px всичко изглежда рязко.
  const sharpness = found
    ? irisSharpness(src, region.x + geo.limbus.cx / k, region.y + geo.limbus.cy / k, geo.limbus.r / k, crop)
    : 0
  return {
    region,
    reading: {
      found,
      cx: geo.limbus.cx,
      cy: geo.limbus.cy,
      r: geo.limbus.r,
      side: ANALYSIS_SIDE,
      pupilConfidence: geo.pupilConfidence,
      limbusConfidence: geo.limbusConfidence,
      sharpness,
      rotation,
      t: performance.now(),
    },
  }
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

/** Изрязва квадрата на окото (с поле около него) от снимката. */
function cropRegion(still: HTMLCanvasElement, region: Region, vw: number): HTMLCanvasElement {
  const k = still.width / vw
  const out = document.createElement('canvas')
  out.width = Math.round(region.s * k)
  out.height = out.width
  out.getContext('2d')!.drawImage(still, region.x * k, region.y * k, region.s * k, region.s * k, 0, 0, out.width, out.height)
  return out
}

/* ── компонент ────────────────────────────────────────────────────────────── */

export default function LiveIrisCamera({ startSide, missing, onDone, onClose }: LiveIrisCameraProps) {
  const [phase, setPhase] = useState<'intro' | 'live' | 'error'>('intro')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('single')
  const [side, setSide] = useState<Side>(startSide)
  const [mirror, setMirror] = useState(false)
  const [sound, setSound] = useState(true)
  const [torch, setTorch] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [state, setState] = useState<CaptureState>({ score: 0, hint: 'search', ready: false })
  const [rings, setRings] = useState<{ x: number; y: number; r: number }[]>([])
  const [guides, setGuides] = useState<{ x: number; y: number; r: number }[]>([])
  const [flash, setFlash] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const feedbackRef = useRef(new Feedback())
  const gatesRef = useRef<Record<Side, CaptureGate>>({ left: new CaptureGate(), right: new CaptureGate() })
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

  const start = async () => {
    // Всичко, което иска докосване (звук, жироскоп на iPhone), става тук.
    feedbackRef.current.unlock()
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
      // Обективът не фокусира по-близо от ~10 cm. С 2× увеличение окото е
      // едро от 15–20 cm, където фокусът е сигурен.
      if (caps.zoom && modeRef.current === 'single') advanced.push({ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2)) })
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
      feedbackRef.current.say(modeRef.current === 'single' ? `${SIDE_LABEL[sideRef.current]}. Насочете камерата.` : 'Двете очи в кръговете.', null, performance.now(), true)
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

  const capture = useCallback(
    async (regions: Region[]) => {
      const video = videoRef.current
      if (!video || capturingRef.current) return
      capturingRef.current = true
      setBusy(true)
      feedbackRef.current.shutter()
      setFlash(true)
      setTimeout(() => setFlash(false), 180)
      try {
        const still = await grabStill(video, track())
        for (const region of regions) {
          const file = await canvasToFile(cropRegion(still, region, video.videoWidth), `iris-${region.side}-${Date.now()}.jpg`)
          if (file) capturesRef.current = [...capturesRef.current.filter(c => c.side !== region.side), { side: region.side, file }]
        }
        const have = new Set(capturesRef.current.map(c => c.side))
        const next = missing.find(s => !have.has(s))
        if (modeRef.current === 'single' && next) {
          // Едното око е готово — минаваме на другото, без да затваряме камерата.
          gatesRef.current[next].reset()
          setSide(next)
          setBanner(`Готово. Сега ${next === 'left' ? 'лявото' : 'дясното'} око.`)
          feedbackRef.current.say(`Готово. Сега ${next === 'left' ? 'лявото' : 'дясното'} око.`, null, performance.now(), true)
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

  // Цикълът: кадър → откриване → рязкост → решение. Без requestVideoFrameCallback,
  // за да работи и на по-стари iPhone.
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
        const regions = regionsFor(modeRef.current, sideRef.current, vw, vh)
        const detections = regions.map(r => analyseRegion(video, r, work, crop, rotationRef.current))
        const states = detections.map(d => gatesRef.current[d.region.side].push(d.reading))
        // При две очи решава по-слабото.
        const worst = states.reduce((a, b) => (b.score < a.score ? b : a))
        const ready = states.every(s => s.ready)
        setState({ ...worst, ready })
        const view = toScreen(vw, vh)
        if (view) {
          setRings(detections.filter(d => d.reading.found && d.reading.pupilConfidence >= 0.3).map(({ region, reading }) => view(region, reading.cx, reading.cy, reading.r)))
          // Насоката: къде и колко голямо да е окото (средата на допустимия размер).
          setGuides(regions.map(r => view(r, ANALYSIS_SIDE / 2, ANALYSIS_SIDE / 2, ANALYSIS_SIDE * 0.28)))
        }
        const now = performance.now()
        feedbackRef.current.tick(worst, now)
        if (worst.hint !== 'ready') feedbackRef.current.say(HINT_TEXT[worst.hint], worst.hint, now)
        if (ready) void capture(regions)
      }
      timer = window.setTimeout(loop, TICK_MS)
    }
    loop()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [phase, capture])

  /** Точка от анализирания квадрат → екран; видеото е `object-cover`. */
  const toScreen = (vw: number, vh: number) => {
    const box = boxRef.current
    if (!box) return null
    const { width: bw, height: bh } = box.getBoundingClientRect()
    const k = Math.max(bw / vw, bh / vh)
    const ox = (bw - vw * k) / 2
    const oy = (bh - vh * k) / 2
    return (region: Region, cx: number, cy: number, r: number) => {
      const s = region.s / ANALYSIS_SIDE
      return { x: ox + (region.x + cx * s) * k, y: oy + (region.y + cy * s) * k, r: r * s * k }
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    gatesRef.current.left.reset()
    gatesRef.current.right.reset()
  }

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
                Насочете задната камера към окото. Телефонът сам ще улови момента, в който окото е рязко и неподвижно, и ще снима. Сигналите зачестяват, колкото по-близо сте.
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
                      {m === 'single' ? 'Едно по едно' : 'Двете очи наведнъж'}
                      {m === 'single' && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">най-ясно</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m === 'single'
                        ? 'Окото заема целия кадър — най-много детайли. След първото камерата минава сама на второто.'
                        : 'По-бързо, но всяко око е по-малко в кадъра и детайлите са по-малко.'}
                    </p>
                  </button>
                ))}
              </div>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li>• Отворете широко окото и гледайте право в камерата.</li>
                <li>• Без огледало: включете светкавицата, приближете бавно телефона и чакайте сигнала.</li>
                <li>• С огледало: обърнете екрана към огледалото и включете „Огледало“, за да четете надписите.</li>
              </ul>
              <Button size="lg" className="mt-6 h-14 w-full gap-2 text-base font-bold" onClick={start}>
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
          {/* Насоки: къде да е окото. */}
          {guides.map((g, i) => (
            <circle key={`g${i}`} cx={g.x} cy={g.y} r={g.r} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth={2} strokeDasharray="8 8" />
          ))}
          {/* Откритият ирис. */}
          {rings.map((r, i) => (
            <circle key={i} cx={r.x} cy={r.y} r={r.r} fill="none" stroke={ringColor} strokeWidth={4} style={{ transition: 'all 120ms linear' }} />
          ))}
        </svg>
        {flash && <div className="absolute inset-0 bg-white/80" />}
      </div>

      {/* Горна лента */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button type="button" onClick={() => { stop(); onClose() }} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40" aria-label="Затвори">
          <X size={22} />
        </button>
        <span className="flex-1 text-center text-base font-bold">{mode === 'single' ? SIDE_LABEL[side] : 'Двете очи'}</span>
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
          {busy ? 'Снимам…' : HINT_TEXT[state.hint]}
        </p>
        <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full transition-all duration-150" style={{ width: `${Math.round(state.score * 100)}%`, background: ringColor }} />
        </div>
        {!torchSupported && <p className="mt-2 text-center text-xs text-white/60">Светкавицата не се включва от този браузър — застанете с лице към светлина.</p>}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const v = videoRef.current
              if (v?.videoWidth) void capture(regionsFor(mode, side, v.videoWidth, v.videoHeight))
            }}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:scale-95"
            aria-label="Снимай ръчно"
          />
        </div>
      </div>
    </div>
  )
}
