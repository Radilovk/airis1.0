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

interface Props {
  data: CalibratedAnalysisPayload
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
            <h3 className="text-lg font-semibold">Важно за вашия случай</h3>
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
                  <p
                    className={`text-sm font-semibold ${
                      n.level === 'critical' ? 'text-rose-900' : 'text-amber-900'
                    }`}
                  >
                    {n.title}
                  </p>
                  <p
                    className={`mt-1 text-sm leading-relaxed ${
                      n.level === 'critical' ? 'text-rose-800' : 'text-amber-800'
                    }`}
                  >
                    {n.body}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Target size={20} weight="duotone" className="text-primary" />
          <h3 className="text-lg font-semibold">Системи във фокус</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="h-full cursor-pointer p-4 transition-shadow active:scale-[0.99] hover:shadow-md"
                  onClick={() => setOpenSystem(openSystem === s.key ? null : s.key)}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{s.label}</p>
                      {rank === 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                          <Fire size={12} weight="fill" /> основен фокус
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 text-2xl font-bold tabular-nums ${c.text}`}>
                      {s.score}
                    </span>
                  </div>

                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${c.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${s.score}%` }}
                      transition={{ duration: 0.8, delay: i * 0.07 }}
                    />
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>

                  <AnimatePresence initial={false}>
                    {openSystem === s.key && s.reasons.length > 0 && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 space-y-1.5 overflow-hidden border-t pt-3 text-sm text-muted-foreground"
                      >
                        {s.reasons.map((r, k) => (
                          <li key={k} className="flex gap-2">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>

                  {s.reasons.length > 0 && (
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-primary"
                    >
                      {openSystem === s.key ? 'Скрий подробностите' : 'Виж подробностите'}
                      <CaretDown
                        size={12}
                        className={`transition-transform ${openSystem === s.key ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </div>

        {secondary.length > 0 && (
          <div className="mt-3 grid gap-2 grid-cols-2 lg:grid-cols-4">
            {secondary.map(s => {
              const c = scoreColour(s.score)
              return (
                <Card key={s.key} className="p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{s.label}</span>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${c.text}`}>
                      {s.score}
                    </span>
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
        )}
      </div>

      {data.drivers.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ListChecks size={20} weight="duotone" className="text-primary" />
            <h3 className="text-lg font-semibold">Ключови насоки</h3>
          </div>
          <div className="space-y-2">
            {data.drivers.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
              >
                <Card className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    {d.strength === 'high' && (
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-800">
                        Висок приоритет
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-snug">{d.observation}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.action}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <Collapsible open={techOpen} onOpenChange={setTechOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-muted/30 px-4 py-3.5 text-sm font-medium active:bg-muted/50">
          <span className="flex items-center gap-2">
            <Gauge size={18} weight="duotone" />
            Подробности за анализа
          </span>
          <CaretDown size={16} className={`transition-transform ${techOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2 overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-slate-100">
            <div className="p-5 md:p-6">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                <Metric label="Качество на снимките" value={`${data.imageQuality}/100`} hint="Резкост и осветеност" />
                <Metric label="Видима площ" value={`${Math.round(data.stripCoverage * 100)}%`} hint="Незакрита от клепач" />
                <Metric label="Дял на ириса" value={`${Math.round(data.irisWeight * 100)}%`} hint="В общата оценка" accent />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Много от прегледаните зони са нормални вариации и не влизат в плана.
              </p>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card className="border-amber-200/80 bg-amber-50/50 p-4">
        <div className="flex gap-2.5">
          <Scales size={18} weight="duotone" className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-xs leading-relaxed text-amber-900">
            Този анализ <strong>не е медицинска диагностика</strong> и не замества преглед
            или лечение. Използва се като ориентир за хранителен и начин на живот план.
            При оплаквания се обърнете към лекар.
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
