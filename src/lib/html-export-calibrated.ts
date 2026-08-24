import type { AnalysisReport } from '@/types'
import { summarizeCalibratedReport, isPlanRelevantFinding } from '@/lib/calibrated-report-summary'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** PDF/HTML export — съответства на калибрирания web доклад. */
export function generateCalibratedReportHTML(report: AnalysisReport): string {
  const cal = report.calibrated!
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  const summary = summarizeCalibratedReport(cal, { briefSummary: report.briefSummary, avgHealth })
  const bmi = (report.questionnaireData.weight / ((report.questionnaireData.height / 100) ** 2)).toFixed(1)
  const relevantFindings = cal.findings.filter(isPlanRelevantFinding)
  const plan = report.detailedPlan

  const systemsHtml = cal.systems
    .map(
      s => `
      <div class="system-row ${s.priority ? 'priority' : ''}">
        <div class="system-head">
          <span>${esc(s.label)}</span>
          <strong>${s.score}/100</strong>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${s.score}%"></div></div>
        <p class="muted">${esc(s.description)}</p>
      </div>`
    )
    .join('')

  const driversHtml = cal.drivers
    .map(
      (d, i) => `
      <div class="driver">
        <div class="driver-head">
          <span class="num">${i + 1}</span>
          ${d.strength === 'high' ? '<span class="tag high">Висок приоритет</span>' : ''}
        </div>
        <p class="driver-title">${esc(d.observation)}</p>
        <p class="muted">${esc(d.action)}</p>
      </div>`
    )
    .join('')

  const findingsHtml = (['left', 'right'] as const)
    .map(side => {
      const label = side === 'left' ? 'Ляв ирис' : 'Десен ирис'
      const img = side === 'left' ? report.leftIrisImage?.dataUrl : report.rightIrisImage?.dataUrl
      const items = relevantFindings.filter(f => f.side === side)
      return `
        <div class="eye-block">
          <h3>${label}</h3>
          ${img ? `<img src="${img}" alt="${label}" class="eye-photo" />` : ''}
          <ul class="findings-list">
            ${
              items.length
                ? items.map(f => `<li><strong>${esc(f.label)}</strong> · сектор ${f.sector}, пръsten ${f.ring}</li>`).join('')
                : '<li class="muted">Няма значими маркери за това око.</li>'
            }
          </ul>
        </div>`
    })
    .join('')

  const foodsHtml = plan
    ? `
    ${(plan.recommendedFoods ?? []).map(f => `<li class="ok">${esc(f)}</li>`).join('')}
    ${(plan.avoidFoods ?? []).map(f => `<li class="avoid">${esc(f)}</li>`).join('')}
  `
    : ''

  const supplementsHtml = (plan?.supplements ?? [])
    .map(
      s => `
      <div class="supp">
        <strong>${esc(s.name)}</strong>
        <p>${esc(s.dosage)} · ${esc(s.timing)}</p>
        ${s.notes ? `<p class="muted">${esc(s.notes)}</p>` : ''}
      </div>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Иридологичен доклад — ${esc(report.questionnaireData.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 0; background: #f8fafc; color: #0f172a; line-height: 1.55; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
    .hero { text-align: center; padding: 28px 20px; border-radius: 20px; background: linear-gradient(135deg, #eef2ff, #f0fdf4); margin-bottom: 24px; }
    .score { font-size: 3rem; font-weight: 800; color: #4f46e5; line-height: 1; }
    h1 { font-size: 1.25rem; margin: 12px 0 4px; }
    h2 { font-size: 1.1rem; margin: 0 0 12px; }
    h3 { font-size: 1rem; margin: 0 0 8px; }
    section { background: #fff; border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(15,23,42,.06); }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
    .stat { background: #f1f5f9; border-radius: 12px; padding: 12px; text-align: center; }
    .stat b { display: block; font-size: 1.25rem; }
    .stat span { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
    .lead { font-size: 0.95rem; color: #334155; margin-top: 12px; }
    .muted { font-size: 0.875rem; color: #64748b; margin: 4px 0 0; }
    .system-row { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
    .system-row.priority { background: #fef2f2; margin: 0 -12px; padding: 12px; border-radius: 12px; border: none; }
    .system-head { display: flex; justify-content: space-between; font-weight: 600; }
    .bar { height: 6px; background: #e2e8f0; border-radius: 99px; margin: 8px 0; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #14b8a6); border-radius: 99px; }
    .driver { padding: 14px 0; border-bottom: 1px solid #f1f5f9; }
    .driver-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .num { width: 24px; height: 24px; border-radius: 50%; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
    .tag.high { font-size: 10px; background: #ffe4e6; color: #be123c; padding: 2px 8px; border-radius: 99px; }
    .driver-title { font-weight: 600; margin: 0; }
    .eyes { display: grid; gap: 20px; }
    @media (min-width: 560px) { .eyes { grid-template-columns: 1fr 1fr; } }
    .eye-photo { width: 100%; max-width: 280px; border-radius: 16px; display: block; margin: 8px auto; }
    .findings-list { padding-left: 18px; font-size: 0.875rem; }
    .findings-list li { margin-bottom: 6px; }
    li.ok { color: #15803d; }
    li.avoid { color: #b91c1c; }
    .supp { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .footer { font-size: 0.75rem; color: #64748b; text-align: center; margin-top: 24px; }
    @media print { body { background: #fff; } section { box-shadow: none; border: 1px solid #e2e8f0; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="score">${avgHealth}</div>
      <p class="muted">Общ резултат /100</p>
      <h1>${esc(summary.headline)}</h1>
      <p class="lead">${esc(summary.lead)}</p>
      <div class="stats">
        <div class="stat"><b>${summary.totalDetected}</b><span>Прегледани</span></div>
        <div class="stat"><b>${summary.planRelevant}</b><span>Значими</span></div>
        <div class="stat"><b>${summary.sectorsAffected}</b><span>Сектори</span></div>
      </div>
    </div>

    <section>
      <h2>Клиент</h2>
      <p>${esc(report.questionnaireData.name)} · ${report.questionnaireData.age} г. · BMI ${bmi}</p>
      ${report.questionnaireData.goals.length ? `<p class="muted">Цели: ${report.questionnaireData.goals.map(esc).join(', ')}</p>` : ''}
    </section>

    <section>
      <h2>Обобщение</h2>
      <p>${esc(summary.explanation)}</p>
      ${report.briefSummary ? `<p class="lead">${esc(report.briefSummary)}</p>` : ''}
    </section>

    <section>
      <h2>Системи</h2>
      ${systemsHtml}
    </section>

    ${cal.drivers.length ? `<section><h2>Ключови насоки</h2>${driversHtml}</section>` : ''}

    <section>
      <h2>Ирис — значими зони</h2>
      <div class="eyes">${findingsHtml}</div>
    </section>

    ${
      plan
        ? `
    <section>
      <h2>Храни</h2>
      <ul class="findings-list">${foodsHtml || '<li class="muted">Няма специфични хранителни насоки.</li>'}</ul>
    </section>
    ${
      supplementsHtml
        ? `<section><h2>Добавки</h2>${supplementsHtml}</section>`
        : ''
    }`
        : ''
    }

    <div class="footer">
      <p>Този доклад не е медицинска диагностика. Генериран на ${new Date().toLocaleString('bg-BG')}.</p>
    </div>
  </div>
</body>
</html>`
}
