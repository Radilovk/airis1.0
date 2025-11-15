import { useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'

interface HealthProgressChartProps {
  report: AnalysisReport
}

export default function HealthProgressChart({ report }: HealthProgressChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  
  const generateProjectedData = () => {
    const data: Array<{ month: string; health: number | null; projected: number | null }> = [
      { month: 'Днес', health: avgHealth, projected: null }
    ]
    
    const baseImprovement = avgHealth < 60 ? 5 : avgHealth < 80 ? 3 : 2
    let lastHealth = avgHealth
    
    for (let i = 1; i <= 6; i++) {
      const improvementFactor = 1 - (i * 0.1)
      const monthlyImprovement = baseImprovement * improvementFactor
      const projectedHealth = Math.min(100, Math.round(
        lastHealth + monthlyImprovement + (Math.random() * 2 - 1)
      ))
      
      data.push({
        month: `${i}м`,
        health: null,
        projected: projectedHealth
      })
      
      lastHealth = projectedHealth
    }
    
    return data
  }
  
  const data = generateProjectedData()
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-xs font-semibold mb-1">{payload[0].payload.month}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}/100
            </p>
          ))}
        </div>
      )
    }
    return null
  }
  
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-base mb-4">Проектиран Прогрес</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Очаквано подобрение на здравето при следване на препоръките
      </p>
      
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.1)" />
          <XAxis 
            dataKey="month" 
            tick={{ fill: 'currentColor', fontSize: 11 }}
            stroke="rgba(100, 116, 139, 0.3)"
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fill: 'currentColor', fontSize: 11 }}
            stroke="rgba(100, 116, 139, 0.3)"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="health"
            stroke="oklch(0.55 0.15 230)"
            strokeWidth={3}
            name="Текущо"
            dot={{ r: 5, fill: 'oklch(0.55 0.15 230)' }}
            activeDot={{ r: 7, onMouseEnter: () => setHoveredPoint(0) }}
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke="oklch(0.70 0.18 45)"
            strokeWidth={3}
            strokeDasharray="5 5"
            name="Прогноза"
            dot={{ r: 4, fill: 'oklch(0.70 0.18 45)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="grid grid-cols-2 gap-3 mt-4">
        <motion.div 
          className="p-3 rounded-lg bg-primary/10 border border-primary/20"
          whileHover={{ scale: 1.02 }}
        >
          <p className="text-xs text-muted-foreground mb-1">Текущо ниво</p>
          <p className="text-xl font-bold text-primary">{avgHealth}/100</p>
        </motion.div>
        <motion.div 
          className="p-3 rounded-lg bg-accent/10 border border-accent/20"
          whileHover={{ scale: 1.02 }}
        >
          <p className="text-xs text-muted-foreground mb-1">Цел (6 месеца)</p>
          <p className="text-xl font-bold text-accent">{data[data.length - 1].projected}/100</p>
        </motion.div>
      </div>
    </Card>
  )
}
