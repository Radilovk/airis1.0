import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import type { SystemScore } from '@/types'

interface SystemComparisonChartProps {
  leftScores: SystemScore[]
  rightScores: SystemScore[]
}

export default function SystemComparisonChart({ leftScores, rightScores }: SystemComparisonChartProps) {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null)
  
  if (!leftScores || !Array.isArray(leftScores) || leftScores.length === 0) {
    return (
      <Card className="p-5">
        <div className="text-center py-8 text-muted-foreground text-sm">
          Системни оценки не са налични
        </div>
      </Card>
    )
  }

  const mergedData = leftScores.map((leftScore, idx) => {
    const rightScore = rightScores?.[idx]
    const leftVal = leftScore?.score || 0
    const rightVal = rightScore?.score || 0
    const diff = Math.abs(leftVal - rightVal)
    
    return {
      system: leftScore?.system || 'Неизвестна',
      left: leftVal,
      right: rightVal,
      difference: diff,
      status: diff > 15 ? 'high' : diff > 8 ? 'medium' : 'low'
    }
  }).filter(item => item.system !== 'Неизвестна')

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg min-w-[200px]">
          <p className="text-sm font-semibold mb-2">{data.system}</p>
          <div className="space-y-1">
            <p className="text-xs flex justify-between gap-4">
              <span className="text-muted-foreground">Ляв ирис:</span>
              <span className="font-mono font-semibold" style={{ color: 'oklch(0.55 0.15 230)' }}>
                {data.left}/100
              </span>
            </p>
            <p className="text-xs flex justify-between gap-4">
              <span className="text-muted-foreground">Десен ирис:</span>
              <span className="font-mono font-semibold" style={{ color: 'oklch(0.70 0.18 45)' }}>
                {data.right}/100
              </span>
            </p>
            <div className="border-t border-border mt-2 pt-2">
              <p className="text-xs flex justify-between gap-4">
                <span className="text-muted-foreground">Разлика:</span>
                <span className={`font-mono font-semibold ${
                  data.difference > 15 ? 'text-red-600' : 
                  data.difference > 8 ? 'text-yellow-600' : 
                  'text-green-600'
                }`}>
                  {data.difference}
                </span>
              </p>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const getStatusBadge = (status: string) => {
    if (status === 'high') {
      return <Badge variant="destructive" className="text-xs">Висока разлика</Badge>
    } else if (status === 'medium') {
      return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Умерена</Badge>
    }
    return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Балансирано</Badge>
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-base mb-4">Сравнение Ляв/Десен Ирис</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Различия в здравословното състояние между двете очи
      </p>
      
      <ResponsiveContainer width="100%" height={350}>
        <BarChart 
          data={mergedData}
          layout="horizontal"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.1)" />
          <XAxis 
            type="number"
            domain={[0, 100]}
            tick={{ fill: 'currentColor', fontSize: 11 }}
            stroke="rgba(100, 116, 139, 0.3)"
          />
          <YAxis 
            type="category"
            dataKey="system"
            width={75}
            tick={{ fill: 'currentColor', fontSize: 10 }}
            stroke="rgba(100, 116, 139, 0.3)"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
          />
          <Bar 
            dataKey="left" 
            fill="oklch(0.55 0.15 230)"
            name="Ляв ирис"
            radius={[0, 4, 4, 0]}
            onClick={(data) => setSelectedSystem(data.system)}
            cursor="pointer"
          >
            {mergedData.map((entry, index) => (
              <Cell 
                key={`cell-left-${index}`}
                fill={selectedSystem === entry.system ? 'oklch(0.45 0.20 230)' : 'oklch(0.55 0.15 230)'}
              />
            ))}
          </Bar>
          <Bar 
            dataKey="right" 
            fill="oklch(0.70 0.18 45)"
            name="Десен ирис"
            radius={[0, 4, 4, 0]}
            onClick={(data) => setSelectedSystem(data.system)}
            cursor="pointer"
          >
            {mergedData.map((entry, index) => (
              <Cell 
                key={`cell-right-${index}`}
                fill={selectedSystem === entry.system ? 'oklch(0.60 0.22 45)' : 'oklch(0.70 0.18 45)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-6 space-y-2">
        {mergedData
          .filter(item => item.difference > 8)
          .sort((a, b) => b.difference - a.difference)
          .slice(0, 3)
          .map((item, idx) => (
            <motion.div
              key={item.system}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{item.system}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Разлика: {item.difference} точки
                </p>
              </div>
              {getStatusBadge(item.status)}
            </motion.div>
          ))}
        {mergedData.filter(item => item.difference > 8).length === 0 && (
          <div className="text-center py-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg">
            Всички системи са балансирани между двете очи
          </div>
        )}
      </div>
    </Card>
  )
}
