/**
 * Генерира реалистична „светкавица" снимка за тест — отворено око, отблясък в зеницата.
 * Не замества реална снимка на клиент, но валидира pipeline-а за flash условия.
 */
export function drawFlashEyeFixture(): {
  dataUrl: string
  width: number
  height: number
  cx: number
  cy: number
  rp: number
  ri: number
} {
  const W = 1200
  const H = 1600
  const CX = 600
  const CY = 720
  const RP = 95
  const RI = 340

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')!

  // Кожа / фон
  const skin = x.createRadialGradient(CX, CY, 50, CX, CY, 700)
  skin.addColorStop(0, '#c8a88a')
  skin.addColorStop(1, '#8a6a52')
  x.fillStyle = skin
  x.fillRect(0, 0, W, H)

  // Склера
  x.fillStyle = '#f5f2ee'
  x.beginPath()
  x.ellipse(CX, CY, RI + 40, RI + 18, 0, 0, Math.PI * 2)
  x.fill()

  // Ирис — зелено-кафяв с радиални влакна
  x.save()
  x.beginPath()
  x.arc(CX, CY, RI, 0, Math.PI * 2)
  x.clip()
  x.fillStyle = '#7a8a62'
  x.fillRect(CX - RI, CY - RI, RI * 2, RI * 2)
  for (let i = 0; i < 280; i++) {
    const a0 = (i / 280) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 0.55) / 280) * Math.PI * 2 - Math.PI / 2
    x.fillStyle = i % 4 === 0 ? 'rgba(180,160,90,0.55)' : 'rgba(60,80,50,0.35)'
    x.beginPath()
    x.moveTo(CX, CY)
    x.arc(CX, CY, RI, a0, a1)
    x.fill()
  }
  // Златисто-жълт център (heterochromia)
  const inner = x.createRadialGradient(CX, CY, RP, CX, CY, RI * 0.55)
  inner.addColorStop(0, 'rgba(210,170,70,0.85)')
  inner.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = inner
  x.fillRect(CX - RI, CY - RI, RI * 2, RI * 2)
  x.restore()

  // Зеница + отблясък от светкавица
  x.fillStyle = '#0a0a0c'
  x.beginPath()
  x.arc(CX, CY, RP, 0, Math.PI * 2)
  x.fill()
  x.fillStyle = '#ffffff'
  x.beginPath()
  x.arc(CX - 8, CY - 6, 28, 0, Math.PI * 2)
  x.fill()
  x.fillStyle = 'rgba(255,255,255,0.45)'
  x.beginPath()
  x.arc(CX + 12, CY + 14, 8, 0, Math.PI * 2)
  x.fill()

  // Капиляри по склерата
  x.strokeStyle = 'rgba(200,80,80,0.25)'
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2
    x.beginPath()
    x.moveTo(CX + Math.cos(a) * (RI + 5), CY + Math.sin(a) * (RI + 5) * 0.5)
    x.lineTo(CX + Math.cos(a) * (RI + 35), CY + Math.sin(a) * (RI + 35) * 0.5)
    x.stroke()
  }

  return {
    dataUrl: c.toDataURL('image/jpeg', 0.92),
    width: W,
    height: H,
    cx: CX,
    cy: CY,
    rp: RP,
    ri: RI,
  }
}
