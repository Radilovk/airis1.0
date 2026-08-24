import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Warning, Info } from '@phosphor-icons/react'
import type { Recommendation } from '@/types'

interface RecommendationCardProps {
  recommendation: Recommendation
  index: number
}

export default function RecommendationCard({ recommendation, index }: RecommendationCardProps) {
  const getPriorityConfig = (priority: 'high' | 'medium' | 'low') => {
    const configs = {
      high: { 
        label: 'Висок приоритет', 
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: Warning,
        iconColor: 'text-red-600',
        progress: 100
      },
      medium: { 
        label: 'Среден приоритет', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: Info,
        iconColor: 'text-yellow-600',
        progress: 66
      },
      low: { 
        label: 'Нисък приоритет', 
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: CheckCircle,
        iconColor: 'text-blue-600',
        progress: 33
      }
    }
    return configs[priority]
  }

  const getCategoryLabel = (category: 'diet' | 'supplement' | 'lifestyle') => {
    const labels = {
      diet: '🥗 Хранене',
      supplement: '💊 Добавки',
      lifestyle: '🧘 Начин на живот'
    }
    return labels[category]
  }

  const config = getPriorityConfig(recommendation.priority)
  const Icon = config.icon

  return (
    <Card className="p-5 hover:shadow-md transition-all border-l-4" style={{
      borderLeftColor: recommendation.priority === 'high' ? 'rgb(239, 68, 68)' : 
                       recommendation.priority === 'medium' ? 'rgb(234, 179, 8)' : 
                       'rgb(59, 130, 246)'
    }}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          recommendation.priority === 'high' ? 'bg-red-100' :
          recommendation.priority === 'medium' ? 'bg-yellow-100' :
          'bg-blue-100'
        }`}>
          <Icon size={20} weight="duotone" className={config.iconColor} />
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {getCategoryLabel(recommendation.category)}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">#{index + 1}</span>
              </div>
              <h4 className="font-semibold text-base mb-2">{recommendation.title}</h4>
            </div>
            {recommendation.priority === 'high' && (
              <Badge className={`${config.color} border flex-shrink-0`}>
                {config.label}
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {recommendation.description}
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Важност</span>
              <span className="font-semibold">{config.progress}%</span>
            </div>
            <Progress value={config.progress} className="h-1.5" />
          </div>
        </div>
      </div>
    </Card>
  )
}
