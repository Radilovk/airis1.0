import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Warning,
  CheckCircle,
  Info,
  Eye,
  SealWarning,
  ShieldCheck,
  Activity
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport } from '@/types'
import IrisWithOverlay from '@/components/iris/IrisWithOverlay'
import IrisVisualization from '../IrisVisualization'
import ZoneHeatmap from '../ZoneHeatmap'
import ZoneStatusPieChart from '../ZoneStatusPieChart'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useState } from 'react'

interface IridologyTabProps {
  report: AnalysisReport
}

export default function IridologyTab({ report }: IridologyTabProps) {
  const [expandedAnalysis, setExpandedAnalysis] = useState(false)
  
  const getStatusBadge = (status: 'normal' | 'attention' | 'concern') => {
    const variants = {
      normal: { variant: 'default' as const, icon: CheckCircle, text: 'Норма', color: 'text-green-600', bg: 'bg-green-50' },
      attention: { variant: 'secondary' as const, icon: Info, text: 'Внимание', color: 'text-yellow-600', bg: 'bg-yellow-50' },
      concern: { variant: 'destructive' as const, icon: Warning, text: 'Притеснение', color: 'text-red-600', bg: 'bg-red-50' }
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
  
  const getZoneStats = (zones: any[]) => {
    const stats = {
      total: zones.length,
      normal: zones.filter(z => z?.status === 'normal').length,
      attention: zones.filter(z => z?.status === 'attention').length,
      concern: zones.filter(z => z?.status === 'concern').length
    }
    return stats
  }
  
  const leftStats = getZoneStats(report.leftIris?.zones || [])
  const rightStats = getZoneStats(report.rightIris?.zones || [])

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ZoneStatusPieChart leftIris={report.leftIris} rightIris={report.rightIris} />
      </motion.div>
      
      {report.detailedAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Collapsible open={expandedAnalysis} onOpenChange={setExpandedAnalysis}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full p-5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Activity size={20} weight="duotone" className="text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-base">Детайлен Иридологичен Анализ</h3>
                    <p className="text-xs text-muted-foreground">Пълно обяснение на находките</p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: expandedAnalysis ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Warning size={18} className="text-muted-foreground" />
                </motion.div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-5 space-y-3">
                  {report.detailedAnalysis.split(/\n\n+/).filter(p => p.trim()).map((paragraph, idx) => {
                    const cleanParagraph = paragraph.trim()
                    return cleanParagraph ? (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.25 }}
                        className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl"
                      >
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <p className="text-sm leading-relaxed text-foreground/90">{cleanParagraph}</p>
                      </motion.div>
                    ) : null
                  })}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>
      )}
      
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-gradient-to-br from-green-50/50 to-green-100/30">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={18} weight="duotone" className="text-green-600" />
            <span className="text-xs font-semibold text-green-700">Здрави Зони</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{leftStats.normal + rightStats.normal}</p>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-yellow-50/50 to-yellow-100/30">
          <div className="flex items-center gap-2 mb-2">
            <Info size={18} weight="duotone" className="text-yellow-600" />
            <span className="text-xs font-semibold text-yellow-700">Внимание</span>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{leftStats.attention + rightStats.attention}</p>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-orange-50/50 to-orange-100/30">
          <div className="flex items-center gap-2 mb-2">
            <SealWarning size={18} weight="duotone" className="text-orange-600" />
            <span className="text-xs font-semibold text-orange-700">Притеснение</span>
          </div>
          <p className="text-2xl font-bold text-orange-700">{leftStats.concern + rightStats.concern}</p>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={18} weight="duotone" className="text-primary" />
            <span className="text-xs font-semibold text-primary">Общо Зони</span>
          </div>
          <p className="text-2xl font-bold text-primary">{leftStats.total + rightStats.total}</p>
        </Card>
      </div>
      
      <Tabs defaultValue="left" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1.5 bg-muted/50">
          <TabsTrigger value="left" className="flex items-center gap-2 py-2.5 rounded-lg">
            <Eye size={16} weight="duotone" />
            <span className="text-xs font-medium">Ляв Ирис</span>
          </TabsTrigger>
          <TabsTrigger value="right" className="flex items-center gap-2 py-2.5 rounded-lg">
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

              <IrisVisualization analysis={report.leftIris} side="left" />
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Activity size={16} weight="duotone" className="text-primary" />
                Иридологични Зони
              </h3>
              <div className="space-y-3">
                {(report.leftIris?.zones || [])
                  .filter(zone => zone && zone.status !== 'normal')
                  .map((zone, idx) => {
                    const statusConfig = {
                      attention: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Info, iconColor: 'text-yellow-600' },
                      concern: { bg: 'bg-red-50', border: 'border-red-200', icon: Warning, iconColor: 'text-red-600' }
                    }[zone.status] || { bg: 'bg-gray-50', border: 'border-gray-200', icon: Info, iconColor: 'text-gray-600' }
                    
                    const Icon = statusConfig.icon
                    
                    return (
                      <Collapsible key={zone.id}>
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, duration: 0.25 }}
                          className={`border-2 rounded-xl overflow-hidden ${statusConfig.bg} ${statusConfig.border} hover:shadow-md transition-all`}
                        >
                          <CollapsibleTrigger className="w-full p-4 hover:bg-black/5 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${statusConfig.bg} shadow-sm`}>
                                  <Icon size={20} weight="duotone" className={statusConfig.iconColor} />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <h4 className="font-bold text-sm mb-0.5">{zone.name || ''}</h4>
                                  <p className="text-xs text-muted-foreground">{zone.organ || ''}</p>
                                </div>
                              </div>
                              {getStatusBadge(zone.status)}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 pb-4 pl-16">
                              <p className="text-sm leading-relaxed text-foreground/90">{zone.findings || ''}</p>
                            </div>
                          </CollapsibleContent>
                        </motion.div>
                      </Collapsible>
                    )
                  })}
                {(report.leftIris?.zones || []).filter(zone => zone && zone.status !== 'normal').length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle size={32} weight="duotone" className="text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Всички зони са в норма</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {report.leftIris?.artifacts && report.leftIris.artifacts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="p-5">
                <h3 className="font-semibold text-sm mb-3">Артефакти</h3>
                <div className="space-y-2.5">
                  {report.leftIris.artifacts.map((artifact, idx) => artifact && (
                    <div key={idx} className="flex items-start gap-2.5 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <Warning size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-yellow-900">{artifact.type || ''}</p>
                        <p className="text-xs text-yellow-700 mt-0.5">{artifact.location || ''}</p>
                        <p className="text-xs mt-1.5 text-yellow-800">{artifact.description || ''}</p>
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

              <IrisVisualization analysis={report.rightIris} side="right" />
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Activity size={16} weight="duotone" className="text-primary" />
                Иридологични Зони
              </h3>
              <div className="space-y-3">
                {(report.rightIris?.zones || [])
                  .filter(zone => zone && zone.status !== 'normal')
                  .map((zone, idx) => {
                    const statusConfig = {
                      attention: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Info, iconColor: 'text-yellow-600' },
                      concern: { bg: 'bg-red-50', border: 'border-red-200', icon: Warning, iconColor: 'text-red-600' }
                    }[zone.status] || { bg: 'bg-gray-50', border: 'border-gray-200', icon: Info, iconColor: 'text-gray-600' }
                    
                    const Icon = statusConfig.icon
                    
                    return (
                      <Collapsible key={zone.id}>
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, duration: 0.25 }}
                          className={`border-2 rounded-xl overflow-hidden ${statusConfig.bg} ${statusConfig.border} hover:shadow-md transition-all`}
                        >
                          <CollapsibleTrigger className="w-full p-4 hover:bg-black/5 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${statusConfig.bg} shadow-sm`}>
                                  <Icon size={20} weight="duotone" className={statusConfig.iconColor} />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <h4 className="font-bold text-sm mb-0.5">{zone.name || ''}</h4>
                                  <p className="text-xs text-muted-foreground">{zone.organ || ''}</p>
                                </div>
                              </div>
                              {getStatusBadge(zone.status)}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 pb-4 pl-16">
                              <p className="text-sm leading-relaxed text-foreground/90">{zone.findings || ''}</p>
                            </div>
                          </CollapsibleContent>
                        </motion.div>
                      </Collapsible>
                    )
                  })}
                {(report.rightIris?.zones || []).filter(zone => zone && zone.status !== 'normal').length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle size={32} weight="duotone" className="text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Всички зони са в норма</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {report.rightIris?.artifacts && report.rightIris.artifacts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="p-5">
                <h3 className="font-semibold text-sm mb-3">Артефакти</h3>
                <div className="space-y-2.5">
                  {report.rightIris.artifacts.map((artifact, idx) => artifact && (
                    <div key={idx} className="flex items-start gap-2.5 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <Warning size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-yellow-900">{artifact.type || ''}</p>
                        <p className="text-xs text-yellow-700 mt-0.5">{artifact.location || ''}</p>
                        <p className="text-xs mt-1.5 text-yellow-800">{artifact.description || ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <ZoneHeatmap zones={report.leftIris?.zones || []} side="left" />
          <ZoneHeatmap zones={report.rightIris?.zones || []} side="right" />
        </div>
      </motion.div>

      {report.detailedAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="p-6 border-2">
            <h3 className="font-bold text-lg mb-5 flex items-center gap-3 pb-3 border-b-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Eye size={22} weight="duotone" className="text-primary-foreground" />
              </div>
              <span>Детайлен Иридологичен Анализ</span>
            </h3>
            <div className="space-y-4">
              {report.detailedAnalysis.split(/\n\n+/).filter(p => p.trim()).map((paragraph, idx) => {
                const cleanParagraph = paragraph.trim()
                if (!cleanParagraph) return null
                
                return (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    className="flex items-start gap-3 p-4 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0 shadow-sm" />
                    <p className="text-sm leading-relaxed text-foreground/90 flex-1">
                      {cleanParagraph}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
