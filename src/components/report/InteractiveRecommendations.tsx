import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ForkKnife, 
  Pill, 
  PersonSimpleRun,
  Check,
  ArrowRight
} from '@phosphor-icons/react'
import type { Recommendation } from '@/types'

interface InteractiveRecommendationsProps {
  recommendations: Recommendation[]
}

export default function InteractiveRecommendations({ recommendations }: InteractiveRecommendationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  
  const groupedRecs = recommendations.reduce((acc, rec, idx) => {
    if (!acc[rec.category]) {
      acc[rec.category] = []
    }
    acc[rec.category].push({ ...rec, originalIndex: idx })
    return acc
  }, {} as Record<string, Array<Recommendation & { originalIndex: number }>>)
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'diet':
        return ForkKnife
      case 'supplement':
        return Pill
      case 'lifestyle':
        return PersonSimpleRun
      default:
        return Check
    }
  }
  
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'diet':
        return 'Хранене'
      case 'supplement':
        return 'Добавки'
      case 'lifestyle':
        return 'Начин на живот'
      default:
        return category
    }
  }
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'diet':
        return 'oklch(0.75 0.15 145)'
      case 'supplement':
        return 'oklch(0.55 0.15 230)'
      case 'lifestyle':
        return 'oklch(0.70 0.18 45)'
      default:
        return 'oklch(0.70 0.05 220)'
    }
  }
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }
  
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Висок'
      case 'medium':
        return 'Среден'
      case 'low':
        return 'Нисък'
      default:
        return priority
    }
  }
  
  const toggleCheck = (index: number) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }
  
  const completionRate = recommendations.length > 0 
    ? Math.round((checkedItems.size / recommendations.length) * 100)
    : 0
  
  return (
    <Card className="p-5">
      <div className="mb-6">
        <h3 className="font-semibold text-base mb-2">Интерактивни Препоръки</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Маркирайте завършените препоръки за проследяване на напредъка
        </p>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold text-primary min-w-[50px] text-right">
            {completionRate}%
          </span>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {Object.keys(groupedRecs).map((category) => {
            const Icon = getCategoryIcon(category)
            const isSelected = selectedCategory === category
            const color = getCategoryColor(category)
            
            return (
              <motion.button
                key={category}
                onClick={() => setSelectedCategory(isSelected ? null : category)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icon size={18} weight="duotone" style={{ color }} />
                <span className="text-sm font-medium">{getCategoryLabel(category)}</span>
                <Badge variant="secondary" className="text-xs">
                  {groupedRecs[category].length}
                </Badge>
              </motion.button>
            )
          })}
        </div>
      </div>
      
      <div className="space-y-2">
        <AnimatePresence mode="wait">
          {Object.entries(groupedRecs)
            .filter(([category]) => !selectedCategory || category === selectedCategory)
            .map(([category, recs]) => (
              <div key={category} className="space-y-2">
                {recs
                  .sort((a, b) => {
                    const priorityOrder = { high: 0, medium: 1, low: 2 }
                    return priorityOrder[a.priority] - priorityOrder[b.priority]
                  })
                  .map((rec, idx) => {
                    const isChecked = checkedItems.has(rec.originalIndex)
                    const Icon = getCategoryIcon(category)
                    
                    return (
                      <motion.div
                        key={rec.originalIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-green-50 border-green-200 opacity-60' 
                            : 'bg-card hover:bg-muted/30 border-border hover:border-primary/30 hover:shadow-md'
                        }`}
                        onClick={() => toggleCheck(rec.originalIndex)}
                      >
                        <motion.div
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${
                            isChecked 
                              ? 'bg-green-500 border-green-500' 
                              : 'border-muted-foreground/30 hover:border-primary'
                          }`}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          {isChecked && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <Check size={16} weight="bold" className="text-white" />
                            </motion.div>
                          )}
                        </motion.div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <Icon 
                                size={18} 
                                weight="duotone" 
                                style={{ color: getCategoryColor(category) }}
                              />
                              <h4 className={`font-bold text-sm ${isChecked ? 'line-through' : ''}`}>
                                {rec.title}
                              </h4>
                            </div>
                            <Badge 
                              className={`text-xs flex-shrink-0 border ${getPriorityColor(rec.priority)}`}
                            >
                              {getPriorityLabel(rec.priority)}
                            </Badge>
                          </div>
                          <p className={`text-sm leading-relaxed ${
                            isChecked ? 'text-muted-foreground line-through' : 'text-foreground/80'
                          }`}>
                            {rec.description}
                          </p>
                        </div>
                        
                        {!isChecked && (
                          <motion.div
                            whileHover={{ x: 5 }}
                            className="flex-shrink-0 text-primary"
                          >
                            <ArrowRight size={20} weight="bold" />
                          </motion.div>
                        )}
                      </motion.div>
                    )
                  })}
              </div>
            ))}
        </AnimatePresence>
      </div>
      
      {checkedItems.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Check size={24} weight="duotone" className="text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                Страхотна работа! {checkedItems.size} от {recommendations.length} препоръки завършени
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Продължавайте да следвате плана за оптимални резултати
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  )
}
