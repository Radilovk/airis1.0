import type { AnalysisReport } from '@/types'

export function generateComprehensiveReportHTML(report: AnalysisReport): string {
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  const bmi = (report.questionnaireData.weight / ((report.questionnaireData.height / 100) ** 2)).toFixed(1)
  const leftZones = report.leftIris?.zones || []
  const rightZones = report.rightIris?.zones || []
  
  const leftStats = {
    total: leftZones.length,
    normal: leftZones.filter(z => z?.status === 'normal').length,
    attention: leftZones.filter(z => z?.status === 'attention').length,
    concern: leftZones.filter(z => z?.status === 'concern').length
  }
  
  const rightStats = {
    total: rightZones.length,
    normal: rightZones.filter(z => z?.status === 'normal').length,
    attention: rightZones.filter(z => z?.status === 'attention').length,
    concern: rightZones.filter(z => z?.status === 'concern').length
  }

  const renderIrisSVG = (zones: any[], side: 'left' | 'right', overallHealth: number) => {
    const radius = 150
    const centerX = 200
    const centerY = 200
    const pupilRadius = radius * 0.25
    const innerRingEnd = radius * 0.33
    const middleRingStart = innerRingEnd
    const middleRingEnd = radius * 0.83
    const outerRingStart = middleRingEnd

    const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
      return {
        x: cx + r * Math.cos(angleInRadians),
        y: cy + r * Math.sin(angleInRadians)
      }
    }

    const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
      const start = polarToCartesian(x, y, r, endAngle)
      const end = polarToCartesian(x, y, r, startAngle)
      const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
      
      return [
        'M', x, y,
        'L', start.x, start.y,
        'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
        'Z'
      ].join(' ')
    }

    const getColorForStatus = (status: string) => {
      const colors: Record<string, string> = {
        normal: 'rgba(34, 197, 94, 0.15)',
        attention: 'rgba(234, 179, 8, 0.35)',
        concern: 'rgba(239, 68, 68, 0.45)'
      }
      return colors[status] || 'rgba(100, 116, 139, 0.1)'
    }

    const getStrokeForStatus = (status: string) => {
      const colors: Record<string, string> = {
        normal: 'rgba(34, 197, 94, 0.5)',
        attention: 'rgba(234, 179, 8, 0.75)',
        concern: 'rgba(239, 68, 68, 0.85)'
      }
      return colors[status] || 'rgba(100, 116, 139, 0.3)'
    }

    let svgContent = `
      <svg width="400" height="400" viewBox="0 0 400 400" class="iris-svg">
        <defs>
          <radialGradient id="pupilGradient-${side}" cx="50%" cy="50%">
            <stop offset="0%" stop-color="rgba(15, 23, 42, 0.9)" />
            <stop offset="100%" stop-color="rgba(30, 41, 59, 0.7)" />
          </radialGradient>
          <linearGradient id="ringGlow-${side}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(59, 130, 246, 0.6)" />
            <stop offset="50%" stop-color="rgba(99, 102, 241, 0.6)" />
            <stop offset="100%" stop-color="rgba(139, 92, 246, 0.6)" />
          </linearGradient>
          <filter id="glow-${side}">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <circle cx="${centerX}" cy="${centerY}" r="${radius + 5}" fill="none" stroke="url(#ringGlow-${side})" stroke-width="1" opacity="0.3" />
        
        <circle cx="${centerX}" cy="${centerY}" r="${innerRingEnd}" fill="none" stroke="rgba(59, 130, 246, 0.7)" stroke-width="1.5" stroke-dasharray="4,2" filter="url(#glow-${side})" />
        <circle cx="${centerX}" cy="${centerY}" r="${middleRingStart}" fill="none" stroke="rgba(99, 102, 241, 0.8)" stroke-width="2.5" filter="url(#glow-${side})" />
        <circle cx="${centerX}" cy="${centerY}" r="${middleRingEnd}" fill="none" stroke="rgba(139, 92, 246, 0.8)" stroke-width="2.5" filter="url(#glow-${side})" />
        <circle cx="${centerX}" cy="${centerY}" r="${outerRingStart}" fill="none" stroke="rgba(168, 85, 247, 0.7)" stroke-width="1.5" stroke-dasharray="4,2" filter="url(#glow-${side})" />
    `

    for (let angle = 0; angle < 360; angle += 30) {
      const outer = polarToCartesian(centerX, centerY, radius, angle)
      const inner = polarToCartesian(centerX, centerY, pupilRadius, angle)
      svgContent += `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(100, 116, 139, 0.25)" stroke-width="1" />`
    }

    zones.forEach((zone) => {
      if (!zone) return
      const startAngle = zone.angle?.[0] ?? 0
      const endAngle = zone.angle?.[1] ?? 30
      const midAngle = (startAngle + endAngle) / 2
      const labelPos = polarToCartesian(centerX, centerY, radius * 0.9, midAngle)
      
      const path = describeArc(centerX, centerY, radius, startAngle, endAngle)
      const fill = getColorForStatus(zone.status)
      const stroke = getStrokeForStatus(zone.status)
      const strokeWidth = zone.status === 'normal' ? 1 : 2
      const opacity = zone.status === 'normal' ? 0.4 : 0.8

      svgContent += `
        <path 
          d="${path}" 
          fill="${fill}" 
          stroke="${stroke}" 
          stroke-width="${strokeWidth}" 
          opacity="${opacity}"
          class="iris-zone" 
          data-zone-id="${zone.id}"
          data-zone-name="${zone.name || ''}"
          data-zone-organ="${zone.organ || ''}"
          data-zone-status="${zone.status}"
          data-zone-findings="${(zone.findings || '').replace(/"/g, '&quot;')}"
        />
        <text 
          x="${labelPos.x}" 
          y="${labelPos.y}" 
          text-anchor="middle" 
          dominant-baseline="middle" 
          fill="currentColor" 
          font-size="11" 
          font-weight="700" 
          font-family="monospace"
          opacity="${opacity}"
          class="zone-label"
        >
          ${zone.id}
        </text>
      `
    })

    svgContent += `
        <circle cx="${centerX}" cy="${centerY}" r="${pupilRadius}" fill="url(#pupilGradient-${side})" stroke="rgba(59, 130, 246, 0.6)" stroke-width="2" filter="url(#glow-${side})" />
        <text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" fill="rgba(255, 255, 255, 0.9)" font-size="32" font-weight="700" font-family="monospace" filter="url(#glow-${side})">${overallHealth}</text>
    `

    for (let angle = 0; angle < 360; angle += 45) {
      const tickStart = polarToCartesian(centerX, centerY, radius - 5, angle)
      const tickEnd = polarToCartesian(centerX, centerY, radius + 5, angle)
      svgContent += `<line x1="${tickStart.x}" y1="${tickStart.y}" x2="${tickEnd.x}" y2="${tickEnd.y}" stroke="rgba(99, 102, 241, 0.5)" stroke-width="2" filter="url(#glow-${side})" />`
    }

    svgContent += `</svg>`
    return svgContent
  }

  const parseDetailedAnalysis = (text: string) => {
    const sections = {
      overview: '',
      keyFindings: '',
      goalConnection: '',
      prognosis: ''
    }
    
    const lines = text.split('\n').filter(line => line.trim())
    let currentSection = ''
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed.includes('Обща оценка') || trimmed.includes('обща оценка')) {
        currentSection = 'overview'
      } else if (trimmed.includes('Най-важни находки') || trimmed.includes('важни находки')) {
        currentSection = 'keyFindings'
      } else if (trimmed.includes('Връзка с целите') || trimmed.includes('връзка с целите')) {
        currentSection = 'goalConnection'
      } else if (trimmed.includes('Прогноза') || trimmed.includes('прогноза')) {
        currentSection = 'prognosis'
      } else if (currentSection && !trimmed.match(/^\d+\./)) {
        sections[currentSection as keyof typeof sections] += (sections[currentSection as keyof typeof sections] ? ' ' : '') + trimmed
      }
    })
    
    return sections
  }

  const generateSystemScoresChart = () => {
    const allScores = [
      ...(report.leftIris.systemScores || []),
      ...(report.rightIris.systemScores || [])
    ]
    
    const systemAverages = new Map<string, number[]>()
    allScores.forEach(s => {
      if (s?.system && typeof s.score === 'number') {
        const current = systemAverages.get(s.system) || []
        systemAverages.set(s.system, [...current, s.score])
      }
    })
    
    const systemData = Array.from(systemAverages.entries()).map(([system, scores]) => ({
      system,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    })).sort((a, b) => b.score - a.score)

    return systemData.map(item => `
      <div class="system-score-item">
        <div class="system-score-header">
          <span class="system-name">${item.system}</span>
          <span class="system-value">${item.score}/100</span>
        </div>
        <div class="system-score-bar">
          <div class="system-score-fill" style="width: ${item.score}%; background-color: ${
            item.score >= 75 ? 'oklch(0.60 0.15 145)' : 
            item.score >= 60 ? 'oklch(0.65 0.15 60)' : 
            'oklch(0.60 0.20 27)'
          }"></div>
        </div>
      </div>
    `).join('')
  }

  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Иридологичен Доклад - ${report.questionnaireData.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: oklch(0.25 0.02 240);
      background: oklch(0.98 0.01 230);
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, oklch(0.55 0.15 230) 0%, oklch(0.70 0.18 45) 100%);
      color: white;
      padding: 48px 32px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    
    .header .subtitle {
      font-size: 18px;
      opacity: 0.95;
      margin-bottom: 8px;
    }
    
    .header .date {
      font-size: 14px;
      opacity: 0.85;
    }
    
    .score-section {
      text-align: center;
      padding: 48px 32px;
      background: linear-gradient(180deg, oklch(0.98 0.01 230) 0%, white 100%);
    }
    
    .score-badge {
      display: inline-flex;
      align-items: center;
      justify-center;
      width: 140px;
      height: 140px;
      border-radius: 28px;
      background: linear-gradient(135deg, oklch(0.55 0.15 230 / 0.15) 0%, oklch(0.70 0.18 45 / 0.15) 100%);
      margin-bottom: 20px;
      font-size: 56px;
      font-weight: 700;
      color: oklch(0.55 0.15 230);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    }
    
    .score-label {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    
    .score-desc {
      font-size: 15px;
      color: oklch(0.50 0.05 240);
      max-width: 600px;
      margin: 0 auto;
    }
    
    .content {
      padding: 40px 32px;
    }
    
    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 24px;
      color: oklch(0.25 0.02 240);
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 3px solid oklch(0.55 0.15 230);
    }
    
    .section-title.gradient {
      background: linear-gradient(135deg, oklch(0.55 0.15 230) 0%, oklch(0.70 0.18 45) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .section-icon {
      font-size: 28px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    
    .card {
      background: oklch(1 0 0);
      border: 2px solid oklch(0.88 0.02 230);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: all 0.3s;
    }
    
    .card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
    }
    
    .card-header {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: oklch(0.25 0.02 240);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .card-content {
      font-size: 15px;
      line-height: 1.8;
      color: oklch(0.40 0.02 240);
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 20px 0;
    }
    
    .info-item {
      background: oklch(0.98 0.01 230);
      padding: 20px;
      border-radius: 12px;
      border: 2px solid oklch(0.88 0.02 230);
      transition: all 0.3s;
    }
    
    .info-item:hover {
      border-color: oklch(0.55 0.15 230);
      transform: translateY(-2px);
    }
    
    .info-label {
      font-size: 12px;
      font-weight: 600;
      color: oklch(0.50 0.05 240);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    
    .info-value {
      font-size: 18px;
      font-weight: 700;
      color: oklch(0.25 0.02 240);
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      margin: 24px 0;
    }
    
    .stat-card {
      text-align: center;
      padding: 24px;
      background: linear-gradient(135deg, oklch(0.98 0.01 230) 0%, oklch(0.95 0.01 230) 100%);
      border-radius: 16px;
      border: 2px solid oklch(0.88 0.02 230);
      transition: all 0.3s;
    }
    
    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: oklch(0.55 0.15 230);
      margin-bottom: 8px;
    }
    
    .stat-label {
      font-size: 12px;
      color: oklch(0.50 0.05 240);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .iris-container {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
      justify-content: center;
      margin: 32px 0;
    }
    
    .iris-item {
      flex: 1;
      min-width: 300px;
      max-width: 500px;
    }
    
    .iris-title {
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: oklch(0.55 0.15 230);
      margin-bottom: 16px;
    }
    
    .iris-svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
      background: radial-gradient(circle at center, rgba(30, 41, 59, 0.03) 0%, rgba(15, 23, 42, 0.01) 100%);
      border-radius: 12px;
      padding: 8px;
    }
    
    .iris-zone {
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .iris-zone:hover {
      opacity: 1 !important;
      filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.5));
    }
    
    .zone-info-panel {
      margin-top: 20px;
      padding: 20px;
      background: oklch(0.98 0.01 230);
      border-radius: 12px;
      border: 2px solid oklch(0.88 0.02 230);
      display: none;
    }
    
    .zone-info-panel.active {
      display: block;
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .zone-card {
      background: white;
      border: 2px solid oklch(0.88 0.02 230);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      transition: all 0.3s;
    }
    
    .zone-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateX(4px);
    }
    
    .zone-card.attention {
      background: oklch(0.97 0.05 45 / 0.2);
      border-color: oklch(0.70 0.18 45);
    }
    
    .zone-card.concern {
      background: oklch(0.95 0.05 27 / 0.15);
      border-color: oklch(0.577 0.245 27.325);
    }
    
    .zone-header {
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .zone-name {
      font-size: 16px;
      color: oklch(0.25 0.02 240);
    }
    
    .zone-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 700;
    }
    
    .zone-badge.attention {
      background: oklch(0.90 0.08 60 / 0.3);
      color: oklch(0.50 0.15 60);
    }
    
    .zone-badge.concern {
      background: oklch(0.90 0.10 27 / 0.3);
      color: oklch(0.50 0.20 27);
    }
    
    .zone-findings {
      font-size: 14px;
      line-height: 1.8;
      color: oklch(0.40 0.02 240);
    }
    
    .analysis-text {
      background: oklch(0.98 0.01 230);
      border-radius: 16px;
      padding: 24px;
      margin: 20px 0;
    }
    
    .analysis-paragraph {
      display: flex;
      align-items: start;
      gap: 16px;
      margin-bottom: 20px;
      padding: 20px;
      background: white;
      border-radius: 12px;
      border: 1px solid oklch(0.90 0.02 230);
      transition: all 0.3s;
    }
    
    .analysis-paragraph:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      transform: translateX(4px);
    }
    
    .analysis-paragraph:last-child {
      margin-bottom: 0;
    }
    
    .analysis-bullet {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: linear-gradient(135deg, oklch(0.55 0.15 230) 0%, oklch(0.70 0.18 45) 100%);
      margin-top: 8px;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .analysis-paragraph p {
      font-size: 15px;
      line-height: 1.8;
      color: oklch(0.30 0.02 240);
    }
    
    .system-score-item {
      margin-bottom: 16px;
    }
    
    .system-score-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .system-name {
      font-size: 14px;
      font-weight: 600;
      color: oklch(0.30 0.02 240);
    }
    
    .system-value {
      font-size: 14px;
      font-weight: 700;
      color: oklch(0.55 0.15 230);
    }
    
    .system-score-bar {
      height: 12px;
      background: oklch(0.93 0.02 230);
      border-radius: 6px;
      overflow: hidden;
    }
    
    .system-score-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 1s ease-out;
    }
    
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 2px solid oklch(0.88 0.02 230);
      padding-bottom: 4px;
    }
    
    .tab {
      padding: 12px 24px;
      background: transparent;
      border: none;
      border-radius: 8px 8px 0 0;
      font-size: 15px;
      font-weight: 600;
      color: oklch(0.50 0.05 240);
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .tab:hover {
      background: oklch(0.95 0.01 230);
      color: oklch(0.55 0.15 230);
    }
    
    .tab.active {
      background: oklch(0.55 0.15 230);
      color: white;
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
      animation: fadeIn 0.3s ease-out;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    .recommendations-list {
      list-style: none;
      padding: 0;
    }
    
    .recommendations-list li {
      padding: 16px 20px;
      margin-bottom: 12px;
      background: oklch(0.98 0.01 230);
      border-radius: 12px;
      border-left: 4px solid oklch(0.55 0.15 230);
      font-size: 14px;
      line-height: 1.8;
      transition: all 0.3s;
    }
    
    .recommendations-list li:hover {
      background: oklch(0.55 0.15 230 / 0.05);
      transform: translateX(4px);
    }
    
    .footer {
      background: oklch(0.93 0.02 230);
      padding: 32px;
      text-align: center;
      font-size: 13px;
      color: oklch(0.50 0.05 240);
      border-top: 2px solid oklch(0.88 0.02 230);
    }
    
    .footer p {
      margin-bottom: 8px;
      line-height: 1.6;
    }
    
    .footer strong {
      color: oklch(0.30 0.02 240);
    }
    
    @media print {
      body {
        padding: 0;
        background: white;
      }
      
      .container {
        box-shadow: none;
        border-radius: 0;
      }
      
      .section {
        page-break-inside: avoid;
      }
      
      @page {
        size: A4;
        margin: 1.5cm;
      }
      
      .iris-zone {
        cursor: default;
      }
      
      .tab {
        cursor: default;
      }
    }
    
    @media (max-width: 768px) {
      body {
        padding: 0;
      }
      
      .container {
        border-radius: 0;
      }
      
      .header {
        padding: 32px 20px;
      }
      
      .header h1 {
        font-size: 24px;
      }
      
      .score-section {
        padding: 32px 20px;
      }
      
      .content {
        padding: 24px 20px;
      }
      
      .section-title {
        font-size: 20px;
      }
      
      .iris-container {
        flex-direction: column;
      }
      
      .iris-item {
        min-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Иридологичен Доклад</h1>
      <div class="subtitle">${report.questionnaireData.name}</div>
      <div class="date">
        ${new Date(report.timestamp).toLocaleDateString('bg-BG', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>

    <div class="score-section">
      <div class="score-badge">${avgHealth}</div>
      <div class="score-label">Общо здравословно състояние</div>
      <div class="score-desc">Вашият иридологичен профил е анализиран и оценен на база множество здравни показатели</div>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">
          <span class="section-icon">📋</span>
          Биометрични данни и здравен профил
        </div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Име</div>
            <div class="info-value">${report.questionnaireData.name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Възраст</div>
            <div class="info-value">${report.questionnaireData.age} години</div>
          </div>
          <div class="info-item">
            <div class="info-label">Пол</div>
            <div class="info-value">${
              report.questionnaireData.gender === 'male' ? 'Мъж' : 
              report.questionnaireData.gender === 'female' ? 'Жена' : 'Друго'
            }</div>
          </div>
          <div class="info-item">
            <div class="info-label">BMI</div>
            <div class="info-value">${bmi}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Тегло</div>
            <div class="info-value">${report.questionnaireData.weight} кг</div>
          </div>
          <div class="info-item">
            <div class="info-label">Ръст</div>
            <div class="info-value">${report.questionnaireData.height} см</div>
          </div>
        </div>
      </div>

      ${report.briefSummary ? `
        <div class="section">
          <div class="section-title">
            <span class="section-icon">📊</span>
            Кратко Резюме
          </div>
          <div class="analysis-text">
            ${report.briefSummary.split(/\n/).filter(line => line.trim()).map(point => {
              const cleanPoint = point.replace(/^[•\-]\s*/, '').trim()
              return cleanPoint ? `
                <div class="analysis-paragraph">
                  <div class="analysis-bullet"></div>
                  <p>${cleanPoint}</p>
                </div>
              ` : ''
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title section-title gradient">
          <span class="section-icon">👁️</span>
          Иридологичен Анализ
        </div>
        
        <div class="card">
          <div class="card-header">Обща Оценка</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${report.leftIris.overallHealth}</div>
              <div class="stat-label">Ляв ирис</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${report.rightIris.overallHealth}</div>
              <div class="stat-label">Десен ирис</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${leftStats.concern + rightStats.concern}</div>
              <div class="stat-label">Притеснение</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${leftStats.attention + rightStats.attention}</div>
              <div class="stat-label">Внимание</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Най-важни Находки</div>
          <div class="stats-grid">
            <div class="stat-card" style="background: linear-gradient(135deg, oklch(0.85 0.08 145 / 0.3) 0%, oklch(0.90 0.05 145 / 0.2) 100%);">
              <div class="stat-value" style="color: oklch(0.50 0.15 145);">${leftStats.normal + rightStats.normal}</div>
              <div class="stat-label">Здрави зони</div>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, oklch(0.85 0.08 60 / 0.3) 0%, oklch(0.90 0.05 60 / 0.2) 100%);">
              <div class="stat-value" style="color: oklch(0.50 0.15 60);">${leftStats.attention + rightStats.attention}</div>
              <div class="stat-label">Внимание</div>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, oklch(0.85 0.10 27 / 0.3) 0%, oklch(0.90 0.05 27 / 0.2) 100%);">
              <div class="stat-value" style="color: oklch(0.50 0.20 27);">${leftStats.concern + rightStats.concern}</div>
              <div class="stat-label">Притеснение</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${leftStats.total + rightStats.total}</div>
              <div class="stat-label">Общо зони</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Интерактивна Топографска Карта</div>
          <div class="iris-container">
            <div class="iris-item">
              <div class="iris-title">Ляв Ирис</div>
              ${renderIrisSVG(leftZones, 'left', report.leftIris.overallHealth)}
              <div id="zone-info-left" class="zone-info-panel"></div>
            </div>
            <div class="iris-item">
              <div class="iris-title">Десен Ирис</div>
              ${renderIrisSVG(rightZones, 'right', report.rightIris.overallHealth)}
              <div id="zone-info-right" class="zone-info-panel"></div>
            </div>
          </div>
        </div>
      </div>

      ${report.detailedAnalysis ? `
        <div class="section">
          <div class="section-title">
            <span class="section-icon">🔍</span>
            Детайлен Иридологичен Анализ
          </div>
          ${(() => {
            const sections = parseDetailedAnalysis(report.detailedAnalysis)
            let html = '<div class="analysis-text">'
            
            if (sections.overview) {
              html += `
                <div class="card" style="margin-bottom: 24px;">
                  <div class="card-header">
                    <span style="font-size: 18px; font-weight: 700;">⚕️ Обща Оценка</span>
                  </div>
                  <div class="card-content">
                    <p style="line-height: 1.8;">${sections.overview}</p>
                  </div>
                </div>
              `
            }
            
            if (sections.keyFindings) {
              html += `
                <div class="card" style="margin-bottom: 24px;">
                  <div class="card-header">
                    <span style="font-size: 18px; font-weight: 700;">⚠️ Най-важни Находки</span>
                  </div>
                  <div class="card-content">
                    <p style="line-height: 1.8;">${sections.keyFindings}</p>
                  </div>
                </div>
              `
            }
            
            if (sections.goalConnection) {
              html += `
                <div class="card" style="margin-bottom: 24px;">
                  <div class="card-header">
                    <span style="font-size: 18px; font-weight: 700;">🎯 Връзка с Целите</span>
                  </div>
                  <div class="card-content">
                    <p style="line-height: 1.8;">${sections.goalConnection}</p>
                  </div>
                </div>
              `
            }
            
            if (sections.prognosis) {
              html += `
                <div class="card" style="margin-bottom: 24px;">
                  <div class="card-header">
                    <span style="font-size: 18px; font-weight: 700;">📈 Прогноза</span>
                  </div>
                  <div class="card-content">
                    <p style="line-height: 1.8;">${sections.prognosis}</p>
                  </div>
                </div>
              `
            }
            
            html += '</div>'
            return html
          })()}
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">
          <span class="section-icon">📈</span>
          Оценка на Органни Системи
        </div>
        <div class="card">
          ${generateSystemScoresChart()}
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="section-icon">🎯</span>
          Детайлни Зони по Ирис
        </div>
        
        <div class="tabs">
          <button class="tab active" onclick="switchTab(event, 'left-zones')">Ляв Ирис</button>
          <button class="tab" onclick="switchTab(event, 'right-zones')">Десен Ирис</button>
        </div>

        <div id="left-zones" class="tab-content active">
          ${leftZones.filter(z => z && z.status !== 'normal').length > 0 ? 
            leftZones.filter(z => z && z.status !== 'normal').map(zone => `
              <div class="zone-card ${zone.status}">
                <div class="zone-header">
                  <span class="zone-name">${zone.name || ''} (${zone.organ || ''})</span>
                  <span class="zone-badge ${zone.status}">
                    ${zone.status === 'attention' ? '⚠️ Внимание' : '🔴 Притеснение'}
                  </span>
                </div>
                <div class="zone-findings">${zone.findings || ''}</div>
              </div>
            `).join('') : 
            '<div class="card"><p class="card-content">Всички зони са в норма ✅</p></div>'
          }
        </div>

        <div id="right-zones" class="tab-content">
          ${rightZones.filter(z => z && z.status !== 'normal').length > 0 ? 
            rightZones.filter(z => z && z.status !== 'normal').map(zone => `
              <div class="zone-card ${zone.status}">
                <div class="zone-header">
                  <span class="zone-name">${zone.name || ''} (${zone.organ || ''})</span>
                  <span class="zone-badge ${zone.status}">
                    ${zone.status === 'attention' ? '⚠️ Внимание' : '🔴 Притеснение'}
                  </span>
                </div>
                <div class="zone-findings">${zone.findings || ''}</div>
              </div>
            `).join('') : 
            '<div class="card"><p class="card-content">Всички зони са в норма ✅</p></div>'
          }
        </div>
      </div>

      ${report.detailedPlan ? `
        ${report.motivationalSummary ? `
          <div class="section">
            <div class="section-title">
              <span class="section-icon">💡</span>
              План за Действие
            </div>
            <div class="card">
              <div class="card-content">${report.motivationalSummary}</div>
            </div>
          </div>
        ` : ''}

        ${report.detailedPlan.generalRecommendations && report.detailedPlan.generalRecommendations.length > 0 ? `
          <div class="section">
            <div class="section-title">
              <span class="section-icon">✨</span>
              Общи Препоръки
            </div>
            <ul class="recommendations-list">
              ${report.detailedPlan.generalRecommendations.map(rec => 
                rec ? `<li>${rec}</li>` : ''
              ).filter(item => item).join('')}
            </ul>
          </div>
        ` : ''}
      ` : ''}
    </div>

    <div class="footer">
      <p><strong>Важна информация:</strong> Този доклад е генериран от AI система за иридологичен анализ и не замества професионална медицинска консултация.</p>
      <p>За допълнителна информация и консултация, моля свържете се с квалифициран иридолог или лекар.</p>
      <p><strong>Генериран на:</strong> ${new Date().toLocaleString('bg-BG')}</p>
    </div>
  </div>

  <script>
    function switchTab(event, tabId) {
      const tabs = document.querySelectorAll('.tab');
      const tabContents = document.querySelectorAll('.tab-content');
      
      tabs.forEach(tab => tab.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    }

    document.querySelectorAll('.iris-zone').forEach(zone => {
      zone.addEventListener('click', function() {
        const zoneId = this.getAttribute('data-zone-id');
        const zoneName = this.getAttribute('data-zone-name');
        const zoneOrgan = this.getAttribute('data-zone-organ');
        const zoneStatus = this.getAttribute('data-zone-status');
        const zoneFindings = this.getAttribute('data-zone-findings');
        
        const svg = this.closest('svg');
        const irisItem = svg.closest('.iris-item');
        const side = irisItem.querySelector('.iris-title').textContent.includes('Ляв') ? 'left' : 'right';
        const infoPanel = document.getElementById('zone-info-' + side);
        
        const statusText = {
          'attention': '⚠️ Внимание',
          'concern': '🔴 Притеснение',
          'normal': '✅ Норма'
        }[zoneStatus] || zoneStatus;
        
        const statusClass = zoneStatus;
        
        infoPanel.innerHTML = \`
          <div class="zone-card \${statusClass}">
            <div class="zone-header">
              <span class="zone-name">\${zoneName} (\${zoneOrgan})</span>
              <span class="zone-badge \${statusClass}">\${statusText}</span>
            </div>
            <div class="zone-findings">\${zoneFindings}</div>
          </div>
        \`;
        
        infoPanel.classList.add('active');
        
        infoPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    window.addEventListener('DOMContentLoaded', () => {
      if (window.location.search.includes('print=true')) {
        setTimeout(() => window.print(), 500);
      }
      
      setTimeout(() => {
        document.querySelectorAll('.system-score-fill').forEach(fill => {
          fill.style.width = fill.style.width;
        });
      }, 100);
    });
  </script>
</body>
</html>`
}
