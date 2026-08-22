/**
 * Utility functions for image manipulation and composite creation
 */

import { SECTORS_RIGHT } from './iris-map'

// Maximum tokens for vision API calls
export const MAX_VISION_TOKENS = 4096

/** Мащаб и отместване за object-contain в квадратен контейнер (калибратор, отчет). */
export function fitImageInSquare(imageW: number, imageH: number, viewSize: number) {
  const scale = viewSize / Math.max(imageW, imageH, 1)
  return {
    scale,
    offsetX: (viewSize - imageW * scale) / 2,
    offsetY: (viewSize - imageH * scale) / 2,
    viewSize,
  }
}

/**
 * Creates a composite image by overlaying the iridology map on top of an iris image
 * @param irisImageDataUrl - Base64 data URL of the iris image
 * @param side - Which side of the iris (left or right) - reserved for future use
 * @returns Promise<string> - Base64 data URL of the composite image
 */
export async function createIrisWithOverlay(
  irisImageDataUrl: string,
  _side: 'left' | 'right' // Prefixed with underscore as it's reserved for future use
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Load iris image
      const irisImg = new Image()
      irisImg.crossOrigin = 'anonymous'
      
      irisImg.onload = () => {
        // Set canvas size to match iris image
        canvas.width = irisImg.width
        canvas.height = irisImg.height
        
        // Draw iris image first
        ctx.drawImage(irisImg, 0, 0, canvas.width, canvas.height)
        
        // Create and draw overlay
        const size = Math.min(canvas.width, canvas.height)
        const offsetX = (canvas.width - size) / 2
        const offsetY = (canvas.height - size) / 2
        
        // Draw the iridology overlay
        drawIridologyOverlay(ctx, size, offsetX, offsetY)
        
        // Convert canvas to data URL
        const compositeDataUrl = canvas.toDataURL('image/jpeg', 0.95)
        resolve(compositeDataUrl)
      }
      
      irisImg.onerror = () => {
        reject(new Error('Failed to load iris image'))
      }
      
      irisImg.src = irisImageDataUrl
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Draws the iridology overlay on a canvas context
 */
function drawIridologyOverlay(
  ctx: CanvasRenderingContext2D,
  size: number,
  offsetX: number,
  offsetY: number
) {
  const centerX = offsetX + size / 2
  const centerY = offsetY + size / 2
  const radius = size / 2
  
  // Define ring radii (as percentages of main radius)
  const pupilRadius = radius * 0.3
  const innerRadius = radius * 0.55
  const middleRadius = radius * 0.75
  const outerRadius = radius * 0.95
  
  // Set up drawing style
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
  ctx.lineWidth = 2
  
  // Draw pupil circle
  ctx.beginPath()
  ctx.arc(centerX, centerY, pupilRadius, 0, 2 * Math.PI)
  ctx.stroke()
  
  // Draw inner ring (autonomic nerve wreath)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'
  ctx.setLineDash([5, 3])
  ctx.beginPath()
  ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI)
  ctx.stroke()
  
  // Draw middle ring
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 4])
  ctx.beginPath()
  ctx.arc(centerX, centerY, middleRadius, 0, 2 * Math.PI)
  ctx.stroke()
  
  // Draw outer ring
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
  ctx.lineWidth = 3
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI)
  ctx.stroke()
  
  // Draw 12 radial sector lines (like clock hours)
  const sectors = 12
  const angleStep = (2 * Math.PI) / sectors
  
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'
  ctx.lineWidth = 1
  ctx.setLineDash([])
  
  for (let i = 0; i < sectors; i++) {
    const angle = angleStep * i - Math.PI / 2 // Start at 12 o'clock
    const x1 = centerX + pupilRadius * Math.cos(angle)
    const y1 = centerY + pupilRadius * Math.sin(angle)
    const x2 = centerX + outerRadius * Math.cos(angle)
    const y2 = centerY + outerRadius * Math.sin(angle)
    
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  
  // Draw hour labels with organ names
  ctx.fillStyle = 'rgba(59, 130, 246, 0.9)'
  ctx.font = `${Math.max(10, size / 30)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // Етикетите идват от единствената карта (`src/lib/iris-map.ts`) и са ОБЩИ
  // (функционални), а не органни. Преди тук стоеше четвърти, различен списък
  // от органи — той противоречеше и на промпта, и на отчета.
  const labels = SECTORS_RIGHT.map((sec, i) => ({
    hour: sec.id,
    text: `${sec.clock}\n${sec.label.split(' ')[0]}`,
    angle: -Math.PI / 2 + angleStep * i,
  }))
  
  // Draw labels at outer edge
  const labelRadius = outerRadius + radius * 0.12
  labels.forEach(label => {
    const x = centerX + labelRadius * Math.cos(label.angle)
    const y = centerY + labelRadius * Math.sin(label.angle)
    
    // Split multi-line text
    const lines = label.text.split('\n')
    const lineHeight = Math.max(12, size / 25)
    
    lines.forEach((line, idx) => {
      const yOffset = (idx - (lines.length - 1) / 2) * lineHeight
      ctx.fillText(line, x, y + yOffset)
    })
  })
  
  // Draw center crosshair
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'
  ctx.lineWidth = 1
  const crosshairSize = 10
  
  ctx.beginPath()
  ctx.moveTo(centerX - crosshairSize, centerY)
  ctx.lineTo(centerX + crosshairSize, centerY)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(centerX, centerY - crosshairSize)
  ctx.lineTo(centerX, centerY + crosshairSize)
  ctx.stroke()
}

/** Максимален размер на data URL за едно око. */
export const MAX_EYE_IMAGE_BYTES = 400 * 1024

/**
 * Смалява data URL, докато се побере в лимита.
 *
 * Първо пробва по-ниско качество на JPEG, после намалява и размерите. Връща
 * най-доброто постигнато — извикващият проверява дали е достатъчно.
 *
 * Съществува, защото приложението отхвърляше собствения си изход: кроп
 * редакторът дава 1600 px при качество 0.92, което за нормална снимка е
 * 400–500 KB, а прагът беше точно 400 KB.
 */
export function shrinkDataUrlToLimit(dataUrl: string, maxBytes: number): Promise<string> {
  return new Promise(resolve => {
    if (dataUrl.length <= maxBytes) { resolve(dataUrl); return }
    const img = new Image()
    img.onload = () => {
      let best = dataUrl
      // Първо само качество — размерите носят детайла, който анализът ползва.
      for (const q of [0.86, 0.78, 0.7, 0.62]) {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const ctx = c.getContext('2d')
        if (!ctx) break
        ctx.imageSmoothingQuality = 'high'
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(img, 0, 0)
        best = c.toDataURL('image/jpeg', q)
        if (best.length <= maxBytes) { resolve(best); return }
      }
      // Едва след това се жертва резолюция.
      for (const scale of [0.85, 0.72, 0.6, 0.5]) {
        const c = document.createElement('canvas')
        c.width = Math.round(img.naturalWidth * scale)
        c.height = Math.round(img.naturalHeight * scale)
        const ctx = c.getContext('2d')
        if (!ctx) break
        ctx.imageSmoothingQuality = 'high'
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(img, 0, 0, c.width, c.height)
        best = c.toDataURL('image/jpeg', 0.8)
        if (best.length <= maxBytes) { resolve(best); return }
      }
      resolve(best)
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
