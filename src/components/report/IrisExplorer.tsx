import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Crosshair,
  Eye,
  Lightbulb,
  MapTrifold,
  Sparkle,
  X,
} from '@phosphor-icons/react'
import { fitImageInSquare } from '@/lib/image-utils'
import { cellCenterInView, findingOverlayPath, ringTopCenterInView } from '@/lib/iris-coords'
import { isCircumferentialFinding, sectorsFor, RING_BANDS } from '@/lib/iris-map'
import { groupFindingsForDisplay, isPlanRelevantFinding } from '@/lib/calibrated-report-summary'
import { readFinding, type SignalStrength } from '@/lib/iris-reading'
import type { AnalysisReport, CalibratedAnalysisPayload, IrisGeometrySnapshot } from '@/types'

const VIEW = 360

type Finding = CalibratedAnalysisPayload['findings'][number]
type Side = 'left' | 'right'

const STRENGTH_STYLE: Record<SignalStrength, { dot: string; fill: string; text: string }> = {
  clear: { dot: '#ea580c', fill: 'rgba(234,88,12,0.42)', text: 'text-orange-700' },
  moderate: { dot: '#f59e0b', fill: 'rgba(245,158,11,0.38)', text: 'text-amber-700' },
  faint: { dot: '#facc15', fill: 'rgba(250,204,21,0.3)', text: 'text-yellow-700' },
}

function useOverlay(geometry?: IrisGeometrySnapshot) {
  return useMemo(() => {
    if (!geometry?.imageWidth || !geometry.imageHeight) return null
    const fit = fitImageInSquare(geometry.imageWidth, geometry.imageHeight, VIEW)
    return {
      cx: geometry.limbus.cx * fit.scale + fit.offsetX,
      cy: geometry.limbus.cy * fit.scale + fit.offsetY,
      pr: geometry.pupil.r * fit.scale,
      lr: geometry.limbus.r * fit.scale,
    }
  }, [geometry])
}

function pt(cx: number, cy: number, r: number, minute: number) {
  const t = (minute / 60) * Math.PI * 2
  return { x: cx + r * Math.sin(t), y: cy - r * Math.cos(t) }
}

function wedgePath(cx: number, cy: number, r0: number, r1: number, sector: number) {
  const m0 = (sector - 1) * 5
  const m1 = sector * 5
  const a = pt(cx, cy, r1, m0)
  const b = pt(cx, cy, r1, m1)
  const c = pt(cx, cy, r0, m1)
  const d = pt(cx, cy, r0, m0)
  return `M${a.x},${a.y} A${r1},${r1} 0 0 1 ${b.x},${b.y} L${c.x},${c.y} A${r0},${r0} 0 0 0 ${d.x},${d.y} Z`
}

function markerPoint(f: Finding, geometry: IrisGeometrySnapshot) {
  return isCircumferentialFinding(f.type)
    ? ringTopCenterInView(f.ring, geometry, VIEW)
    : cellCenterInView(f.sector, f.ring, geometry, VIEW)
}

/** Голямото интерактивно око: снимка + карта на зоните + номерирани знаци. */
function EyeStage({
  side,
  dataUrl,
  geometry,
  findings,
  active,
  onSelect,
  showZones,
  showMarks,
}: {
  side: Side
  dataUrl: string
  geometry?: IrisGeometrySnapshot
  findings: Finding[]
  active: number | null
  onSelect: (i: number | null) => void
  showZones: boolean
  showMarks: boolean
}) {
  const ov = useOverlay(geometry)
  const [hoverSector, setHoverSector] = useState<number | null>(null)
  const sectors = sectorsFor(side)
  const hovered = hoverSector ? sectors[hoverSector - 1] : null
  // Часовете стоят извън ириса, освен ако ирисът изпълва кадъра — тогава вътре.
  const labelR = ov
    ? Math.min(ov.cx, ov.cy, VIEW - ov.cx, VIEW - ov.cy) > ov.lr + 22
      ? ov.lr + 13
      : ov.lr - 12
    : 0

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px] select-none overflow-hidden rounded-[28px] bg-slate-950 shadow-2xl shadow-primary/10 ring-1 ring-black/10">
      {dataUrl ? (
        <img src={dataUrl} alt={side === 'left' ? 'Ляв ирис' : 'Десен ирис'} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">Няма снимка</div>
      )}

      {ov && geometry && (
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="absolute inset-0 h-full w-full" onClick={() => onSelect(null)}>
          {/* потъмняване извън ириса — фокусира погледа */}
          <defs>
            <mask id={`iris-hole-${side}`}>
              <rect width={VIEW} height={VIEW} fill="white" />
              <circle cx={ov.cx} cy={ov.cy} r={ov.lr + 2} fill="black" />
            </mask>
          </defs>
          <rect width={VIEW} height={VIEW} fill="rgba(2,6,23,0.45)" mask={`url(#iris-hole-${side})`} />

          {showZones && (
            <g>
              {RING_BANDS.slice(1).map(b => {
                const r = ov.pr + (ov.lr - ov.pr) * (b.rings[0] / 12)
                return <circle key={b.key} cx={ov.cx} cy={ov.cy} r={r} fill="none" stroke="rgba(186,230,253,0.35)" strokeDasharray="2 3" strokeWidth={0.8} />
              })}
              {sectors.map(s => (
                <path
                  key={s.id}
                  d={wedgePath(ov.cx, ov.cy, ov.pr, ov.lr, s.id)}
                  fill={hoverSector === s.id ? 'rgba(56,189,248,0.22)' : 'rgba(56,189,248,0.0)'}
                  stroke="rgba(186,230,253,0.4)"
                  strokeWidth={0.7}
                  className="cursor-help transition-[fill] duration-150"
                  onMouseEnter={() => setHoverSector(s.id)}
                  onMouseLeave={() => setHoverSector(null)}
                  onClick={e => {
                    e.stopPropagation()
                    setHoverSector(hoverSector === s.id ? null : s.id)
                  }}
                />
              ))}
              {Array.from({ length: 12 }, (_, k) => {
                const hour = k === 0 ? 12 : k
                const p = pt(ov.cx, ov.cy, labelR, k * 5)
                const lit = hoverSector != null && (hoverSector - 1 === k || hoverSector % 12 === k)
                return (
                  <text key={`t${k}`} x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={lit ? '#7dd3fc' : 'rgba(255,255,255,0.75)'} className="pointer-events-none">
                    {hour}
                  </text>
                )
              })}
            </g>
          )}

          <circle cx={ov.cx} cy={ov.cy} r={ov.lr} fill="none" stroke="rgba(251,191,36,0.75)" strokeWidth={1.4} strokeDasharray="5 4" className="pointer-events-none" />
          <circle cx={ov.cx} cy={ov.cy} r={ov.pr} fill="none" stroke="rgba(56,189,248,0.85)" strokeWidth={1.4} className="pointer-events-none" />

          {showMarks &&
            findings.map((f, i) => {
              const s = STRENGTH_STYLE[readFinding(f).strength]
              return (
                <path
                  key={`a${i}`}
                  d={findingOverlayPath(f, geometry, VIEW)}
                  fill={active === i ? s.fill : active === null ? s.fill.replace(/0\.\d+\)$/, '0.22)') : 'rgba(255,255,255,0.04)'}
                  stroke={active === i ? '#fff' : 'rgba(255,255,255,0.25)'}
                  strokeWidth={active === i ? 1.6 : 0.6}
                  className="cursor-pointer transition-all duration-200"
                  onClick={e => {
                    e.stopPropagation()
                    onSelect(active === i ? null : i)
                  }}
                />
              )
            })}

          {showMarks &&
            findings.map((f, i) => {
              const p = markerPoint(f, geometry)
              const strength = readFinding(f).strength
              const s = STRENGTH_STYLE[strength]
              const on = active === i
              return (
                <g
                  key={`m${i}`}
                  className="cursor-pointer"
                  onClick={e => {
                    e.stopPropagation()
                    onSelect(on ? null : i)
                  }}
                  role="button"
                  aria-label={`Знак ${i + 1}: ${f.label}`}
                >
                  {on && (
                    <circle cx={p.x} cy={p.y} r={14} fill="none" stroke="#fff" strokeWidth={1.5} className="iris-pulse" />
                  )}
                  {/* Ясният знак носи и външен пръстен — силата не се чете само по цвета. */}
                  {strength === 'clear' && (
                    <circle cx={p.x} cy={p.y} r={on ? 13 : 11} fill="none" stroke={s.dot} strokeWidth={1.8} />
                  )}
                  <circle cx={p.x} cy={p.y} r={on ? 10.5 : 8.5} fill={s.dot} stroke="#fff" strokeWidth={1.6} className="transition-all duration-200" />
                  <text x={p.x} y={p.y + 3.4} textAnchor="middle" fontSize={on ? 10.5 : 9.5} fontWeight={800} fill="#fff" className="pointer-events-none">
                    {i + 1}
                  </text>
                </g>
              )
            })}
        </svg>
      )}

      <AnimatePresence>
        {showZones && hovered && (
          <motion.div
            key={hovered.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-slate-900/85 px-3 py-2 text-xs text-white backdrop-blur"
          >
            <span className="font-semibold text-sky-300">{hovered.clock}</span> · {hovered.label}
            <span className="block text-[11px] text-slate-400">По иридологичната карта: {hovered.reference}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FindingDetail({
  f,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  f: Finding
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const r = readFinding(f)
  const s = STRENGTH_STYLE[r.strength]
  return (
    <motion.div
      key={`${f.side}-${index}`}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white shadow" style={{ background: s.dot }}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-lg font-bold leading-tight">{r.title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{r.where}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Затвори">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.reliability.map((chip, i) => (
          <span key={chip} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${i === 0 ? `bg-muted ${s.text}` : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'}`}>
            {i > 0 && <CheckCircle size={12} weight="fill" />}
            {chip}
          </span>
        ))}
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        {r.zone && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Зона</dt>
            <dd className="mt-0.5 font-medium">{r.zone}</dd>
          </div>
        )}
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Какво означава</dt>
          <dd className="mt-0.5 leading-relaxed">
            {r.meaning.charAt(0).toUpperCase() + r.meaning.slice(1)}. {r.bandMeaning}
          </dd>
        </div>
        <div className="rounded-xl bg-primary/5 p-3 ring-1 ring-primary/15">
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Lightbulb size={13} weight="fill" /> Какво да направите
          </dt>
          <dd className="mt-1 leading-relaxed">{r.support}</dd>
        </div>
        {r.ophthalmicNote && (
          <div className="rounded-xl bg-sky-50 p-3 text-sky-950 ring-1 ring-sky-200">
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              <Eye size={13} weight="fill" /> Погледът на офталмолога
            </dt>
            <dd className="mt-1 leading-relaxed">{r.ophthalmicNote}</dd>
          </div>
        )}
        {r.mapReference && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            По иридологичната карта зоната съответства на: {r.mapReference}. Това е справка от картата, не оценка на органа.
          </p>
        )}
      </dl>

      <div className="mt-auto flex items-center justify-between pt-4">
        <button type="button" onClick={onPrev} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10">
          <ArrowLeft size={14} /> Предишен
        </button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {index + 1} / {total}
        </span>
        <button type="button" onClick={onNext} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10">
          Следващ <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  )
}

function FindingList({ findings, onSelect, side, reviewed }: { findings: Finding[]; onSelect: (i: number) => void; side: Side; reviewed: number }) {
  if (findings.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
        <Sparkle size={32} weight="duotone" className="text-emerald-500" />
        <p className="font-semibold">Чист ирис в това око</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {reviewed > 0
            ? `Прегледани са ${reviewed} точки — нито една не е достатъчно ясна, за да промени плана.`
            : 'Няма открити ирисови акценти за това око.'}
        </p>
      </div>
    )
  }
  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Crosshair size={16} className="text-primary" />
        Докоснете номер на снимката или знак от списъка.
      </p>
      <ul className="space-y-2">
        {findings.map((f, i) => {
          const r = readFinding(f)
          const s = STRENGTH_STYLE[r.strength]
          return (
            <motion.li key={`${side}-${f.type}-${f.sector}-${f.ring}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="group flex w-full items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2.5 text-left ring-1 ring-transparent transition hover:bg-background hover:shadow-md hover:ring-primary/20 active:scale-[0.99]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white" style={{ background: s.dot }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{r.zone ?? r.where}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Интерактивен изследовател на ириса: едно голямо око, превключвател ляво/дясно,
 * карта на зоните при поискване и подробно „разчитане" на всеки знак.
 */
export default function IrisExplorer({ report }: { report: AnalysisReport }) {
  const cal = report.calibrated
  const perSide = useMemo(() => {
    const out: Record<Side, { shown: Finding[]; reviewed: number }> = {
      left: { shown: [], reviewed: 0 },
      right: { shown: [], reviewed: 0 },
    }
    for (const side of ['left', 'right'] as const) {
      const all = (cal?.findings ?? []).filter(f => f.side === side)
      out[side] = { shown: groupFindingsForDisplay(all.filter(isPlanRelevantFinding)), reviewed: all.length }
    }
    return out
  }, [cal])

  const firstSide: Side = perSide.right.shown.length >= perSide.left.shown.length ? 'right' : 'left'
  const [side, setSide] = useState<Side>(firstSide)
  const [active, setActive] = useState<number | null>(null)
  const [showZones, setShowZones] = useState(false)
  const [showMarks, setShowMarks] = useState(true)

  const list = perSide[side].shown

  useEffect(() => setActive(null), [side])

  useEffect(() => {
    if (active === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setActive(a => (a === null ? 0 : (a + 1) % list.length))
      if (e.key === 'ArrowLeft') setActive(a => (a === null ? 0 : (a - 1 + list.length) % list.length))
      if (e.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, list.length])

  if (!cal) return null

  const image = side === 'left' ? report.leftIrisImage : report.rightIrisImage

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/5 via-transparent to-accent/5 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold">Вашите ириси отблизо</h3>
          <p className="text-xs text-muted-foreground">Всеки номер е знак, който влиза в плана. Числата около ириса са часовете от картата.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-muted p-1" role="tablist" aria-label="Око">
            {(['left', 'right'] as const).map(s => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={side === s}
                onClick={() => setSide(s)}
                className={`relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${side === s ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {side === s && <motion.span layoutId="eye-pill" className="absolute inset-0 rounded-full bg-primary shadow" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <span className="relative">
                  {s === 'left' ? 'Ляв' : 'Десен'}
                  <span className="ml-1.5 text-[11px] opacity-80">{perSide[s].shown.length}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-4 sm:p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-6">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={side} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25 }}>
              <EyeStage
                side={side}
                dataUrl={image?.dataUrl ?? ''}
                geometry={image?.geometry}
                findings={list}
                active={active}
                onSelect={setActive}
                showZones={showZones}
                showMarks={showMarks}
              />
            </motion.div>
          </AnimatePresence>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Toggle on={showMarks} onClick={() => setShowMarks(v => !v)} icon={<Crosshair size={14} />} label="Знаци" />
            <Toggle on={showZones} onClick={() => setShowZones(v => !v)} icon={<MapTrifold size={14} />} label="Карта на зоните" />
          </div>
          <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground">
            {(['clear', 'moderate'] as const).map(k => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: STRENGTH_STYLE[k].dot,
                    boxShadow: k === 'clear' ? `0 0 0 1.5px var(--background, #fff), 0 0 0 3px ${STRENGTH_STYLE[k].dot}` : undefined,
                  }}
                />
                {k === 'clear' ? 'ясен знак' : 'умерен знак'}
              </span>
            ))}
          </div>
        </div>

        <div className="min-h-[320px] min-w-0 rounded-2xl md:border md:bg-background md:p-5">
          <AnimatePresence mode="wait">
            {active !== null && list[active] ? (
              <FindingDetail
                key={`d-${side}-${active}`}
                f={list[active]}
                index={active}
                total={list.length}
                onPrev={() => setActive((active - 1 + list.length) % list.length)}
                onNext={() => setActive((active + 1) % list.length)}
                onClose={() => setActive(null)}
              />
            ) : (
              <motion.div key={`l-${side}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <FindingList findings={list} onSelect={setActive} side={side} reviewed={perSide[side].reviewed} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  )
}

function Toggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${on ? 'bg-primary/10 text-primary ring-primary/30' : 'bg-background text-muted-foreground ring-border hover:text-foreground'}`}
    >
      {icon}
      {label}
    </button>
  )
}
