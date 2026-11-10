import { useEffect, useMemo, useReducer, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, CircleNotch, Warning } from '@phosphor-icons/react'
import type { IrisImage } from '@/types'
import type { PipelineEvent } from '@/lib/iris-pipeline'

type Side = 'left' | 'right'
type Layer = 'structure' | 'pigment'

interface PassCount {
  started: number
  done: number
  failed: number
  accepted: number
}

interface EyeState {
  prep?: { quality: number; coverage: number }
  passes: Record<Layer, PassCount>
  merge?: { total: number; confirmed: number }
  constitution?: string
  verify?: { checked: number; seen: number; notSeen: number; points: Array<{ minute: number; ring: number }> }
  /** Слоят, който се чете в момента — за цвета на лъча. */
  activeLayer?: Layer
}

interface FeedItem {
  id: number
  text: string
  tone: 'info' | 'ok' | 'warn'
}

export interface LiveState {
  eyes: Record<Side, EyeState>
  screen?: { signs: number }
  score: 'idle' | 'start' | 'done'
  plan: 'idle' | 'start' | 'done' | 'fail'
  feed: FeedItem[]
  seq: number
  /** Получено ли е поне едно събитие (иначе екранът следва само прогреса). */
  live: boolean
}

const emptyPasses = (): Record<Layer, PassCount> => ({
  structure: { started: 0, done: 0, failed: 0, accepted: 0 },
  pigment: { started: 0, done: 0, failed: 0, accepted: 0 },
})

export const initialLiveState = (): LiveState => ({
  eyes: { left: { passes: emptyPasses() }, right: { passes: emptyPasses() } },
  score: 'idle',
  plan: 'idle',
  feed: [],
  seq: 0,
  live: false,
})

const EYE = { left: 'Ляв ирис', right: 'Десен ирис' } as const
const LAYER = { structure: 'структура', pigment: 'пигменти' } as const

function knaka(n: number) {
  return n === 1 ? '1 знак' : `${n} знака`
}

/** Превежда събитие в ред от журнала — на човешки език, без технически думи. */
function feedText(ev: PipelineEvent): { text: string; tone: FeedItem['tone'] } | null {
  switch (ev.kind) {
    case 'prep':
      return {
        text: `${EYE[ev.side]}: снимката е разгъната в карта — качество ${Math.round(ev.quality)}/100, видими ${Math.round(ev.coverage * 100)} %`,
        tone: 'info',
      }
    case 'pass':
      if (ev.status === 'done')
        return {
          text: `${EYE[ev.side]} · ${LAYER[ev.layer]}, прочит ${ev.reading + 1}: ${ev.accepted ? knaka(ev.accepted) : 'без знаци'}`,
          tone: 'info',
        }
      if (ev.status === 'fail')
        return { text: `${EYE[ev.side]} · ${LAYER[ev.layer]}, прочит ${ev.reading + 1} не успя — разчитаме на другия`, tone: 'warn' }
      return null
    case 'merge':
      return {
        text: `${EYE[ev.side]}: ${knaka(ev.total)}, ${ev.confirmed} от тях — и в двата независими прочита`,
        tone: 'ok',
      }
    case 'constitution':
      return ev.label ? { text: `${EYE[ev.side]}: тип на ириса — ${ev.label.toLowerCase()}`, tone: 'info' } : null
    case 'verify':
      if (ev.checked === 0) return null
      return {
        text:
          `${EYE[ev.side]}: ${ev.seen} от ${ev.checked} знака се виждат ясно на снимката` +
          (ev.notSeen > 0 ? ` — ${ev.notSeen} отпадат` : ''),
        tone: ev.notSeen > 0 ? 'warn' : 'ok',
      }
    case 'screen':
      return {
        text: ev.signs > 0 ? `Очен скрининг: ${knaka(ev.signs)} за преглед при очен лекар` : 'Очен скрининг: без знаци за безпокойство',
        tone: ev.signs > 0 ? 'warn' : 'ok',
      }
    case 'score':
      return ev.status === 'done' ? { text: 'Отговорите и ирисът са сверени — областите за работа са подредени', tone: 'ok' } : null
    case 'plan':
      if (ev.status === 'start') return { text: 'Пишем личния план — храни, добавки, навици', tone: 'info' }
      if (ev.status === 'done') return { text: 'Планът е готов', tone: 'ok' }
      return { text: 'Планът не се генерира — ще опитаме отново', tone: 'warn' }
  }
}

export type LiveAction = PipelineEvent | { kind: 'reset' }

export function liveReducer(state: LiveState, ev: LiveAction): LiveState {
  if (ev.kind === 'reset') return initialLiveState()
  const next: LiveState = { ...state, live: true, eyes: { left: { ...state.eyes.left }, right: { ...state.eyes.right } } }
  switch (ev.kind) {
    case 'prep':
      next.eyes[ev.side].prep = { quality: ev.quality, coverage: ev.coverage }
      break
    case 'pass': {
      const eye = next.eyes[ev.side]
      const p = { ...eye.passes[ev.layer] }
      if (ev.status === 'start') p.started++
      if (ev.status === 'done') {
        p.done++
        p.accepted += ev.accepted ?? 0
      }
      if (ev.status === 'fail') p.failed++
      eye.passes = { ...eye.passes, [ev.layer]: p }
      eye.activeLayer = ev.status === 'start' ? ev.layer : eye.activeLayer
      break
    }
    case 'merge':
      next.eyes[ev.side].merge = { total: ev.total, confirmed: ev.confirmed }
      break
    case 'constitution':
      next.eyes[ev.side].constitution = ev.label
      break
    case 'verify':
      next.eyes[ev.side].verify = { checked: ev.checked, seen: ev.seen, notSeen: ev.notSeen, points: ev.points }
      break
    case 'screen':
      next.screen = { signs: ev.signs }
      break
    case 'score':
      next.score = ev.status
      break
    case 'plan':
      next.plan = ev.status
      break
  }
  const line = feedText(ev)
  if (line) {
    next.seq = state.seq + 1
    next.feed = [{ id: next.seq, ...line }, ...state.feed].slice(0, 6)
  }
  return next
}

export function useLiveState() {
  return useReducer(liveReducer, undefined, initialLiveState)
}

/* ── окото със скенера ───────────────────────────────────────────────────── */

const EYE_SIZE = 148

function ScanEye({ image, eye, scanning, label }: { image: IrisImage; eye: EyeState; scanning: boolean; label: string }) {
  const reduce = useReducedMotion()
  const geo = image.geometry
  const S = EYE_SIZE
  const fit = useMemo(() => {
    if (!geo?.imageWidth || !geo.limbus?.r) return null
    const scale = (S * 0.44) / geo.limbus.r
    return {
      scale,
      w: geo.imageWidth * scale,
      h: geo.imageHeight * scale,
      left: S / 2 - geo.limbus.cx * scale,
      top: S / 2 - geo.limbus.cy * scale,
      pr: geo.pupil.r * scale,
      lr: geo.limbus.r * scale,
    }
  }, [geo, S])
  const pr = fit?.pr ?? S * 0.12
  const lr = fit?.lr ?? S * 0.44
  const color = eye.activeLayer === 'pigment' ? '245,158,11' : '56,189,248'
  const verified = eye.verify

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative overflow-hidden rounded-full bg-slate-900 shadow-lg ring-1 ring-black/10" style={{ width: S, height: S }}>
        {image.dataUrl &&
          (fit ? (
            <img
              src={image.dataUrl}
              alt={label}
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ width: fit.w, height: fit.h, left: fit.left, top: fit.top }}
            />
          ) : (
            <img src={image.dataUrl} alt={label} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          ))}
        <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 h-full w-full">
          {/* картата 12 × 12, по която се чете */}
          <g stroke="rgba(186,230,253,0.35)" strokeWidth={0.6} fill="none">
            <circle cx={S / 2} cy={S / 2} r={lr} stroke="rgba(251,191,36,0.7)" strokeWidth={1} />
            <circle cx={S / 2} cy={S / 2} r={pr} stroke="rgba(56,189,248,0.8)" strokeWidth={1} />
            {[4, 8].map(k => (
              <circle key={k} cx={S / 2} cy={S / 2} r={pr + ((lr - pr) * k) / 12} strokeDasharray="2 3" />
            ))}
            {Array.from({ length: 12 }, (_, k) => {
              const t = (k / 12) * Math.PI * 2
              return (
                <line
                  key={k}
                  x1={S / 2 + pr * Math.sin(t)}
                  y1={S / 2 - pr * Math.cos(t)}
                  x2={S / 2 + lr * Math.sin(t)}
                  y2={S / 2 - lr * Math.cos(t)}
                />
              )
            })}
          </g>
          {/* знаците, които проверката по снимката потвърди */}
          {verified?.points.map((p, i) => {
            const t = (p.minute / 60) * Math.PI * 2
            const rad = pr + (lr - pr) * (p.ring / 12)
            const x = S / 2 + rad * Math.sin(t)
            const y = S / 2 - rad * Math.cos(t)
            return (
              <motion.g key={i} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.12 }} style={{ transformOrigin: `${x}px ${y}px` }}>
                <circle cx={x} cy={y} r={5.5} fill="none" stroke="#fff" strokeWidth={1.4} />
                <circle cx={x} cy={y} r={2} fill="#f97316" />
              </motion.g>
            )
          })}
        </svg>
        {/* въртящ се лъч — само докато окото се чете */}
        {scanning && !reduce && (
          <div
            className="pointer-events-none absolute inset-0 animate-[spin_2.6s_linear_infinite] rounded-full"
            style={{
              background: `conic-gradient(from 0deg, rgba(${color},0) 0deg, rgba(${color},0) 300deg, rgba(${color},0.45) 355deg, rgba(${color},0.75) 360deg)`,
              mixBlendMode: 'screen',
            }}
          />
        )}
        {scanning && reduce && <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-sky-400/70" />}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {verified
            ? verified.checked > 0
              ? `${verified.seen} видими знака`
              : 'проверено'
            : scanning
              ? eye.activeLayer === 'pigment'
                ? 'чете пигментите'
                : 'чете структурата'
              : eye.prep
                ? 'готово за четене'
                : 'подготовка'}
        </p>
      </div>
    </div>
  )
}

/* ── стъпките ────────────────────────────────────────────────────────────── */

type StepStatus = 'pending' | 'running' | 'done' | 'warn'

interface Step {
  key: string
  title: string
  detail: string
  status: StepStatus
  sub?: Array<{ label: string; value: string; status: StepStatus }>
}

function passStatus(p: PassCount): StepStatus {
  if (p.done + p.failed >= 2) return p.failed >= 2 ? 'warn' : 'done'
  return p.started > 0 ? 'running' : 'pending'
}

function eyeStep(side: Side, e: EyeState): Step {
  const s = passStatus(e.passes.structure)
  const p = passStatus(e.passes.pigment)
  const started = e.passes.structure.started + e.passes.pigment.started > 0
  const status: StepStatus = e.merge ? 'done' : started ? 'running' : 'pending'
  const count = (c: PassCount) => `${c.done + c.failed}/2 прочита`
  return {
    key: side,
    title: EYE[side],
    detail: e.merge
      ? `${knaka(e.merge.total)} · ${e.merge.confirmed} потвърдени при повторния прочит`
      : 'Всеки слой се чете два пъти, независимо — със завъртяна карта',
    status,
    sub: [
      { label: 'Структура — лакуни, бразди, влакна', value: count(e.passes.structure), status: s },
      { label: 'Пигменти — петна и оцветяване', value: count(e.passes.pigment), status: p },
      {
        label: 'Сверка на двата прочита',
        value: e.merge ? `${e.merge.confirmed} съвпадения` : '—',
        status: e.merge ? 'done' : s === 'done' && p === 'done' ? 'running' : 'pending',
      },
    ],
  }
}

function buildSteps(st: LiveState, progress: number): Step[] {
  const { left, right } = st.eyes
  // Без събития (наследен анализ) стъпките следват само прогреса.
  const byProgress = (from: number, to: number): StepStatus =>
    progress >= to ? 'done' : progress >= from ? 'running' : 'pending'

  if (!st.live) {
    return [
      { key: 'prep', title: 'Подготовка на снимките', detail: 'Намираме зеницата и ръба на ириса', status: byProgress(0, 15) },
      { key: 'read', title: 'Разчитане на двата ириса', detail: 'Структура и пигменти, всеки слой два пъти', status: byProgress(15, 65) },
      { key: 'cross', title: 'Кръстосан анализ', detail: 'Отговорите и ирисът се сверяват един с друг', status: byProgress(65, 75) },
      { key: 'plan', title: 'Вашият личен план', detail: 'Хранене, добавки и навици', status: byProgress(75, 100) },
    ]
  }

  const prepDone = !!(left.prep && right.prep)
  const verifyL = left.verify
  const verifyR = right.verify
  const verifyDone = !!(verifyL && verifyR)
  const anyScan = left.passes.structure.started + right.passes.structure.started > 0
  const checked = (verifyL?.checked ?? 0) + (verifyR?.checked ?? 0)
  const seen = (verifyL?.seen ?? 0) + (verifyR?.seen ?? 0)

  return [
    {
      key: 'prep',
      title: 'Подготовка на снимките',
      detail: prepDone
        ? `Качество: ляв ${Math.round(left.prep!.quality)}/100 · десен ${Math.round(right.prep!.quality)}/100`
        : 'Намираме зеницата и ръба на ириса и разгъваме всяко око в карта 12 × 12',
      status: prepDone ? 'done' : 'running',
    },
    eyeStep('left', left),
    eyeStep('right', right),
    {
      key: 'verify',
      title: 'Проверка по снимката',
      detail: verifyDone
        ? checked > 0
          ? `${seen} от ${checked} знака се виждат ясно — само те ще бъдат посочени`
          : 'Няма знаци с конкретно място за проверка'
        : 'Всеки знак се търси в самите пиксели — невидимото отпада',
      status: verifyDone ? 'done' : verifyL || verifyR || (left.merge && right.merge) ? 'running' : 'pending',
    },
    {
      key: 'screen',
      title: 'Очен скрининг',
      detail: st.screen
        ? st.screen.signs > 0
          ? `${knaka(st.screen.signs)} за преглед при очен лекар`
          : 'Без знаци за безпокойство'
        : 'Склера, ръб на роговицата и зеница — отделно от ириса',
      status: st.screen ? (st.screen.signs > 0 ? 'warn' : 'done') : anyScan ? 'running' : 'pending',
    },
    {
      key: 'cross',
      title: 'Кръстосан анализ',
      detail: 'Знаците в ириса се тълкуват през отговорите ви, а отговорите — спрямо ириса',
      status: st.score === 'done' ? 'done' : st.score === 'start' ? 'running' : 'pending',
    },
    {
      key: 'plan',
      title: 'Вашият личен план',
      detail: st.plan === 'done' ? 'Готов' : 'Храни, добавки и навици — най-дългата стъпка',
      status: st.plan === 'done' ? 'done' : st.plan === 'fail' ? 'warn' : st.plan === 'start' ? 'running' : 'pending',
    },
  ]
}

function StatusIcon({ status, size = 'md' }: { status: StepStatus; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  const icon = size === 'sm' ? 10 : 14
  if (status === 'done')
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground`}>
        <Check size={icon} weight="bold" />
      </span>
    )
  if (status === 'warn')
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-amber-500 text-white`}>
        <Warning size={icon} weight="bold" />
      </span>
    )
  if (status === 'running')
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-2 ring-primary/40`}>
        <CircleNotch size={icon} weight="bold" className="animate-spin" />
      </span>
    )
  return <span className={`${box} shrink-0 rounded-full bg-muted`} />
}

/* ── целият екран ────────────────────────────────────────────────────────── */

export default function AnalysisLiveView({
  state,
  progress,
  status,
  leftIris,
  rightIris,
}: {
  state: LiveState
  progress: number
  status: string
  leftIris: IrisImage
  rightIris: IrisImage
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [])

  const steps = buildSteps(state, progress)
  const scanning = (e: EyeState) => !e.merge && e.passes.structure.started + e.passes.pigment.started > 0
  const leftScan = state.live ? scanning(state.eyes.left) : progress >= 15 && progress < 65
  const rightScan = state.live ? scanning(state.eyes.right) : progress >= 15 && progress < 65

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-start justify-center gap-6 sm:gap-10">
        <ScanEye image={rightIris} eye={state.eyes.right} scanning={rightScan} label="Десен ирис" />
        <ScanEye image={leftIris} eye={state.eyes.left} scanning={leftScan} label="Ляв ирис" />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-medium">{status}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} · {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            animate={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      <ol className="space-y-2">
        {steps.map((step, i) => (
          <motion.li
            key={step.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-xl border px-3 py-2.5 transition-colors ${
              step.status === 'running' ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border/60 bg-background'
            }`}
          >
            <div className="flex items-start gap-3">
              <StatusIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] leading-tight ${step.status === 'pending' ? 'text-muted-foreground' : 'font-semibold'}`}>
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{step.detail}</p>
                {step.sub && step.status !== 'pending' && (
                  <ul className="mt-2 space-y-1">
                    {step.sub.map(sub => (
                      <li key={sub.label} className="flex items-center gap-2 text-xs">
                        <StatusIcon status={sub.status} size="sm" />
                        <span className={`min-w-0 flex-1 truncate ${sub.status === 'pending' ? 'text-muted-foreground' : ''}`}>{sub.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{sub.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>

      <p className="text-center text-xs text-muted-foreground">Обикновено отнема под минута. Не затваряйте приложението.</p>
    </div>
  )
}
