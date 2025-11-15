import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import type { IrisZone } from '@/types'

interface ZoneHeatmapProps {
  zones: IrisZone[]
  side: 'left' | 'right'
}

export default function ZoneHeatmap({ zones, side }: ZoneHeatmapProps) {
  const [selectedZone, setSelectedZone] = useState<IrisZone | null>(null)
  
  const getZoneColor = (status: 'normal' | 'attention' | 'concern') => {
    switch (status) {
      case 'normal':
        return 'oklch(0.75 0.15 145)'
      case 'attention':
        return 'oklch(0.75 0.18 85)'
      case 'concern':
        return 'oklch(0.65 0.20 25)'
      default:
        return 'oklch(0.70 0.05 220)'
    }
  }
  
  const getZoneOpacity = (status: 'normal' | 'attention' | 'concern') => {
    switch (status) {
      case 'concern':
        return 0.9
      case 'attention':
        return 0.7
      case 'normal':
        return 0.4
      default:
        return 0.3
    }
  }
  
  const radius = 120
  const centerX = 140
  const centerY = 140
  
  const createArcPath = (startAngle: number, endAngle: number, innerRadius: number, outerRadius: number) => {
    const startAngleRad = (startAngle - 90) * Math.PI / 180
    const endAngleRad = (endAngle - 90) * Math.PI / 180
    
    const x1 = centerX + innerRadius * Math.cos(startAngleRad)
    const y1 = centerY + innerRadius * Math.sin(startAngleRad)
    const x2 = centerX + outerRadius * Math.cos(startAngleRad)
    const y2 = centerY + outerRadius * Math.sin(startAngleRad)
    const x3 = centerX + outerRadius * Math.cos(endAngleRad)
    const y3 = centerY + outerRadius * Math.sin(endAngleRad)
    const x4 = centerX + innerRadius * Math.cos(endAngleRad)
    const y4 = centerY + innerRadius * Math.sin(endAngleRad)
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    
    return `
      M ${x1} ${y1}
      L ${x2} ${y2}
      A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3}
      L ${x4} ${y4}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}
      Z
    `
  }
  
  const getStatusIcon = (status: 'normal' | 'attention' | 'concern') => {
    switch (status) {
      case 'concern':
        return '●●●'
      case 'attention':
        return '●●'
      case 'normal':
        return '●'
      default:
        return ''
    }
  }
  
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-base mb-4">
        {side === 'left' ? 'Ляв' : 'Десен'} Ирис - Зонова Карта
      </h3>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 flex justify-center">
          <svg width="280" height="280" viewBox="0 0 280 280" className="drop-shadow-md">
            <circle 
              cx={centerX} 
              cy={centerY} 
              r={radius + 20} 
              fill="oklch(0.95 0.02 220)"
              stroke="oklch(0.85 0.03 220)"
              strokeWidth="2"
            />
            
            <circle 
              cx={centerX} 
              cy={centerY} 
              r={25} 
              fill="oklch(0.20 0.05 240)"
              stroke="oklch(0.15 0.05 240)"
              strokeWidth="2"
            />
            
            {zones.map((zone) => {
              const [startAngle, endAngle] = zone.angle
              const color = getZoneColor(zone.status)
              const opacity = getZoneOpacity(zone.status)
              const isSelected = selectedZone?.id === zone.id
              
              return (
                <g key={zone.id}>
                  <path
                    d={createArcPath(startAngle, endAngle, 30, 115)}
                    fill={color}
                    opacity={isSelected ? 1 : opacity}
                    stroke={isSelected ? 'oklch(0.30 0.10 240)' : 'oklch(0.90 0.02 220)'}
                    strokeWidth={isSelected ? 3 : 1}
                    className="cursor-pointer transition-all duration-200 hover:opacity-100"
                    onMouseEnter={() => setSelectedZone(zone)}
                    onMouseLeave={() => setSelectedZone(null)}
                  />
                </g>
              )
            })}
            
            <text 
              x={centerX} 
              y={centerY + 5} 
              textAnchor="middle" 
              fill="white"
              fontSize="12"
              fontWeight="bold"
            >
              {side === 'left' ? 'L' : 'R'}
            </text>
          </svg>
        </div>
        
        <div className="flex-1 space-y-3 max-h-[320px] overflow-y-auto">
          {selectedZone ? (
            <motion.div
              key={selectedZone.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border-2 border-primary/30"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-bold text-sm">{selectedZone.name}</h4>
                  <p className="text-xs text-muted-foreground">{selectedZone.organ}</p>
                </div>
                <Badge 
                  variant={selectedZone.status === 'concern' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {selectedZone.status === 'normal' ? 'Норма' : 
                   selectedZone.status === 'attention' ? 'Внимание' : 'Притеснение'}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 mt-2">
                {selectedZone.findings}
              </p>
            </motion.div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Посочете зона за детайли
            </div>
          )}
          
          <div className="space-y-2 pt-4 border-t">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Всички зони:</p>
            {zones.map((zone, idx) => (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedZone?.id === zone.id 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'hover:bg-muted/50'
                }`}
                onMouseEnter={() => setSelectedZone(zone)}
                onClick={() => setSelectedZone(zone)}
              >
                <span 
                  className="text-xs"
                  style={{ color: getZoneColor(zone.status) }}
                >
                  {getStatusIcon(zone.status)}
                </span>
                <span className="text-xs flex-1 min-w-0 truncate">{zone.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getZoneColor('normal') }} />
          <span className="text-xs text-muted-foreground">Норма</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getZoneColor('attention') }} />
          <span className="text-xs text-muted-foreground">Внимание</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getZoneColor('concern') }} />
          <span className="text-xs text-muted-foreground">Притеснение</span>
        </div>
      </div>
    </Card>
  )
}
