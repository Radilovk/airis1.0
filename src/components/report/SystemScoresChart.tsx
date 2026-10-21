import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { SystemScore } from '@/types'

interface SystemScoresChartProps {
  leftScores: SystemScore[]
  rightScores: SystemScore[]
}

export default function SystemScoresChart({ leftScores, rightScores }: SystemScoresChartProps) {
  if (!leftScores || !Array.isArray(leftScores) || leftScores.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Системни оценки не са налични
      </div>
    )
  }

  const mergedData = leftScores.map((leftScore, idx) => {
    const rightScore = rightScores?.[idx]
    return {
      system: leftScore?.system || 'Неизвестна система',
      left: leftScore?.score || 0,
      right: rightScore?.score || 0,
      average: Math.round(((leftScore?.score || 0) + (rightScore?.score || 0)) / 2)
    }
  }).filter(item => item.system !== 'Неизвестна система')

  return (
    <div className="space-y-6">
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={mergedData}>
          <PolarGrid stroke="rgba(100, 116, 139, 0.2)" />
          <PolarAngleAxis 
            dataKey="system" 
            tick={{ fill: 'currentColor', fontSize: 12 }}
          />
          <Radar isAnimationActive={false}
            name="Ляв ирис"
            dataKey="left"
            stroke="oklch(0.55 0.15 230)"
            fill="oklch(0.55 0.15 230)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Radar isAnimationActive={false}
            name="Десен ирис"
            dataKey="right"
            stroke="oklch(0.70 0.18 45)"
            fill="oklch(0.70 0.18 45)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              color: 'hsl(var(--foreground))'
            }}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mergedData.map((item) => (
          <div key={item.system} className="p-4 border rounded-lg">
            <h4 className="font-semibold text-sm mb-3">{item.system}</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Среден резултат</span>
                <span className="font-mono font-semibold">{item.average}/100</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all"
                  style={{ width: `${item.average}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
