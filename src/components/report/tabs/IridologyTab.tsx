import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Warning,
  CheckCircle,
  Info,
  Eye
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import IrisWithOverlay from '@/components/iris/IrisWithOverlay'
import IrisVisualization from '../IrisVisualization'

interface IridologyTabProps {
  report: AnalysisReport
}

export default function IridologyTab({ report }: IridologyTabProps) {
  const getStatusBadge = (status: 'normal' | 'attention' | 'concern') => {
    const variants = {
      normal: { variant: 'default' as const, icon: CheckCircle, text: 'Норма', color: 'text-green-600' },
      attention: { variant: 'secondary' as const, icon: Info, text: 'Внимание', color: 'text-yellow-600' },
      concern: { variant: 'destructive' as const, icon: Warning, text: 'Притеснение', color: 'text-red-600' }
    }
    const config = variants[status]
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="gap-1 text-xs">
        <Icon size={12} weight="fill" className={config.color} />
        {config.text}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="left" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1">
          <TabsTrigger value="left" className="flex items-center gap-2 py-2.5">
            <Eye size={16} weight="duotone" />
            <span className="text-xs font-medium">Ляв Ирис</span>
          </TabsTrigger>
          <TabsTrigger value="right" className="flex items-center gap-2 py-2.5">
            <Eye size={16} weight="duotone" />
            <span className="text-xs font-medium">Десен Ирис</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="left" className="space-y-4 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base">Ляв Ирис</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Здраве:</span>
                  <span className="text-lg font-bold text-primary">{report.leftIris.overallHealth}/100</span>
                </div>
              </div>
              
              <div className="flex justify-center mb-4">
                <div className="w-full max-w-[280px]">
                  <IrisWithOverlay 
                    imageDataUrl={report.leftIrisImage.dataUrl}
                    side="left"
                    size={280}
                  />
                </div>
              </div>

              <IrisVisualization analysis={report.leftIris} />
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3">Иридологични Зони</h3>
              <div className="space-y-3">
                {report.leftIris.zones
                  .filter(zone => zone.status !== 'normal')
                  .map((zone) => (
                    <div key={zone.id} className="border rounded-lg p-3 bg-card">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{zone.name}</h4>
                          <p className="text-xs text-muted-foreground">{zone.organ}</p>
                        </div>
                        {getStatusBadge(zone.status)}
                      </div>
                      <p className="text-xs leading-relaxed mt-2 text-foreground/90">{zone.findings}</p>
                    </div>
                  ))}
                {report.leftIris.zones.filter(zone => zone.status !== 'normal').length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle size={32} weight="duotone" className="text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Всички зони са в норма</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {report.leftIris.artifacts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="p-5">
                <h3 className="font-semibold text-sm mb-3">Артефакти</h3>
                <div className="space-y-2.5">
                  {report.leftIris.artifacts.map((artifact, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <Warning size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-yellow-900">{artifact.type}</p>
                        <p className="text-xs text-yellow-700 mt-0.5">{artifact.location}</p>
                        <p className="text-xs mt-1.5 text-yellow-800">{artifact.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="right" className="space-y-4 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base">Десен Ирис</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Здраве:</span>
                  <span className="text-lg font-bold text-primary">{report.rightIris.overallHealth}/100</span>
                </div>
              </div>
              
              <div className="flex justify-center mb-4">
                <div className="w-full max-w-[280px]">
                  <IrisWithOverlay 
                    imageDataUrl={report.rightIrisImage.dataUrl}
                    side="right"
                    size={280}
                  />
                </div>
              </div>

              <IrisVisualization analysis={report.rightIris} />
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3">Иридологични Зони</h3>
              <div className="space-y-3">
                {report.rightIris.zones
                  .filter(zone => zone.status !== 'normal')
                  .map((zone) => (
                    <div key={zone.id} className="border rounded-lg p-3 bg-card">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{zone.name}</h4>
                          <p className="text-xs text-muted-foreground">{zone.organ}</p>
                        </div>
                        {getStatusBadge(zone.status)}
                      </div>
                      <p className="text-xs leading-relaxed mt-2 text-foreground/90">{zone.findings}</p>
                    </div>
                  ))}
                {report.rightIris.zones.filter(zone => zone.status !== 'normal').length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle size={32} weight="duotone" className="text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Всички зони са в норма</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {report.rightIris.artifacts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="p-5">
                <h3 className="font-semibold text-sm mb-3">Артефакти</h3>
                <div className="space-y-2.5">
                  {report.rightIris.artifacts.map((artifact, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <Warning size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-yellow-900">{artifact.type}</p>
                        <p className="text-xs text-yellow-700 mt-0.5">{artifact.location}</p>
                        <p className="text-xs mt-1.5 text-yellow-800">{artifact.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
