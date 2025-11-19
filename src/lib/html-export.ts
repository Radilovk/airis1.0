import type { AnalysisReport } from '@/types'

export function generateReportHTML(report: AnalysisReport): string {
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  const bmi = (report.questionnaireData.weight / ((report.questionnaireData.height / 100) ** 2)).toFixed(1)
  const leftZones = report.leftIris?.zones || []
  const rightZones = report.rightIris?.zones || []
  const concernZones = leftZones.filter(z => z?.status && z.status !== 'normal').length + 
                      rightZones.filter(z => z?.status && z.status !== 'normal').length

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

  const getSleepQualityLabel = (quality: string) => {
    const labels: Record<string, string> = {
      'poor': 'Лошо',
      'fair': 'Средно',
      'good': 'Добро',
      'excellent': 'Отлично'
    }
    return labels[quality] || quality
  }

  const getLifestyleHTML = () => {
    const sleepHours = report.questionnaireData.sleepHours
    const sleepQuality = report.questionnaireData.sleepQuality
    
    let sleepQualityText = getSleepQualityLabel(sleepQuality)
    
    if (sleepHours < 6) {
      sleepQualityText = 'Недостатъчен'
    } else if (sleepHours < 7) {
      sleepQualityText = sleepQuality === 'excellent' || sleepQuality === 'good' ? 'Под оптималното' : sleepQualityText
    } else if (sleepHours > 9) {
      sleepQualityText = 'Прекомерен'
    } else if (sleepQuality === 'poor' || sleepQuality === 'fair') {
      sleepQualityText = getSleepQualityLabel(sleepQuality)
    }

    return `
      <div class="lifestyle-grid">
        <div class="lifestyle-item">
          <div class="lifestyle-icon">🌙</div>
          <div class="lifestyle-label">Сън</div>
          <div class="lifestyle-value">${sleepHours}ч</div>
          <div class="lifestyle-quality">${sleepQualityText}</div>
        </div>
        <div class="lifestyle-item">
          <div class="lifestyle-icon">💧</div>
          <div class="lifestyle-label">Хидратация</div>
          <div class="lifestyle-value">${report.questionnaireData.hydration} чаши</div>
          <div class="lifestyle-quality">${report.questionnaireData.hydration >= 8 ? 'Добра' : 'Недостатъчна'}</div>
        </div>
        <div class="lifestyle-item">
          <div class="lifestyle-icon">⚡</div>
          <div class="lifestyle-label">Стрес</div>
          <div class="lifestyle-value">${
            report.questionnaireData.stressLevel === 'low' ? 'Нисък' : 
            report.questionnaireData.stressLevel === 'moderate' ? 'Умерен' : 'Висок'
          }</div>
        </div>
        <div class="lifestyle-item">
          <div class="lifestyle-icon">🏋️</div>
          <div class="lifestyle-label">Активност</div>
          <div class="lifestyle-value">${
            report.questionnaireData.activityLevel === 'very-active' ? 'Много активен' :
            report.questionnaireData.activityLevel === 'active' ? 'Активен' :
            report.questionnaireData.activityLevel === 'moderate' ? 'Умерен' :
            report.questionnaireData.activityLevel === 'light' ? 'Лека' : 'Заседнал'
          }</div>
        </div>
      </div>
    `
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
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, oklch(0.55 0.15 230) 0%, oklch(0.70 0.18 45) 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .header .date {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .score-section {
      text-align: center;
      padding: 40px 32px;
      background: linear-gradient(180deg, oklch(0.98 0.01 230) 0%, white 100%);
    }
    
    .score-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 120px;
      height: 120px;
      border-radius: 24px;
      background: linear-gradient(135deg, oklch(0.55 0.15 230 / 0.2) 0%, oklch(0.70 0.18 45 / 0.2) 100%);
      margin-bottom: 16px;
      font-size: 48px;
      font-weight: 700;
      background-clip: padding-box;
      color: oklch(0.55 0.15 230);
    }
    
    .score-label {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .score-desc {
      font-size: 14px;
      color: oklch(0.50 0.05 240);
      max-width: 500px;
      margin: 0 auto;
    }
    
    .content {
      padding: 32px;
    }
    
    .section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      color: oklch(0.25 0.02 240);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-icon {
      font-size: 24px;
    }
    
    .card {
      background: oklch(1 0 0);
      border: 1px solid oklch(0.88 0.02 230);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 12px;
    }
    
    .card-header {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: oklch(0.25 0.02 240);
    }
    
    .card-content {
      font-size: 14px;
      line-height: 1.7;
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
      padding: 16px;
      border-radius: 12px;
      border: 1px solid oklch(0.88 0.02 230);
    }
    
    .info-label {
      font-size: 12px;
      font-weight: 500;
      color: oklch(0.50 0.05 240);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: oklch(0.25 0.02 240);
    }
    
    .goals-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
    }
    
    .goal-tag {
      background: oklch(0.85 0.08 220);
      color: oklch(0.25 0.02 240);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }
    
    .summary-box {
      background: linear-gradient(135deg, oklch(0.55 0.15 230 / 0.1) 0%, oklch(0.70 0.18 45 / 0.1) 100%);
      border-left: 4px solid oklch(0.55 0.15 230);
      padding: 20px;
      border-radius: 0 12px 12px 0;
      margin: 20px 0;
    }
    
    .summary-box p {
      margin-bottom: 12px;
      font-size: 14px;
      line-height: 1.8;
      color: oklch(0.35 0.02 240);
    }
    
    .summary-box p:last-child {
      margin-bottom: 0;
    }
    
    .lifestyle-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin: 20px 0;
    }
    
    .lifestyle-item {
      background: oklch(0.98 0.01 230);
      border: 1px solid oklch(0.88 0.02 230);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    
    .lifestyle-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
    
    .lifestyle-label {
      font-size: 12px;
      color: oklch(0.50 0.05 240);
      font-weight: 500;
      margin-bottom: 4px;
    }
    
    .lifestyle-value {
      font-size: 16px;
      font-weight: 600;
      color: oklch(0.25 0.02 240);
      margin-bottom: 2px;
    }
    
    .lifestyle-quality {
      font-size: 11px;
      color: oklch(0.55 0.05 240);
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    
    .stat-card {
      text-align: center;
      padding: 16px;
      background: oklch(0.98 0.01 230);
      border-radius: 12px;
      border: 1px solid oklch(0.88 0.02 230);
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: oklch(0.55 0.15 230);
      margin-bottom: 4px;
    }
    
    .stat-label {
      font-size: 11px;
      color: oklch(0.50 0.05 240);
      font-weight: 500;
    }
    
    .zone-card {
      background: white;
      border: 1px solid oklch(0.88 0.02 230);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    
    .zone-card.attention {
      background: oklch(0.97 0.05 45 / 0.3);
      border-color: oklch(0.70 0.18 45);
    }
    
    .zone-card.concern {
      background: oklch(0.95 0.05 27 / 0.2);
      border-color: oklch(0.577 0.245 27.325);
    }
    
    .zone-header {
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .zone-name {
      font-size: 14px;
      color: oklch(0.25 0.02 240);
    }
    
    .zone-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .zone-badge.normal {
      background: oklch(0.90 0.05 140 / 0.3);
      color: oklch(0.40 0.12 145);
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
      font-size: 13px;
      line-height: 1.7;
      color: oklch(0.40 0.02 240);
    }
    
    .analysis-text {
      background: oklch(0.98 0.01 230);
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
    }
    
    .analysis-paragraph {
      display: flex;
      align-items: start;
      gap: 12px;
      margin-bottom: 16px;
      padding: 16px;
      background: white;
      border-radius: 12px;
    }
    
    .analysis-paragraph:last-child {
      margin-bottom: 0;
    }
    
    .analysis-bullet {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: oklch(0.55 0.15 230);
      margin-top: 6px;
      flex-shrink: 0;
    }
    
    .analysis-paragraph p {
      font-size: 14px;
      line-height: 1.8;
      color: oklch(0.35 0.02 240);
    }
    
    .food-section {
      margin-bottom: 24px;
    }
    
    .food-section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .food-section-desc {
      font-size: 13px;
      color: oklch(0.50 0.05 240);
      margin-bottom: 12px;
    }
    
    .food-list {
      display: grid;
      gap: 8px;
    }
    
    .food-item {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.6;
      display: flex;
      align-items: start;
      gap: 8px;
    }
    
    .food-item.recommended {
      background: oklch(0.95 0.05 140 / 0.3);
      border-left: 3px solid oklch(0.55 0.15 145);
    }
    
    .food-item.avoid {
      background: oklch(0.95 0.05 27 / 0.2);
      border-left: 3px solid oklch(0.577 0.245 27.325);
    }
    
    .supplement-card {
      background: oklch(0.95 0.03 230 / 0.5);
      border: 1px solid oklch(0.55 0.15 230 / 0.3);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
    }
    
    .supplement-name {
      font-weight: 600;
      color: oklch(0.55 0.15 230);
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .supplement-details {
      font-size: 13px;
      color: oklch(0.40 0.02 240);
      line-height: 1.7;
    }
    
    .supplement-details strong {
      color: oklch(0.30 0.02 240);
    }
    
    .recommendations-list {
      list-style: none;
      padding: 0;
    }
    
    .recommendations-list li {
      padding: 12px 16px;
      margin-bottom: 8px;
      background: oklch(0.98 0.01 230);
      border-radius: 8px;
      border-left: 3px solid oklch(0.55 0.15 230);
      font-size: 13px;
      line-height: 1.7;
    }
    
    .footer {
      background: oklch(0.93 0.02 230);
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: oklch(0.50 0.05 240);
      border-top: 1px solid oklch(0.88 0.02 230);
    }
    
    .footer p {
      margin-bottom: 8px;
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
        margin: 2cm;
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
        padding: 24px 16px;
      }
      
      .score-section {
        padding: 32px 16px;
      }
      
      .content {
        padding: 20px 16px;
      }
      
      .info-grid {
        grid-template-columns: 1fr;
      }
      
      .lifestyle-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Иридологичен Доклад</h1>
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
          Биометрични данни
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

      ${report.questionnaireData.goals && report.questionnaireData.goals.length > 0 ? `
        <div class="section">
          <div class="section-title">
            <span class="section-icon">🎯</span>
            Здравни цели
          </div>
          <div class="goals-list">
            ${report.questionnaireData.goals.map(goal => `<span class="goal-tag">${goal}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${report.briefSummary ? `
        <div class="section">
          <div class="section-title">
            <span class="section-icon">📊</span>
            Обобщение
          </div>
          <div class="summary-box">
            ${report.briefSummary.split(/\n/).filter(line => line.trim()).map(point => {
              const cleanPoint = point.replace(/^[•\-]\s*/, '').trim()
              return cleanPoint ? `<p>• ${cleanPoint}</p>` : ''
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">
          <span class="section-icon">📈</span>
          Начин на живот
        </div>
        ${getLifestyleHTML()}
      </div>

      <div class="section">
        <div class="section-title">
          <span class="section-icon">🔬</span>
          Резултати от анализа
        </div>
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
            <div class="stat-value">${concernZones}</div>
            <div class="stat-label">Зони за внимание</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${(report.leftIris?.artifacts?.length || 0) + (report.rightIris?.artifacts?.length || 0)}</div>
            <div class="stat-label">Артефакти</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="section-icon">👁️</span>
          Иридологични находки - Ляв ирис
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${leftStats.normal}</div>
            <div class="stat-label">Норма</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${leftStats.attention}</div>
            <div class="stat-label">Внимание</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${leftStats.concern}</div>
            <div class="stat-label">Притеснение</div>
          </div>
        </div>
        ${leftZones.filter(z => z && z.status !== 'normal').length > 0 ? `
          ${leftZones.filter(z => z && z.status !== 'normal').map(zone => `
            <div class="zone-card ${zone.status}">
              <div class="zone-header">
                <span class="zone-name">${zone.name || ''} (${zone.organ || ''})</span>
                <span class="zone-badge ${zone.status}">
                  ${zone.status === 'attention' ? '⚠️ Внимание' : '🔴 Притеснение'}
                </span>
              </div>
              <div class="zone-findings">${zone.findings || ''}</div>
            </div>
          `).join('')}
        ` : '<p class="card-content">Всички зони са в норма</p>'}
      </div>

      <div class="section">
        <div class="section-title">
          <span class="section-icon">👁️</span>
          Иридологични находки - Десен ирис
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${rightStats.normal}</div>
            <div class="stat-label">Норма</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${rightStats.attention}</div>
            <div class="stat-label">Внимание</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${rightStats.concern}</div>
            <div class="stat-label">Притеснение</div>
          </div>
        </div>
        ${rightZones.filter(z => z && z.status !== 'normal').length > 0 ? `
          ${rightZones.filter(z => z && z.status !== 'normal').map(zone => `
            <div class="zone-card ${zone.status}">
              <div class="zone-header">
                <span class="zone-name">${zone.name || ''} (${zone.organ || ''})</span>
                <span class="zone-badge ${zone.status}">
                  ${zone.status === 'attention' ? '⚠️ Внимание' : '🔴 Притеснение'}
                </span>
              </div>
              <div class="zone-findings">${zone.findings || ''}</div>
            </div>
          `).join('')}
        ` : '<p class="card-content">Всички зони са в норма</p>'}
      </div>

      ${report.detailedAnalysis ? `
        <div class="section">
          <div class="section-title">
            <span class="section-icon">🔍</span>
            Детайлен иридологичен анализ
          </div>
          <div class="analysis-text">
            ${report.detailedAnalysis.split(/\n\n+/).filter(p => p.trim()).map(paragraph => {
              const cleanParagraph = paragraph.trim()
              return cleanParagraph ? `
                <div class="analysis-paragraph">
                  <div class="analysis-bullet"></div>
                  <p>${cleanParagraph}</p>
                </div>
              ` : ''
            }).join('')}
          </div>
        </div>
      ` : ''}

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
              <span class="section-icon">💡</span>
              Общи Препоръки
            </div>
            <ul class="recommendations-list">
              ${report.detailedPlan.generalRecommendations.slice(0, 3).map(rec => 
                rec ? `<li>${rec}</li>` : ''
              ).filter(item => item).join('')}
            </ul>
          </div>
        ` : ''}

        ${(report.detailedPlan.recommendedFoods && report.detailedPlan.recommendedFoods.length > 0) || 
          (report.detailedPlan.avoidFoods && report.detailedPlan.avoidFoods.length > 0) ? `
          <div class="section">
            <div class="section-title">
              <span class="section-icon">🍎</span>
              Хранителни препоръки
            </div>
            
            ${report.detailedPlan.recommendedFoods && report.detailedPlan.recommendedFoods.length > 0 ? `
              <div class="food-section">
                <div class="food-section-title">✅ Препоръчителни храни</div>
                <div class="food-section-desc">Включете тези храни редовно в ежедневното си хранене за оптимална подкрепа на здравето.</div>
                <div class="food-list">
                  ${report.detailedPlan.recommendedFoods.map(food => 
                    food ? `<div class="food-item recommended">• ${food}</div>` : ''
                  ).filter(item => item).join('')}
                </div>
              </div>
            ` : ''}

            ${report.detailedPlan.avoidFoods && report.detailedPlan.avoidFoods.length > 0 ? `
              <div class="food-section">
                <div class="food-section-title">❌ Храни за избягване</div>
                <div class="food-section-desc">Ограничете или елиминирайте тези храни от диетата си за подобряване на здравното състояние.</div>
                <div class="food-list">
                  ${report.detailedPlan.avoidFoods.map(food => 
                    food ? `<div class="food-item avoid">• ${food}</div>` : ''
                  ).filter(item => item).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${report.detailedPlan.supplements && report.detailedPlan.supplements.length > 0 ? `
          <div class="section">
            <div class="section-title">
              <span class="section-icon">💊</span>
              Хранителни добавки
            </div>
            ${report.detailedPlan.supplements.slice(0, 3).map(supp => supp ? `
              <div class="supplement-card">
                <div class="supplement-name">• ${supp.name || ''}</div>
                <div class="supplement-details">
                  <strong>Дозировка:</strong> ${supp.dosage || ''}<br>
                  <strong>Прием:</strong> ${supp.timing || ''}
                  ${supp.notes ? `<br><strong>Бележка:</strong> ${supp.notes}` : ''}
                </div>
              </div>
            ` : '').filter(item => item).join('')}
          </div>
        ` : ''}

        ${report.detailedPlan.psychologicalRecommendations && report.detailedPlan.psychologicalRecommendations.length > 0 ? `
          <div class="section">
            <div class="section-title">
              <span class="section-icon">🧠</span>
              Психологически препоръки
            </div>
            <ul class="recommendations-list">
              ${report.detailedPlan.psychologicalRecommendations.slice(0, 3).map(rec => 
                rec ? `<li>${rec}</li>` : ''
              ).filter(item => item).join('')}
            </ul>
          </div>
        ` : ''}

        ${report.detailedPlan.specialRecommendations && report.detailedPlan.specialRecommendations.length > 0 ? `
          <div class="section">
            <div class="section-title">
              <span class="section-icon">⭐</span>
              Специални препоръки
            </div>
            <ul class="recommendations-list">
              ${report.detailedPlan.specialRecommendations.slice(0, 3).map(rec => 
                rec ? `<li>${rec}</li>` : ''
              ).filter(item => item).join('')}
            </ul>
          </div>
        ` : ''}

        ${report.detailedPlan.recommendedTests && report.detailedPlan.recommendedTests.length > 0 ? `
          <div class="section">
            <div class="section-title">
              <span class="section-icon">🔬</span>
              Препоръчителни изследвания
            </div>
            <ul class="recommendations-list">
              ${report.detailedPlan.recommendedTests.slice(0, 3).map(test => 
                test ? `<li>${test}</li>` : ''
              ).filter(item => item).join('')}
            </ul>
          </div>
        ` : ''}
      ` : ''}
    </div>

    <div class="footer">
      <p><strong>Важна информация:</strong> Този доклад е генериран от AI система за иридологичен анализ и не замества професионална медицинска консултация.</p>
      <p>За допълнителна информация и консултация, моля свържете се с квалифициран иридолог или лекар.</p>
      <p>Генериран на: ${new Date().toLocaleString('bg-BG')}</p>
    </div>
  </div>

  <script>
    console.log('Иридологичен доклад зареден успешно');
    
    window.addEventListener('DOMContentLoaded', () => {
      if (window.location.search.includes('print=true')) {
        setTimeout(() => window.print(), 500);
      }
    });
  </script>
</body>
</html>`
}
