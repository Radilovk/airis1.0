import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Download, Calendar, CheckCircle, Wrench, Sparkle } from '@phosphor-icons/react'
import { toast } from 'sonner'

const CHANGELOG_DATA = {
  title: 'Лог на промени от 12 ноември до момента',
  lastUpdate: new Date().toLocaleDateString('bg-BG'),
  sections: [
    {
      category: 'Editor Mode',
      icon: '✏️',
      color: 'purple',
      items: [
        {
          title: 'Editor Mode система',
          description: 'Пълна система за редактиране на репорт модулите в реално време директно от приложението',
          details: [
            'Включване/изключване на Editor Mode от админ панела',
            'Визуални индикатори за всеки редактируем елемент',
            'Drag & drop преподреждане на модули и контейнери',
            'Премахване и възстановяване на модули',
            'Коментиране на всеки контейнер за бъдещи корекции'
          ]
        },
        {
          title: 'Редакция на контейнери',
          description: 'Детайлна редакция на всеки под-елемент в репорта',
          details: [
            'Редактиране на всички табове: Overview, Иридология, План за действие',
            'Достъп до всички подконтейнери и елементи',
            'Запазване на пълна интерактивност при редакция',
            'Кликабилни и разгръщащи се елементи работят паралелно с редакцията'
          ]
        },
        {
          title: 'Експорт на коментари',
          description: 'Генериране и изтегляне на всички коментари в структуриран формат',
          details: [
            'Експорт в JSON и TXT формат',
            'Организирани по модули и контейнери',
            'Включени timestamps и метаданни',
            'Директно изтегляне от интерфейса'
          ]
        }
      ]
    },
    {
      category: 'Иридологичен Анализ',
      icon: '👁️',
      color: 'blue',
      items: [
        {
          title: 'Интерактивна ирисова карта',
          description: 'Интерактивна визуализация на 12-те иридологични зони',
          details: [
            'Кликабилни зони с детайлна информация',
            'Цветово кодиране според здравно състояние',
            'Hover ефекти и tooltips',
            'Синхронизирана карта за ляв и десен ирис',
            'Позициониране на зоните по часовник (12 зони)'
          ]
        },
        {
          title: 'Редактор за позициониране на ирис',
          description: 'Canvas-базиран редактор за прецизно подравняване на ирисови снимки',
          details: [
            'Drag & drop позициониране',
            'Pinch-to-zoom и завъртане',
            'Overlay шаблон с 12 иридологични зони',
            'Високо-резолюционен експорт (800×800px)',
            'Touch и mouse поддръжка',
            'Възможност за повторно редактиране след качване'
          ]
        },
        {
          title: 'Оптимизирана AI база знания',
          description: 'Структурирана иридологична база знания вместо PDF зареждане',
          details: [
            'Компактна база с иридологична карта (12 зони)',
            '5 типа артефакти с интерпретации',
            '6 системи за анализ (храносмилателна, имунна, нервна и др.)',
            'Хранителни препоръки по категории',
            'Намален prompt размер от ~2000 на ~500 символа'
          ]
        }
      ]
    },
    {
      category: 'Визуализации и Графики',
      icon: '📊',
      color: 'green',
      items: [
        {
          title: 'Интерактивни charts',
          description: '7 типа интерактивни графики за визуализация на здравни данни',
          details: [
            'HealthProgressChart - текущо здраве и 6-месечна прогноза',
            'NutritionChart - категоризация на храни (препоръчани/избягвани)',
            'SystemComparisonChart - сравнение ляв/десен ирис по системи',
            'ZoneHeatmap - циркулярна карта на ирисовите зони',
            'ZoneStatusPieChart - pie chart на зоновото състояние',
            'ActionTimeline - времева линия с 4 фази на изпълнение',
            'InteractiveRecommendations - checklist за проследяване'
          ]
        },
        {
          title: 'Responsive дизайн',
          description: 'Адаптивни визуализации за всички устройства',
          details: [
            'Адаптивни размери според екрана',
            'Grid layouts с автоматично преструктуриране',
            'Scrollable containers за mobile',
            'Touch-friendly контроли',
            'Hover tooltips с mobile алтернативи'
          ]
        }
      ]
    },
    {
      category: 'Административен Панел',
      icon: '⚙️',
      color: 'orange',
      items: [
        {
          title: 'Табова организация',
          description: 'Реорганизиран админ панел в табове за по-добра навигация',
          details: [
            'AI Модел конфигурация',
            'Иридологично ръководство (с редактор)',
            'AI Prompt шаблон (с редактор)',
            'Въпросник настройки',
            'Editor Mode контроли',
            'Changelog лог (този екран)',
            'Responsive дизайн за mobile'
          ]
        },
        {
          title: 'Редактируемо иридологично ръководство',
          description: 'Пълен текстов редактор за иридологичните насоки',
          details: [
            'Textarea редактор с висока височина',
            'Запазване с timestamp',
            'Възстановяване на default ръководство',
            'Реално време синхронизация с AI анализа',
            'Markdown поддръжка'
          ]
        },
        {
          title: 'Редактируем AI Prompt',
          description: 'Директна редакция на AI промпта за анализ',
          details: [
            'Пълен достъп до prompt шаблона',
            'Оптимизирани промптове (60-70% намаление на токени)',
            'Комбинация английски + български за по-малко токени',
            'Възстановяване на default промпт',
            'Real-time приложение при следващ анализ'
          ]
        },
        {
          title: 'AI модел конфигурация',
          description: 'Управление на AI модели и API ключове',
          details: [
            'Поддръжка на OpenAI (gpt-4o, gpt-4o-mini)',
            'Поддръжка на Google Gemini (gemini-2.0-flash-exp и др.)',
            'GitHub Spark модел (default)',
            'Собствени API ключове за по-бързи анализи',
            'Конфигуриране на request delays и retry логика',
            'Визуални индикатори за активна конфигурация'
          ]
        },
        {
          title: 'Управление на въпросника',
          description: 'Редактиране на въпроси и опции във въпросника',
          details: [
            'Добавяне/премахване на въпроси',
            'Редактиране на заглавия и описания',
            'Управление на опции (за checkbox/radio полета)',
            'Drag & drop преподреждане на въпроси',
            'Валидация и задължителни полета'
          ]
        }
      ]
    },
    {
      category: 'Репорт Система',
      icon: '📄',
      color: 'cyan',
      items: [
        {
          title: 'Подобрено форматиране',
          description: 'Професионално форматиране на репорт елементите',
          details: [
            'Bullet points с икони',
            'Разделени контейнери с clear визуална йерархия',
            'Accordion компоненти за дълги текстове',
            'Цветово кодиране според важност',
            'Responsive колони и grid layouts'
          ]
        },
        {
          title: 'Интерактивни елементи',
          description: 'Кликабилни и разгръщащи се секции',
          details: [
            'Accordion за препоръки и детайли',
            'Tabs за различни анализни секции',
            'Hover states и tooltips',
            'Expandable карти с допълнителна информация',
            'Progress bars за визуализация на нива'
          ]
        },
        {
          title: 'Пълен превод на български',
          description: 'Всички текстове преведени, без английски остатъци',
          details: [
            'Преводи на всички AI генерирани текстове',
            'Български labels и headers',
            'Локализирани съобщения за грешки',
            'Български tooltips и descriptions'
          ]
        }
      ]
    },
    {
      category: 'Информационна Страница',
      icon: 'ℹ️',
      color: 'indigo',
      items: [
        {
          title: '"Как работи Airis" страница',
          description: 'Детайлна информационна страница за принципите на Airis',
          details: [
            'Обяснение на клиничния и конституционен подход',
            'Описание на биологичната основа на иридологията',
            'Клинични маркери (Arcus senilis, иктер и др.)',
            'Конституционен ирисов анализ',
            'Ролята на въпросника',
            'Стъпки на анализа',
            'Библиографска справка с източници',
            'Collapsible секции за детайлно четене',
            'Икони и визуални елементи'
          ]
        }
      ]
    },
    {
      category: 'Технически Подобрения',
      icon: '🔧',
      color: 'red',
      items: [
        {
          title: 'Storage оптимизация',
          description: 'Намаляване на използваната памет и автоматично почистване',
          details: [
            'Автоматично изтриване на стари изображения',
            'Storage usage мониторинг',
            'Леки версии на репорти в историята (без изображения)',
            'Пълни изображения само в активния репорт',
            'Размерни ограничения (200KB за изображение)',
            'Garbage collection hints'
          ]
        },
        {
          title: 'Error handling и debugging',
          description: 'Подобрено управление на грешки и debugging инструменти',
          details: [
            'Детайлно логване с emoji индикатори',
            'QuickDebugPanel за real-time мониторинг',
            'Upload diagnostics система',
            'Error logger с категоризация',
            'JSON parsing error recovery (автоматично почистване на markdown блокове)',
            'Retry логика с exponential backoff',
            'Rate limiting за API заявки'
          ]
        },
        {
          title: 'Оптимизация на AI промптове',
          description: '60-70% намаление на prompt размера',
          details: [
            'Комбинация англ + BG за по-малко токени',
            'Премахване на дублиращи се инструкции',
            'Съкратени технически термини',
            'Ирис анализ: 3100 → 900 символа (~70%)',
            'Хранителен план: 2500 → 800 символа (~68%)',
            'Supplements: 2800 → 600 символа (~79%)',
            'По-бързи анализи (2-3x)',
            'По-малко rate limit проблеми'
          ]
        },
        {
          title: 'Screen transition защита',
          description: 'Предотвратяване на duplicate вызовове и race conditions',
          details: [
            'Lock механизъм за screen transitions',
            'Дублирана валидация на изображения',
            'Memory stabilization паузи',
            'Защита срещу rapid clicking'
          ]
        }
      ]
    },
    {
      category: 'Диагностични Инструменти',
      icon: '🩺',
      color: 'yellow',
      items: [
        {
          title: 'QuickDebugPanel',
          description: 'Real-time debug панел за мониторинг на приложението',
          details: [
            'Live логове с timestamps',
            'Цветово кодирани log levels',
            'Scrollable log history',
            'Експорт на логове',
            'Minimizable panel'
          ]
        },
        {
          title: 'Diagnostic Screen',
          description: 'Специализиран екран за системна диагностика',
          details: [
            'Storage usage информация',
            'API конфигурация status',
            'Error logs история',
            'Upload diagnostics',
            'System health check'
          ]
        },
        {
          title: 'Upload diagnostics система',
          description: 'Детайлно проследяване на image upload процеса',
          details: [
            'Step-by-step логване на upload',
            'Validation checks на всеки етап',
            'Size и format проверки',
            'Memory usage tracking',
            'Error pinpointing'
          ]
        }
      ]
    }
  ]
}

export default function ChangelogTab() {
  const handleDownload = () => {
    const changelogText = generateChangelogText()
    const blob = new Blob([changelogText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `airis-changelog-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Changelog изтеглен успешно!')
  }

  const generateChangelogText = (): string => {
    let text = `# ${CHANGELOG_DATA.title}\n`
    text += `Последна актуализация: ${CHANGELOG_DATA.lastUpdate}\n\n`
    text += `═══════════════════════════════════════════════════════════════\n\n`

    CHANGELOG_DATA.sections.forEach((section) => {
      text += `\n${section.icon} ${section.category.toUpperCase()}\n`
      text += `${'─'.repeat(60)}\n\n`

      section.items.forEach((item, idx) => {
        text += `${idx + 1}. ${item.title}\n`
        text += `   ${item.description}\n\n`
        
        item.details.forEach((detail) => {
          text += `   • ${detail}\n`
        })
        text += `\n`
      })
    })

    text += `\n═══════════════════════════════════════════════════════════════\n`
    text += `Генериран от Airis Admin Panel - ${new Date().toLocaleString('bg-BG')}\n`

    return text
  }

  const getCategoryColor = (color: string) => {
    const colors: Record<string, string> = {
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
      blue: 'bg-blue-100 text-blue-700 border-blue-200',
      green: 'bg-green-100 text-green-700 border-green-200',
      orange: 'bg-orange-100 text-orange-700 border-orange-200',
      cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      red: 'bg-red-100 text-red-700 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    }
    return colors[color] || 'bg-gray-100 text-gray-700 border-gray-200'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Лог на Промени</h3>
          <p className="text-sm text-muted-foreground">
            Подробна история на функционалности и подобрения от 12 ноември
          </p>
        </div>
        <Button onClick={handleDownload} className="gap-2">
          <Download weight="bold" />
          Изтегли
        </Button>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar weight="duotone" className="w-6 h-6 text-primary" />
              <div>
                <CardTitle className="text-xl">{CHANGELOG_DATA.title}</CardTitle>
                <CardDescription>
                  Последна актуализация: {CHANGELOG_DATA.lastUpdate}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="gap-2">
              <CheckCircle weight="fill" className="w-4 h-4 text-green-600" />
              {CHANGELOG_DATA.sections.reduce((acc, s) => acc + s.items.length, 0)} промени
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-8">
              {CHANGELOG_DATA.sections.map((section, sectionIdx) => (
                <div key={sectionIdx} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-lg border ${getCategoryColor(section.color)}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{section.icon}</span>
                        <span className="font-semibold text-sm">{section.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pl-4 border-l-2 border-border">
                    {section.items.map((item, itemIdx) => (
                      <Card key={itemIdx} className="ml-4 bg-card/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              <Sparkle weight="duotone" className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-base">{item.title}</CardTitle>
                              <CardDescription className="text-sm mt-1">
                                {item.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul className="space-y-2">
                            {item.details.map((detail, detailIdx) => (
                              <li key={detailIdx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle weight="bold" className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {sectionIdx < CHANGELOG_DATA.sections.length - 1 && (
                    <Separator className="mt-6" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Wrench weight="duotone" className="w-5 h-5 text-primary mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Забележка:
              </p>
              <p>
                Този лог съдържа само списък и описание на промените. Техническите детайли за файлова структура и имплементация са умишлено пропуснати за по-добра четимост.
              </p>
              <p>
                За пълна техническа документация, вижте PRD.md и другите markdown файлове в root директорията на проекта.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
