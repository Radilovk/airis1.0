import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsClockwise, Check, X } from '@phosphor-icons/react'
import IridologyOverlay from './IridologyOverlay'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
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
  const customOverlayRef = useRef<CustomOverlay | null>(null)
  
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
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  useEffect(() => {
    const loadOverlay = async () => {
      try {
        const overlay = await window.spark.kv.get<CustomOverlay>('custom-overlay')
        if (overlay) {
          customOverlayRef.current = overlay
        }
      } catch (error) {
        console.warn('Няма custom overlay')
      }
    }
    loadOverlay()
  }, [])
  
  // Responsive canvas size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.clientWidth - 32, 400)
        setCanvasSize({ width, height: width })
      }
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])
  
  // Load and initialize image
  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
    
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      console.error('Невалиден imageDataUrl')
      setImageError(true)
      return
    }

    if (!imageDataUrl.startsWith('data:image/')) {
      console.error('Невалиден формат на imageDataUrl')
      setImageError(true)
      return
    }
    
    const img = new Image()
    let mounted = true
    
    img.onload = () => {
      if (mounted) {
        imageRef.current = img
        setImageLoaded(true)
      }
    }
    
    img.onerror = (error) => {
      console.error('Грешка при зареждане на изображението:', error)
      if (mounted) {
        setImageError(true)
        setImageLoaded(false)
      }
    }
    
    try {
      img.src = imageDataUrl
    } catch (error) {
      console.error('Грешка при задаване на изображението:', error)
      if (mounted) {
        setImageError(true)
      }
    }
    
    return () => {
      mounted = false
      img.onload = null
      img.onerror = null
      if (imageRef.current === img) {
        imageRef.current = null
      }
      try {
        img.src = ''
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, [imageDataUrl])
  
  // Draw canvas with current transform
  useEffect(() => {
    if (!imageLoaded || imageError) return
    
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return
    
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return
    
    try {
      const { width, height } = canvas
      const centerX = width / 2
      const centerY = height / 2
      
      ctx.clearRect(0, 0, width, height)
      
      ctx.save()
      
      ctx.translate(centerX + transform.x, centerY + transform.y)
      ctx.rotate((transform.rotation * Math.PI) / 180)
      ctx.scale(transform.scale, transform.scale)
      
      const imgWidth = img.width
      const imgHeight = img.height
      ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight)
      
      ctx.restore()
    } catch (error) {
      console.error('Грешка при рисуване на канваса:', error)
    }
  }, [transform, canvasSize, imageLoaded, imageError])
  
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
    const img = imageRef.current
    
    if (!canvas || !img || !imageLoaded) {
      console.error('❌ [CROP] Canvas или изображение не са готови')
      toast.error('Изображението все още не е заредено')
      return
    }
    
    try {
      console.log('✂️ [CROP] Започване на crop операция...')
      console.log(`📊 [CROP] Canvas размер: ${canvas.width}x${canvas.height}`)
      console.log(`📊 [CROP] Image размер: ${img.width}x${img.height}`)
      console.log(`📊 [CROP] Transform:`, transform)
      
      const cropCanvas = document.createElement('canvas')
      const cropSize = 800
      cropCanvas.width = cropSize
      cropCanvas.height = cropSize
      
      console.log(`📊 [CROP] Crop canvas създаден: ${cropSize}x${cropSize}`)
      
      const cropCtx = cropCanvas.getContext('2d', { 
        willReadFrequently: false,
        alpha: false
      })
      
      if (!cropCtx) {
        throw new Error('Не може да се създаде context за canvas')
      }
      
      console.log('✅ [CROP] Canvas context създаден')
      
      // Fill with black background
      cropCtx.fillStyle = '#000000'
      cropCtx.fillRect(0, 0, cropSize, cropSize)
      
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      
      cropCtx.save()
      
      const scaleFactor = cropSize / canvas.width
      console.log(`📊 [CROP] Scale factor: ${scaleFactor}`)
      cropCtx.scale(scaleFactor, scaleFactor)
      
      cropCtx.translate(centerX + transform.x, centerY + transform.y)
      cropCtx.rotate((transform.rotation * Math.PI) / 180)
      cropCtx.scale(transform.scale, transform.scale)
      
      console.log('🖼️ [CROP] Започване рисуване на изображението...')
      cropCtx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height)
      
      cropCtx.restore()
      
      console.log('✅ [CROP] Основното изображение нарисувано')
      
      // Apply circular mask to remove areas outside the iris
      console.log('🎭 [CROP] Прилагане на кръгова маска за премахване на зони извън ириса...')
      cropCtx.save()
      cropCtx.globalCompositeOperation = 'destination-in'
      cropCtx.beginPath()
      const radius = cropSize * 0.48 // 48% of canvas size (96% of radius) for the circular mask
      cropCtx.arc(cropSize / 2, cropSize / 2, radius, 0, Math.PI * 2)
      cropCtx.fillStyle = '#FFFFFF'
      cropCtx.fill()
      cropCtx.restore()
      console.log('✅ [CROP] Кръгова маска приложена - зоните извън ириса премахнати')
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const finalizeCrop = () => {
        try {
          console.log('🔄 [CROP] Конвертиране на canvas към dataURL...')
          const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.95)
          const sizeKB = Math.round(croppedDataUrl.length / 1024)
          console.log(`📊 [CROP] Размер на cropped изображение: ${sizeKB} KB`)
          
          if (croppedDataUrl.length > 800 * 1024) {
            console.warn(`⚠️ [CROP] Изображението е твърде голямо след crop (${sizeKB} KB)`)
            toast.error('Изображението е твърде голямо. Моля, опитайте с по-малък мащаб.')
            return
          }
          
          if (!croppedDataUrl.startsWith('data:image/')) {
            throw new Error('Невалиден формат на cropped изображението')
          }
          
          console.log('✅ [CROP] Извикване на onSave callback...')
          cropCanvas.width = 0
          cropCanvas.height = 0
          
          onSave(croppedDataUrl)
        } catch (error) {
          console.error('❌ [CROP] Грешка при създаване на dataURL:', error)
          const errorMsg = error instanceof Error ? error.message : String(error)
          if (errorMsg.includes('quota') || errorMsg.includes('memory')) {
            toast.error('Недостатъчно памет. Опитайте с по-малко мащабиране.')
          } else {
            toast.error('Грешка при запазване на изображението')
          }
        }
      }
      
      console.log('🎨 [CROP] Финализиране на crop операцията...')
      finalizeCrop()
    } catch (error) {
      console.error('❌ [CROP] Фатална грешка при запазване:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('❌ [CROP] Error message:', errorMsg)
      console.error('❌ [CROP] Error stack:', (error as Error)?.stack)
      
      if (errorMsg.includes('quota') || errorMsg.includes('memory') || errorMsg.includes('allocation')) {
        toast.error('Недостатъчно памет в браузъра. Презаредете страницата и опитайте с по-малка снимка.')
      } else {
        toast.error('Грешка при обработка на изображението')
      }
    }
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
          
          {/* Error message */}
          {imageError && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive font-semibold">⚠️ Грешка при зареждане на изображението</p>
              <p className="text-sm text-destructive/80 mt-1">
                Изображението не може да бъде заредено. Моля, опитайте с друга снимка.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="mt-3"
              >
                Връщане назад
              </Button>
            </div>
          )}
          
          {/* Loading message */}
          {!imageLoaded && !imageError && (
            <div className="mb-4 p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
                <p className="text-sm font-medium">Зареждане на изображението...</p>
              </div>
            </div>
          )}
          
          {/* Instructions */}
          {imageLoaded && !imageError && (
            <div className="mb-4 p-3 bg-primary/10 rounded-lg text-xs md:text-sm">
              <p className="font-semibold mb-1">📱 Инструкции:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Плъзгане:</strong> 1 пръст за преместване</li>
                <li>• <strong>Мащабиране:</strong> 2 пръста за увеличаване/намаляване или колелце на мишката</li>
                <li>• <strong>Цел:</strong> Подравнете ириса с шаблона</li>
              </ul>
            </div>
          )}
          
          {/* Editor area */}
          {imageLoaded && !imageError && (
            <>
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
            </>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
