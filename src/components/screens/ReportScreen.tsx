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
import { motion } from 'framer-motion'
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

  const handleExport = async () => {
    try {
      const jsPDF = (await import('jspdf')).jsPDF
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 20
      let yPos = 20

      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('ИРИДОЛОГИЧЕН ДОКЛАД', pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Дата: ${new Date(report.timestamp).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 15

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('БИОМЕТРИЧНИ ДАННИ', margin, yPos)
      yPos += 7

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Име: ${report.questionnaireData.name}`, margin, yPos)
      yPos += 5
      doc.text(`Възраст: ${report.questionnaireData.age} години | Пол: ${report.questionnaireData.gender === 'male' ? 'Мъж' : report.questionnaireData.gender === 'female' ? 'Жена' : 'Друго'}`, margin, yPos)
      yPos += 5
      doc.text(`Тегло: ${report.questionnaireData.weight} кг | Ръст: ${report.questionnaireData.height} см | BMI: ${(report.questionnaireData.weight / ((report.questionnaireData.height / 100) ** 2)).toFixed(1)}`, margin, yPos)
      yPos += 10

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('ЗДРАВНИ ЦЕЛИ', margin, yPos)
      yPos += 7

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      report.questionnaireData.goals.forEach((goal) => {
        doc.text(`• ${goal}`, margin + 5, yPos)
        yPos += 5
      })
      yPos += 5

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('ОБОБЩЕНИЕ', margin, yPos)
      yPos += 7

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const summaryLines = doc.splitTextToSize(report.briefSummary || report.summary, pageWidth - 2 * margin)
      summaryLines.forEach((line: string) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }
        doc.text(line, margin, yPos)
        yPos += 5
      })
      yPos += 5

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('РЕЗУЛТАТИ', margin, yPos)
      yPos += 7

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Общо здравословно състояние: ${avgHealth}/100`, margin, yPos)
      yPos += 5
      doc.text(`Ляв ирис: ${report.leftIris.overallHealth}/100`, margin, yPos)
      yPos += 5
      doc.text(`Десен ирис: ${report.rightIris.overallHealth}/100`, margin, yPos)
      yPos += 5
      doc.text(`Зони за внимание: ${report.leftIris.zones.filter(z => z.status !== 'normal').length + report.rightIris.zones.filter(z => z.status !== 'normal').length}`, margin, yPos)
      yPos += 10

      if (yPos > 240) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('ЛЯВ ИРИС - ЗОНИ С ОТКЛОНЕНИЯ', margin, yPos)
      yPos += 7

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      report.leftIris.zones.filter(z => z.status !== 'normal').forEach((z) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }
        doc.setFont('helvetica', 'bold')
        doc.text(`${z.name} (${z.organ})`, margin, yPos)
        yPos += 4
        doc.setFont('helvetica', 'normal')
        doc.text(`Статус: ${z.status === 'attention' ? 'Внимание' : 'Притеснение'}`, margin + 5, yPos)
        yPos += 4
        const findingsLines = doc.splitTextToSize(`Находки: ${z.findings}`, pageWidth - 2 * margin - 10)
        findingsLines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage()
            yPos = 20
          }
          doc.text(line, margin + 5, yPos)
          yPos += 4
        })
        yPos += 2
      })

      if (yPos > 240) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('ДЕСЕН ИРИС - ЗОНИ С ОТКЛОНЕНИЯ', margin, yPos)
      yPos += 7

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      report.rightIris.zones.filter(z => z.status !== 'normal').forEach((z) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }
        doc.setFont('helvetica', 'bold')
        doc.text(`${z.name} (${z.organ})`, margin, yPos)
        yPos += 4
        doc.setFont('helvetica', 'normal')
        doc.text(`Статус: ${z.status === 'attention' ? 'Внимание' : 'Притеснение'}`, margin + 5, yPos)
        yPos += 4
        const findingsLines = doc.splitTextToSize(`Находки: ${z.findings}`, pageWidth - 2 * margin - 10)
        findingsLines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage()
            yPos = 20
          }
          doc.text(line, margin + 5, yPos)
          yPos += 4
        })
        yPos += 2
      })

      if (yPos > 240) {
        doc.addPage()
        yPos = 20
      }

      if (report.detailedPlan) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('ХРАНИТЕЛНИ ПРЕПОРЪКИ', margin, yPos)
        yPos += 7

        if (report.detailedPlan.recommendedFoods.length > 0) {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text('Препоръчителни храни:', margin, yPos)
          yPos += 5
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          report.detailedPlan.recommendedFoods.slice(0, 10).forEach((food) => {
            if (yPos > 270) {
              doc.addPage()
              yPos = 20
            }
            doc.text(`✓ ${food}`, margin + 5, yPos)
            yPos += 4
          })
          yPos += 3
        }

        if (report.detailedPlan.avoidFoods.length > 0) {
          if (yPos > 250) {
            doc.addPage()
            yPos = 20
          }
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text('Храни за избягване:', margin, yPos)
          yPos += 5
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          report.detailedPlan.avoidFoods.slice(0, 10).forEach((food) => {
            if (yPos > 270) {
              doc.addPage()
              yPos = 20
            }
            doc.text(`✗ ${food}`, margin + 5, yPos)
            yPos += 4
          })
          yPos += 5
        }
      }

      if (yPos > 260) {
        doc.addPage()
        yPos = 20
      }
      yPos += 10

      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text('Този доклад е генериран от AI система за иридологичен анализ и не замества професионална медицинска консултация.', pageWidth / 2, yPos, { align: 'center', maxWidth: pageWidth - 2 * margin })

      doc.save(`iridology-report-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('PDF докладът е изтеглен успешно')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Грешка при генериране на PDF')
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
