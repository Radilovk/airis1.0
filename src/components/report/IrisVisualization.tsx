import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { IrisAnalysis, IrisZone } from '@/types'

interface IrisVisualizationProps {
  analysis: IrisAnalysis
  side?: 'left' | 'right'
}

export default function IrisVisualization({ analysis, side = 'left' }: IrisVisualizationProps) {
  const [hoveredZone, setHoveredZone] = useState<IrisZone | null>(null)
  const [selectedZone, setSelectedZone] = useState<IrisZone | null>(null)
  
  if (!analysis || !analysis.zones || !Array.isArray(analysis.zones)) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Визуализация на ириса не е налична
      </div>
    )
  }
  
  const radius = 150
  const centerX = 200
  const centerY = 200

  const getColorForStatus = (status: 'normal' | 'attention' | 'concern') => {
    const colors = {
      normal: 'rgba(34, 197, 94, 0.2)',
      attention: 'rgba(234, 179, 8, 0.3)',
      concern: 'rgba(239, 68, 68, 0.3)'
    }
    return colors[status]
  }

  const getStrokeForStatus = (status: 'normal' | 'attention' | 'concern') => {
    const colors = {
      normal: 'rgba(34, 197, 94, 0.6)',
      attention: 'rgba(234, 179, 8, 0.8)',
      concern: 'rgba(239, 68, 68, 0.8)'
    }
    return colors[status]
  }

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    }
  }

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle)
    const end = polarToCartesian(x, y, radius, startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
    
    return [
      'M', x, y,
      'L', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      'Z'
    ].join(' ')
  }

  const getStatusBadge = (status: 'normal' | 'attention' | 'concern') => {
    const variants = {
      normal: { text: 'Норма', color: 'bg-green-100 text-green-800 border-green-200' },
      attention: { text: 'Внимание', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      concern: { text: 'Притеснение', color: 'bg-red-100 text-red-800 border-red-200' }
    }
    const config = variants[status]
    return (
      <Badge className={`${config.color} border`}>
        {config.text}
      </Badge>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="flex-shrink-0">
          <svg 
            width="400" 
            height="400" 
            viewBox="0 0 400 400" 
            className="max-w-full"
          >
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="rgba(100, 116, 139, 0.05)"
              stroke="rgba(100, 116, 139, 0.2)"
              strokeWidth="2"
            />

            <circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.4}
              fill="none"
              stroke="rgba(100, 116, 139, 0.15)"
              strokeWidth="1"
              strokeDasharray="4,4"
            />

            <circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.7}
              fill="none"
              stroke="rgba(100, 116, 139, 0.15)"
              strokeWidth="1"
              strokeDasharray="4,4"
            />

            {(analysis.zones || []).map((zone, index) => {
              if (!zone) return null
              const startAngle = zone.angle?.[0] ?? 0
              const endAngle = zone.angle?.[1] ?? 30
              const midAngle = (startAngle + endAngle) / 2
              const labelPos = polarToCartesian(centerX, centerY, radius * 0.85, midAngle)
              
              return (
                <g key={`${zone.id}-${index}`}>
                  <path
                    d={describeArc(centerX, centerY, radius, startAngle, endAngle)}
                    fill={getColorForStatus(zone.status)}
                    stroke={getStrokeForStatus(zone.status)}
                    strokeWidth={(hoveredZone?.id === zone.id || selectedZone?.id === zone.id) ? 3 : zone.status === 'normal' ? 1 : 2}
                    opacity={(hoveredZone?.id === zone.id || selectedZone?.id === zone.id) ? 1 : zone.status === 'normal' ? 0.3 : 0.8}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredZone(zone)}
                    onMouseLeave={() => setHoveredZone(null)}
                    onClick={() => setSelectedZone(zone)}
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="currentColor"
                    fontSize="12"
                    fontWeight="600"
                    className="pointer-events-none"
                    opacity={(hoveredZone?.id === zone.id || selectedZone?.id === zone.id) ? 1 : zone.status === 'normal' ? 0.3 : 1}
                  >
                    {zone.id}
                  </text>
                </g>
              )
            })}

            <circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.25}
              fill="rgba(100, 116, 139, 0.1)"
              stroke="rgba(100, 116, 139, 0.3)"
              strokeWidth="1"
            />

            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              fontSize="32"
              fontWeight="700"
              className="font-mono"
            >
              {analysis.overallHealth || 0}
            </text>

            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
              const outer = polarToCartesian(centerX, centerY, radius, angle)
              const inner = polarToCartesian(centerX, centerY, radius - 10, angle)
              return (
                <line
                  key={angle}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="rgba(100, 116, 139, 0.2)"
                  strokeWidth="1"
                />
              )
            })}
          </svg>
          <div className="text-center mt-4 text-sm font-medium text-muted-foreground">
            Посочете зона за детайли
          </div>
        </div>

        <div className="flex-1 w-full">
          {selectedZone ? (
            <Card className="p-6 bg-muted/30">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold mb-1">{selectedZone.name}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{selectedZone.organ}</p>
                  </div>
                  {getStatusBadge(selectedZone.status)}
                </div>
                <div className="text-sm leading-relaxed">
                  {selectedZone.findings}
                </div>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="text-sm text-primary hover:underline"
                >
                  Затвори
                </button>
              </div>
            </Card>
          ) : hoveredZone ? (
            <Card className="p-6 bg-muted/30">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold mb-1">{hoveredZone.name}</h4>
                    <p className="text-sm text-muted-foreground">{hoveredZone.organ}</p>
                  </div>
                  {getStatusBadge(hoveredZone.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Кликнете за повече информация
                </p>
              </div>
            </Card>
          ) : (
            <Card className="p-6 bg-muted/30 border-dashed">
              <div className="text-center text-muted-foreground">
                <p className="text-sm">Преминете с мишката или кликнете върху зона от диаграмата за да видите детайли</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="text-center">
          <div className="w-4 h-4 rounded-full bg-green-500/30 border-2 border-green-500/60 mx-auto mb-2" />
          <p className="text-xs font-medium">Норма</p>
          <p className="text-xs text-muted-foreground">
            {(analysis.zones || []).filter(z => z?.status === 'normal').length} зони
          </p>
        </div>
        <div className="text-center">
          <div className="w-4 h-4 rounded-full bg-yellow-500/30 border-2 border-yellow-500/80 mx-auto mb-2" />
          <p className="text-xs font-medium">Внимание</p>
          <p className="text-xs text-muted-foreground">
            {(analysis.zones || []).filter(z => z?.status === 'attention').length} зони
          </p>
        </div>
        <div className="text-center">
          <div className="w-4 h-4 rounded-full bg-red-500/30 border-2 border-red-500/80 mx-auto mb-2" />
          <p className="text-xs font-medium">Притеснение</p>
          <p className="text-xs text-muted-foreground">
            {(analysis.zones || []).filter(z => z?.status === 'concern').length} зони
          </p>
        </div>
      </div>
    </div>
  )
}
