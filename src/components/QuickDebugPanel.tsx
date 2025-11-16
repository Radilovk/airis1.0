import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bug, X, CaretDown, CaretUp, Download } from '@phosphor-icons/react'
import { runDiagnostics, type DiagnosticResult } from '@/lib/diagnostics'
import { uploadDiagnostics } from '@/lib/upload-diagnostics'

export default function QuickDebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && !result) {
      runCheck()
    }
  }, [isOpen])

  const runCheck = async () => {
    setIsLoading(true)
    try {
      const diagnosticResult = await runDiagnostics()
      setResult(diagnosticResult)
    } catch (error) {
      console.error('Diagnostic error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 w-12 h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-all hover:scale-110"
        title="Бърза диагностика"
      >
        <Bug size={24} weight="fill" />
      </button>
    )
  }

  const failCount = result?.checks.filter(c => c.status === 'fail').length || 0
  const warningCount = result?.checks.filter(c => c.status === 'warning').length || 0
  const passCount = result?.checks.filter(c => c.status === 'pass').length || 0

  return (
    <Card className="fixed bottom-4 right-4 w-80 max-h-[500px] overflow-hidden shadow-2xl z-50 border-2">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Bug size={20} weight="fill" />
          <span className="font-semibold">Бърза Проверка</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <CaretDown size={16} /> : <CaretUp size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
            onClick={() => setIsOpen(false)}
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoading && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Проверява се...
          </div>
        )}

        {!isLoading && result && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Статус</div>
                <Badge 
                  className={
                    result.overallStatus === 'healthy' ? 'bg-green-500' :
                    result.overallStatus === 'issues' ? 'bg-amber-500' :
                    'bg-red-500'
                  }
                >
                  {result.overallStatus === 'healthy' && 'Здрава'}
                  {result.overallStatus === 'issues' && 'С проблеми'}
                  {result.overallStatus === 'critical' && 'Критично'}
                </Badge>
              </div>
              <div className="flex gap-2 text-sm">
                {passCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>{passCount}</span>
                  </div>
                )}
                {warningCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>{warningCount}</span>
                  </div>
                )}
                {failCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>{failCount}</span>
                  </div>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {result.checks.map((check, index) => (
                  <div 
                    key={index}
                    className="text-xs p-2 rounded border bg-card"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{check.name}</span>
                      <div 
                        className={`w-2 h-2 rounded-full ${
                          check.status === 'pass' ? 'bg-green-500' :
                          check.status === 'warning' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="text-muted-foreground">{check.message}</div>
                    {check.details && (
                      <div className="mt-1 p-1 bg-muted/50 rounded text-[10px] font-mono">
                        {check.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={runCheck}
              className="w-full"
            >
              Опресни
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => uploadDiagnostics.downloadReport()}
              className="w-full gap-2"
            >
              <Download size={16} />
              Изтегли Upload Diagnostics
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
