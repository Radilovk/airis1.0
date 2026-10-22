import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { 
  CaretDown,
  Leaf,
  Pill,
  Heart,
  Brain,
  Flask,
  Lightbulb,
  AppleLogo,
  WarningCircle,
  CheckCircle,
  XCircle
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport, SupplementRecommendation } from '@/types'
import { cn } from '@/lib/utils'
import { interactionsFor, applySupplementInteractions } from '@/lib/drug-interactions'

interface PlanTabProps {
  report: AnalysisReport
}

interface PlanSection {
  id: string
  title: string
  icon: typeof AppleLogo
  content: string[]
  priority?: 'high' | 'medium' | 'low'
}

export default function PlanTab({ report }: PlanTabProps) {
  if (!report.detailedPlan) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Планът не е наличен
      </div>
    )
  }

  const { detailedPlan, motivationalSummary } = report
  const isCalibrated = !!report.calibrated
  const hasDrivers = (report.calibrated?.drivers.length ?? 0) > 0
  
  const hasGeneralRecs = !isCalibrated && detailedPlan.generalRecommendations && detailedPlan.generalRecommendations.length > 0
  const hasFoodRecs = (detailedPlan.recommendedFoods && detailedPlan.recommendedFoods.length > 0) || 
                      (detailedPlan.avoidFoods && detailedPlan.avoidFoods.length > 0)
  const hasSupplements = detailedPlan.supplements && detailedPlan.supplements.length > 0
  const hasPsychRecs = detailedPlan.psychologicalRecommendations && detailedPlan.psychologicalRecommendations.length > 0
  const hasSpecialRecs = detailedPlan.specialRecommendations && detailedPlan.specialRecommendations.length > 0
  const hasTests = detailedPlan.recommendedTests && detailedPlan.recommendedTests.length > 0
  const showFullPlan = isCalibrated

  return (
    <div className="space-y-3">
      {isCalibrated && hasDrivers && (
        <Card className="border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          Тук са конкретните стъпки — храни, добавки и навици.
        </Card>
      )}

      {!isCalibrated && motivationalSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/10">
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
              <Lightbulb size={20} weight="duotone" className="text-primary" />
              План за действие
            </h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {motivationalSummary}
            </p>
          </Card>
        </motion.div>
      )}

      <div className="space-y-2.5">
        {hasGeneralRecs && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <CollapsibleSection 
              section={{
                id: 'general',
                title: 'Общи препоръки',
                icon: Lightbulb,
                content: showFullPlan
                  ? detailedPlan.generalRecommendations
                  : detailedPlan.generalRecommendations.slice(0, 3)
              }} 
            />
          </motion.div>
        )}

        {hasFoodRecs && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <FoodRecommendationsSection 
              recommendedFoods={detailedPlan.recommendedFoods || []}
              avoidFoods={detailedPlan.avoidFoods || []}
            />
          </motion.div>
        )}

        {hasSupplements && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <SupplementsSection
              supplements={showFullPlan ? detailedPlan.supplements : detailedPlan.supplements.slice(0, 3)}
              questionnaire={report.questionnaireData}
            />
          </motion.div>
        )}

        {hasPsychRecs && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <CollapsibleSection 
              section={{
                id: 'psychological',
                title: 'Психологически препоръки',
                icon: Brain,
                content: showFullPlan
                  ? detailedPlan.psychologicalRecommendations
                  : detailedPlan.psychologicalRecommendations.slice(0, 3)
              }} 
            />
          </motion.div>
        )}

        {hasSpecialRecs && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <CollapsibleSection 
              section={{
                id: 'special',
                title: 'Индивидуални препоръки',
                icon: Leaf,
                content: showFullPlan
                  ? detailedPlan.specialRecommendations
                  : detailedPlan.specialRecommendations.slice(0, 3)
              }} 
            />
          </motion.div>
        )}

        {hasTests && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
          >
            <CollapsibleSection 
              section={{
                id: 'tests',
                title: 'Препоръчителни изследвания',
                icon: Flask,
                content: showFullPlan
                  ? detailedPlan.recommendedTests
                  : detailedPlan.recommendedTests.slice(0, 3)
              }} 
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}

function SupplementsSection({ supplements, questionnaire }: { supplements: SupplementRecommendation[]; questionnaire?: AnalysisReport['questionnaireData'] }) {
  const [isOpen, setIsOpen] = useState(false)
  const vegan = (questionnaire?.dietaryProfile || []).includes('Веган')
  // Само търсеща дума: наличните продукти се подбират на biocode-bg.com при клика.
  // Array.from — за да не се среже символ на две (емоджи и др.).
  const pickUrl = (name: string) =>
    `https://biocode-bg.com/pick.html?q=${encodeURIComponent(Array.from(name).slice(0, 80).join(''))}${vegan ? '&vegan=1' : ''}&utm_source=airis&utm_medium=supplement`
  // Същата таблица за лекарства като в NutriPlan: неподходящата при посоченото
  // лекарство добавка остава с предупреждение и без линк към магазина.
  const meds = String(questionnaire?.medications || '').trim()
  const ix = interactionsFor({ medications: meds, medicationsDetails: '' })
  const blocked = new Map<string, string>(
    applySupplementInteractions(supplements.map(s => ({ name: String(s?.name ?? ''), dosage: s?.dosage })), ix).dropped
      .map((d: { name: string; because: string }) => [d.name, d.because]),
  )

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden transition-all border-2 border-primary/20">
        <CollapsibleTrigger className="w-full p-5 flex items-center justify-between gap-3 hover:bg-primary/5 transition-colors bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <Pill size={22} weight="duotone" className="text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="font-bold text-base">Хранителни Добавки</h4>
              <p className="text-xs text-muted-foreground">Дозировка и прием</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs font-semibold">
              {supplements.length}
            </Badge>
            <CaretDown 
              size={20} 
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                isOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-5 space-y-3 bg-gradient-to-b from-background to-primary/5">
            {supplements.map((supp, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.3 }}
                className="p-4 bg-gradient-to-br from-card to-primary/5 rounded-xl border-2 border-primary/10 shadow-sm hover:shadow-md transition-all space-y-2.5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
                    <Pill size={18} weight="duotone" className="text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-base mb-2 text-primary break-words">
                      {(() => {
                        const name = String(supp?.name ?? '').trim()
                        if (!name || blocked.has(name)) return name
                        return (
                          <a href={pickUrl(name)} target="_blank" rel="noopener sponsored" className="underline underline-offset-4 hover:text-primary/80">
                            {name}
                          </a>
                        )
                      })()}
                    </h5>
                    {blocked.has(String(supp?.name ?? '').trim()) && (
                      <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
                        <span>Не се препоръчва при приема на {blocked.get(String(supp?.name ?? '').trim())} — обсъдете с лекаря си, преди да я приемате.</span>
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2 p-2 bg-background/80 rounded-lg">
                        <span className="font-semibold text-foreground min-w-[80px] flex-shrink-0">• Дозировка:</span>
                        <span className="text-foreground/80 break-words">{supp.dosage}</span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-background/80 rounded-lg">
                        <span className="font-semibold text-foreground min-w-[80px] flex-shrink-0">• Прием:</span>
                        <span className="text-foreground/80 break-words">{supp.timing}</span>
                      </div>
                      {supp.notes && (
                        <div className="flex items-start gap-2 p-2.5 bg-accent/10 rounded-lg border border-accent/20 mt-2">
                          <span className="font-semibold text-foreground min-w-[80px] flex-shrink-0">• Бележка:</span>
                          <span className="italic text-foreground/80 text-sm leading-relaxed break-words">{supp.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            <p className="text-xs text-muted-foreground">
              Името на добавката води към наличните в момента продукти в BIOCODE · biocode-bg.com.
            </p>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function CollapsibleSection({ section }: { section: PlanSection }) {
  const [isOpen, setIsOpen] = useState(false)
  const Icon = section.icon

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden transition-all border-2">
        <CollapsibleTrigger className="w-full p-5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15 shadow-sm">
              <Icon size={22} weight="duotone" className="text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="font-bold text-base">{section.title}</h4>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs font-semibold">
              {section.content.length}
            </Badge>
            <CaretDown 
              size={20} 
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                isOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-5 space-y-3 bg-gradient-to-b from-background to-muted/10">
            {section.content.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.25 }}
                className="flex items-start gap-3 p-4 bg-card rounded-xl border-2 border-border/50 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0 shadow-sm" />
                <p className="text-sm leading-relaxed flex-1 break-words">{item}</p>
              </motion.div>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function FoodRecommendationsSection({ 
  recommendedFoods, 
  avoidFoods 
}: { 
  recommendedFoods: string[]
  avoidFoods: string[] 
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  const allRecommended = recommendedFoods || []
  const allAvoid = avoidFoods || []
  
  if (allRecommended.length === 0 && allAvoid.length === 0) {
    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden transition-all border-2">
        <CollapsibleTrigger className="w-full p-5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors bg-gradient-to-r from-green-50/50 to-amber-50/50">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
              <AppleLogo size={22} weight="duotone" className="text-white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="font-bold text-base">Хранителни препоръки</h4>
              <p className="text-xs text-muted-foreground">Пълен списък с препоръчителни и забранени храни</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs font-semibold">
              {allRecommended.length + allAvoid.length}
            </Badge>
            <CaretDown 
              size={20} 
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                isOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-5 space-y-6 bg-gradient-to-b from-background to-muted/20">
            {allRecommended.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-green-200">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    <CheckCircle size={20} weight="fill" className="text-white" />
                  </div>
                  <div>
                    <h5 className="font-bold text-base text-green-900">Препоръчителни храни</h5>
                    <p className="text-xs text-green-700">Включете ги редовно в храненето си</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-green-700 border-green-300 bg-green-50">
                    {allRecommended.length} храни
                  </Badge>
                </div>
                <div className="grid gap-2.5">
                  {allRecommended.map((food, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.2 }}
                      className="group flex items-start gap-3 p-3.5 bg-gradient-to-r from-green-50 to-emerald-50/50 rounded-xl border border-green-200 hover:border-green-300 hover:shadow-md transition-all"
                    >
                      <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                        <CheckCircle size={16} weight="fill" className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-green-900 leading-relaxed block break-words">{food}</span>
                      </div>
                      <div className="text-xs font-semibold text-green-600 flex-shrink-0 px-2 py-0.5 bg-green-100 rounded-full">
                        #{idx + 1}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            
            {allAvoid.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-amber-200">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    <XCircle size={20} weight="fill" className="text-white" />
                  </div>
                  <div>
                    <h5 className="font-bold text-base text-amber-900">Храни за избягване</h5>
                    <p className="text-xs text-amber-700">Ограничете или елиминирайте от диетата</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-amber-700 border-amber-300 bg-amber-50">
                    {allAvoid.length} храни
                  </Badge>
                </div>
                <div className="grid gap-2.5">
                  {allAvoid.map((food, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.2 }}
                      className="group flex items-start gap-3 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-xl border border-amber-200 hover:border-amber-300 hover:shadow-md transition-all"
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                        <XCircle size={16} weight="fill" className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-amber-900 leading-relaxed block break-words">{food}</span>
                      </div>
                      <div className="text-xs font-semibold text-amber-800 flex-shrink-0 px-2 py-0.5 bg-amber-100 rounded-full">
                        #{idx + 1}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
