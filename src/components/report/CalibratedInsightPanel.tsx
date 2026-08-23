import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  CaretDown,
  Fire,
  Gauge,
  ListChecks,
  Scales,
  ShieldWarning,
  Target,
} from '@phosphor-icons/react'
import type { CalibratedAnalysisPayload } from '@/types'

/**
 * CalibratedInsightPanel — витрината на новия анализ.
 *
 * Показва трите неща, които правят резултата проверим, вместо просто красив:
 *   1. Приоритетните системи и защо са такива (проследими причини).
 *   2. Хранителните драйвери с обозначен ИЗТОЧНИК — въпросник, ирис, или и двете.
 */

interface Props {
  data: CalibratedAnalysisPayload
}

const STRENGTH_STYLE: Record<string, { label: string; cls: string }> = {
  high: { label: 'висок приоритет', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  medium: { label: 'среден', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  low: { label: 'нисък', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
}

const SOURCE_STYLE: Record<string, { label: string; cls: string }> = {
  both: { label: 'въпросник + ирис', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  iris: { label: 'от ириса', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  questionnaire: { label: 'от въпросника', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
}

function scoreColour(score: number) {
  if (score >= 80) return { bar: 'from-emerald-400 to-teal-500', text: 'text-emerald-700' }
  if (score >= 65) return { bar: 'from-lime-400 to-emerald-500', text: 'text-lime-700' }
  if (score >= 50) return { bar: 'from-amber-400 to-orange-500', text: 'text-amber-700' }
  return { bar: 'from-rose-400 to-red-500', text: 'text-rose-700' }
}

export default function CalibratedInsightPanel({ data }: Props) {
  const [openSystem, setOpenSystem] = useState<string | null>(null)
  const [techOpen, setTechOpen] = useState(false)

  const priority = data.systems.filter(s => s.priority)
  const secondary = data.systems.filter(s => !s.priority)

  return (
    <div className="space-y-6">
      {data.notices && data.notices.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ShieldWarning size={20} weight="duotone" className="text-amber-600" />
            <h3 className="text-lg font-semibold">Важно за твоя случай</h3>
          </div>
          <div className="space-y-2">
            {data.notices.map((n, i) => (
              <motion.div
                key={n.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={`p-4 ${
                    n.level === 'critical'
                      ? 'border-rose-300 bg-rose-50/70'
                      : 'border-amber-300 bg-amber-50/70'
                  }`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        n.level === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          n.level === 'critical' ? 'text-rose-900' : 'text-amber-900'
                        }`}
                      >
                        {n.title}
                      </p>
                      <p
                        className={`mt-1 text-xs leading-relaxed ${
                          n.level === 'critical' ? 'text-rose-800' : 'text-amber-800'
                        }`}
                      >
                        {n.body}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Планът по-долу вече е съобразен с горното — някои общи препоръки са
            заменени или пропуснати нарочно.
          </p>
        </div>
      )}

      {/* ── Приоритетни системи ───────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Target size={20} weight="duotone" className="text-primary" />
          <h3 className="text-lg font-semibold">Приоритетен фокус</h3>
          <Badge variant="secondary" className="ml-1 text-[10px]">
            метаболизъм · ендокринна · храносмилане
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {priority.map((s, i) => {
            const c = scoreColour(s.score)
            const rank = data.focus.indexOf(s.key)
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <Card
                  className="h-full cursor-pointer p-4 transition-shadow hover:shadow-md"
                  onClick={() => setOpenSystem(openSystem === s.key ? null : s.key)}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold leading-tight">{s.label}</p>
                      {rank === 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                          <Fire size={12} weight="fill" /> водеща тема
                        </span>
                      )}
                    </div>
                    <span className={`text-2xl font-bold tabular-nums ${c.text}`}>{s.score}</span>
                  </div>

                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${c.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${s.score}%` }}
                      transition={{ duration: 0.8, delay: i * 0.07 }}
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">{s.description}</p>

                  <AnimatePresence initial={false}>
                    {openSystem === s.key && s.reasons.length > 0 && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 space-y-1 overflow-hidden border-t pt-3 text-xs text-muted-foreground"
                      >
                        {s.reasons.map((r, k) => (
                          <li key={k} className="flex gap-1.5">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>

                  {s.reasons.length > 0 && (
                    <button className="mt-2 flex items-center gap-1 text-[11px] text-primary">
                      {openSystem === s.key ? 'скрий причините' : 'защо?'}
                      <CaretDown
                        size={11}
                        className={`transition-transform ${openSystem === s.key ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* останалите системи */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {secondary.map(s => {
            const c = scoreColour(s.score)
            return (
              <Card key={s.key} className="p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className={`text-sm font-bold tabular-nums ${c.text}`}>{s.score}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${c.bar}`}
                    style={{ width: `${s.score}%` }}
                  />
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── Драйвери ──────────────────────────────────────────────────────── */}
      {data.drivers.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ListChecks size={20} weight="duotone" className="text-primary" />
            <h3 className="text-lg font-semibold">Какво движи плана</h3>
          </div>
          <div className="space-y-2">
            {data.drivers.map((d, i) => {
              const st = STRENGTH_STYLE[d.strength] ?? STRENGTH_STYLE.low
              const src = SOURCE_STYLE[d.source] ?? SOURCE_STYLE.questionnaire
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                >
                  <Card className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${st.cls}`}>
                        {st.label}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${src.cls}`}>
                        {src.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{d.observation}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.action}</p>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Технически детайли (скрити по подразбиране) ───────────────────── */}
      <Collapsible open={techOpen} onOpenChange={setTechOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Gauge size={18} weight="duotone" />
            Как е изчислен резултатът
          </span>
          <CaretDown size={16} className={`transition-transform ${techOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2 overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-slate-100">
            <div className="p-5 md:p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Качество на снимките" value={`${data.imageQuality}/100`} hint="Резкост, зеница, отблясъци" />
                <Metric label="Разчетена площ" value={`${Math.round(data.stripCoverage * 100)}%`} hint="Закрито от клепач/отблясък" />
                {typeof data.agreement === 'number' && (
                  <Metric label="Повторяемост" value={`${Math.round(data.agreement * 100)}%`} hint="Съвпадение между два прочита" />
                )}
                <Metric label="Тежест на ириса" value={`${Math.round(data.irisWeight * 100)}%`} hint="Останалото — въпросник" accent />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Много от прегледаните точки са нормални вариации на ириса и не влизат в плана,
                освен ако не са потвърдени или достатъчно ясни.
              </p>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Дисклеймър ────────────────────────────────────────────────────── */}
      <Card className="border-amber-200 bg-amber-50/60 p-4">
        <div className="flex gap-2.5">
          <Scales size={18} weight="duotone" className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-xs leading-relaxed text-amber-900">
            Този анализ <strong>не е медицинска диагностика</strong> и не замества преглед,
            изследвания или лечение. Ирисодиагностиката няма доказана диагностична стойност
            в конвенционалната медицина. Тук тя се използва като допълнителен ориентир към
            въпросника при съставянето на хранителен план. При оплаквания се обърнете към лекар.
          </p>
        </div>
      </Card>
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        accent ? 'bg-sky-500/15 ring-1 ring-sky-400/30' : 'bg-white/[0.05]'
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>
    </div>
  )
}
