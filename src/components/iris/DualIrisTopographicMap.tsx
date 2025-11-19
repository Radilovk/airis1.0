import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import type { IrisAnalysis, IrisZone } from '@/types'
import { Eye } from '@phosphor-icons/react'

interface DualIrisTopographicMapProps {
  leftIris: IrisAnalysis
  rightIris: IrisAnalysis
  leftImageUrl: string
  rightImageUrl: string
}

export default function DualIrisTopographicMap({
  leftIris,
  rightIris,
  leftImageUrl,
  rightImageUrl
}: DualIrisTopographicMapProps) {
  const [hoveredZone, setHoveredZone] = useState<{ zone: IrisZone; side: 'left' | 'right' } | null>(null)
  const [selectedZone, setSelectedZone] = useState<{ zone: IrisZone; side: 'left' | 'right' } | null>(null)

  const getZoneColor = (status: 'normal' | 'attention' | 'concern') => {
    switch (status) {
      case 'normal':
        return 'rgba(34, 197, 94, 0.25)'
      case 'attention':
        return 'rgba(234, 179, 8, 0.45)'
      case 'concern':
        return 'rgba(239, 68, 68, 0.55)'
      default:
        return 'rgba(100, 116, 139, 0.2)'
    }
  }

  const getZoneStroke = (status: 'normal' | 'attention' | 'concern') => {
    switch (status) {
      case 'normal':
        return 'rgba(34, 197, 94, 0.6)'
      case 'attention':
        return 'rgba(234, 179, 8, 0.85)'
      case 'concern':
        return 'rgba(239, 68, 68, 0.9)'
      default:
        return 'rgba(100, 116, 139, 0.4)'
    }
  }

  const getStatusBadge = (status: 'normal' | 'attention' | 'concern') => {
    const variants = {
      normal: { text: 'Норма', color: 'bg-green-100 text-green-800 border-green-300' },
      attention: { text: 'Внимание', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      concern: { text: 'Притеснение', color: 'bg-red-100 text-red-800 border-red-300' }
    }
    const config = variants[status]
    return (
      <Badge className={`${config.color} border text-xs font-semibold`}>
        {config.text}
      </Badge>
    )
  }

  const createZoneArc = (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = centerX + radius * Math.cos(startRad)
    const y1 = centerY + radius * Math.sin(startRad)
    const x2 = centerX + radius * Math.cos(endRad)
    const y2 = centerY + radius * Math.sin(endRad)

    const largeArcFlag = endAngle - startAngle > 180 ? '1' : '0'

    return [
      'M', centerX, centerY,
      'L', x1, y1,
      'A', radius, radius, 0, largeArcFlag, 1, x2, y2,
      'Z'
    ].join(' ')
  }

  const normalizeZones = (zones: IrisZone[]): IrisZone[] => {
    if (!zones || zones.length === 0) return []
    
    const normalized: IrisZone[] = []
    const anglePerZone = 360 / 12

    for (let i = 0; i < 12; i++) {
      const existingZone = zones[i] || zones[0]
      const startAngle = i * anglePerZone - 90
      const endAngle = (i + 1) * anglePerZone - 90
      const newZone: IrisZone = {
        ...existingZone,
        id: i + 1,
        angle: [startAngle, endAngle] as [number, number]
      }
      normalized.push(newZone)
    }

    return normalized
  }

  const renderIris = (
    imageUrl: string,
    zones: IrisZone[],
    side: 'left' | 'right',
    analysis: IrisAnalysis
  ) => {
    const normalizedZones = normalizeZones(zones)
    const size = 320
    const radius = size / 2
    const centerX = radius
    const centerY = radius
    const irisRadius = radius * 0.85
    
    const pupilRadius = irisRadius * 0.25
    const innerRingStart = pupilRadius
    const innerRingEnd = irisRadius * 0.33
    const middleRingStart = innerRingEnd
    const middleRingEnd = irisRadius * 0.83
    const outerRingStart = middleRingEnd
    const outerRingEnd = irisRadius

    return (
      <div className="relative flex-1 min-w-0">
        <div className="relative aspect-square rounded-xl overflow-hidden shadow-lg">
          <img
            src={imageUrl}
            alt={`${side === 'left' ? 'Ляв' : 'Десен'} ирис`}
            className="absolute inset-0 w-full h-full object-cover rounded-xl"
          />
          
          <svg
            className="absolute inset-0 w-full h-full pointer-events-auto"
            viewBox={`0 0 ${size} ${size}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id={`glow-${side}`}>
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id={`ringGlow-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.6)" />
                <stop offset="50%" stopColor="rgba(99, 102, 241, 0.6)" />
                <stop offset="100%" stopColor="rgba(139, 92, 246, 0.6)" />
              </linearGradient>
              <radialGradient id={`pupilGlow-${side}`} cx="50%" cy="50%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0.1)" />
              </radialGradient>
            </defs>

            <circle
              cx={centerX}
              cy={centerY}
              r={innerRingEnd}
              fill="none"
              stroke="rgba(59, 130, 246, 0.7)"
              strokeWidth="1.5"
              strokeDasharray="4,2"
              filter={`url(#glow-${side})`}
            />
            
            <circle
              cx={centerX}
              cy={centerY}
              r={middleRingStart}
              fill="none"
              stroke="rgba(99, 102, 241, 0.8)"
              strokeWidth="2.5"
              filter={`url(#glow-${side})`}
            />
            
            <circle
              cx={centerX}
              cy={centerY}
              r={middleRingEnd}
              fill="none"
              stroke="rgba(139, 92, 246, 0.8)"
              strokeWidth="2.5"
              filter={`url(#glow-${side})`}
            />
            
            <circle
              cx={centerX}
              cy={centerY}
              r={outerRingStart}
              fill="none"
              stroke="rgba(168, 85, 247, 0.7)"
              strokeWidth="1.5"
              strokeDasharray="4,2"
              filter={`url(#glow-${side})`}
            />

            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
              const angleRad = ((angle - 90) * Math.PI) / 180
              const innerX = centerX + pupilRadius * Math.cos(angleRad)
              const innerY = centerY + pupilRadius * Math.sin(angleRad)
              const outerX = centerX + irisRadius * Math.cos(angleRad)
              const outerY = centerY + irisRadius * Math.sin(angleRad)
              return (
                <line
                  key={`radial-${side}-${angle}`}
                  x1={innerX}
                  y1={innerY}
                  x2={outerX}
                  y2={outerY}
                  stroke="rgba(100, 116, 139, 0.25)"
                  strokeWidth="1"
                />
              )
            })}

            {normalizedZones.map((zone, idx) => {
              const [startAngle, endAngle] = zone.angle

              const isHovered = hoveredZone?.zone.id === zone.id && hoveredZone?.side === side
              const isSelected = selectedZone?.zone.id === zone.id && selectedZone?.side === side

              return (
                <g key={`${side}-${zone.id}-${idx}`}>
                  <path
                    d={createZoneArc(centerX, centerY, irisRadius, startAngle, endAngle)}
                    fill={getZoneColor(zone.status)}
                    stroke={getZoneStroke(zone.status)}
                    strokeWidth={isHovered || isSelected ? 3 : 1.5}
                    className="cursor-pointer transition-all duration-200"
                    style={{
                      filter: isHovered || isSelected ? `url(#glow-${side})` : 'none'
                    }}
                    onMouseEnter={() => setHoveredZone({ zone, side })}
                    onMouseLeave={() => setHoveredZone(null)}
                    onClick={() => setSelectedZone({ zone, side })}
                  />
                </g>
              )
            })}

            <circle
              cx={centerX}
              cy={centerY}
              r={irisRadius * 0.25}
              fill="none"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="2"
              className="pointer-events-none"
            />

            <circle
              cx={centerX}
              cy={centerY}
              r={irisRadius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="3"
              className="pointer-events-none"
              style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }}
            />

            {Array.from({ length: 12 }).map((_, i) => {
              const angle = i * 30 - 90
              const angleRad = (angle * Math.PI) / 180
              const x1 = centerX + irisRadius * 0.25 * Math.cos(angleRad)
              const y1 = centerY + irisRadius * 0.25 * Math.sin(angleRad)
              const x2 = centerX + irisRadius * Math.cos(angleRad)
              const y2 = centerY + irisRadius * Math.sin(angleRad)

              return (
                <line
                  key={`divider-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                  className="pointer-events-none"
                />
              )
            })}
          </svg>

          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-2">
              <Eye size={14} weight="duotone" className="text-white" />
              <span className="text-xs font-bold text-white">
                {analysis.overallHealth}/100
              </span>
            </div>
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/20">
            <span className="text-xs font-bold text-white">
              {side === 'left' ? 'Ляв Ирис' : 'Десен Ирис'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const activeZone = selectedZone || hoveredZone

  return (
    <Card className="overflow-hidden">
      <div className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
        <h3 className="font-bold text-xl mb-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Eye size={22} weight="duotone" className="text-primary-foreground" />
          </div>
          Топографска Карта на Зоните
        </h3>
        <p className="text-sm text-muted-foreground">
          Интерактивна визуализация на 12-те иридологични зони
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {renderIris(leftImageUrl, leftIris.zones || [], 'left', leftIris)}
          {renderIris(rightImageUrl, rightIris.zones || [], 'right', rightIris)}
        </div>

        <div className="border-t pt-6">
          <AnimatePresence mode="wait">
            {activeZone ? (
              <motion.div
                key={`${activeZone.side}-${activeZone.zone.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="p-5 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border-2 border-primary/30"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-lg">{activeZone.zone.name}</h4>
                      <Badge className="bg-muted text-muted-foreground text-xs">
                        {activeZone.side === 'left' ? 'Ляв' : 'Десен'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium mb-3">
                      {activeZone.zone.organ}
                    </p>
                  </div>
                  {getStatusBadge(activeZone.zone.status)}
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {activeZone.zone.findings}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8 text-muted-foreground"
              >
                <Eye size={32} weight="duotone" className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  Посочете зона от картата за детайли
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t pt-6">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Легенда</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border-2"
                style={{
                  backgroundColor: getZoneColor('normal'),
                  borderColor: getZoneStroke('normal')
                }}
              />
              <span className="text-xs font-medium">Норма</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border-2"
                style={{
                  backgroundColor: getZoneColor('attention'),
                  borderColor: getZoneStroke('attention')
                }}
              />
              <span className="text-xs font-medium">Внимание</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border-2"
                style={{
                  backgroundColor: getZoneColor('concern'),
                  borderColor: getZoneStroke('concern')
                }}
              />
              <span className="text-xs font-medium">Притеснение</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
