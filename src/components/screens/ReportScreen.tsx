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
  ClipboardText
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { AnalysisReport } from '@/types'
import OverviewTab from '@/components/report/tabs/OverviewTab'
import IridologyTab from '@/components/report/tabs/IridologyTab'
import PlanTab from '@/components/report/tabs/PlanTab'

interface ReportScreenProps {
  report: AnalysisReport
  onRestart: () => void
}

export default function ReportScreen({ report, onRestart }: ReportScreenProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)

  const handleExport = () => {
    const reportText = `
ИРИДОЛОГИЧЕН ДОКЛАД
Дата: ${new Date(report.timestamp).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}

БИОМЕТРИЧНИ ДАННИ
Възраст: ${report.questionnaireData.age} години
Пол: ${report.questionnaireData.gender === 'male' ? 'Мъж' : report.questionnaireData.gender === 'female' ? 'Жена' : 'Друго'}
Тегло: ${report.questionnaireData.weight} кг
Ръст: ${report.questionnaireData.height} см
BMI: ${(report.questionnaireData.weight / ((report.questionnaireData.height / 100) ** 2)).toFixed(1)}

ЗДРАВНИ ЦЕЛИ
${report.questionnaireData.goals.map(g => `• ${g}`).join('\n')}

ОПЛАКВАНИЯ
${report.questionnaireData.complaints || 'Няма'}

ОБОБЩЕНИЕ
${report.summary}

РЕЗУЛТАТИ
Общо здравословно състояние: ${avgHealth}/100
Ляв ирис: ${report.leftIris.overallHealth}/100
Десен ирис: ${report.rightIris.overallHealth}/100
Зони за внимание: ${report.leftIris.zones.filter(z => z.status !== 'normal').length + report.rightIris.zones.filter(z => z.status !== 'normal').length}

ЛЯВ ИРИС - ЗОНИ С ОТКЛОНЕНИЯ
${report.leftIris.zones.filter(z => z.status !== 'normal').map(z => `
${z.name} (${z.organ})
Статус: ${z.status === 'attention' ? 'Внимание' : 'Притеснение'}
Находки: ${z.findings}
`).join('\n')}

ДЕСЕН ИРИС - ЗОНИ С ОТКЛОНЕНИЯ
${report.rightIris.zones.filter(z => z.status !== 'normal').map(z => `
${z.name} (${z.organ})
Статус: ${z.status === 'attention' ? 'Внимание' : 'Притеснение'}
Находки: ${z.findings}
`).join('\n')}

ПРЕПОРЪКИ ЗА ХРАНЕНЕ
${report.recommendations.filter(r => r.category === 'diet').map(r => `
${r.title} (Приоритет: ${r.priority === 'high' ? 'Висок' : r.priority === 'medium' ? 'Среден' : 'Нисък'})
${r.description}
`).join('\n')}

ПРЕПОРЪКИ ЗА ХРАНИТЕЛНИ ДОБАВКИ
${report.recommendations.filter(r => r.category === 'supplement').map(r => `
${r.title} (Приоритет: ${r.priority === 'high' ? 'Висок' : r.priority === 'medium' ? 'Среден' : 'Нисък'})
${r.description}
`).join('\n')}

ПРЕПОРЪКИ ЗА НАЧИН НА ЖИВОТ
${report.recommendations.filter(r => r.category === 'lifestyle').map(r => `
${r.title} (Приоритет: ${r.priority === 'high' ? 'Висок' : r.priority === 'medium' ? 'Среден' : 'Нисък'})
${r.description}
`).join('\n')}

---
Този доклад е генериран от AI система за иридологичен анализ и не замества професионална медицинска консултация.
    `.trim()

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `iridology-report-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Докладът е изтеглен успешно')
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
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText size={20} weight="duotone" className="text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold truncate">Иридологичен Доклад</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {new Date(report.timestamp).toLocaleDateString('bg-BG', { 
                    day: 'numeric', 
                    month: 'short'
                  })}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={handleShare} className="h-8 w-8 p-0">
                <Share size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExport} className="h-8 w-8 p-0">
                <Download size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onRestart} className="h-8 w-8 p-0">
                <ArrowClockwise size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50">
            <TabsTrigger 
              value="overview" 
              className="flex flex-col gap-1 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Target size={20} weight="duotone" />
              <span className="text-xs font-medium">Общо състояние</span>
            </TabsTrigger>
            <TabsTrigger 
              value="iridology" 
              className="flex flex-col gap-1 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Activity size={20} weight="duotone" />
              <span className="text-xs font-medium">Анализ</span>
            </TabsTrigger>
            <TabsTrigger 
              value="plan" 
              className="flex flex-col gap-1 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <ClipboardText size={20} weight="duotone" />
              <span className="text-xs font-medium">План</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab report={report} avgHealth={avgHealth} />
          </TabsContent>

          <TabsContent value="iridology" className="mt-6">
            <IridologyTab report={report} />
          </TabsContent>

          <TabsContent value="plan" className="mt-6">
            <PlanTab report={report} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
