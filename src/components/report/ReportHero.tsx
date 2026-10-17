import { useEffect, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { CheckCircle, Eye, Fingerprint, ShieldCheck, Target, Warning, WarningOctagon } from '@phosphor-icons/react'
import { summarizeCalibratedReport, topPrioritySystems } from '@/lib/calibrated-report-summary'
import { constitutionKey } from '@/lib/iris-reading'
import { eyeReferralChip } from '@/lib/eye-health'
import type { AnalysisReport, EyeReferral } from '@/types'

const VERDICT_GRADIENT = {
  stable: ['#10b981', '#14b8a6'],
  mild: ['#0ea5e9', '#f59e0b'],
  focus: ['#f59e0b', '#ea580c'],
} as const

const CONSTITUTION_SHORT: Record<string, string> = {
  lymphatic: 'лимфатичен тип',
  hematogenic: 'хематогенен тип',
  mixed: 'смесен тип',
}

const EYE_CHIP_STYLE: Record<EyeReferral, string> = {
  none: 'bg-emerald-500/15 text-emerald-900 ring-emerald-500/30',
  routine: 'bg-sky-500/15 text-sky-900 ring-sky-500/30',
  soon: 'bg-amber-500/20 text-amber-950 ring-amber-500/40',
  urgent: 'bg-rose-500/20 text-rose-950 ring-rose-500/40',
}

const EYE_CHIP_ICON: Record<EyeReferral, typeof Eye> = {
  none: CheckCircle,
  routine: Eye,
  soon: Warning,
  urgent: WarningOctagon,
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const c = animate(0, to, { duration: 1.1, ease: 'easeOut', onUpdate: n => setV(Math.round(n)) })
    return () => c.stop()
  }, [to])
  return <>{v}</>
}

function ScoreRing({ score, colors }: { score: number; colors: readonly [string, string] }) {
  const R = 54
  const C = 2 * Math.PI * R
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="hero-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={R} fill="none" stroke="currentColor" className="text-muted" strokeWidth="11" />
        <motion.circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          stroke="url(#hero-ring)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tabular-nums tracking-tight">
          <CountUp to={score} />
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">от 100</span>
      </div>
    </div>
  )
}

/**
 * Върхът на доклада: един резултат, един извод, и чипове, които водят към
 * подробностите. Всичко останало е под таба.
 */
export default function ReportHero({
  report,
  onOpenIris,
}: {
  report: AnalysisReport
  onOpenIris: () => void
}) {
  const cal = report.calibrated!
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  const summary = summarizeCalibratedReport(cal, { briefSummary: report.briefSummary, avgHealth })
  const focus = topPrioritySystems(cal)
  const cKey = constitutionKey(cal.constitution)
  const eye = cal.eyeHealth
  const confirmed = cal.confirmedCount ?? 0
  const relevant = summary.planRelevant

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-[28px] border bg-card p-5 shadow-xl shadow-primary/5 md:p-7"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-60 w-60 rounded-full bg-gradient-to-tr from-accent/10 to-transparent blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center">
        <ScoreRing score={avgHealth} colors={VERDICT_GRADIENT[summary.verdict]} />
        <div className="min-w-0 flex-1 text-center md:text-left">
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight md:text-[28px]">{summary.headline}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">{summary.lead}</p>

          {focus.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Target size={14} weight="duotone" /> Фокус:
              </span>
              {focus.map((s, i) => (
                <motion.span
                  key={s.key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${i === 0 ? 'bg-primary text-primary-foreground shadow' : 'bg-primary/10 text-primary'}`}
                >
                  {s.label}
                </motion.span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap justify-center gap-2 border-t pt-4 md:justify-start">
        {eye?.ran && (
          <button
            type="button"
            onClick={onOpenIris}
            className={`inline-flex items-center gap-1.5 min-h-11 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition hover:scale-[1.03] active:scale-95 ${EYE_CHIP_STYLE[eye.referral]}`}
          >
            {(() => {
              const EyeIcon = EYE_CHIP_ICON[eye.referral]
              return <EyeIcon size={16} weight="bold" aria-hidden />
            })()}
            Очи: {eyeReferralChip(eye.referral)}
          </button>
        )}
        {cKey && (
          <button
            type="button"
            onClick={onOpenIris}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-sm font-semibold text-foreground/80 ring-1 ring-border transition hover:scale-[1.03] active:scale-95"
          >
            <Fingerprint size={14} weight="bold" /> {CONSTITUTION_SHORT[cKey]}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenIris}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-sm font-semibold text-foreground/80 ring-1 ring-border transition hover:scale-[1.03] active:scale-95"
        >
          <ShieldCheck size={14} weight="bold" /> {relevant} знака в плана
          {confirmed > 0 ? ` · ${confirmed} потвърдени двойно` : ''}
        </button>
      </div>
    </motion.section>
  )
}
