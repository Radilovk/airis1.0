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
  WarningCircle
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AnalysisReport, SupplementRecommendation } from '@/types'
import { cn } from '@/lib/utils'

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

  return (
    <div className="space-y-3">
      {motivationalSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/10">
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
              <Lightbulb size={20} weight="duotone" className="text-primary" />
              План за Действие
            </h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {motivationalSummary}
            </p>
          </Card>
        </motion.div>
      )}

      <div className="space-y-2.5">
        {detailedPlan.generalRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <CollapsibleSection 
              section={{
                id: 'general',
                title: 'Общи Препоръки',
                icon: Lightbulb,
                content: detailedPlan.generalRecommendations
              }} 
            />
          </motion.div>
        )}

        {(detailedPlan.recommendedFoods.length > 0 || detailedPlan.avoidFoods.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <FoodRecommendationsSection 
              recommendedFoods={detailedPlan.recommendedFoods}
              avoidFoods={detailedPlan.avoidFoods}
            />
          </motion.div>
        )}

        {detailedPlan.supplements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <SupplementsSection supplements={detailedPlan.supplements} />
          </motion.div>
        )}

        {detailedPlan.psychologicalRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <CollapsibleSection 
              section={{
                id: 'psychological',
                title: 'Психологически Препоръки',
                icon: Brain,
                content: detailedPlan.psychologicalRecommendations
              }} 
            />
          </motion.div>
        )}

        {detailedPlan.specialRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <CollapsibleSection 
              section={{
                id: 'special',
                title: 'Специални (Индивидуални) Препоръки',
                icon: Leaf,
                content: detailedPlan.specialRecommendations
              }} 
            />
          </motion.div>
        )}

        {detailedPlan.recommendedTests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
          >
            <CollapsibleSection 
              section={{
                id: 'tests',
                title: 'Препоръчителни Конкретни Изследвания',
                icon: Flask,
                content: detailedPlan.recommendedTests
              }} 
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}

function SupplementsSection({ supplements }: { supplements: SupplementRecommendation[] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden transition-all">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
              <Pill size={18} weight="duotone" className="text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="font-semibold text-sm">Хранителни Добавки - Дозировка и Прием</h4>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">
              {supplements.length}
            </Badge>
            <CaretDown 
              size={18} 
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                isOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 space-y-2.5">
            {supplements.map((supp, idx) => (
              <div 
                key={idx} 
                className="p-3 bg-muted/30 rounded-lg border space-y-1.5"
              >
                <div className="flex items-start gap-2">
                  <Pill size={16} weight="duotone" className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-sm mb-1">{supp.name}</h5>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-start gap-1.5">
                        <span className="font-medium">Дозировка:</span>
                        <span>{supp.dosage}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-medium">Прием:</span>
                        <span>{supp.timing}</span>
                      </div>
                      {supp.notes && (
                        <div className="flex items-start gap-1.5 mt-1.5 pt-1.5 border-t border-border/50">
                          <span className="font-medium">Бележка:</span>
                          <span className="italic">{supp.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
      <Card className="overflow-hidden transition-all">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
              <Icon size={18} weight="duotone" className="text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="font-semibold text-sm">{section.title}</h4>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">
              {section.content.length}
            </Badge>
            <CaretDown 
              size={18} 
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                isOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 space-y-2">
            {section.content.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-2.5 p-3 bg-muted/30 rounded-lg border"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-sm leading-relaxed">{item}</p>
              </div>
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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden transition-all">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
              <AppleLogo size={18} weight="duotone" className="text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="font-semibold text-sm">Хранителни Препоръки</h4>
              <p className="text-xs text-muted-foreground">Препоръчителни и забранени храни</p>
            </div>
          </div>
          <CaretDown 
            size={18} 
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              isOpen && "transform rotate-180"
            )}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 space-y-4">
            {recommendedFoods.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md bg-green-100 flex items-center justify-center flex-shrink-0">
                    <AppleLogo size={14} weight="duotone" className="text-green-700" />
                  </div>
                  <h5 className="font-semibold text-sm text-green-900">Препоръчителни Храни</h5>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {recommendedFoods.map((food, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg border border-green-100"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0" />
                      <span className="text-xs text-green-900 leading-tight">{food}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {avoidFoods.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
                    <WarningCircle size={14} weight="duotone" className="text-red-700" />
                  </div>
                  <h5 className="font-semibold text-sm text-red-900">Храни за Избягване</h5>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {avoidFoods.map((food, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                      <span className="text-xs text-red-900 leading-tight">{food}</span>
                    </div>
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
