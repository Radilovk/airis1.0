import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FileText, 
  Download, 
  ArrowClockwise, 
  Share,
  Target,
  Activity,
  ClipboardText,
  FloppyDisk,
  Warning
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import OverviewTab from '@/components/report/tabs/OverviewTab'
import IridologyTab from '@/components/report/tabs/IridologyTab'
import PlanTab from '@/components/report/tabs/PlanTab'
import { ErrorBoundary } from 'react-error-boundary'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'

interface ReportScreenProps {
  report: AnalysisReport
  onRestart: () => void
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <Warning size={20} weight="duotone" className="text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-lg mb-2">Грешка при зареждане</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Възникна проблем при показване на тази секция.
          </p>
          <p className="text-xs font-mono text-destructive bg-muted/50 p-2 rounded">
            {error.message}
          </p>
        </div>
      </div>
    </Card>
  )
}

export default function ReportScreen({ report, onRestart }: ReportScreenProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
  const [history, setHistory] = useKV<AnalysisReport[]>('analysis-history', [])
  
  const handleSaveToHistory = () => {
    setHistory((current) => {
      const existing = (current || []).find((r) => r.id === report.id)
      if (existing) {
        toast.info('Докладът вече е запазен в историята')
        return current || []
      }
      toast.success('Докладът е запазен в историята')
      return [report, ...(current || [])]
    })
  }

  const handleExport = async () => {
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast.error('Моля, разрешете pop-up прозорците')
        return
      }

      const bmi = (report.questionnaireData.weight / ((report.questionnaireData.height / 100) ** 2)).toFixed(1)
      const leftZones = report.leftIris?.zones || []
      const rightZones = report.rightIris?.zones || []
      const concernZones = leftZones.filter(z => z?.status && z.status !== 'normal').length + 
                          rightZones.filter(z => z?.status && z.status !== 'normal').length

      const htmlContent = `
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Иридологичен Доклад - ${report.questionnaireData.name}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
    }
    .page {
      page-break-after: always;
      padding: 20px 0;
    }
    .page:last-child {
      page-break-after: auto;
    }
    h1 {
      color: #2563eb;
      font-size: 24px;
      margin-bottom: 10px;
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
    }
    h2 {
      color: #1e40af;
      font-size: 18px;
      margin-top: 20px;
      margin-bottom: 10px;
      border-left: 4px solid #2563eb;
      padding-left: 10px;
    }
    h3 {
      color: #1e40af;
      font-size: 14px;
      margin-top: 15px;
      margin-bottom: 8px;
    }
    p {
      margin-bottom: 10px;
      text-align: justify;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .date {
      color: #666;
      font-size: 12px;
      text-align: center;
      margin-bottom: 30px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 15px 0;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .info-item {
      padding: 5px 0;
    }
    .info-label {
      font-weight: bold;
      color: #475569;
    }
    .score-box {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 2px solid #2563eb;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .score-value {
      font-size: 48px;
      font-weight: bold;
      color: #2563eb;
      line-height: 1;
    }
    .score-label {
      font-size: 14px;
      color: #64748b;
      margin-top: 5px;
    }
    .goals {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    .goal-tag {
      background: #dbeafe;
      color: #1e40af;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }
    .summary-box {
      background: #f8fafc;
      border-left: 4px solid #2563eb;
      padding: 15px;
      margin: 15px 0;
      border-radius: 0 8px 8px 0;
    }
    .summary-box p {
      margin-bottom: 8px;
    }
    .zone-card {
      background: #fffbeb;
      border: 1px solid #fbbf24;
      border-radius: 8px;
      padding: 12px;
      margin: 10px 0;
      page-break-inside: avoid;
    }
    .zone-card.concern {
      background: #fef2f2;
      border-color: #ef4444;
    }
    .zone-header {
      font-weight: bold;
      color: #92400e;
      margin-bottom: 5px;
    }
    .zone-card.concern .zone-header {
      color: #991b1b;
    }
    .zone-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      margin-left: 8px;
    }
    .zone-status.attention {
      background: #fef3c7;
      color: #92400e;
    }
    .zone-status.concern {
      background: #fee2e2;
      color: #991b1b;
    }
    .food-list {
      margin: 10px 0;
    }
    .food-item {
      padding: 10px 15px;
      margin: 6px 0;
      border-radius: 8px;
      page-break-inside: avoid;
      line-height: 1.6;
    }
    .food-item.recommended {
      background: #dcfce7;
      border-left: 3px solid #16a34a;
    }
    .food-item.avoid {
      background: #fee2e2;
      border-left: 3px solid #dc2626;
    }
    .supplement-card {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 12px;
      margin: 10px 0;
      page-break-inside: avoid;
    }
    .supplement-name {
      font-weight: bold;
      color: #0369a1;
      margin-bottom: 5px;
    }
    .supplement-details {
      font-size: 12px;
      color: #475569;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      font-style: italic;
    }
    .analysis-text {
      text-align: justify;
      line-height: 1.8;
      margin: 15px 0;
    }
    ul {
      margin: 10px 0 10px 20px;
    }
    li {
      margin-bottom: 5px;
    }
    .text-sm {
      font-size: 13px;
      line-height: 1.6;
    }
    .text-muted {
      color: #6b7280;
      margin-bottom: 12px;
    }
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>ИРИДОЛОГИЧЕН ДОКЛАД</h1>
      <div class="date">
        Дата: ${new Date(report.timestamp).toLocaleDateString('bg-BG', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })}
      </div>
    </div>

    <h2>Биометрични данни</h2>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Име:</span> ${report.questionnaireData.name}
      </div>
      <div class="info-item">
        <span class="info-label">Възраст:</span> ${report.questionnaireData.age} години
      </div>
      <div class="info-item">
        <span class="info-label">Пол:</span> ${report.questionnaireData.gender === 'male' ? 'Мъж' : report.questionnaireData.gender === 'female' ? 'Жена' : 'Друго'}
      </div>
      <div class="info-item">
        <span class="info-label">BMI:</span> ${bmi}
      </div>
      <div class="info-item">
        <span class="info-label">Тегло:</span> ${report.questionnaireData.weight} кг
      </div>
      <div class="info-item">
        <span class="info-label">Ръст:</span> ${report.questionnaireData.height} см
      </div>
    </div>

    <h2>Здравни цели</h2>
    <div class="goals">
      ${report.questionnaireData.goals.map(goal => `<span class="goal-tag">${goal}</span>`).join('')}
    </div>

    <h2>Обобщение</h2>
    <div class="score-box">
      <div class="score-value">${avgHealth}</div>
      <div class="score-label">Общо здравословно състояние (от 100)</div>
    </div>
    
    ${report.briefSummary ? `
      <div class="summary-box">
        ${report.briefSummary.split(/\n/).filter(line => line.trim()).map(point => {
          const cleanPoint = point.replace(/^•\s*/, '').trim()
          return cleanPoint ? `<p>• ${cleanPoint}</p>` : ''
        }).join('')}
      </div>
    ` : ''}

    <h2>Резултати от анализа</h2>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Ляв ирис:</span> ${report.leftIris.overallHealth}/100
      </div>
      <div class="info-item">
        <span class="info-label">Десен ирис:</span> ${report.rightIris.overallHealth}/100
      </div>
      <div class="info-item">
        <span class="info-label">Зони за внимание:</span> ${concernZones}
      </div>
      <div class="info-item">
        <span class="info-label">Артефакти:</span> ${(report.leftIris?.artifacts?.length || 0) + (report.rightIris?.artifacts?.length || 0)}
      </div>
    </div>
  </div>

  <div class="page">
    <h2>Иридологични находки - Ляв ирис</h2>
    ${leftZones.filter(z => z && z.status !== 'normal').length > 0 ? `
      ${leftZones.filter(z => z && z.status !== 'normal').map(zone => `
        <div class="zone-card ${zone.status}">
          <div class="zone-header">
            ${zone.name || ''} (${zone.organ || ''})
            <span class="zone-status ${zone.status}">
              ${zone.status === 'attention' ? 'Внимание' : 'Притеснение'}
            </span>
          </div>
          <p>${zone.findings || ''}</p>
        </div>
      `).join('')}
    ` : '<p>Всички зони са в норма</p>'}

    <h2>Иридологични находки - Десен ирис</h2>
    ${rightZones.filter(z => z && z.status !== 'normal').length > 0 ? `
      ${rightZones.filter(z => z && z.status !== 'normal').map(zone => `
        <div class="zone-card ${zone.status}">
          <div class="zone-header">
            ${zone.name || ''} (${zone.organ || ''})
            <span class="zone-status ${zone.status}">
              ${zone.status === 'attention' ? 'Внимание' : 'Притеснение'}
            </span>
          </div>
          <p>${zone.findings || ''}</p>
        </div>
      `).join('')}
    ` : '<p>Всички зони са в норма</p>'}
  </div>

  ${report.detailedAnalysis ? `
    <div class="page">
      <h2>Детайлен иридологичен анализ</h2>
      <div class="analysis-text">
        ${report.detailedAnalysis.split(/\n\n+/).filter(p => p.trim()).map(paragraph => {
          const cleanParagraph = paragraph.trim()
          return cleanParagraph ? `<p style="margin-bottom: 15px; line-height: 1.8;">• ${cleanParagraph}</p>` : ''
        }).join('')}
      </div>
    </div>
  ` : ''}

  ${report.detailedPlan ? `
    <div class="page">
      <h2>Хранителни препоръки</h2>
      
      ${report.detailedPlan.recommendedFoods && report.detailedPlan.recommendedFoods.length > 0 ? `
        <h3>Препоръчителни храни</h3>
        <p class="text-sm text-muted">Включете тези храни редовно в ежедневното си хранене за оптимална подкрепа на здравето.</p>
        <div class="food-list">
          ${report.detailedPlan.recommendedFoods.map((food, idx) => 
            food ? `<div class="food-item recommended">• ${food}</div>` : ''
          ).filter(item => item).join('')}
        </div>
      ` : ''}

      ${report.detailedPlan.avoidFoods && report.detailedPlan.avoidFoods.length > 0 ? `
        <h3 style="margin-top: 25px;">Храни за избягване</h3>
        <p class="text-sm text-muted">Ограничете или елиминирайте тези храни от диетата си за подобряване на здравното състояние.</p>
        <div class="food-list">
          ${report.detailedPlan.avoidFoods.map((food, idx) => 
            food ? `<div class="food-item avoid">• ${food}</div>` : ''
          ).filter(item => item).join('')}
        </div>
      ` : ''}

      ${report.detailedPlan.supplements && report.detailedPlan.supplements.length > 0 ? `
        <h3 style="margin-top: 25px;">Хранителни добавки</h3>
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
      ` : ''}

      ${report.detailedPlan.generalRecommendations && report.detailedPlan.generalRecommendations.length > 0 ? `
        <h3 style="margin-top: 25px;">Общи препоръки</h3>
        <ul>
          ${report.detailedPlan.generalRecommendations.slice(0, 3).map(rec => 
            rec ? `<li>${rec}</li>` : ''
          ).filter(item => item).join('')}
        </ul>
      ` : ''}
    </div>
  ` : ''}

  ${report.detailedPlan && (
     (report.detailedPlan.psychologicalRecommendations && report.detailedPlan.psychologicalRecommendations.length > 0) || 
     (report.detailedPlan.specialRecommendations && report.detailedPlan.specialRecommendations.length > 0) || 
     (report.detailedPlan.recommendedTests && report.detailedPlan.recommendedTests.length > 0)) ? `
    <div class="page">
      ${report.detailedPlan.psychologicalRecommendations && report.detailedPlan.psychologicalRecommendations.length > 0 ? `
        <h2>Психологически препоръки</h2>
        <ul>
          ${report.detailedPlan.psychologicalRecommendations.slice(0, 3).map(rec => 
            rec ? `<li>${rec}</li>` : ''
          ).filter(item => item).join('')}
        </ul>
      ` : ''}

      ${report.detailedPlan.specialRecommendations && report.detailedPlan.specialRecommendations.length > 0 ? `
        <h2>Специални препоръки</h2>
        <ul>
          ${report.detailedPlan.specialRecommendations.slice(0, 3).map(rec => 
            rec ? `<li>${rec}</li>` : ''
          ).filter(item => item).join('')}
        </ul>
      ` : ''}

      ${report.detailedPlan.recommendedTests && report.detailedPlan.recommendedTests.length > 0 ? `
        <h2>Препоръчителни изследвания</h2>
        <ul>
          ${report.detailedPlan.recommendedTests.slice(0, 3).map(test => 
            test ? `<li>${test}</li>` : ''
          ).filter(item => item).join('')}
        </ul>
      ` : ''}
    </div>
  ` : ''}

  <div class="footer">
    Този доклад е генериран от AI система за иридологичен анализ и не замества професионална медицинска консултация.
    За допълнителна информация и консултация, моля свържете се с квалифициран иридолог или лекар.
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print()
      }, 500)
    }
  </script>
</body>
</html>
`
      
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      
      toast.success('Отваряне на прозорец за печат/запис като PDF')
    } catch (error) {
      console.error('Error generating export:', error)
      toast.error('Грешка при генериране на експорт')
    }
  }

  const handleShare = () => {
    const shareText = `Завърших иридологичен анализ! Общо здраве: ${avgHealth}/100. Получих ${report.recommendations.length} персонализирани препоръки.`
    
    if (navigator.share) {
      navigator.share({
        title: 'Иридологичен Анализ',
        text: shareText,
      }).then(() => {
        toast.success('Споделено успешно')
      }).catch(() => {
        toast.error('Грешка при споделяне')
      })
    } else {
      navigator.clipboard.writeText(shareText)
      toast.success('Копирано в клипборда')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 pb-20">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <motion.div 
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center flex-shrink-0 shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <FileText size={24} weight="duotone" className="text-primary-foreground" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Иридологичен Доклад
                </h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{report.questionnaireData.name}</span>
                  <span>•</span>
                  <span>
                    {new Date(report.timestamp).toLocaleDateString('bg-BG', { 
                      day: 'numeric', 
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSaveToHistory} 
                  className="h-9 w-9 p-0 hover:bg-green-500/10 hover:text-green-600 transition-colors"
                  title="Запази в историята"
                >
                  <FloppyDisk size={18} />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleShare} 
                  className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Share size={18} />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleExport} 
                  className="h-9 w-9 p-0 hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  <Download size={18} />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onRestart} 
                  className="h-9 w-9 p-0 hover:bg-muted transition-colors"
                >
                  <ArrowClockwise size={18} />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 mb-4 shadow-lg">
              <span className="text-3xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                {avgHealth}
              </span>
            </div>
            <h2 className="text-xl font-bold mb-2">Общо здравословно състояние</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Вашият иридологичен профил е анализиран и оценен на база множество здравни показатели
            </p>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1.5 bg-muted/50 rounded-xl shadow-inner">
            <TabsTrigger 
              value="overview" 
              className="flex flex-col gap-1.5 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all"
            >
              <Target size={22} weight="duotone" />
              <span className="text-xs font-semibold">Общо състояние</span>
            </TabsTrigger>
            <TabsTrigger 
              value="iridology" 
              className="flex flex-col gap-1.5 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all"
            >
              <Activity size={22} weight="duotone" />
              <span className="text-xs font-semibold">Анализ</span>
            </TabsTrigger>
            <TabsTrigger 
              value="plan" 
              className="flex flex-col gap-1.5 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all"
            >
              <ClipboardText size={22} weight="duotone" />
              <span className="text-xs font-semibold">План</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <ErrorBoundary fallbackRender={({ error }) => <ErrorFallback error={error} />}>
              <OverviewTab report={report} avgHealth={avgHealth} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="iridology" className="mt-6">
            <ErrorBoundary fallbackRender={({ error }) => <ErrorFallback error={error} />}>
              <IridologyTab report={report} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="plan" className="mt-6">
            <ErrorBoundary fallbackRender={({ error }) => <ErrorFallback error={error} />}>
              <PlanTab report={report} />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
