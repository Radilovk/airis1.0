import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  CaretDown,
  CheckCircle,
  ClipboardText,
  Eye,
  Scales,
  SealCheck,
  ShieldWarning,
} from '@phosphor-icons/react'
import type { CalibratedAnalysisPayload } from '@/types'
import {
  groupFindingsForDisplay,
  isPlanRelevantFinding,
  topPrioritySystems,
} from '@/lib/calibrated-report-summary'
import { findingAreaKey, rankKeySigns, visibleLabel } from '@/lib/iris-reading'

interface Props {
  data: CalibratedAnalysisPayload
  /** Отваря таба с плана (храни, добавки, навици). */
  onOpenPlan?: () => void
  /** Отваря таба със снимките. */
  onOpenIris?: () => void
}

type Finding = CalibratedAnalysisPayload['findings'][number]

/** Знаците от ирисовия анализ за дадена област: до два, всеки знак веднъж. */
interface Evidence {
  label: string
  where: string
}

function evidenceBySystem(data: CalibratedAnalysisPayload): Map<string, Evidence[]> {
  const key: Finding[] = (['left', 'right'] as const).flatMap(
    side => rankKeySigns(groupFindingsForDisplay(data.findings.filter(f => f.side === side && isPlanRelevantFinding(f)))).key
  )
  const out = new Map<string, Evidence[]>()
  const seen = new Set<string>()
  for (const f of key) {
    const sys = findingAreaKey(f)
    if (!sys) continue
    // Един и същ знак в двете очи се показва веднъж.
    const id = `${sys}:${f.type}`
    if (seen.has(id)) continue
    seen.add(id)
    const both =
      f.bilateral || key.some(o => o.side !== f.side && o.type === f.type && findingAreaKey(o) === sys)
    const list = out.get(sys) ?? []
    if (list.length < 2) {
      list.push({
        label: visibleLabel(f),
        where: both ? 'двете очи' : f.side === 'left' ? 'ляво око' : 'дясно око',
      })
    }
    out.set(sys, list)
  }
  return out
}

/** Причините от ириса са в блока „Ирисов анализ“ — тук остават отговорите. */
const IRIS_REASON = /—\s*(ляв|десен)\s+ирис/i

type Driver = CalibratedAnalysisPayload['drivers'][number]
type System = CalibratedAnalysisPayload['systems'][number]

/**
 * Откъде идва изводът — в кръстосания анализ. Без проценти и дялове:
 * показва се само дали изводът е потвърден от двата източника.
 */
const SOURCE: Record<Driver['source'], { label: string; icon: typeof Eye; style: string }> = {
  both: {
    label: 'потвърдено кръстосано',
    icon: SealCheck,
    style: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  questionnaire: {
    label: 'вашите отговори',
    icon: ClipboardText,
    style: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
  iris: {
    label: 'знак в ириса',
    icon: Eye,
    style: 'bg-muted text-foreground/70 ring-border',
  },
}

/** Степен вместо голо число — числото без контекст плаши повече, отколкото казва. */
function level(score: number) {
  if (score < 60) return { label: 'изисква най-много внимание', bar: 'from-amber-400 to-orange-500', text: 'text-amber-800' }
  // Същите граници като описанието на системата: под 80 има сигнали.
  if (score < 80) return { label: 'заслужава внимание', bar: 'from-amber-300 to-amber-500', text: 'text-amber-700' }
  return { label: 'в добро състояние', bar: 'from-emerald-400 to-teal-500', text: 'text-emerald-700' }
}

function SourceChip({ source }: { source: Driver['source'] }) {
  const s = SOURCE[source]
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${s.style}`}>
      <Icon size={12} weight="bold" /> {s.label}
    </span>
  )
}

function FocusCard({
  system,
  rank,
  evidence,
  onOpenIris,
}: {
  system: System
  rank: number
  evidence: Evidence[]
  onOpenIris?: () => void
}) {
  const [open, setOpen] = useState(false)
  const lv = level(system.score)
  const answers = system.reasons.filter(r => !IRIS_REASON.test(r))
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.07 }}>
      <Card className="gap-0 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
            {rank + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold leading-tight">{system.label}</p>
            <p className={`mt-0.5 text-xs font-semibold ${lv.text}`}>{lv.label}</p>
          </div>
          <span className="shrink-0 text-right">
            <span className="block text-lg font-bold tabular-nums leading-none">{system.score}</span>
            <span className="text-[10px] text-muted-foreground">от 100</span>
          </span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${lv.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${system.score}%` }}
            transition={{ duration: 0.8, delay: rank * 0.07 }}
          />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{system.description}</p>

        {/* Основанието — двата източника, видими, без съвети. Съветите са в плана. */}
        <div className="mt-3 space-y-2">
          {answers.length > 0 && (
            <div className="rounded-xl bg-muted/40 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ClipboardText size={13} weight="bold" /> От вашите отговори
              </p>
              <ul className="mt-1 space-y-0.5 text-sm leading-snug">
                {answers.slice(0, open ? answers.length : 3).map((r, k) => (
                  <li key={k}>{r}</li>
                ))}
              </ul>
              {answers.length > 3 && (
                <button type="button" onClick={() => setOpen(v => !v)} className="mt-1 min-h-8 text-xs font-medium text-primary">
                  {open ? 'По-малко' : `Още ${answers.length - 3}`}
                </button>
              )}
            </div>
          )}
          {evidence.length > 0 && (
            <button
              type="button"
              onClick={onOpenIris}
              className="flex w-full items-start gap-2 rounded-xl bg-muted/40 px-3 py-2.5 text-left text-sm transition active:scale-[0.99]"
            >
              <Eye size={16} weight="duotone" className="mt-0.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  В ириса · вижте къде
                </span>
                {evidence.map(e => (
                  <span key={e.label} className="block leading-snug">
                    {e.label} <span className="text-muted-foreground">· {e.where}</span>
                  </span>
                ))}
              </span>
            </button>
          )}
          {answers.length > 0 && evidence.length > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <SealCheck size={13} weight="fill" /> Двата източника сочат едно и също
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

/**
 * Таб „Вашият фокус“. Един въпрос — „върху какво да работя с храненето?“ —
 * и един отговор: до три области, всяка с конкретна стъпка и с посочено
 * основание. Всичко останало е свито или е в другите табове.
 */
export default function CalibratedInsightPanel({ data, onOpenIris }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(false)

  const focus = topPrioritySystems(data)
  const evidence = evidenceBySystem(data)
  const focusKeys = new Set(focus.map(s => s.key))
  const rest = data.systems.filter(s => !focusKeys.has(s.key)).sort((a, b) => a.score - b.score)
  const confirmed = data.confirmedCount ?? 0

  return (
    <div className="space-y-6">
      {data.notices && data.notices.length > 0 && (
        <div className="space-y-2">
          {data.notices.map(n => (
            <Card
              key={n.title}
              className={`gap-1 p-4 ${n.level === 'critical' ? 'border-rose-300 bg-rose-50/70' : 'border-amber-300 bg-amber-50/70'}`}
            >
              <p className={`flex items-center gap-2 text-sm font-semibold ${n.level === 'critical' ? 'text-rose-900' : 'text-amber-900'}`}>
                <ShieldWarning size={18} weight="duotone" /> {n.title}
              </p>
              <p className={`text-sm leading-relaxed ${n.level === 'critical' ? 'text-rose-800' : 'text-amber-800'}`}>{n.body}</p>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold">Какво показва анализът</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {focus.length > 0
            ? `${focus.length === 1 ? 'Една област изисква' : `${focus.length} области изискват`} внимание — подредени по важност. Под всяка е основанието: вашите отговори и знаците в ириса.`
            : 'Няма област, която да изисква специално внимание.'}
        </p>
        <div className="mt-4 space-y-3">
          {focus.map((s, i) => (
            <FocusCard
              key={s.key}
              system={s}
              rank={i}
              evidence={evidence.get(s.key) ?? []}
              onOpenIris={onOpenIris}
            />
          ))}
        </div>

      </div>

      {rest.length > 0 && (
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-medium active:bg-muted/50">
            <span className="flex items-center gap-2">
              <CheckCircle size={18} weight="duotone" className="text-emerald-600" />
              Останалите области
            </span>
            <CaretDown size={16} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {rest.map(s => {
                const lv = level(s.score)
                return (
                  <Card key={s.key} className="gap-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{s.label}</span>
                      <span className={`shrink-0 text-xs font-semibold ${lv.text}`}>
                        {lv.label} · <span className="tabular-nums">{s.score}</span>
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                  </Card>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible open={howOpen} onOpenChange={setHowOpen}>
        <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-medium active:bg-muted/50">
          <span className="flex items-center gap-2">
            <SealCheck size={18} weight="duotone" className="text-primary" />
            Колко е сигурно това
          </span>
          <CaretDown size={16} className={`transition-transform ${howOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2 gap-3 p-4 text-sm leading-relaxed">
            <p>
              <strong>Това е кръстосан анализ.</strong> Отговорите ви и знаците в ириса не се оценяват поотделно и
              не се събират накрая — всеки извод минава през двата източника едновременно. Знакът в ириса се
              тълкува според това, което ни казахте, а отговорите се проверяват спрямо ириса. Където двата сочат
              едно и също, изводът е най-сигурен. Когато снимката е неясна, анализът стъпва повече на отговорите,
              вместо да гадае.
            </p>
            <p>
              Всяко око се разчита два пъти независимо.{' '}
              {confirmed > 0
                ? `${confirmed} ${confirmed === 1 ? 'знак се появи' : 'знака се появиха'} и в двата прочита — на тях може да се разчита най-много.`
                : 'Знаците, появили се само веднъж, влизат в плана с по-малка тежест.'}
            </p>
            <p>
              Когато изводът идва и от отговорите, и от ириса (<SourceChip source="both" />), той е най-сигурен.
              Където има смисъл, планът предлага и изследване, с което да проверите.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="rounded-xl bg-muted/50 p-2">
                <p className="text-lg font-bold tabular-nums">{data.imageQuality}/100</p>
                <p className="text-[11px] text-muted-foreground">качество на снимките</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-2">
                <p className="text-lg font-bold tabular-nums">{Math.round(data.stripCoverage * 100)}%</p>
                <p className="text-[11px] text-muted-foreground">видим ирис</p>
              </div>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex gap-2.5 px-1">
        <Scales size={16} weight="duotone" className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Това е ориентир за хранене и начин на живот, не медицинска диагноза. При оплаквания или
          лечение се посъветвайте с лекар.
        </p>
      </div>
    </div>
  )
}
