import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Eye, Sparkle, Activity, FileText, ClockClockwise, Gear, Flask, Info, Bug } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useKV } from '@github/spark/hooks'
import type { QuestionnaireData } from '@/types'

interface WelcomeScreenProps {
  onStart: () => void
  onViewHistory: () => void
  onAdmin: () => void
  onTestStart: () => void
  onAbout: () => void
  onDiagnostics: () => void
}

export default function WelcomeScreen({ onStart, onViewHistory, onAdmin, onTestStart, onAbout, onDiagnostics }: WelcomeScreenProps) {
  const [questionnaireData] = useKV<QuestionnaireData | null>('questionnaire-data', null)
  const features = [
    {
      icon: Eye,
      title: 'AI Анализ на Ириси',
      description: 'Използваме изкуствен интелект за детайлен анализ на иридологични зони'
    },
    {
      icon: Activity,
      title: 'Здравна Оценка',
      description: 'Оценка на различни органни системи според топографски шаблон'
    },
    {
      icon: FileText,
      title: 'Подробен Доклад',
      description: 'Получете детайлен доклад с находки, диаграми и обяснения'
    },
    {
      icon: Sparkle,
      title: 'Персонализирани Препоръки',
      description: 'Индивидуални препоръки за хранене и хранителни добавки'
    }
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mb-6">
            <Eye size={40} weight="duotone" className="text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Иридологичен Анализ
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Открийте здравословното си състояние чрез модерен AI анализ на ириси
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon size={24} weight="duotone" className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center space-y-4"
        >
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={onStart}
              className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            >
              Започни Анализ
            </Button>
            {questionnaireData && (
              <Button
                size="lg"
                variant="secondary"
                onClick={onTestStart}
                className="px-8 py-6 text-lg font-semibold gap-2 bg-gradient-to-r from-accent/20 to-accent/10 border-2 border-accent/50 hover:bg-accent/20"
              >
                <Flask size={20} weight="duotone" />
                Използвай предишни данни
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              onClick={onViewHistory}
              className="px-8 py-6 text-lg font-semibold gap-2"
            >
              <ClockClockwise size={20} weight="duotone" />
              История
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={onAdmin}
              className="px-8 py-6 text-lg font-semibold gap-2"
            >
              <Gear size={20} weight="duotone" />
              Настройки
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              variant="ghost"
              onClick={onAbout}
              className="px-6 py-4 text-base font-medium gap-2 border border-primary/20 hover:bg-primary/5"
            >
              <Info size={20} weight="duotone" />
              За airis – как работи системата
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={onDiagnostics}
              className="px-6 py-4 text-base font-medium gap-2 border border-amber-500/20 hover:bg-amber-500/5 text-amber-600"
            >
              <Bug size={20} weight="duotone" />
              Диагностика
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Процесът отнема около 5-10 минути
          </p>
        </motion.div>
      </div>
    </div>
  )
}
