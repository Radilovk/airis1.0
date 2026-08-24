import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '@/components/ui/card'
import type { CalibratedAnalysisPayload } from '@/types'

interface Props {
  systems: CalibratedAnalysisPayload['systems']
}

/** Радарна диаграма на системните оценки — mobile-first. */
export default function CalibratedSystemsChart({ systems }: Props) {
  if (!systems?.length) return null

  const data = systems.map(s => ({
    system: s.label.replace(/^Система\s+/i, '').split(' ')[0] ?? s.label,
    fullLabel: s.label,
    score: s.score,
    priority: s.priority,
  }))

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 md:p-6">
      <h3 className="mb-1 text-base font-semibold md:text-lg">Баланс на системите</h3>
      <p className="mb-4 text-xs text-muted-foreground md:text-sm">
        Колкото по-голяма е областта, толкова по-добра е оценката на системата.
      </p>
      <div className="mx-auto w-full max-w-md">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="rgba(100, 116, 139, 0.25)" />
            <PolarAngleAxis
              dataKey="system"
              tick={{ fill: 'currentColor', fontSize: 10 }}
            />
            <Radar
              name="Оценка"
              dataKey="score"
              stroke="oklch(0.55 0.15 230)"
              fill="oklch(0.55 0.15 230)"
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Tooltip
              formatter={(value: number) => [`${value}/100`, 'Оценка']}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullLabel ?? ''
              }
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.75rem',
                fontSize: '13px',
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {systems.map(s => (
          <div
            key={s.key}
            className={`rounded-xl px-3 py-2.5 ring-1 ${
              s.priority ? 'bg-primary/5 ring-primary/20' : 'bg-muted/30 ring-border/60'
            }`}
          >
            <p className="truncate text-[11px] text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold tabular-nums text-primary">{s.score}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
