import React, { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsClockwise, Check, X } from '@phosphor-icons/react'
import IridologyOverlay from './IridologyOverlay'
import { motion } from 'framer-motion'
import type { CustomOverlay } from '@/types'

interface IrisCropEditorProps {
  imageDataUrl: string
  side: 'left' | 'right'
  onSave: (croppedDataUrl: string) => void
  onCancel: () => void
}

interface Transform {
  scale: number
  x: number
  y: number
  rotation: number
}

export default function IrisCropEditor({ imageDataUrl, side, onSave, onCancel }: IrisCropEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [customOverlay] = useKV<CustomOverlay | null>('custom-overlay', null)
  
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
    rotation: 0
  })
  
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 })
  
  // Responsive canvas size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.clientWidth - 32, 500)
        setCanvasSize({ width, height: width })
      }
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])
  
  // Load and initialize image
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
    }
    img.src = imageDataUrl
  }, [imageDataUrl])
  
  // Draw canvas with current transform
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const { width, height } = canvas
    const centerX = width / 2
    const centerY = height / 2
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height)
    
    // Save context state
    ctx.save()
    
    // Apply transformations
    ctx.translate(centerX + transform.x, centerY + transform.y)
    ctx.rotate((transform.rotation * Math.PI) / 180)
    ctx.scale(transform.scale, transform.scale)
    
    // Draw image centered
    const imgWidth = img.width
    const imgHeight = img.height
    ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight)
    
    // Restore context
    ctx.restore()
  }, [transform, canvasSize])
  
  // Touch and mouse handlers
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length === 0) return { x: 0, y: 0 }
    const x = Array.from(touches).reduce((sum, t) => sum + t.clientX, 0) / touches.length
    const y = Array.from(touches).reduce((sum, t) => sum + t.clientY, 0) / touches.length
    return { x, y }
  }
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - start dragging
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
    } else if (e.touches.length === 2) {
      // Two finger - pinch to zoom
      const distance = getTouchDistance(e.touches)
      setLastTouchDistance(distance)
    }
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    
    if (e.touches.length === 1 && isDragging) {
      // Single touch - pan
      const dx = e.touches[0].clientX - dragStart.x
      const dy = e.touches[0].clientY - dragStart.y
      
      setTransform(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }))
      
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
    } else if (e.touches.length === 2) {
      // Two finger - pinch to zoom
      const distance = getTouchDistance(e.touches)
      if (distance && lastTouchDistance) {
        const scaleDelta = distance / lastTouchDistance
        setTransform(prev => ({
          ...prev,
          scale: Math.max(0.5, Math.min(5, prev.scale * scaleDelta))
        }))
        setLastTouchDistance(distance)
      }
    }
  }
  
  const handleTouchEnd = () => {
    setIsDragging(false)
    setLastTouchDistance(null)
  }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }))
    
    setDragStart({ x: e.clientX, y: e.clientY })
  }
  
  const handleMouseUp = () => {
    setIsDragging(false)
  }
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const scaleDelta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(5, prev.scale * scaleDelta))
    }))
  }
  
  // Control buttons
  const handleZoomIn = () => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(5, prev.scale * 1.2)
    }))
  }
  
  const handleZoomOut = () => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, prev.scale / 1.2)
    }))
  }
  
  const handleRotate = () => {
    setTransform(prev => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360
    }))
  }
  
  const handleReset = () => {
    setTransform({
      scale: 1,
      x: 0,
      y: 0,
      rotation: 0
    })
  }
  
  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const cropCanvas = document.createElement('canvas')
    const cropSize = 800
    cropCanvas.width = cropSize
    cropCanvas.height = cropSize
    const cropCtx = cropCanvas.getContext('2d')
    if (!cropCtx) return
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    cropCtx.save()
    
    const scaleFactor = cropSize / canvas.width
    cropCtx.scale(scaleFactor, scaleFactor)
    
    cropCtx.translate(centerX + transform.x, centerY + transform.y)
    cropCtx.rotate((transform.rotation * Math.PI) / 180)
    cropCtx.scale(transform.scale, transform.scale)
    
    const img = imageRef.current
    if (img) {
      cropCtx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height)
    }
    
    cropCtx.restore()
    
    if (customOverlay) {
      const overlayImg = new Image()
      overlayImg.onload = () => {
        cropCtx.globalAlpha = 0.6
        cropCtx.drawImage(overlayImg, 0, 0, cropSize, cropSize)
        cropCtx.globalAlpha = 1.0
        
        const croppedDataUrl = cropCanvas.toDataURL('image/png')
        onSave(croppedDataUrl)
      }
      
      overlayImg.onerror = () => {
        const croppedDataUrl = cropCanvas.toDataURL('image/png')
        onSave(croppedDataUrl)
      }
      
      overlayImg.src = customOverlay.dataUrl
    } else {
      const overlayDiv = document.createElement('div')
      overlayDiv.style.position = 'absolute'
      overlayDiv.style.left = '-9999px'
      document.body.appendChild(overlayDiv)
      
      const root = document.createElement('div')
      overlayDiv.appendChild(root)
      
      const svgContainer = document.createElement('div')
      svgContainer.innerHTML = `
        <svg width="${cropSize}" height="${cropSize}" viewBox="0 0 ${cropSize} ${cropSize}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="glowGradient" cx="50%" cy="50%">
              <stop offset="0%" stop-color="rgba(59, 130, 246, 0.3)" />
              <stop offset="50%" stop-color="rgba(59, 130, 246, 0.15)" />
              <stop offset="100%" stop-color="rgba(59, 130, 246, 0.05)" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <pattern id="scanlines" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1"/>
            </pattern>
          </defs>
          ${generateOverlaySVGContent(cropSize)}
        </svg>
      `
      
      const svgElement = svgContainer.querySelector('svg')
      if (!svgElement) {
        document.body.removeChild(overlayDiv)
        return
      }
      
      const svgData = new XMLSerializer().serializeToString(svgElement)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      
      const overlayImg = new Image()
      overlayImg.onload = () => {
        cropCtx.globalAlpha = 0.6
        cropCtx.drawImage(overlayImg, 0, 0, cropSize, cropSize)
        cropCtx.globalAlpha = 1.0
        
        const croppedDataUrl = cropCanvas.toDataURL('image/png')
        
        URL.revokeObjectURL(svgUrl)
        document.body.removeChild(overlayDiv)
        
        onSave(croppedDataUrl)
      }
      
      overlayImg.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        document.body.removeChild(overlayDiv)
        
        const croppedDataUrl = cropCanvas.toDataURL('image/png')
        onSave(croppedDataUrl)
      }
      
      overlayImg.src = svgUrl
    }
  }
  
  const generateOverlaySVGContent = (size: number) => {
    const radius = size / 2
    const pupilRadius = radius * 0.3
    const innerRadius = radius * 0.55
    const middleRadius = radius * 0.75
    const outerRadius = radius * 0.95
    const sectors = 12
    const angleStep = 360 / sectors
    
    const sectorLines = Array.from({ length: sectors }).map((_, i) => {
      const angle = (angleStep * i - 90) * (Math.PI / 180)
      const x1 = radius + pupilRadius * Math.cos(angle)
      const y1 = radius + pupilRadius * Math.sin(angle)
      const x2 = radius + outerRadius * Math.cos(angle)
      const y2 = radius + outerRadius * Math.sin(angle)
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(59, 130, 246, 0.3)" stroke-width="1" filter="url(#glow)"/>`
    }).join('')
    
    const corners = [
      [20, 20, 0],
      [size - 20, 20, 90],
      [size - 20, size - 20, 180],
      [20, size - 20, 270]
    ].map(([x, y, rotation]) => `
      <g transform="translate(${x}, ${y}) rotate(${rotation})">
        <line x1="0" y1="0" x2="15" y2="0" stroke="rgba(59, 130, 246, 0.6)" stroke-width="2" />
        <line x1="0" y1="0" x2="0" y2="15" stroke="rgba(59, 130, 246, 0.6)" stroke-width="2" />
      </g>
    `).join('')
    
    return `
      <circle cx="${radius}" cy="${radius}" r="${outerRadius}" fill="url(#glowGradient)" opacity="0.4"/>
      <circle cx="${radius}" cy="${radius}" r="${outerRadius}" fill="url(#scanlines)" opacity="0.3"/>
      <circle cx="${radius}" cy="${radius}" r="${pupilRadius}" fill="none" stroke="rgba(59, 130, 246, 0.6)" stroke-width="2" filter="url(#glow)"/>
      <circle cx="${radius}" cy="${radius}" r="${innerRadius}" fill="none" stroke="rgba(59, 130, 246, 0.5)" stroke-width="2" stroke-dasharray="5,3" filter="url(#glow)"/>
      <circle cx="${radius}" cy="${radius}" r="${middleRadius}" fill="none" stroke="rgba(59, 130, 246, 0.4)" stroke-width="1.5" stroke-dasharray="8,4" filter="url(#glow)"/>
      <circle cx="${radius}" cy="${radius}" r="${outerRadius}" fill="none" stroke="rgba(59, 130, 246, 0.7)" stroke-width="3" filter="url(#glow)"/>
      ${sectorLines}
      <line x1="${radius - 10}" y1="${radius}" x2="${radius + 10}" y2="${radius}" stroke="rgba(59, 130, 246, 0.5)" stroke-width="1"/>
      <line x1="${radius}" y1="${radius - 10}" x2="${radius}" y2="${radius + 10}" stroke="rgba(59, 130, 246, 0.5)" stroke-width="1"/>
      ${corners}
      <circle cx="${radius}" cy="${radius}" r="3" fill="rgba(59, 130, 246, 0.9)" filter="url(#glow)">
        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite"/>
      </circle>
    `
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <Card className="w-full max-w-2xl bg-background/95 backdrop-blur">
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg md:text-xl font-bold">
                {side === 'left' ? 'Ляв' : 'Десен'} Ирис - Позициониране
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Използвайте жестове или бутоните за позициониране
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="md:hidden"
            >
              <X size={24} />
            </Button>
          </div>
          
          {/* Instructions */}
          <div className="mb-4 p-3 bg-primary/10 rounded-lg text-xs md:text-sm">
            <p className="font-semibold mb-1">📱 Инструкции:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>Плъзгане:</strong> 1 пръст за преместване</li>
              <li>• <strong>Мащабиране:</strong> 2 пръста за увеличаване/намаляване или колелце на мишката</li>
              <li>• <strong>Цел:</strong> Подравнете ириса с шаблона</li>
            </ul>
          </div>
          
          {/* Editor area */}
          <div 
            ref={containerRef}
            className="relative mb-4 mx-auto"
            style={{ 
              width: '100%',
              maxWidth: `${canvasSize.width}px`,
              touchAction: 'none'
            }}
          >
            <div className="relative" style={{ aspectRatio: '1/1' }}>
              {/* Canvas for image */}
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="absolute inset-0 rounded-lg touch-none cursor-move"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ 
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)'
                }}
              />
              
              {/* Iridology overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <IridologyOverlay size={canvasSize.width} className="opacity-80" />
              </div>
            </div>
          </div>
          
          {/* Control buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              className="gap-2 flex-1 md:flex-initial"
            >
              <MagnifyingGlassPlus size={18} />
              Увеличи
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              className="gap-2 flex-1 md:flex-initial"
            >
              <MagnifyingGlassMinus size={18} />
              Намали
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="gap-2 flex-1 md:flex-initial"
            >
              <ArrowsClockwise size={18} />
              Завърти
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2 flex-1 md:flex-initial"
            >
              Нулирай
            </Button>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 hidden md:flex gap-2"
            >
              <X size={20} />
              Отказ
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 gap-2 bg-primary hover:bg-primary/90"
            >
              <Check size={20} weight="bold" />
              Запази
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
