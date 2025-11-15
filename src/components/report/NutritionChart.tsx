import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnalysisReport } from '@/types'

interface NutritionChartProps {
  report: AnalysisReport
}

export default function NutritionChart({ report }: NutritionChartProps) {
  const [activeTab, setActiveTab] = useState<'recommended' | 'avoid'>('recommended')
  const [selectedFood, setSelectedFood] = useState<string | null>(null)
  
  const recommendedFoods = report.detailedPlan?.recommendedFoods || []
  const avoidFoods = report.detailedPlan?.avoidFoods || []
  
  const getCategoryData = (foods: string[], isRecommended: boolean) => {
    const categories: Record<string, number> = {
      'Плодове': 0,
      'Зеленчуци': 0,
      'Протеини': 0,
      'Зърнени': 0,
      'Млечни': 0,
      'Други': 0
    }
    
    foods.forEach(food => {
      const lower = food.toLowerCase()
      if (lower.match(/ябълк|круш|банан|ягод|портокал|грозде|кайсия|праскова|слива|киви|манго|ананас|дини|пъпеш/)) {
        categories['Плодове']++
      } else if (lower.match(/салат|домат|краставиц|чушк|морков|зеле|броколи|карфиол|спанак|тикв|патладжан/)) {
        categories['Зеленчуци']++
      } else if (lower.match(/месо|риба|пиле|яйца|боб|леща|грах|тофу|протеин|орех/)) {
        categories['Протеини']++
      } else if (lower.match(/ориз|пшениц|брашно|хляб|паста|овес|киноа|царевиц/)) {
        categories['Зърнени']++
      } else if (lower.match(/мляко|сирене|кашкавал|кисело|йогурт|извара/)) {
        categories['Млечни']++
      } else {
        categories['Други']++
      }
    })
    
    return Object.entries(categories)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => ({ name, count, type: isRecommended ? 'recommended' : 'avoid' }))
  }
  
  const recommendedData = getCategoryData(recommendedFoods, true)
  const avoidData = getCategoryData(avoidFoods, false)
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-1">{data.name}</p>
          <p className="text-xs text-muted-foreground">{data.count} продукта</p>
        </div>
      )
    }
    return null
  }
  
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-base mb-4">Хранителен Профил</h3>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="recommended" className="flex items-center gap-2">
            <CheckCircle size={16} weight="duotone" />
            <span className="text-xs">Препоръчани</span>
          </TabsTrigger>
          <TabsTrigger value="avoid" className="flex items-center gap-2">
            <XCircle size={16} weight="duotone" />
            <span className="text-xs">За избягване</span>
          </TabsTrigger>
        </TabsList>
        
        <AnimatePresence mode="wait">
          <TabsContent value="recommended" key="recommended">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {recommendedData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={recommendedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.1)" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: 'currentColor', fontSize: 11 }}
                        stroke="rgba(100, 116, 139, 0.3)"
                      />
                      <YAxis 
                        tick={{ fill: 'currentColor', fontSize: 11 }}
                        stroke="rgba(100, 116, 139, 0.3)"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="count" 
                        radius={[8, 8, 0, 0]}
                        onClick={(data) => setSelectedFood(data.name)}
                        cursor="pointer"
                      >
                        {recommendedData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={selectedFood === entry.name ? 'oklch(0.70 0.18 45)' : 'oklch(0.55 0.15 230)'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-800">
                      <span className="font-semibold">{recommendedFoods.length} храни</span> препоръчани за редовна консумация
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Няма препоръчани храни
                </div>
              )}
            </motion.div>
          </TabsContent>
          
          <TabsContent value="avoid" key="avoid">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {avoidData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={avoidData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.1)" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: 'currentColor', fontSize: 11 }}
                        stroke="rgba(100, 116, 139, 0.3)"
                      />
                      <YAxis 
                        tick={{ fill: 'currentColor', fontSize: 11 }}
                        stroke="rgba(100, 116, 139, 0.3)"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="count" 
                        radius={[8, 8, 0, 0]}
                        onClick={(data) => setSelectedFood(data.name)}
                        cursor="pointer"
                      >
                        {avoidData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={selectedFood === entry.name ? 'oklch(0.70 0.18 45)' : 'oklch(0.577 0.245 27.325)'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-800">
                      <span className="font-semibold">{avoidFoods.length} храни</span> за ограничаване или избягване
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Няма храни за избягване
                </div>
              )}
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </Card>
  )
}
