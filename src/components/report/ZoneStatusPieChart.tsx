import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { CheckCircle, Info, Warning } from '@phosphor-icons/react'
import type { IrisAnalysis } from '@/types'

interface ZoneStatusPieChartProps {
  leftIris: IrisAnalysis
  rightIris: IrisAnalysis
}

export default function ZoneStatusPieChart({ leftIris, rightIris }: ZoneStatusPieChartProps) {
  const leftZones = leftIris?.zones || []
  const rightZones = rightIris?.zones || []
  const allZones = [...leftZones, ...rightZones]
  
  const statusCount = {
    normal: allZones.filter(z => z?.status === 'normal').length,
    attention: allZones.filter(z => z?.status === 'attention').length,
    concern: allZones.filter(z => z?.status === 'concern').length
  }
  
  const data = [
    { name: 'Норма', value: statusCount.normal, color: 'oklch(0.75 0.15 145)' },
    { name: 'Внимание', value: statusCount.attention, color: 'oklch(0.75 0.18 85)' },
    { name: 'Притеснение', value: statusCount.concern, color: 'oklch(0.65 0.20 25)' }
  ].filter(item => item.value > 0)
  
  const total = statusCount.normal + statusCount.attention + statusCount.concern
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-1">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.value} зони ({Math.round((item.value / total) * 100)}%)
          </p>
        </div>
      )
    }
    return null
  }
  
  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    
    if (percent < 0.05) return null
    
    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }
  
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-base mb-4">Обобщение на Зоните</h3>
      
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={90}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between p-3 rounded-lg border bg-green-50 border-green-200"
          >
            <div className="flex items-center gap-3">
              <CheckCircle size={24} weight="duotone" className="text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-900">Здрави Зони</p>
                <p className="text-xs text-green-700">Без притеснения</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-700">{statusCount.normal}</p>
              <p className="text-xs text-green-600">
                {Math.round((statusCount.normal / total) * 100)}%
              </p>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between p-3 rounded-lg border bg-yellow-50 border-yellow-200"
          >
            <div className="flex items-center gap-3">
              <Info size={24} weight="duotone" className="text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-900">Внимание</p>
                <p className="text-xs text-yellow-700">За наблюдение</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-yellow-700">{statusCount.attention}</p>
              <p className="text-xs text-yellow-600">
                {Math.round((statusCount.attention / total) * 100)}%
              </p>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between p-3 rounded-lg border bg-orange-50 border-orange-200"
          >
            <div className="flex items-center gap-3">
              <Warning size={24} weight="duotone" className="text-orange-600" />
              <div>
                <p className="text-sm font-semibold text-orange-900">Притеснение</p>
                <p className="text-xs text-orange-700">Изисква действие</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-orange-700">{statusCount.concern}</p>
              <p className="text-xs text-orange-600">
                {Math.round((statusCount.concern / total) * 100)}%
              </p>
            </div>
          </motion.div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
        <p className="text-sm text-foreground/80">
          <span className="font-semibold">Общо {total} зони</span> са анализирани в двата ириса.
          {statusCount.concern > 0 && (
            <span className="text-orange-600 font-semibold ml-1">
              Препоръчително е да обърнете специално внимание на {statusCount.concern} зони.
            </span>
          )}
        </p>
      </div>
    </Card>
  )
}
