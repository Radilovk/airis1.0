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
import DualIrisTopographicMap from '@/components/iris/DualIrisTopographicMap'
import UnwrappedIrisMap from '@/components/iris/UnwrappedIrisMap'
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
        <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <Eye size={24} weight="duotone" className="text-primary-foreground" />
            </div>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Иридологичен Анализ
            </span>
          </h2>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
            <Activity size={20} weight="duotone" />
            Обща Оценка
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={18} weight="duotone" className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Ляв Ирис</span>
              </div>
              <p className="text-3xl font-bold text-blue-700">{report.leftIris.overallHealth}</p>
              <p className="text-xs text-blue-600 mt-1">Общо здраве</p>
            </div>
            
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={18} weight="duotone" className="text-purple-600" />
                <span className="text-xs font-semibold text-purple-700">Десен Ирис</span>
              </div>
              <p className="text-3xl font-bold text-purple-700">{report.rightIris.overallHealth}</p>
              <p className="text-xs text-purple-600 mt-1">Общо здраве</p>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
            <SealWarning size={20} weight="duotone" />
            Най-важни Находки
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-gradient-to-br from-green-50/50 to-green-100/30 rounded-xl border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} weight="duotone" className="text-green-600" />
                <span className="text-xs font-semibold text-green-700">Здрави Зони</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{leftStats.normal + rightStats.normal}</p>
            </div>
            
            <div className="p-4 bg-gradient-to-br from-yellow-50/50 to-yellow-100/30 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Info size={18} weight="duotone" className="text-yellow-600" />
                <span className="text-xs font-semibold text-yellow-700">Внимание</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{leftStats.attention + rightStats.attention}</p>
            </div>
            
            <div className="p-4 bg-gradient-to-br from-orange-50/50 to-orange-100/30 rounded-xl border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <SealWarning size={18} weight="duotone" className="text-orange-600" />
                <span className="text-xs font-semibold text-orange-700">Притеснение</span>
              </div>
              <p className="text-2xl font-bold text-orange-700">{leftStats.concern + rightStats.concern}</p>
            </div>
            
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/20 rounded-xl border border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <Eye size={18} weight="duotone" className="text-primary" />
                <span className="text-xs font-semibold text-primary">Общо Зони</span>
              </div>
              <p className="text-2xl font-bold text-primary">{leftStats.total + rightStats.total}</p>
            </div>
          </div>
        </Card>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
            <Eye size={20} weight="duotone" />
            Интерактивна Топографска Карта
          </h3>
          <DualIrisTopographicMap
            leftIris={report.leftIris}
            rightIris={report.rightIris}
            leftImageUrl={report.leftIrisImage.dataUrl}
            rightImageUrl={report.rightIrisImage.dataUrl}
          />
        </Card>
      </motion.div>

      {/* Unwrapped coordinate-system maps (minute × ring) */}
      {(report.leftIris.zones?.some(z => z.minute_start !== undefined) ||
        report.rightIris.zones?.some(z => z.minute_start !== undefined) ||
        report.leftIrisMaps || report.rightIrisMaps) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2 text-primary px-1">
            <Eye size={20} weight="duotone" />
            Разгъвка – Координатна Система (минута × пръстен)
          </h3>

          {/* Layer switcher – only shown when multi-stream maps are available */}
          {(report.leftIrisMaps || report.rightIrisMaps) ? (
            <Tabs defaultValue="base" className="w-full">
              <TabsList className="mb-2">
                <TabsTrigger value="base">Базов (осветление)</TabsTrigger>
                <TabsTrigger value="structure">Структурен (крипти / влакна)</TabsTrigger>
                <TabsTrigger value="pigment">Пигментен (токсини / цвят)</TabsTrigger>
              </TabsList>

              {(['base', 'structure', 'pigment'] as const).map((layer) => (
                <TabsContent key={layer} value={layer} className="space-y-4">
                  <UnwrappedIrisMap
                    mappedImageBase64={report.leftIrisMaps?.[layer] || undefined}
                    originalImageUrl={report.leftIrisImage.dataUrl || undefined}
                    zones={report.leftIris.zones}
                    artifacts={report.leftIris.artifacts}
                    side="left"
                    overallHealth={report.leftIris.overallHealth}
                  />
                  <UnwrappedIrisMap
                    mappedImageBase64={report.rightIrisMaps?.[layer] || undefined}
                    originalImageUrl={report.rightIrisImage.dataUrl || undefined}
                    zones={report.rightIris.zones}
                    artifacts={report.rightIris.artifacts}
                    side="right"
                    overallHealth={report.rightIris.overallHealth}
                  />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <>
              <UnwrappedIrisMap
                originalImageUrl={report.leftIrisImage.dataUrl || undefined}
                zones={report.leftIris.zones}
                artifacts={report.leftIris.artifacts}
                side="left"
                overallHealth={report.leftIris.overallHealth}
              />
              <UnwrappedIrisMap
                originalImageUrl={report.rightIrisImage.dataUrl || undefined}
                zones={report.rightIris.zones}
                artifacts={report.rightIris.artifacts}
                side="right"
                overallHealth={report.rightIris.overallHealth}
              />
            </>
          )}
        </motion.div>
      )}

      {report.detailedAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="p-6 border-2 border-primary/10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
              <Activity size={20} weight="duotone" />
              Връзка с Целите и Прогноза
            </h3>
            <div className="space-y-3">
              {report.detailedAnalysis.split(/\n\n+/).filter(p => p.trim()).map((paragraph, idx) => {
                const cleanParagraph = paragraph.trim()
                return cleanParagraph ? (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.25 }}
                    className="flex items-start gap-3 p-4 bg-gradient-to-r from-primary/5 to-primary/0 rounded-xl border border-primary/10"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0 shadow-sm" />
                    <p className="text-sm leading-relaxed text-foreground/90">{cleanParagraph}</p>
                  </motion.div>
                ) : null
              })}
            </div>
          </Card>
        </motion.div>
      )}
      
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
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Activity size={16} weight="duotone" className="text-primary" />
                Иридологични Зони - Ляв Ирис
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
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Activity size={16} weight="duotone" className="text-primary" />
                Иридологични Зони - Десен Ирис
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
    </div>
  )
}
