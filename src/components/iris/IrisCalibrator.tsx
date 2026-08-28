import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  ArrowClockwise,
  CheckCircle,
  Crosshair,
  Eye,
  Image as ImageIcon,
  Sparkle,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'
import { analyseIrisQuality, type QualityReport } from '@/lib/iris-quality'
import { detectIrisGeometry, concentricGeometry, type IrisGeometry } from '@/lib/iris-geometry'
import { unwrapIris } from '@/lib/iris-unwrap'
import { CALIBRATION } from '@/lib/ui-copy'
import type { IrisGeometrySnapshot } from '@/types'

/**
 * IrisCalibrator — стъпката между „снимката е качена" и „анализът тръгва".
 *
 * Прави три неща, които приложението досега не правеше изобщо:
 *   1. Измерва къде са зеницата и лимбусът и ПОКАЗВА измерването на потребителя.
 *   2. Оценява дали снимката изобщо става и казва конкретно какво да оправи.
 *   3. Дава възможност геометрията да се коригира с пръст — след ръчна корекция
 *      координатната система е сигурна дори когато автоматиката се е провалила.
 *
 * Веднага показва и живата разгъвка — потребителят вижда какво точно ще види
 * моделът. Това е и най-силният демонстрационен момент в целия продукт.
 */

interface IrisCalibratorProps {
  imageDataUrl: string
  side: 'left' | 'right'
  onConfirm: (geometry: IrisGeometrySnapshot, quality: QualityReport) => void
  onRetake: () => void
  onCancel: () => void
}

type Handle = 'pupil' | 'limbus' | null
type CalStep = 'center' | 'outer' | 'inner'

const VIEW = 460

export default function IrisCalibrator({
  imageDataUrl,
  side,
  onConfirm,
  onRetake,
  onCancel,
}: IrisCalibratorProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [analysing, setAnalysing] = useState(true)
  const [report, setReport] = useState<QualityReport | null>(null)
  const [geo, setGeo] = useState<IrisGeometry | null>(null)
  const [touched, setTouched] = useState(false)
  const [drag, setDrag] = useState<Handle>(null)
  const [strip, setStrip] = useState<string | null>(null)
  const [showStrip, setShowStrip] = useState(false)
  /** Дял четима площ в лентата — това е, което моделът реално получава. */
  const [coverage, setCoverage] = useState<number | null>(null)
  const [calStep, setCalStep] = useState<CalStep>('center')
  const [showGrid, setShowGrid] = useState(false)
  // Естествените размери се държат в state, а не се четат от ref-а: промяна на
  // ref не предизвиква повторно изчисление и наслагването изоставаше с един кадър.
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  /* ── зареждане + автоматично измерване ─────────────────────────────────── */
  useEffect(() => {
    let alive = true
    setLoaded(false)
    setFailed(false)
    setAnalysing(true)

    const img = new Image()
    img.onload = () => {
      if (!alive) return
      imgRef.current = img
      setNatural({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height })
      setLoaded(true)
      // Отлагаме тежката работа с един кадър, за да се покаже интерфейсът.
      requestAnimationFrame(() => {
        if (!alive) return
        try {
          const q = analyseIrisQuality(img)
          setReport(q)
          setGeo(concentricGeometry(q.geometry))
        } catch {
          const g = detectIrisGeometry(img)
          setGeo(concentricGeometry(g))
        } finally {
          if (alive) setAnalysing(false)
        }
      })
    }
    img.onerror = () => {
      if (!alive) return
      setFailed(true)
      setAnalysing(false)
    }
    img.src = imageDataUrl

    return () => {
      alive = false
    }
  }, [imageDataUrl])

  /* ── мащаб между пикселите на снимката и екрана ────────────────────────── */
  const scale = useMemo(
    () => (natural.w && natural.h ? VIEW / Math.max(natural.w, natural.h) : 1),
    [natural]
  )

  const offset = useMemo(() => {
    if (!natural.w || !natural.h) return { x: 0, y: 0 }
    return {
      x: (VIEW - natural.w * scale) / 2,
      y: (VIEW - natural.h * scale) / 2,
    }
  }, [scale, natural])

  const toView = useCallback(
    (x: number, y: number) => ({ x: x * scale + offset.x, y: y * scale + offset.y }),
    [scale, offset]
  )

  /* ── живата разгъвка ──────────────────────────────────────────────────── */
  const rebuildStrip = useCallback(
    (g: IrisGeometry) => {
      const img = imgRef.current
      if (!img) return
      try {
        const res = unwrapIris(img, g, side, {
          plotWidth: 840,
          plotHeight: 420,
          quality: 0.82,
        })
        setStrip(res.dataUrl)
        setCoverage(res.coverage)
        // Оценката се преизчислява с покритието: то описва лентата, която
        // моделът вижда, а не снимката, която потребителят е направил.
        try {
          setReport(analyseIrisQuality(img, { stripCoverage: res.coverage, manualGeometry: g.manual, geometry: g }))
        } catch {
          /* оставяме предишната оценка */
        }
      } catch {
        setStrip(null)
        setCoverage(null)
      }
    },
    [side]
  )

  useEffect(() => {
    if (!geo || !loaded || drag) return
    const t = setTimeout(() => rebuildStrip(geo), 180)
    return () => clearTimeout(t)
  }, [geo, loaded, drag, rebuildStrip])

  /* ── влачене на пръстените ────────────────────────────────────────────── */
  const pointFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) return null
      const vx = ((clientX - rect.left) / rect.width) * VIEW
      const vy = ((clientY - rect.top) / rect.height) * VIEW
      return { x: (vx - offset.x) / scale, y: (vy - offset.y) / scale }
    },
    [offset, scale]
  )

  const onPointerDown = (handle: Exclude<Handle, null>) => (e: React.PointerEvent) => {
    if (handle === 'pupil' && calStep !== 'inner') return
    if (handle === 'limbus' && calStep !== 'outer') return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDrag(handle)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !geo) return
    const p = pointFromEvent(e.clientX, e.clientY)
    if (!p) return
    const centre = drag === 'pupil' ? geo.pupil : geo.limbus
    const r = Math.hypot(p.x - centre.cx, p.y - centre.cy)
    setTouched(true)
    setGeo(prev => {
      if (!prev) return prev
      const cx = prev.limbus.cx
      const cy = prev.limbus.cy
      if (drag === 'pupil') {
        const nr = Math.max(4, Math.min(prev.limbus.r * 0.7, r))
        return concentricGeometry({
          ...prev,
          pupil: { cx, cy, r: nr },
          limbus: { ...prev.limbus, cx, cy },
          manual: true,
          pupilConfidence: 1,
        })
      }
      const nr = Math.max(prev.pupil.r * 1.5, r)
      return concentricGeometry({
        ...prev,
        limbus: { ...prev.limbus, cx, cy, r: nr },
        manual: true,
        limbusConfidence: 1,
      })
    })
  }

  const onPointerUp = () => {
    if (drag && geo) rebuildStrip(geo)
    setDrag(null)
  }

  /** Влачене на центъра — премества и двата кръга заедно. */
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (calStep !== 'center') return
    if (drag || !geo) return
    const p = pointFromEvent(e.clientX, e.clientY)
    if (!p) return
    const dLimbus = Math.hypot(p.x - geo.limbus.cx, p.y - geo.limbus.cy)
    if (dLimbus > geo.limbus.r * 1.02) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDrag(null)
    const startPupil = { ...geo.pupil }
    const startLimbus = { ...geo.limbus }
    const start = p

    const move = (ev: PointerEvent) => {
      const q = pointFromEvent(ev.clientX, ev.clientY)
      if (!q) return
      const dx = q.x - start.x
      const dy = q.y - start.y
      setTouched(true)
      setGeo(prev =>
        prev
          ? concentricGeometry({
              ...prev,
              pupil: { ...prev.pupil, cx: startPupil.cx + dx, cy: startPupil.cy + dy },
              limbus: { ...prev.limbus, cx: startLimbus.cx + dx, cy: startLimbus.cy + dy },
              manual: true,
            })
          : prev
      )
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setGeo(g => {
        if (g) rebuildStrip(g)
        return g
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const reset = () => {
    const img = imgRef.current
    if (!img) return
    const q = analyseIrisQuality(img)
    setReport(q)
    setGeo(concentricGeometry(q.geometry))
    setTouched(false)
    setCalStep('center')
    rebuildStrip(q.geometry)
  }

  const adjustRadius = (which: 'pupil' | 'limbus', delta: number) => {
    setTouched(true)
    setGeo(prev => {
      if (!prev) return prev
      const cx = prev.limbus.cx
      const cy = prev.limbus.cy
      if (which === 'pupil') {
        const nr = Math.max(4, Math.min(prev.limbus.r * 0.7, prev.pupil.r + delta))
        return concentricGeometry({
          ...prev,
          pupil: { cx, cy, r: nr },
          manual: true,
          pupilConfidence: 1,
        })
      }
      const nr = Math.max(prev.pupil.r * 1.5, prev.limbus.r + delta)
      return concentricGeometry({
        ...prev,
        limbus: { ...prev.limbus, cx, cy, r: nr },
        manual: true,
        limbusConfidence: 1,
      })
    })
  }

  /* ── решение ──────────────────────────────────────────────────────────── */
  const GEOMETRY_CODES = new Set(['pupil_not_found', 'pupil_low_contrast'])

  const blockingErrors = useMemo(() => {
    if (!report) return []
    // Ръчната калибрация е финалното решение на потребителя.
    if (touched) return []
    return report.issues.filter(i => {
      if (i.level !== 'error') return false
      if (touched && GEOMETRY_CODES.has(i.code)) return false
      return true
    })
  }, [report, touched, coverage])

  const warnings = useMemo(
    () => (report?.issues ?? []).filter(i => i.level === 'warning'),
    [report]
  )

  const cannotConfirm = blockingErrors.length > 0
  const score = report?.score ?? 0

  const scoreTone =
    score >= 70 ? 'emerald' : score >= 45 ? 'amber' : 'rose'
  const toneClasses: Record<string, string> = {
    emerald: 'from-emerald-400 to-teal-500',
    amber: 'from-amber-400 to-orange-500',
    rose: 'from-rose-400 to-red-500',
  }

  const confirm = () => {
    if (!geo || !report) return
    const snapshot: IrisGeometrySnapshot = {
      pupil: { ...geo.pupil },
      limbus: { ...geo.limbus },
      imageWidth: geo.imageWidth,
      imageHeight: geo.imageHeight,
      pupilConfidence: geo.pupilConfidence,
      limbusConfidence: geo.limbusConfidence,
      manual: touched,
    }
    onConfirm(snapshot, { ...report, geometry: geo, score })
  }

  const sideLabel = side === 'left' ? 'Ляв' : 'Десен'
  const stepHint =
    calStep === 'center'
      ? CALIBRATION.hintCenter
      : calStep === 'outer'
        ? CALIBRATION.hintOuter
        : CALIBRATION.hintInner

  const pupilSliderMax = geo ? Math.round(geo.limbus.r * 0.7) : 100
  const limbusSliderMax = geo
    ? Math.min(
        geo.imageWidth / 2,
        geo.imageHeight / 2,
        Math.round(geo.pupil.r * 4)
      )
    : 200

  /* ── изглед ───────────────────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-md md:items-center md:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl"
      >
        {/* Заглавие */}
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-lg shadow-sky-500/20">
              <Crosshair size={22} weight="bold" className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-tight">
                {CALIBRATION.title(side)}
              </h3>
              <p className="text-xs text-slate-400">{CALIBRATION.subtitle}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Затвори"
          >
            <XCircle size={24} />
          </Button>
        </div>

        {/* Стъпки */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-3">
          {(
            [
              ['center', CALIBRATION.stepCenter],
              ['outer', CALIBRATION.stepOuter],
              ['inner', CALIBRATION.stepInner],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={calStep === id ? 'default' : 'ghost'}
              onClick={() => setCalStep(id)}
              className={
                calStep === id
                  ? 'bg-sky-500 text-white hover:bg-sky-400'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,460px)_1fr]">
          {/* ── Сцена ───────────────────────────────────────────────────── */}
          <div>
            <div
              ref={stageRef}
              onPointerDown={onStagePointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative mx-auto aspect-square w-full max-w-[460px] touch-none overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
            >
              {loaded && !failed && (
                <img
                  src={imageDataUrl}
                  alt={`${sideLabel} ирис`}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
              )}

              {failed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <ImageIcon size={40} />
                  <p className="text-sm">Изображението не се зарежда</p>
                </div>
              )}

              {/* сканиращ лъч, докато трае измерването */}
              <AnimatePresence>
                {analysing && !failed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute inset-0"
                  >
                    <motion.div
                      className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-sky-400/25 to-transparent"
                      animate={{ y: ['-10%', '110%'] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-sky-400/30">
                      {CALIBRATION.measuring}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* пръстените */}
              {geo && loaded && !failed && (
                <svg
                  viewBox={`0 0 ${VIEW} ${VIEW}`}
                  className="absolute inset-0 h-full w-full"
                  style={{ touchAction: 'none' }}
                >
                  <defs>
                    <radialGradient id="pupilGlow">
                      <stop offset="60%" stopColor="rgba(56,189,248,0)" />
                      <stop offset="100%" stopColor="rgba(56,189,248,0.35)" />
                    </radialGradient>
                  </defs>

                  {(() => {
                    const c = toView(geo.limbus.cx, geo.limbus.cy)
                    const pr = geo.pupil.r * scale
                    const lr = geo.limbus.r * scale
                    const rings = Array.from({ length: 11 }, (_, i) => {
                      const t = (i + 1) / 12
                      return { cx: c.x, cy: c.y, r: pr + (lr - pr) * t }
                    })
                    return (
                      <>
                        {/* междинни пръстени — по избор */}
                        {showGrid &&
                          rings.map((r, i) => (
                            <circle
                              key={i}
                              cx={r.cx}
                              cy={r.cy}
                              r={r.r}
                              fill="none"
                              stroke="rgba(125,211,252,0.22)"
                              strokeWidth={1}
                            />
                          ))}

                        {showGrid &&
                          Array.from({ length: 12 }, (_, i) => {
                          const a = (i * 30 * Math.PI) / 180
                          const sin = Math.sin(a)
                          const cos = Math.cos(a)
                          return (
                            <line
                              key={`s${i}`}
                              x1={c.x + pr * sin}
                              y1={c.y - pr * cos}
                              x2={c.x + lr * sin}
                              y2={c.y - lr * cos}
                              stroke="rgba(125,211,252,0.28)"
                              strokeWidth={1}
                            />
                          )
                        })}

                        {/* център — стъпка 1 */}
                        {(calStep === 'center' || showGrid) && (
                          <>
                            <circle cx={c.x} cy={c.y} r={6} fill="#38bdf8" stroke="#fff" strokeWidth={2} />
                            <line x1={c.x - 14} y1={c.y} x2={c.x + 14} y2={c.y} stroke="#38bdf8" strokeWidth={2} />
                            <line x1={c.x} y1={c.y - 14} x2={c.x} y2={c.y + 14} stroke="#38bdf8" strokeWidth={2} />
                          </>
                        )}

                        {/* лимбус — стъпка 2 */}
                        {(calStep === 'outer' || calStep === 'center' || showGrid) && (
                          <>
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={lr}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={calStep === 'outer' ? 3 : 2}
                          strokeDasharray="10 6"
                          opacity={calStep === 'inner' ? 0.35 : 1}
                        />
                        {calStep === 'outer' && (
                        <circle
                          cx={c.x}
                          cy={c.y - lr}
                          r={14}
                          fill="#fbbf24"
                          stroke="#0f172a"
                          strokeWidth={2}
                          style={{ cursor: 'ns-resize' }}
                          onPointerDown={onPointerDown('limbus')}
                        />
                        )}
                          </>
                        )}

                        {/* зеница — стъпка 3 */}
                        {(calStep === 'inner' || calStep === 'center' || showGrid) && (
                          <>
                        <circle cx={c.x} cy={c.y} r={pr * 1.35} fill="url(#pupilGlow)" opacity={calStep === 'outer' ? 0.2 : 0.6} />
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={pr}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth={calStep === 'inner' ? 3 : 2}
                          opacity={calStep === 'outer' ? 0.35 : 1}
                        />
                        {calStep === 'inner' && (
                        <circle
                          cx={c.x}
                          cy={c.y - pr}
                          r={14}
                          fill="#38bdf8"
                          stroke="#0f172a"
                          strokeWidth={2}
                          style={{ cursor: 'ns-resize' }}
                          onPointerDown={onPointerDown('pupil')}
                        />
                        )}
                          </>
                        )}

                        {/* маркер 12:00 */}
                        {showGrid && (
                        <text
                          x={c.x}
                          y={c.y - lr - 14}
                          textAnchor="middle"
                          fill="#fbbf24"
                          fontSize={13}
                          fontWeight={700}
                        >
                          12:00
                        </text>
                        )}
                      </>
                    )
                  })()}
                </svg>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3 text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> {CALIBRATION.pupilLabel}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> {CALIBRATION.outerLabel}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGrid(v => !v)}
                  className="h-8 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  {showGrid ? CALIBRATION.hideGrid : CALIBRATION.showGrid}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={!loaded || analysing}
                  className="h-8 gap-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <ArrowClockwise size={15} />
                  {CALIBRATION.autoReset}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">{stepHint}</p>

            {geo && calStep === 'outer' && (
              <div className="mt-3 space-y-2 rounded-xl bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{CALIBRATION.outerLabel}</span>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => adjustRadius('limbus', -2)}>
                      {CALIBRATION.smaller}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => adjustRadius('limbus', 2)}>
                      {CALIBRATION.larger}
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[Math.round(geo.limbus.r)]}
                  min={Math.round(geo.pupil.r * 1.5)}
                  max={limbusSliderMax}
                  step={1}
                  onValueChange={([v]) => {
                    setTouched(true)
                    setGeo(prev =>
                      prev
                        ? concentricGeometry({
                            ...prev,
                            limbus: { ...prev.limbus, r: v },
                            manual: true,
                            limbusConfidence: 1,
                          })
                        : prev
                    )
                  }}
                />
              </div>
            )}

            {geo && calStep === 'inner' && (
              <div className="mt-3 space-y-2 rounded-xl bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{CALIBRATION.pupilLabel}</span>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => adjustRadius('pupil', -2)}>
                      {CALIBRATION.smaller}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => adjustRadius('pupil', 2)}>
                      {CALIBRATION.larger}
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[Math.round(geo.pupil.r)]}
                  min={4}
                  max={pupilSliderMax}
                  step={1}
                  onValueChange={([v]) => {
                    setTouched(true)
                    setGeo(prev =>
                      prev
                        ? concentricGeometry({
                            ...prev,
                            pupil: { ...prev.pupil, r: v },
                            manual: true,
                            pupilConfidence: 1,
                          })
                        : prev
                    )
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Панел с оценка ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {/* резултат */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="10"
                    />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke={
                        scoreTone === 'emerald'
                          ? '#34d399'
                          : scoreTone === 'amber'
                            ? '#fbbf24'
                            : '#fb7185'
                      }
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 42}
                      initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                      animate={{
                        strokeDashoffset: 2 * Math.PI * 42 * (1 - score / 100),
                      }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold leading-none">
                      {analysing ? '—' : score}
                    </span>
                    <span className="text-[10px] text-slate-500">от 100</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold">
                    {analysing
                      ? 'Проверяваме снимката…'
                      : cannotConfirm
                        ? CALIBRATION.needsRetake
                        : (report?.headline ?? '')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {analysing
                      ? 'Проверяваме резкостта, осветеността и видимата зона на ириса.'
                      : cannotConfirm
                        ? CALIBRATION.needsRetakeHint
                        : touched
                          ? CALIBRATION.manualOk
                          : CALIBRATION.autoOk}
                  </p>
                </div>
              </div>

              {/* метрики */}
              {report && !analysing && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: CALIBRATION.metricSharpness, value: report.metrics.sharpness },
                    { label: CALIBRATION.metricPupil, value: touched ? 1 : report.geometry.pupilConfidence },
                    {
                      label: CALIBRATION.metricCoverage,
                      value: coverage ?? report.metrics.frameCoverage,
                    },
                    { label: CALIBRATION.metricGlare, value: 1 - Math.min(1, report.metrics.glare / 0.12) },
                  ].map(m => (
                    <div key={m.label} className="rounded-xl bg-white/[0.04] p-2">
                      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                        {m.label}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className={`h-full rounded-full bg-gradient-to-r ${
                            toneClasses[
                              m.value >= 0.66 ? 'emerald' : m.value >= 0.4 ? 'amber' : 'rose'
                            ]
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(Math.max(0, Math.min(1, m.value)) * 100)}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* проблеми */}
            {!analysing && report && (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {blockingErrors.map(i => (
                  <IssueRow key={i.code} tone="error" title={i.message} body={i.fix} />
                ))}
                {warnings.map(i => (
                  <IssueRow key={i.code} tone="warn" title={i.message} body={i.fix} />
                ))}
                {!cannotConfirm && warnings.length === 0 && (
                  <IssueRow
                    tone="ok"
                    title="Няма установени проблеми"
                    body="Снимката е подходяща за анализ."
                  />
                )}
              </div>
            )}

            {/* разгъвката */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <button
                type="button"
                onClick={() => setShowStrip(v => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Sparkle size={16} weight="fill" className="text-sky-400" />
                  {CALIBRATION.stripTitle}
                </span>
                <Badge variant="outline" className="border-white/15 text-[10px] text-slate-400">
                  {showStrip ? 'скрий' : 'покажи'}
                </Badge>
              </button>
              <AnimatePresence initial={false}>
                {showStrip && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 overflow-x-auto rounded-xl bg-white p-1">
                      {/* min-w държи лентата над прага на четимост — при тесен
                          екран контейнерът скролва хоризонтално вместо да я свива. */}
                      {strip ? (
                        <img src={strip} alt="Разгъната карта на ириса" className="min-w-[880px]" />
                      ) : (
                        <div className="flex h-24 items-center justify-center text-xs text-slate-500">
                          Изчисляване…
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{CALIBRATION.stripHint}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Действия */}
        <div className="flex flex-col gap-2 border-t border-white/10 bg-slate-900/60 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onRetake}
            className="gap-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <ImageIcon size={18} />
            {CALIBRATION.retake}
          </Button>
          <Button
            onClick={confirm}
            disabled={analysing || !geo || !report || cannotConfirm}
            className="gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-400 hover:to-indigo-400 disabled:opacity-40"
          >
            <Eye size={18} weight="bold" />
            {cannotConfirm
              ? CALIBRATION.needsRetake
              : warnings.length > 0
                ? CALIBRATION.confirmWarn
                : CALIBRATION.confirm}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function IssueRow({
  tone,
  title,
  body,
}: {
  tone: 'error' | 'warn' | 'ok'
  title: string
  body: string
}) {
  const cfg = {
    error: {
      icon: <XCircle size={18} weight="fill" className="text-rose-400" />,
      ring: 'border-rose-500/25 bg-rose-500/[0.07]',
    },
    warn: {
      icon: <WarningCircle size={18} weight="fill" className="text-amber-400" />,
      ring: 'border-amber-500/25 bg-amber-500/[0.07]',
    },
    ok: {
      icon: <CheckCircle size={18} weight="fill" className="text-emerald-400" />,
      ring: 'border-emerald-500/25 bg-emerald-500/[0.07]',
    },
  }[tone]

  return (
    <div className={`flex gap-2.5 rounded-xl border p-3 ${cfg.ring}`}>
      <div className="mt-0.5 shrink-0">{cfg.icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{body}</p>
      </div>
    </div>
  )
}
