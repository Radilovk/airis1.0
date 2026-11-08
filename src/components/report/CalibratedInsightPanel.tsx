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
  ForkKnife,
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
 * Откъде идва изводът. Това е отговорът на „кое от това е реално“:
 * отговорите са стабилната основа, ирисът само уточнява, а когато двете
 * съвпадат — изводът е най-сигурен.
 */
const SOURCE: Record<Driver['source'], { label: string; icon: typeof Eye; style: string }> = {
  both: {
    label: 'отговорите + ирисът',
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
  if (score < 60) return { label: 'започнете оттук', bar: 'from-amber-400 to-orange-500', text: 'text-amber-800' }
  if (score < 72) return { label: 'заслужава внимание', bar: 'from-amber-300 to-amber-500', text: 'text-amber-700' }
  return { label: 'поддръжка', bar: 'from-emerald-400 to-teal-500', text: 'text-emerald-700' }
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
  drivers,
  rank,
  evidence,
  onOpenIris,
}: {
  system: System
  drivers: Driver[]
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

        {evidence.length > 0 && (
          <button
            type="button"
            onClick={onOpenIris}
            className="mt-3 flex w-full items-start gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-left text-sm transition active:scale-[0.99]"
          >
            <Eye size={16} weight="duotone" className="mt-0.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ирисов анализ
              </span>
              {evidence.map(e => (
                <span key={e.label} className="block leading-snug">
                  {e.label} <span className="text-muted-foreground">· {e.where}</span>
                </span>
              ))}
            </span>
          </button>
        )}

        {drivers.length > 0 && (
          <div className="mt-3 space-y-2">
            {drivers.map(d => (
              <div key={d.id} className="rounded-xl bg-primary/5 p-3 ring-1 ring-primary/15">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  <ForkKnife size={13} weight="bold" /> Какво да направите
                </p>
                <p className="mt-1 text-[15px] leading-relaxed">{d.action}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  Основание: <SourceChip source={d.source} />
                </div>
              </div>
            ))}
          </div>
        )}

        {answers.length > 0 && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="mt-2 flex min-h-11 items-center gap-1 text-xs font-medium text-primary">
              {open ? 'Скрий' : 'От вашите отговори'}
              <CaretDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="space-y-1.5 border-t pt-3 text-sm text-muted-foreground">
                {answers.map((r, k) => (
                  <li key={k} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </Card>
    </motion.div>
  )
}

/**
 * Таб „Вашият фокус“. Един въпрос — „върху какво да работя с храненето?“ —
 * и един отговор: до три области, всяка с конкретна стъпка и с посочено
 * основание. Всичко останало е свито или е в другите табове.
 */
export default function CalibratedInsightPanel({ data, onOpenPlan, onOpenIris }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(false)

  const focus = topPrioritySystems(data)
  const evidence = evidenceBySystem(data)
  const focusKeys = new Set(focus.map(s => s.key))
  const driversFor = (key: string) => data.drivers.filter(d => d.system === key).slice(0, 2)
  const shownDriverIds = new Set(focus.flatMap(s => driversFor(s.key).map(d => d.id)))
  const otherDrivers = data.drivers.filter(d => !shownDriverIds.has(d.id))
  const rest = data.systems.filter(s => !focusKeys.has(s.key)).sort((a, b) => a.score - b.score)
  const confirmed = data.confirmedCount ?? 0
  const irisPct = Math.round(data.irisWeight * 100)

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
        <h3 className="text-lg font-bold">Къде храненето ще помогне най-много</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {focus.length > 0
            ? `${focus.length === 1 ? 'Една област' : `${focus.length} области`}, подредени по това откъде да започнете.`
            : 'Няма област, която да изисква специален фокус — планът поддържа доброто състояние.'}
        </p>
        <div className="mt-4 space-y-3">
          {focus.map((s, i) => (
            <FocusCard
              key={s.key}
              system={s}
              drivers={driversFor(s.key)}
              rank={i}
              evidence={evidence.get(s.key) ?? []}
              onOpenIris={onOpenIris}
            />
          ))}
        </div>
        {onOpenPlan && (
          <button
            type="button"
            onClick={onOpenPlan}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-md transition active:scale-[0.99]"
          >
            <ForkKnife size={18} weight="bold" /> Вижте храните, добавките и навиците
          </button>
        )}
      </div>

      {(rest.length > 0 || otherDrivers.length > 0) && (
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
                const extra = otherDrivers.filter(d => d.system === s.key)
                return (
                  <Card key={s.key} className="gap-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{s.label}</span>
                      <span className={`shrink-0 text-xs font-semibold ${lv.text}`}>
                        {lv.label} · <span className="tabular-nums">{s.score}</span>
                      </span>
                    </div>
                    {extra.map(d => (
                      <p key={d.id} className="text-sm leading-relaxed text-muted-foreground">
                        {d.action}
                      </p>
                    ))}
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
              <strong>Основата са вашите отговори.</strong> Ирисът само уточнява картината — тук той тежи{' '}
              <strong>{irisPct}%</strong> (никога повече от 35%). При неясна снимка тежи по-малко, вместо да
              гадае.
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
