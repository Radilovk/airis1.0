import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Play, 
  Download, 
  Trash,
  CheckCircle,
  XCircle,
  Warning
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { runDiagnostics, exportDiagnostics, clearAllData, type DiagnosticResult } from '@/lib/diagnostics'

interface DiagnosticScreenProps {
  onBack: () => void
}

export default function DiagnosticScreen({ onBack }: DiagnosticScreenProps) {
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    handleRunDiagnostics()
  }, [])

  const handleRunDiagnostics = async () => {
    setIsRunning(true)
    try {
      const diagnosticResult = await runDiagnostics()
      setResult(diagnosticResult)
      
      if (diagnosticResult.overallStatus === 'critical') {
        toast.error('Открити са критични проблеми')
      } else if (diagnosticResult.overallStatus === 'issues') {
        toast.warning('Открити са предупреждения')
      } else {
        toast.success('Системата е здрава')
      }
    } catch (error) {
      toast.error('Грешка при изпълнение на диагностиката')
      console.error(error)
    } finally {
      setIsRunning(false)
    }
  }

  const handleExport = async () => {
    try {
      const data = await exportDiagnostics()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diagnostics-${new Date().toISOString()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Диагностиката е експортирана')
    } catch (error) {
      toast.error('Грешка при експортиране')
      console.error(error)
    }
  }

  const handleClearData = async () => {
    if (!confirm('Сигурни ли сте, че искате да изтриете всички данни? Това действие е необратимо.')) {
      return
    }

    try {
      await clearAllData()
      toast.success('Всички данни са изтрити')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      toast.error('Грешка при изтриване на данните')
      console.error(error)
    }
  }

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" weight="fill" />
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" weight="fill" />
      case 'warning':
        return <Warning className="w-5 h-5 text-amber-500" weight="fill" />
    }
  }

  const getStatusBadge = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-500">OK</Badge>
      case 'fail':
        return <Badge variant="destructive">Грешка</Badge>
      case 'warning':
        return <Badge className="bg-amber-500">Внимание</Badge>
    }
  }

  const getOverallStatusColor = (status: 'healthy' | 'issues' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'issues':
        return 'text-amber-500'
      case 'critical':
        return 'text-red-500'
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Системна Диагностика</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Проверка на състоянието на приложението
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunDiagnostics}
              disabled={isRunning}
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Изпълнява се...' : 'Изпълни'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!result}
            >
              <Download className="w-4 h-4" />
              Експорт
            </Button>
          </div>
        </div>

        {result && (
          <>
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Общо Състояние</h2>
                  <p className="text-sm text-muted-foreground">
                    Проверено на {new Date(result.timestamp).toLocaleString('bg-BG')}
                  </p>
                </div>
                <div className={`text-4xl font-bold ${getOverallStatusColor(result.overallStatus)}`}>
                  {result.overallStatus === 'healthy' && '✓'}
                  {result.overallStatus === 'issues' && '⚠'}
                  {result.overallStatus === 'critical' && '✕'}
                </div>
              </div>
            </Card>

            <div className="space-y-3 mb-6">
              {result.checks.map((check, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getStatusIcon(check.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-semibold">{check.name}</h3>
                        {getStatusBadge(check.status)}
                      </div>
                      <p className="text-sm text-foreground/80 mb-1">
                        {check.message}
                      </p>
                      {check.details && (
                        <p className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded mt-2">
                          {check.details}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6 border-destructive/50 bg-destructive/5">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Warning className="w-5 h-5 text-destructive" />
                Опасна Зона
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Изтрийте всички запазени данни, включително анкети, анализи и история. 
                Това действие е необратимо и ще изисква презареждане на приложението.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearData}
              >
                <Trash className="w-4 h-4" />
                Изтрий Всички Данни
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
