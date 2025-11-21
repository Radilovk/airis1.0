import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ClockClockwise, 
  FileText, 
  Trash,
  Eye,
  ArrowLeft,
  ArrowsClockwise,
  PencilSimple
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import type { AnalysisReport } from '@/types'

interface HistoryScreenProps {
  onViewReport: (report: AnalysisReport) => void
  onBack: () => void
  onReanalyze?: (report: AnalysisReport) => void
  onEditReport?: (report: AnalysisReport) => void
}

export default function HistoryScreen({ onViewReport, onBack, onReanalyze, onEditReport }: HistoryScreenProps) {
  const [history, setHistory] = useKVWithFallback<AnalysisReport[]>('analysis-history', [])

  const handleDelete = (timestamp: string) => {
    setHistory((current) => (current || []).filter(r => r.timestamp !== timestamp))
    toast.success('Докладът е изтрит')
  }

  const handleClearAll = () => {
    if (confirm('Сигурни ли сте, че искате да изтриете всички доклади?')) {
      setHistory([])
      toast.success('Всички доклади са изтрити')
    }
  }

  const historyList = history || []

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
                <ArrowLeft size={16} />
                Назад
              </Button>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClockClockwise size={24} weight="duotone" className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">История на Анализите</h1>
                <p className="text-sm text-muted-foreground">
                  {historyList.length} {historyList.length === 1 ? 'доклад' : 'доклада'}
                </p>
              </div>
            </div>
            {historyList.length > 0 && (
              <Button variant="outline" onClick={handleClearAll} className="gap-2">
                <Trash size={16} />
                Изтрий Всички
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {historyList.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <FileText size={40} className="text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Няма запазени доклади</h2>
            <p className="text-muted-foreground mb-6">
              Вашите анализи ще се появят тук след като завършите поне един анализ
            </p>
            <Button onClick={onBack}>
              Започни Първи Анализ
            </Button>
          </motion.div>
        ) : (
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="grid gap-6">
              {historyList.map((report, idx) => {
                const avgHealth = Math.round((report.leftIris.overallHealth + report.rightIris.overallHealth) / 2)
                const concernZones = report.leftIris.zones.filter(z => z.status !== 'normal').length +
                                    report.rightIris.zones.filter(z => z.status !== 'normal').length
                
                return (
                  <motion.div
                    key={report.timestamp}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card className="p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileText size={24} weight="duotone" className="text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">
                                Анализ от {new Date(report.timestamp).toLocaleDateString('bg-BG', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {new Date(report.timestamp).toLocaleTimeString('bg-BG', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-4 gap-4 mb-4">
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Общо Здраве</p>
                              <p className="text-2xl font-bold text-primary">{avgHealth}/100</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Зони за Внимание</p>
                              <p className="text-2xl font-bold">{concernZones}</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Препоръки</p>
                              <p className="text-2xl font-bold">{report.recommendations.length}</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Възраст/Пол</p>
                              <p className="text-lg font-semibold">
                                {report.questionnaireData.age} г. / 
                                {report.questionnaireData.gender === 'male' ? ' М' : report.questionnaireData.gender === 'female' ? ' Ж' : ' Др'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-4">
                            {report.questionnaireData.goals.slice(0, 3).map((goal) => (
                              <Badge key={goal} variant="secondary" className="text-xs">
                                {goal}
                              </Badge>
                            ))}
                            {report.questionnaireData.goals.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{report.questionnaireData.goals.length - 3} още
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => onViewReport(report)}
                            className="gap-2"
                          >
                            <Eye size={16} />
                            Преглед
                          </Button>
                          {onEditReport && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditReport(report)}
                              className="gap-2 hover:bg-purple-500/10 hover:text-purple-600 hover:border-purple-500"
                            >
                              <PencilSimple size={16} />
                              Редактирай
                            </Button>
                          )}
                          {onReanalyze && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onReanalyze(report)}
                              className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500"
                            >
                              <ArrowsClockwise size={16} />
                              Повторен анализ
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(report.timestamp)}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            <Trash size={16} />
                            Изтрий
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
