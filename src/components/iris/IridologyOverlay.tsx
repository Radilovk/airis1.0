import React from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'

interface IridologyOverlayProps {
  size?: number
  side?: 'left' | 'right'
  className?: string
}

export default function IridologyOverlay({ 
  size = 400,
  side = 'left',
  className = ''
}: IridologyOverlayProps) {
  const [customOverlay] = useKVWithFallback<{ dataUrl: string, type: 'svg' | 'png' } | null>('custom-overlay', null)
  
  if (customOverlay) {
    return (
      <img 
        src={customOverlay.dataUrl}
        alt="Iridology Overlay"
        width={size}
        height={size}
        className={className}
        style={{ pointerEvents: 'none' }}
      />
    )
  }
  
  const radius = size / 2
  const pupilRadius = radius * 0.3
  const innerRadius = radius * 0.55
  const middleRadius = radius * 0.75
  const outerRadius = radius * 0.95
  
  const sectors = 12
  const angleStep = 360 / sectors

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        {/* Glowing gradient for futuristic effect */}
        <radialGradient id="glowGradient" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
          <stop offset="50%" stopColor="rgba(59, 130, 246, 0.15)" />
          <stop offset="100%" stopColor="rgba(59, 130, 246, 0.05)" />
        </radialGradient>
        
        {/* Neon glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Scan line pattern for tech effect */}
        <pattern id="scanlines" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="1"/>
        </pattern>
      </defs>
      
      {/* Background glow */}
      <circle 
        cx={radius} 
        cy={radius} 
        r={outerRadius} 
        fill="url(#glowGradient)"
        opacity="0.4"
      />
      
      {/* Scan lines overlay for tech effect */}
      <circle 
        cx={radius} 
        cy={radius} 
        r={outerRadius} 
        fill="url(#scanlines)"
        opacity="0.3"
      />
      
      {/* Pupil area */}
      <circle
        cx={radius}
        cy={radius}
        r={pupilRadius}
        fill="none"
        stroke="rgba(59, 130, 246, 0.6)"
        strokeWidth="2"
        filter="url(#glow)"
      />
      
      {/* Inner ring (autonomic nerve wreath) */}
      <circle
        cx={radius}
        cy={radius}
        r={innerRadius}
        fill="none"
        stroke="rgba(59, 130, 246, 0.5)"
        strokeWidth="2"
        strokeDasharray="5,3"
        filter="url(#glow)"
      />
      
      {/* Middle ring */}
      <circle
        cx={radius}
        cy={radius}
        r={middleRadius}
        fill="none"
        stroke="rgba(59, 130, 246, 0.4)"
        strokeWidth="1.5"
        strokeDasharray="8,4"
        filter="url(#glow)"
      />
      
      {/* Outer ring (iris edge) */}
      <circle
        cx={radius}
        cy={radius}
        r={outerRadius}
        fill="none"
        stroke="rgba(59, 130, 246, 0.7)"
        strokeWidth="3"
        filter="url(#glow)"
      />
      
      {/* Radial sector lines */}
      {Array.from({ length: sectors }).map((_, i) => {
        const angle = (angleStep * i - 90) * (Math.PI / 180)
        const x1 = radius + pupilRadius * Math.cos(angle)
        const y1 = radius + pupilRadius * Math.sin(angle)
        const x2 = radius + outerRadius * Math.cos(angle)
        const y2 = radius + outerRadius * Math.sin(angle)
        
        return (
          <line
            key={`sector-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(59, 130, 246, 0.3)"
            strokeWidth="1"
            filter="url(#glow)"
          />
        )
      })}
      
      {/* Central crosshair for alignment */}
      <line
        x1={radius - 10}
        y1={radius}
        x2={radius + 10}
        y2={radius}
        stroke="rgba(59, 130, 246, 0.5)"
        strokeWidth="1"
      />
      <line
        x1={radius}
        y1={radius - 10}
        x2={radius}
        y2={radius + 10}
        stroke="rgba(59, 130, 246, 0.5)"
        strokeWidth="1"
      />
      
      {/* Corner markers for tech feel */}
      {[
        [20, 20, 0],
        [size - 20, 20, 90],
        [size - 20, size - 20, 180],
        [20, size - 20, 270]
      ].map(([x, y, rotation], i) => (
        <g key={`corner-${i}`} transform={`translate(${x}, ${y}) rotate(${rotation})`}>
          <line x1="0" y1="0" x2="15" y2="0" stroke="rgba(59, 130, 246, 0.6)" strokeWidth="2" />
          <line x1="0" y1="0" x2="0" y2="15" stroke="rgba(59, 130, 246, 0.6)" strokeWidth="2" />
        </g>
      ))}
      
      {/* Pulsing center dot */}
      <circle
        cx={radius}
        cy={radius}
        r="3"
        fill="rgba(59, 130, 246, 0.9)"
        filter="url(#glow)"
      >
        <animate
          attributeName="r"
          values="3;5;3"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.9;0.5;0.9"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  )
}
