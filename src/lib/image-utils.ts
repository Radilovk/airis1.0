/**
 * Utility functions for image manipulation and composite creation
 */

/**
 * Creates a composite image by overlaying the iridology map on top of an iris image
 * @param irisImageDataUrl - Base64 data URL of the iris image
 * @param side - Which side of the iris (left or right)
 * @returns Promise<string> - Base64 data URL of the composite image
 */
export async function createIrisWithOverlay(
  irisImageDataUrl: string,
  side: 'left' | 'right'
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
        drawIridologyOverlay(ctx, size, offsetX, offsetY, side)
        
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
  offsetY: number,
  side: 'left' | 'right'
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
  
  const labels = [
    { hour: 12, text: '12h\nМозък', angle: -Math.PI / 2 },
    { hour: 1, text: '1h\nХипофиза', angle: -Math.PI / 2 + angleStep * 1 },
    { hour: 2, text: '2h\nЩ.жлеза', angle: -Math.PI / 2 + angleStep * 2 },
    { hour: 3, text: '3h\nБелодр.', angle: -Math.PI / 2 + angleStep * 3 },
    { hour: 4, text: '4h\nЧ.дроб', angle: -Math.PI / 2 + angleStep * 4 },
    { hour: 5, text: '5h\nСтомах', angle: -Math.PI / 2 + angleStep * 5 },
    { hour: 6, text: '6h\nПанкр.', angle: -Math.PI / 2 + angleStep * 6 },
    { hour: 7, text: '7h\nБъбреци', angle: -Math.PI / 2 + angleStep * 7 },
    { hour: 8, text: '8h\nНадбъбр.', angle: -Math.PI / 2 + angleStep * 8 },
    { hour: 9, text: '9h\nСърце', angle: -Math.PI / 2 + angleStep * 9 },
    { hour: 10, text: '10h\nДалак', angle: -Math.PI / 2 + angleStep * 10 },
    { hour: 11, text: '11h\nЛимфа', angle: -Math.PI / 2 + angleStep * 11 }
  ]
  
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
