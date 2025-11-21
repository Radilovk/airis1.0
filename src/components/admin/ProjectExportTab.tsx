import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { 
  DownloadSimple, 
  Package, 
  FileCode, 
  CheckCircle,
  Info,
  GitBranch,
  FolderOpen,
  File,
  MagnifyingGlass
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface FileStructure {
  path: string
  type: 'file' | 'directory'
  size?: number
}

export default function ProjectExportTab() {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedFiles, setScannedFiles] = useState<FileStructure[]>([])
  const [exportLog, setExportLog] = useState<string[]>([])

  const projectStructure = [
    { path: 'src/App.tsx', desc: 'Главен компонент на приложението' },
    { path: 'src/components/', desc: 'Всички React компоненти' },
    { path: 'src/hooks/', desc: 'Custom React hooks' },
    { path: 'src/lib/', desc: 'Utility функции и библиотеки' },
    { path: 'src/types/', desc: 'TypeScript типове' },
    { path: 'src/index.css', desc: 'Глобални стилове и тема' },
    { path: 'index.html', desc: 'HTML entry point' },
    { path: 'package.json', desc: 'Dependencies и скриптове' },
    { path: 'vite.config.ts', desc: 'Vite конфигурация' },
    { path: 'tsconfig.json', desc: 'TypeScript конфигурация' },
    { path: 'tailwind.config.js', desc: 'Tailwind конфигурация' },
    { path: 'README.md', desc: 'Документация' }
  ]

  const criticalFiles = [
    'index.html',
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    'tsconfig.json',
    'tailwind.config.js',
    'theme.json',
    'components.json',
    'PRD.md',
    'README.md',
    'src/App.tsx',
    'src/index.css',
    'src/main.css',
    'src/main.tsx',
    'src/vite-end.d.ts'
  ]

  const directories = [
    'src/components/',
    'src/components/ui/',
    'src/components/screens/',
    'src/components/admin/',
    'src/components/iris/',
    'src/components/report/',
    'src/hooks/',
    'src/lib/',
    'src/types/',
    'src/styles/',
    'src/assets/'
  ]

  const addLog = (message: string) => {
    setExportLog(prev => [...prev, `${new Date().toLocaleTimeString('bg-BG')}: ${message}`])
  }

  const scanProjectFiles = async () => {
    setIsScanning(true)
    setScannedFiles([])
    setExportLog([])
    addLog('🔍 Започване на сканиране на проекта...')

    const files: FileStructure[] = []
    let totalSize = 0

    const filesToScan = [
      ...criticalFiles,
      'AIRIS_KNOWLEDGE_README.md',
      'AI_CONFIGURATION_GUIDE.md',
      'CHANGELOG.md',
      'TROUBLESHOOTING.md',
      'README_BG.md',
      '.gitignore',
      'extract-project.py'
    ]

    for (const file of filesToScan) {
      try {
        const response = await fetch(`/${file}`)
        if (response.ok) {
          const blob = await response.blob()
          files.push({ path: file, type: 'file', size: blob.size })
          totalSize += blob.size
          addLog(`✓ Намерен: ${file} (${(blob.size / 1024).toFixed(2)} KB)`)
        }
      } catch (error) {
        addLog(`✗ Пропуснат: ${file}`)
      }
    }

    for (const dir of directories) {
      addLog(`📁 Сканиране на директория: ${dir}`)
      files.push({ path: dir, type: 'directory' })
    }

    setScannedFiles(files)
    addLog(`✅ Сканиране завършено: ${files.length} файла/директории, ~${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    setIsScanning(false)
    
    toast.success(`Сканирани ${files.length} файла/директории`, {
      description: `Общ размер: ~${(totalSize / 1024 / 1024).toFixed(2)} MB`
    })
  }

  const exportManualInstructions = () => {
    const instructions = `╔════════════════════════════════════════════════════════════════╗
║         AIRIS - ПЪЛНА ИНСТРУКЦИЯ ЗА ЕКСПОРТ                    ║
╚════════════════════════════════════════════════════════════════╝

📅 Дата: ${new Date().toLocaleString('bg-BG')}

════════════════════════════════════════════════════════════════

🎯 ПРОБЛЕМ: Автоматичната синхронизация GitHub Spark → Repository е нарушена

🔧 РЕШЕНИЕ: Ръчна синхронизация чрез пълен експорт на файловете

════════════════════════════════════════════════════════════════

📋 СТЪПКА 1: ДОСТЪП ДО GITHUB SPARK WORKBENCH
---------------------------------------------
1. Отворете GitHub Spark Dashboard
2. Намерете проекта "AIRIS Iridology App"
3. Кликнете "Open Workbench" или "View Code"
4. Вие ще влезете в Spark IDE с пълен достъп до файловете

════════════════════════════════════════════════════════════════

📦 СТЪПКА 2: КРИТИЧНИ ФАЙЛОВЕ ЗА ЕКСПОРТ
-----------------------------------------
Трябва да експортирате ВСИЧКИ тези файлове:

🔹 ROOT ФАЙЛОВЕ:
   ✓ index.html
   ✓ package.json
   ✓ package-lock.json
   ✓ vite.config.ts
   ✓ tsconfig.json
   ✓ tailwind.config.js
   ✓ theme.json
   ✓ components.json
   ✓ PRD.md
   ✓ README.md
   ✓ .gitignore
   ✓ Всички MD документи (CHANGELOG, TROUBLESHOOTING, и т.н.)

🔹 SRC/ ДИРЕКТОРИЯ (ЦЯЛАТА!):
   ✓ src/App.tsx
   ✓ src/index.css
   ✓ src/main.css
   ✓ src/main.tsx
   ✓ src/vite-end.d.ts
   ✓ src/ErrorFallback.tsx

🔹 SRC/COMPONENTS/ (ВСИЧКИ ПОДДИРЕКТОРИИ!):
   ✓ src/components/ui/ (всички shadcn компоненти)
   ✓ src/components/screens/ (всички екрани)
   ✓ src/components/admin/ (админ панел)
   ✓ src/components/iris/ (ирис анализ)
   ✓ src/components/report/ (репорт компоненти)
   ✓ src/components/EditorModeIndicator.tsx
   ✓ src/components/ErrorFallback.tsx
   ✓ src/components/QuickDebugPanel.tsx

🔹 SRC/HOOKS/:
   ✓ src/hooks/use-mobile.ts
   ✓ src/hooks/use-editable-elements.ts
   ✓ src/hooks/use-deep-editable.ts

🔹 SRC/LIB/:
   ✓ src/lib/utils.ts
   ✓ src/lib/error-logger.ts
   ✓ src/lib/storage-utils.ts
   ✓ src/lib/storage-cleanup.ts
   ✓ src/lib/airis-knowledge.ts
   ✓ src/lib/default-prompts.ts
   ✓ src/lib/defaultQuestions.ts
   ✓ src/lib/upload-diagnostics.ts
   ✓ Всички останали lib файлове

🔹 SRC/TYPES/:
   ✓ src/types/index.ts
   ✓ Всички TypeScript дефиниции

🔹 SRC/STYLES/:
   ✓ src/styles/theme.css

🔹 SRC/ASSETS/ (АКО СЪЩЕСТВУВА):
   ✓ Всички изображения, fonts, и др.

════════════════════════════════════════════════════════════════

💾 СТЪПКА 3: МЕТОДИ ЗА ЕКСПОРТ
------------------------------

МЕТОД 1: GitHub Spark Workbench Download
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. В Spark Workbench, отворете File Explorer
2. Изберете root директорията на проекта
3. Right-click → "Download" или използвайте Download бутон
4. Запазете ZIP локално

⚠️ ВНИМАНИЕ: Понякога Spark Workbench download не включва всички файлове!

МЕТОД 2: Git Clone (ПРЕПОРЪЧИТЕЛНО)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Намерете GitHub repository URL-а на проекта
2. В терминал изпълнете:
   
   git clone [repository-url]
   cd [project-name]

3. Вече имате ПЪЛНА локална копия

МЕТОД 3: Ръчно копиране файл по файл
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Отворете всеки файл в Spark IDE
2. Copy-paste съдържанието в локални файлове
3. Пресъздайте същата директорна структура

⚠️ Това е бавно, но гарантира 100% пълнота!

МЕТОД 4: Python Script (extract-project.py)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Ако имате extract-project.py в root:
1. Стартирайте го в Spark terminal
2. Той ще създаде ZIP с всички файлове

════════════════════════════════════════════════════════════════

🔄 СТЪПКА 4: СИНХРОНИЗАЦИЯ С GITHUB REPOSITORY
-----------------------------------------------
След като имате локално копие:

1. Клонирайте вашия GitHub repository (ако не сте):
   git clone [your-repo-url]
   cd [repo-name]

2. Копирайте ВСИЧКИ файлове от Spark експорта:
   cp -r [spark-export]/* .

3. Проверете промените:
   git status

4. Commit всички промени:
   git add .
   git commit -m "Manual sync: Full project export from Spark"

5. Push към GitHub:
   git push origin main

════════════════════════════════════════════════════════════════

✅ СТЪПКА 5: ВАЛИДАЦИЯ
-----------------------
След синхронизация, проверете:

□ package.json съдържа всички dependencies
□ Всички src/components/ директории са налични
□ Всички src/lib/ файлове са налични
□ index.html, vite.config.ts, tsconfig.json са налични
□ PRD.md и документационните файлове са налични

Тествайте локално:
npm install
npm run dev

Ако работи на http://localhost:5173 → SUCCESS! ✅

════════════════════════════════════════════════════════════════

🐛 TROUBLESHOOTING
------------------

ПРОБЛЕМ: "Module not found"
→ Проверете дали всички файлове от src/ са копирани

ПРОБЛЕМ: "Cannot find package"
→ Изпълнете: npm install

ПРОБЛЕМ: Build грешки
→ Проверете TypeScript конфигурацията (tsconfig.json)

ПРОБЛЕМ: Vite грешки
→ Проверете vite.config.ts и убедете се, че е коректен

════════════════════════════════════════════════════════════════

📞 ПОДДРЪЖКА
------------
При проблеми:
1. Проверете Export Log в админ панела
2. Сканирайте проекта за липсващи файлове
3. Използвайте Diagnostics екрана за system info

════════════════════════════════════════════════════════════════

Генерирано от AIRIS Admin Panel - Export Tab
${new Date().toLocaleString('bg-BG')}
`

    const blob = new Blob([instructions], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AIRIS-EXPORT-INSTRUCTIONS-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Инструкциите са изтеглени успешно!')
  }

  const exportFileList = () => {
    if (scannedFiles.length === 0) {
      toast.error('Първо сканирайте проекта')
      return
    }

    const fileList = `AIRIS Project - File List
Generated: ${new Date().toLocaleString('bg-BG')}
Total Files: ${scannedFiles.filter(f => f.type === 'file').length}
Total Directories: ${scannedFiles.filter(f => f.type === 'directory').length}

═══════════════════════════════════════════════════════════════

FILES:
${scannedFiles.filter(f => f.type === 'file').map(f => 
  `${f.path} ${f.size ? `(${(f.size / 1024).toFixed(2)} KB)` : ''}`
).join('\n')}

DIRECTORIES:
${scannedFiles.filter(f => f.type === 'directory').map(f => f.path).join('\n')}

═══════════════════════════════════════════════════════════════

Export Log:
${exportLog.join('\n')}
`

    const blob = new Blob([fileList], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AIRIS-FILE-LIST-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Списъкът с файлове е изтеглен!')
  }

  const exportInstructions = [
    {
      title: 'Достъп до кода',
      steps: [
        'Използвайте GitHub repository за достъп до кода',
        'Изтеглете детайлните инструкции с бутона "Инструкции за експорт"',
        'Следвайте стъпките за пълна синхронизация'
      ]
    },
    {
      title: 'Методи за експорт',
      steps: [
        'Git Clone - най-надежден метод (препоръчително)',
        'GitHub Download ZIP - бърз и надежден',
        'Ръчно копиране - бавен, но 100% гарантира пълнота'
      ]
    },
    {
      title: 'Локално тестване',
      steps: [
        'npm install - инсталира всички зависимости',
        'npm run dev - стартира dev сървър',
        'Проверка на http://localhost:5173'
      ]
    },
    {
      title: 'Синхронизация с GitHub',
      steps: [
        'git add . - добави всички промени',
        'git commit -m "Manual sync"',
        'git push origin main - синхронизирай с repository'
      ]
    }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <Package className="w-4 h-4 mr-2" />
            Общ преглед
          </TabsTrigger>
          <TabsTrigger value="scanner">
            <MagnifyingGlass className="w-4 h-4 mr-2" />
            Сканиране
          </TabsTrigger>
          <TabsTrigger value="github">
            <GitBranch className="w-4 h-4 mr-2" />
            GitHub
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                Експорт и Синхронизация
              </CardTitle>
              <CardDescription className="text-sm">
                Пълни инструкции за експорт на проекта и ръчна синхронизация с GitHub repository
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Използвайте тези инструменти за експорт и синхронизация на проекта.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3">
                <Button 
                  onClick={exportManualInstructions}
                  variant="default"
                  size="lg"
                  className="w-full"
                >
                  <DownloadSimple className="w-5 h-5 mr-2" />
                  Изтегли пълните инструкции за експорт
                </Button>

                <Button 
                  onClick={scanProjectFiles}
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                      Сканиране...
                    </>
                  ) : (
                    <>
                      <MagnifyingGlass className="w-5 h-5 mr-2" />
                      Сканирай проекта за файлове
                    </>
                  )}
                </Button>

                {scannedFiles.length > 0 && (
                  <Button 
                    onClick={exportFileList}
                    variant="outline"
                    size="lg"
                    className="w-full"
                  >
                    <FileCode className="w-5 h-5 mr-2" />
                    Изтегли списък с файлове
                  </Button>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  Структура на проекта:
                </h3>
                <ScrollArea className="h-[200px] rounded-md border p-3">
                  <div className="space-y-2">
                    {projectStructure.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-mono text-xs">{item.path}</span>
                          <span className="text-muted-foreground ml-2">- {item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Инструкции стъпка по стъпка:</h3>
                <div className="space-y-4">
                  {exportInstructions.map((section, idx) => (
                    <div key={idx} className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Badge variant="outline" className="rounded-full w-6 h-6 flex items-center justify-center p-0">
                          {idx + 1}
                        </Badge>
                        {section.title}
                      </h4>
                      <ul className="ml-8 space-y-1">
                        {section.steps.map((step, stepIdx) => (
                          <li key={stepIdx} className="text-sm text-muted-foreground list-disc">
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scanner" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MagnifyingGlass className="w-5 h-5 text-primary" />
                Сканиране на проекта
              </CardTitle>
              <CardDescription>
                Автоматично открий всички файлове в проекта
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={scanProjectFiles}
                disabled={isScanning}
                className="w-full"
                size="lg"
              >
                {isScanning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Сканиране в процес...
                  </>
                ) : (
                  <>
                    <MagnifyingGlass className="w-5 h-5 mr-2" />
                    Започни сканиране
                  </>
                )}
              </Button>

              {scannedFiles.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Открити файлове:</h4>
                      <Badge>
                        {scannedFiles.filter(f => f.type === 'file').length} файла, {scannedFiles.filter(f => f.type === 'directory').length} директории
                      </Badge>
                    </div>
                    <ScrollArea className="h-[300px] rounded-md border p-3">
                      <div className="space-y-1">
                        {scannedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs py-1">
                            {file.type === 'file' ? (
                              <File className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            ) : (
                              <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            )}
                            <span className="font-mono flex-1">{file.path}</span>
                            {file.size && (
                              <span className="text-muted-foreground">
                                {(file.size / 1024).toFixed(2)} KB
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <Button 
                    onClick={exportFileList}
                    variant="outline"
                    className="w-full"
                  >
                    <DownloadSimple className="w-4 h-4 mr-2" />
                    Изтегли списък
                  </Button>
                </>
              )}

              {exportLog.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Export Log:</h4>
                    <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
                      <div className="space-y-1 font-mono text-xs">
                        {exportLog.map((log, idx) => (
                          <div key={idx} className={
                            log.includes('✓') ? 'text-green-600' :
                            log.includes('✗') ? 'text-red-600' :
                            log.includes('📁') ? 'text-blue-600' :
                            'text-foreground'
                          }>
                            {log}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="github" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary" />
                GitHub Repository Sync
              </CardTitle>
              <CardDescription>
                Директен достъп и синхронизация с GitHub repository
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Препоръчан метод:</strong> Използвайте Git Clone за най-надеждна синхронизация
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Стъпки за Git Clone:</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Отворете GitHub repository</li>
                  <li>Копирайте repository URL (Code → HTTPS)</li>
                  <li>В терминал: <code className="bg-muted px-2 py-0.5 rounded text-xs">git clone [repo-url]</code></li>
                  <li>Влезте в директорията: <code className="bg-muted px-2 py-0.5 rounded text-xs">cd [repo-name]</code></li>
                  <li>Инсталирайте: <code className="bg-muted px-2 py-0.5 rounded text-xs">npm install</code></li>
                  <li>Стартирайте: <code className="bg-muted px-2 py-0.5 rounded text-xs">npm run dev</code></li>
                </ol>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Ръчна синхронизация:</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Копирайте всички файлове в локалния repo</li>
                  <li><code className="bg-muted px-2 py-0.5 rounded text-xs">git add .</code></li>
                  <li><code className="bg-muted px-2 py-0.5 rounded text-xs">git commit -m "Manual sync"</code></li>
                  <li><code className="bg-muted px-2 py-0.5 rounded text-xs">git push origin main</code></li>
                </ol>
              </div>

              <Separator />

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Съвет:</strong> След успешна синхронизация, можете да работите директно 
                  в локалния Git repository и да push-вате промените.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Troubleshooting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Проблем: "Cannot find module"</h4>
                <p className="text-xs text-muted-foreground">
                  → Проверете дали всички src/components/ и src/lib/ файлове са копирани
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Проблем: "Package not found"</h4>
                <p className="text-xs text-muted-foreground">
                  → Изпълнете <code className="bg-muted px-1 py-0.5 rounded">npm install</code> в проектната директория
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Проблем: Build errors</h4>
                <p className="text-xs text-muted-foreground">
                  → Проверете tsconfig.json и vite.config.ts дали са коректни
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Проблем: Git конфликти</h4>
                <p className="text-xs text-muted-foreground">
                  → Използвайте <code className="bg-muted px-1 py-0.5 rounded">git status</code> за преглед и 
                  resolve конфликтите ръчно или с <code className="bg-muted px-1 py-0.5 rounded">git mergetool</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
