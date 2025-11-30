import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Info,
  Brain,
  GitBranch,
  Gear,
  BookOpen,
  ListChecks,
  FloppyDisk
} from '@phosphor-icons/react'

/**
 * Settings Documentation Component
 * Provides comprehensive documentation for all admin panel settings and functions
 */
export default function SettingsDocumentation() {
  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="w-5 h-5 text-primary" weight="duotone" />
          Документация на настройките
        </CardTitle>
        <CardDescription>
          Обяснение на всички функции и настройки в административния панел
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {/* AI Model Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" weight="duotone" />
            <h3 className="font-semibold">AI Модел настройки</h3>
          </div>
          <div className="ml-7 space-y-2 text-muted-foreground">
            <p><strong>Доставчик:</strong> Избор между OpenAI и Google Gemini. И двата изискват собствен API ключ.</p>
            <p><strong>Модел:</strong> Избор на конкретен AI модел (GPT-4o, Gemini 2.0 Flash и др.).</p>
            <p><strong>API ключ:</strong> Задължителен за работа на анализа. Съхранява се само локално в браузъра.</p>
            <p><strong>Забавяне между заявки:</strong> Време за изчакване между AI заявки (5-10 сек препоръчително).</p>
            <p><strong>Диагностична проверка:</strong> AI описва какво вижда преди структурирания анализ.</p>
          </div>
        </div>

        <Separator />

        {/* Pipeline Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" weight="duotone" />
            <h3 className="font-semibold">Pipeline система</h3>
          </div>
          <div className="ml-7 space-y-2 text-muted-foreground">
            <p><strong>Как работи:</strong> Pipeline-ът изпълнява активните стъпки последователно при всеки анализ.</p>
            <p><strong>Единична стъпка (One):</strong> Ако е активна само "One", се изпълнява един цялостен промпт.</p>
            <p><strong>Множество стъпки:</strong> Ако са активни повече стъпки, всяка обработва специфичен аспект.</p>
            
            <Alert className="mt-3">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Стъпки в v9 Pipeline:</strong><br/>
                1. Geo Calibration - Геометрична калибрация на ириса<br/>
                2. Structural Detector - Детекция на лакуни, крипти, бразди<br/>
                3. Pigment & Rings - Детекция на пигментация и пръстени<br/>
                4. Consistency Validator - Валидация и филтриране на находки<br/>
                5. Zone Mapper - Мапиране към органни зони<br/>
                6. Profile Builder - Изграждане на профил<br/>
                7. Frontend Report - Генериране на JSON за UI
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <Separator />

        {/* Presets Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FloppyDisk className="w-5 h-5 text-primary" weight="duotone" />
            <h3 className="font-semibold">Pipeline пресети</h3>
          </div>
          <div className="ml-7 space-y-2 text-muted-foreground">
            <p><strong>Запазване:</strong> Запазете текущата pipeline конфигурация с име за бъдещо използване.</p>
            <p><strong>Зареждане:</strong> Заредете предварително запазена конфигурация.</p>
            <p><strong>Изтриване:</strong> Премахнете ненужни пресети.</p>
            <p className="text-xs italic">Пресетите се съхраняват локално в браузъра.</p>
          </div>
        </div>

        <Separator />

        {/* Step Settings Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Gear className="w-5 h-5 text-primary" weight="duotone" />
            <h3 className="font-semibold">Настройки на стъпка</h3>
          </div>
          <div className="ml-7 space-y-2 text-muted-foreground">
            <p><strong>Активирана:</strong> Включва/изключва стъпката от pipeline-а.</p>
            <p><strong>Промпт:</strong> Инструкциите за AI модела за тази стъпка.</p>
            <p><strong>Temperature:</strong> Креативност на модела (0.3 за точност, 0.7 за разнообразие).</p>
            <p><strong>Max Tokens:</strong> Максимална дължина на отговора.</p>
            <p><strong>Top P:</strong> Контролира разнообразието на отговорите.</p>
          </div>
        </div>

        <Separator />

        {/* GitHub Integration Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" weight="duotone" />
            <h3 className="font-semibold">GitHub интеграция</h3>
          </div>
          <div className="ml-7 space-y-2 text-muted-foreground">
            <p><strong>Свързване:</strong> Въведете GitHub API ключ за директна работа с репозиторито.</p>
            <p><strong>Запазване:</strong> Запазете промените директно в GitHub репото.</p>
            <p><strong>Зареждане:</strong> Заредете текущата конфигурация от GitHub.</p>
            <p className="text-xs italic">GitHub API ключът се генерира от Settings → Developer settings → Personal access tokens.</p>
          </div>
        </div>

        <Separator />

        {/* Best Practices */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Препоръчителна конфигурация:</strong><br/>
            • За бърз анализ: Активирайте само "One" стъпката<br/>
            • За детайлен анализ: Активирайте всички v9 стъпки<br/>
            • Забавяне: 5000-10000ms между заявки<br/>
            • Temperature: 0.5 за баланс между точност и разнообразие
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
