import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '@/components/ui/card'
import type { CalibratedAnalysisPayload } from '@/types'

interface Props {
  systems: CalibratedAnalysisPayload['systems']
}

/** Радарна диаграма на системните оценки. Числата са в картите под нея — тук не се повтарят. */
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
      <h3 className="mb-1 text-base font-semibold md:text-lg">Оценки по системи</h3>
      <p className="mb-4 text-xs text-muted-foreground md:text-sm">
        Колкото по-голяма е областта, толкова по-добра е оценката на системата.
      </p>
      <div className="mx-auto w-full max-w-md">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="58%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid stroke="rgba(100, 116, 139, 0.25)" />
            <PolarAngleAxis
              dataKey="system"
              tick={{ fill: 'currentColor', fontSize: 12 }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Оценка"
              dataKey="score"
              stroke="#0284c7"
              fill="#0ea5e9"
              fillOpacity={0.35}
              strokeWidth={2}
              // Анимацията на recharts 2 под React 19 оставя полигона празен.
              isAnimationActive={false}
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
    </Card>
  )
}
