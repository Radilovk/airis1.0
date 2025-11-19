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
import type { AnalysisReport, EditorModeConfig, ReportModule } from '@/types'
import OverviewTab from '@/components/report/tabs/OverviewTab'
import OverviewTabEditable from '@/components/report/tabs/OverviewTabEditable'
import OverviewTabFullyEditable from '@/components/report/tabs/OverviewTabFullyEditable'
import OverviewTabWithEditor from '@/components/report/tabs/OverviewTabWithEditor'
import IridologyTab from '@/components/report/tabs/IridologyTab'
import IridologyTabEditable from '@/components/report/tabs/IridologyTabEditable'
import PlanTab from '@/components/report/tabs/PlanTab'
import PlanTabEditable from '@/components/report/tabs/PlanTabEditable'
import ReportEditorMode from '@/components/report/ReportEditorMode'
import EditorSidebar from '@/components/report/EditorSidebar'
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
  const [editorConfig] = useKV<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [
      { id: 'overview', type: 'overview', title: 'Обща Информация', visible: true, order: 0, comments: [], containers: [] },
      { id: 'iridology', type: 'iridology', title: 'Иридологичен Анализ', visible: true, order: 1, comments: [], containers: [] },
      { id: 'plan', type: 'plan', title: 'План за Действие', visible: true, order: 2, comments: [], containers: [] },
    ],
    lastModified: new Date().toISOString()
  })
  
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
      const { generateReportHTML } = await import('@/lib/html-export')
      const htmlContent = generateReportHTML(report)
      
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast.error('Моля, разрешете pop-up прозорците')
        return
      }
      
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      
      toast.success('Докладът е отворен в нов прозорец', {
        description: 'Може да го запазите като PDF или да го принтирате'
      })
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

  const renderModuleContent = (module: ReportModule) => {
    if (!module.visible && !editorConfig?.enabled) return null
    
    switch (module.type) {
      case 'overview':
        return editorConfig?.enabled 
          ? <OverviewTabWithEditor report={report} avgHealth={avgHealth} editorMode={editorConfig.enabled} />
          : <OverviewTab report={report} avgHealth={avgHealth} />
      case 'iridology':
        return editorConfig?.enabled
          ? <IridologyTabEditable report={report} />
          : <IridologyTab report={report} />
      case 'plan':
        return editorConfig?.enabled
          ? <PlanTabEditable report={report} />
          : <PlanTab report={report} />
      case 'custom':
        return (
          <div className="text-center py-8 text-muted-foreground">
            <p>Персонализиран модул: {module.title}</p>
            <p className="text-xs mt-2">Добавете съдържание чрез AI инструкции в коментарите</p>
          </div>
        )
      default:
        return null
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
                  title="Сподели"
                >
                  <Share size={18} />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExport} 
                  className="gap-2 hover:bg-accent/10 hover:text-accent hover:border-accent transition-colors"
                  title="Експорт в HTML/PDF"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Експорт HTML</span>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onRestart} 
                  className="h-9 w-9 p-0 hover:bg-muted transition-colors"
                  title="Започни отново"
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

        {editorConfig?.enabled ? (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <EditorSidebar moduleId="overview-tab" moduleName="Общо състояние" />
              <EditorSidebar moduleId="iridology-tab" moduleName="Иридологичен Анализ" />
              <EditorSidebar moduleId="plan-tab" moduleName="План за Действие" />
            </div>
            
            <ReportEditorMode>
              {(modules) => (
                <div className="space-y-3">
                  {modules.map((module) => (
                    <ErrorBoundary 
                      key={module.id} 
                      fallbackRender={({ error }) => <ErrorFallback error={error} />}
                    >
                      {renderModuleContent(module)}
                    </ErrorBoundary>
                  ))}
                </div>
              )}
            </ReportEditorMode>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
