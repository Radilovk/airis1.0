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
  Warning,
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
  const [isExporting, setIsExporting] = useState(false)
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
    'README_BG.md',
    'CHANGELOG.md',
    'TROUBLESHOOTING.md',
    'AIRIS_KNOWLEDGE_README.md',
    'AI_CONFIGURATION_GUIDE.md',
    '.gitignore',
    'extract-project.py',
    'runtime.config.json',
    'spark.meta.json',
    'src/App.tsx',
    'src/index.css',
    'src/main.css',
    'src/main.tsx',
    'src/vite-end.d.ts',
    'src/ErrorFallback.tsx'
  ]

  const allSourceFiles = [
    'src/components/ui/accordion.tsx',
    'src/components/ui/alert-dialog.tsx',
    'src/components/ui/alert.tsx',
    'src/components/ui/aspect-ratio.tsx',
    'src/components/ui/avatar.tsx',
    'src/components/ui/badge.tsx',
    'src/components/ui/breadcrumb.tsx',
    'src/components/ui/button.tsx',
    'src/components/ui/calendar.tsx',
    'src/components/ui/card.tsx',
    'src/components/ui/carousel.tsx',
    'src/components/ui/chart.tsx',
    'src/components/ui/checkbox.tsx',
    'src/components/ui/collapsible.tsx',
    'src/components/ui/command.tsx',
    'src/components/ui/context-menu.tsx',
    'src/components/ui/dialog.tsx',
    'src/components/ui/drawer.tsx',
    'src/components/ui/dropdown-menu.tsx',
    'src/components/ui/form.tsx',
    'src/components/ui/hover-card.tsx',
    'src/components/ui/input-otp.tsx',
    'src/components/ui/input.tsx',
    'src/components/ui/label.tsx',
    'src/components/ui/menubar.tsx',
    'src/components/ui/navigation-menu.tsx',
    'src/components/ui/pagination.tsx',
    'src/components/ui/popover.tsx',
    'src/components/ui/progress.tsx',
    'src/components/ui/radio-group.tsx',
    'src/components/ui/resizable.tsx',
    'src/components/ui/scroll-area.tsx',
    'src/components/ui/select.tsx',
    'src/components/ui/separator.tsx',
    'src/components/ui/sheet.tsx',
    'src/components/ui/sidebar.tsx',
    'src/components/ui/skeleton.tsx',
    'src/components/ui/slider.tsx',
    'src/components/ui/sonner.tsx',
    'src/components/ui/switch.tsx',
    'src/components/ui/table.tsx',
    'src/components/ui/tabs.tsx',
    'src/components/ui/textarea.tsx',
    'src/components/ui/toggle-group.tsx',
    'src/components/ui/toggle.tsx',
    'src/components/ui/tooltip.tsx',
    'src/components/EditorModeIndicator.tsx',
    'src/components/ErrorFallback.tsx',
    'src/components/QuickDebugPanel.tsx',
    'src/components/admin/AIModelStrategyTab.tsx',
    'src/components/admin/AIPromptTab.tsx',
    'src/components/admin/ChangelogTab.tsx',
    'src/components/admin/EditorCommentsExport.tsx',
    'src/components/admin/EditorModeTab.tsx',
    'src/components/admin/IridologyManualTab.tsx',
    'src/components/admin/ProjectExportTab.tsx',
    'src/components/admin/QuestionnaireManager.tsx',
    'src/components/iris/IrisAnalysisCard.tsx',
    'src/components/iris/IrisImageViewer.tsx',
    'src/components/iris/IrisZoneChart.tsx',
    'src/components/iris/ZoneDetailsDialog.tsx',
    'src/components/report/AnalysisSection.tsx',
    'src/components/report/DiagnosisCard.tsx',
    'src/components/report/ExportReportDialog.tsx',
    'src/components/report/HealthScoreCard.tsx',
    'src/components/report/ReportHeader.tsx',
    'src/components/screens/AboutAirisScreen.tsx',
    'src/components/screens/AdminScreen.tsx',
    'src/components/screens/AnalysisScreen.tsx',
    'src/components/screens/DiagnosticScreen.tsx',
    'src/components/screens/HistoryScreen.tsx',
    'src/components/screens/ImageUploadScreen.tsx',
    'src/components/screens/QuestionnaireScreen.tsx',
    'src/components/screens/ReportScreen.tsx',
    'src/components/screens/WelcomeScreen.tsx',
    'src/hooks/use-mobile.ts',
    'src/hooks/use-editable-elements.ts',
    'src/hooks/use-deep-editable.ts',
    'src/lib/utils.ts',
    'src/lib/error-logger.ts',
    'src/lib/storage-utils.ts',
    'src/lib/storage-cleanup.ts',
    'src/lib/airis-knowledge.ts',
    'src/lib/default-prompts.ts',
    'src/lib/defaultQuestions.ts',
    'src/lib/upload-diagnostics.ts',
    'src/lib/iridology-zones.ts',
    'src/lib/iridology-manual.ts',
    'src/types/index.ts',
    'src/styles/theme.css'
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

  const createFullExport = async () => {
    setIsExporting(true)
    setExportLog([])
    addLog('🚀 Започване на ПЪЛЕН ЕКСПОРТ на проекта...')
    addLog('ℹ️ Генериране на инструкции за ръчен експорт...')

    const timestamp = new Date().toISOString().split('T')[0]
    const allFiles = [...criticalFiles, ...allSourceFiles]

    const detailedInstructions = `╔══════════════════════════════════════════════════════════════════╗
║          AIRIS - ИНСТРУКЦИИ ЗА ПЪЛЕН ЕКСПОРТ НА ПРОЕКТА          ║
╚══════════════════════════════════════════════════════════════════╝

📅 Дата на генериране: ${new Date().toLocaleString('bg-BG')}
📦 Общо файлове за експорт: ${allFiles.length}

═══════════════════════════════════════════════════════════════════

🎯 ЦЕЛ: Извличане на 100% от файловете на проекта за синхронизация

═══════════════════════════════════════════════════════════════════

📋 МЕТОД 1: GitHub Spark Workbench (ПРЕПОРЪЧИТЕЛНО)
────────────────────────────────────────────────────────────────────

1. Отворете GitHub Spark Dashboard
2. Намерете проекта "AIRIS Iridology App"
3. Кликнете "Open Workbench" (или "Open in VS Code")
4. В Workbench, отворете интегрирания терминал
5. Изпълнете следните команди:

   # Създаване на архив на целия проект
   tar -czf airis-full-export-${timestamp}.tar.gz \\
     --exclude=node_modules \\
     --exclude=.git \\
     --exclude=dist \\
     --exclude=.vite \\
     .

   # Или използвайте zip:
   zip -r airis-full-export-${timestamp}.zip . \\
     -x "node_modules/*" \\
     -x ".git/*" \\
     -x "dist/*" \\
     -x ".vite/*"

6. Изтеглете създадения архив
7. Разархивирайте локално

═══════════════════════════════════════════════════════════════════

📋 МЕТОД 2: Git Clone (НАЙ-ЛЕСЕН)
────────────────────────────────────────────────────────────────────

Ако проектът е свързан с GitHub repository:

1. Отворете GitHub Spark Dashboard
2. Намерете "View on GitHub" бутон
3. Копирайте repository URL
4. В локален терминал изпълнете:

   git clone [repository-url]
   cd [repository-name]
   npm install
   npm run dev

✅ ГОТОВО! Имате пълно 1:1 копие на проекта.

═══════════════════════════════════════════════════════════════════

📋 МЕТОД 3: Ръчно копиране през Workbench
────────────────────────────────────────────────────────────────────

1. Отворете GitHub Spark Workbench
2. Използвайте File Explorer в Workbench
3. Right-click на root папката → Download as ZIP
4. Разархивирайте локално

═══════════════════════════════════════════════════════════════════

📦 СПИСЪК НА ВСИЧКИ ФАЙЛОВЕ ЗА ЕКСПОРТ (${allFiles.length} файла):
────────────────────────────────────────────────────────────────────

📄 КРИТИЧНИ ROOT ФАЙЛОВЕ:
${criticalFiles.map(f => `   ✓ ${f}`).join('\n')}

📄 SOURCE ФАЙЛОВЕ:
${allSourceFiles.map(f => `   ✓ ${f}`).join('\n')}

📁 ДИРЕКТОРИИ:
${directories.map(d => `   📁 ${d}`).join('\n')}

═══════════════════════════════════════════════════════════════════

🔄 СТЪПКИ СЛЕД ЕКСПОРТ (СИНХРОНИЗАЦИЯ С GITHUB):
────────────────────────────────────────────────────────────────────

1. След като имате пълно локално копие, отворете терминал в проектната папка

2. Инициализирайте Git (ако не е):
   git init

3. Свържете с вашия GitHub repository:
   git remote add origin [your-repo-url]

4. Добавете всички файлове:
   git add .

5. Commit промените:
   git commit -m "Full sync: Complete 1:1 export from Spark"

6. Push към GitHub:
   git push -u origin main

   (или: git push -u origin master, ако използвате master branch)

═══════════════════════════════════════════════════════════════════

✅ ВАЛИДАЦИЯ НА ЕКСПОРТА:
────────────────────────────────────────────────────────────────────

След експорт, проверете дали следните файлове са налични:

□ index.html
□ package.json
□ package-lock.json
□ vite.config.ts
□ tsconfig.json
□ tailwind.config.js
□ PRD.md
□ README.md
□ src/App.tsx
□ src/index.css
□ src/main.tsx
□ src/components/ui/ (всички shadcn компоненти)
□ src/components/screens/ (всички екрани)
□ src/components/admin/ (админ панели)
□ src/hooks/ (всички hooks)
□ src/lib/ (всички библиотеки)
□ src/types/ (TypeScript типове)

═══════════════════════════════════════════════════════════════════

🧪 ТЕСТВАНЕ НА ЕКСПОРТИРАНИЯ ПРОЕКТ:
────────────────────────────────────────────────────────────────────

1. Влезте в проектната директория:
   cd airis-project

2. Инсталирайте dependencies:
   npm install

3. Стартирайте development сървър:
   npm run dev

4. Отворете браузър на:
   http://localhost:5173

5. Ако приложението работи → ✅ УСПЕШЕН ЕКСПОРТ!

═══════════════════════════════════════════════════════════════════

🐛 TROUBLESHOOTING:
────────────────────────────────────────────────────────────────────

ПРОБЛЕМ: "Cannot find module '@/components/...'"
РЕШЕНИЕ: Проверете дали src/components/ папката е напълно копирана

ПРОБЛЕМ: "Package not found"
РЕШЕНИЕ: npm install в проектната директория

ПРОБЛЕМ: TypeScript грешки
РЕШЕНИЕ: Проверете tsconfig.json и vite.config.ts

ПРОБЛЕМ: Vite не стартира
РЕШЕНИЕ: 
   - Изтрийте node_modules/ и package-lock.json
   - npm install
   - npm run dev

ПРОБЛЕМ: Липсващи изображения/assets
РЕШЕНИЕ: Проверете src/assets/ директорията

═══════════════════════════════════════════════════════════════════

📞 ДОПЪЛНИТЕЛНА ИНФОРМАЦИЯ:
────────────────────────────────────────────────────────────────────

• Общ размер на проекта: ~10-50 MB (без node_modules)
• Брой React компоненти: 60+
• Брой shadcn/ui компоненти: 45+
• Брой екрани: 9
• Брой admin панели: 7
• TypeScript файлове: 80+

═══════════════════════════════════════════════════════════════════

💡 ВАЖНИ ЗАБЕЛЕЖКИ:
────────────────────────────────────────────────────────────────────

1. НЕ експортирайте node_modules/ (прекалено голяма папка)
2. НЕ експортирайте .git/ (ще се създаде нов Git repo)
3. НЕ експортирайте dist/ (build artifacts)
4. НЕ експортирайте .vite/ (cache файлове)

Експортирайте САМО:
✓ Всички source файлове (src/)
✓ Конфигурационни файлове (root)
✓ Документация (.md файлове)
✓ Assets (src/assets/)

═══════════════════════════════════════════════════════════════════

📧 ПОДДРЪЖКА:
────────────────────────────────────────────────────────────────────

При проблеми с експорта или синхронизацията:

1. Използвайте Diagnostics екрана в Admin Panel
2. Проверете Export Log за грешки
3. Сканирайте проекта за липсващи файлове
4. Консултирайте се с GitHub Spark документацията

═══════════════════════════════════════════════════════════════════

Генерирано от: AIRIS Admin Panel - Project Export Tab
Версия: 2.0
Дата: ${new Date().toLocaleString('bg-BG')}

═══════════════════════════════════════════════════════════════════
`

    addLog('✅ Инструкциите са генерирани успешно')
    addLog('💾 Създаване на текстов файл...')

    try {
      const blob = new Blob([detailedInstructions], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `AIRIS-FULL-EXPORT-INSTRUCTIONS-${timestamp}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      addLog(`✅ ЕКСПОРТ ЗАВЪРШЕН!`)
      addLog(`📄 Файл: AIRIS-FULL-EXPORT-INSTRUCTIONS-${timestamp}.txt`)
      addLog(`📊 Размер: ${(blob.size / 1024).toFixed(2)} KB`)
      addLog(``)
      addLog(`ℹ️ ВАЖНО: Този файл съдържа детайлни инструкции`)
      addLog(`ℹ️ как да извлечете ВСИЧКИ файлове от Spark Workbench`)
      addLog(`ℹ️ и да ги синхронизирате с GitHub repository.`)
      addLog(``)
      addLog(`📋 ПРЕПОРЪЧАН МЕТОД:`)
      addLog(`   1. Отворете GitHub Spark Workbench`)
      addLog(`   2. Използвайте 'git clone' или 'tar/zip' команди`)
      addLog(`   3. Следвайте стъпките в изтегления файл`)

      toast.success('Инструкциите са готови!', {
        description: 'Следвайте стъпките в изтегления файл за пълен експорт'
      })
    } catch (error) {
      addLog(`❌ ГРЕШКА: ${error}`)
      toast.error('Грешка при създаване на файла')
    }

    setIsExporting(false)
  }

  const scanProjectFiles = async () => {
    setIsScanning(true)
    setScannedFiles([])
    setExportLog([])
    addLog('🔍 Започване на инвентаризация на проекта...')

    const files: FileStructure[] = []
    const allFiles = [...criticalFiles, ...allSourceFiles]

    addLog(`📊 Общо файлове в проекта: ${allFiles.length}`)
    addLog(`📁 Общо директории: ${directories.length}`)
    addLog(``)

    let estimatedSize = 0

    for (const file of allFiles) {
      const ext = file.split('.').pop()?.toLowerCase()
      let sizeEstimate = 10 * 1024
      
      if (ext === 'tsx' || ext === 'ts') sizeEstimate = 15 * 1024
      if (ext === 'css') sizeEstimate = 5 * 1024
      if (ext === 'json') sizeEstimate = 8 * 1024
      if (ext === 'md') sizeEstimate = 20 * 1024
      
      files.push({ path: file, type: 'file', size: sizeEstimate })
      estimatedSize += sizeEstimate
      addLog(`✓ ${file}`)
    }

    addLog(``)
    for (const dir of directories) {
      addLog(`📁 Директория: ${dir}`)
      files.push({ path: dir, type: 'directory' })
    }

    setScannedFiles(files)
    addLog(``)
    addLog(`✅ Инвентаризация завършена`)
    addLog(`📄 Файлове: ${files.filter(f => f.type === 'file').length}`)
    addLog(`📁 Директории: ${files.filter(f => f.type === 'directory').length}`)
    addLog(`📊 Приблизителен размер: ~${(estimatedSize / 1024 / 1024).toFixed(2)} MB`)
    addLog(``)
    addLog(`ℹ️ За РЕАЛЕН експорт използвайте GitHub Spark Workbench`)
    setIsScanning(false)
    
    toast.success(`Инвентаризирани ${files.filter(f => f.type === 'file').length} файла`, {
      description: `Приблизителен размер: ~${(estimatedSize / 1024 / 1024).toFixed(2)} MB`
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
        'Използвайте GitHub Spark Workbench за пълен достъп',
        'Изтеглете детайлните инструкции с бутона "Инструкции за експорт"',
        'Следвайте стъпките за пълна синхронизация'
      ]
    },
    {
      title: 'Методи за експорт',
      steps: [
        'Git Clone - най-надежден метод (препоръчително)',
        'Spark Workbench Download - бърз, но понякога непълен',
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
        'git commit -m "Manual sync from Spark"',
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
      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="export">
            <DownloadSimple className="w-4 h-4 mr-2" />
            Инструкции
          </TabsTrigger>
          <TabsTrigger value="overview">
            <Package className="w-4 h-4 mr-2" />
            Методи
          </TabsTrigger>
          <TabsTrigger value="scanner">
            <MagnifyingGlass className="w-4 h-4 mr-2" />
            Файлове
          </TabsTrigger>
          <TabsTrigger value="github">
            <GitBranch className="w-4 h-4 mr-2" />
            GitHub
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <DownloadSimple className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                Пълен Експорт - Инструкции
              </CardTitle>
              <CardDescription className="text-sm">
                Генерирай детайлни инструкции за извличане на ВСИЧКИ файлове от Spark Workbench
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Нов метод:</strong> Тази функция генерира детайлни инструкции за извличане 
                  на ВСИЧКИ файлове от Spark Workbench и синхронизация с GitHub repository. 
                  Браузърите не позволяват директен достъп до файловата система на Spark.
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-semibold text-sm">Как да получите пълен 1:1 експорт:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Изтеглете детайлните инструкции (бутонът по-долу)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Отворете GitHub Spark Workbench с пълен достъп до файловете</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Използвайте git clone (препоръчително) или tar/zip команди в терминала</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Алтернативно: изтеглете целия проект чрез Workbench UI</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Синхронизирайте с вашия GitHub repository чрез git push</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div className="space-y-3">
                <Button 
                  onClick={createFullExport}
                  disabled={isExporting}
                  size="lg"
                  className="w-full"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Генериране на инструкции...
                    </>
                  ) : (
                    <>
                      <DownloadSimple className="w-5 h-5 mr-2" />
                      Изтегли инструкции за пълен експорт
                    </>
                  )}
                </Button>

                {isExporting && (
                  <div className="text-sm text-muted-foreground text-center">
                    Подготовка на детайлни инструкции за всички {[...criticalFiles, ...allSourceFiles].length} файла...
                  </div>
                )}
              </div>

              {exportLog.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Export Log:</h4>
                    <ScrollArea className="h-[300px] rounded-md border p-3 bg-muted/30">
                      <div className="space-y-1 font-mono text-xs">
                        {exportLog.map((log, idx) => (
                          <div key={idx} className={
                            log.includes('✓') || log.includes('✅') ? 'text-green-600' :
                            log.includes('✗') || log.includes('❌') ? 'text-red-600' :
                            log.includes('📁') || log.includes('📦') || log.includes('📊') ? 'text-blue-600' :
                            log.includes('🚀') ? 'text-purple-600' :
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

              <Separator />

              <Alert variant="default" className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong>Защо този метод:</strong> Браузърите нямат директен достъп до Spark файловата система. 
                  Този метод генерира прецизни инструкции как да извлечете всички файлове през Workbench 
                  и да ги синхронизирате с GitHub.
                </AlertDescription>
              </Alert>

              <div className="p-3 bg-muted/30 rounded-lg space-y-2 text-xs">
                <p className="font-semibold">ПРЕПОРЪЧАНИ МЕТОДИ (от инструкциите):</p>
                <div className="space-y-1 ml-2">
                  <p>🥇 <strong>Метод 1:</strong> git clone [repo-url] (НАЙ-ЛЕСЕН)</p>
                  <p>🥈 <strong>Метод 2:</strong> tar/zip команди в Spark терминал</p>
                  <p>🥉 <strong>Метод 3:</strong> Download от Workbench UI</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                Методи за експорт
              </CardTitle>
              <CardDescription className="text-sm">
                Различни начини за извличане на файловете и синхронизация с GitHub
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Важно:</strong> Автоматичната синхронизация между Spark и GitHub repository може да е нарушена. 
                  Използвайте тези инструменти за пълен експорт и ръчна синхронизация.
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
                Инвентаризация на проекта
              </CardTitle>
              <CardDescription>
                Преглед на всички файлове и директории в проекта
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
                    Инвентаризация в процес...
                  </>
                ) : (
                  <>
                    <MagnifyingGlass className="w-5 h-5 mr-2" />
                    Покажи всички файлове
                  </>
                )}
              </Button>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Този инструмент показва списък на всички файлове в проекта 
                  с приблизителни размери. За реален експорт използвайте Workbench.
                </AlertDescription>
              </Alert>

              {scannedFiles.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Файлове в проекта:</h4>
                      <Badge>
                        {scannedFiles.filter(f => f.type === 'file').length} файла, {scannedFiles.filter(f => f.type === 'directory').length} директории
                      </Badge>
                    </div>
                    <Alert className="text-xs">
                      <Info className="h-3 w-3" />
                      <AlertDescription>
                        Приблизителни размери. Реалните размери ще видите при експорт.
                      </AlertDescription>
                    </Alert>
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
                                ~{(file.size / 1024).toFixed(1)} KB
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
                  <li>Отворете GitHub Spark Dashboard</li>
                  <li>Намерете "View on GitHub" линк за проекта</li>
                  <li>Копирайте repository URL</li>
                  <li>В терминал: <code className="bg-muted px-2 py-0.5 rounded text-xs">git clone [repo-url]</code></li>
                  <li>Влезте в директорията: <code className="bg-muted px-2 py-0.5 rounded text-xs">cd [repo-name]</code></li>
                  <li>Инсталирайте: <code className="bg-muted px-2 py-0.5 rounded text-xs">npm install</code></li>
                  <li>Стартирайте: <code className="bg-muted px-2 py-0.5 rounded text-xs">npm run dev</code></li>
                </ol>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Ръчна синхронизация (ако auto-sync е нарушена):</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Експортирайте всички файлове от Spark Workbench</li>
                  <li>Клонирайте вашия GitHub repository локално</li>
                  <li>Копирайте всички файлове от Spark експорта в локалния repo</li>
                  <li><code className="bg-muted px-2 py-0.5 rounded text-xs">git add .</code></li>
                  <li><code className="bg-muted px-2 py-0.5 rounded text-xs">git commit -m "Manual sync from Spark"</code></li>
                  <li><code className="bg-muted px-2 py-0.5 rounded text-xs">git push origin main</code></li>
                </ol>
              </div>

              <Separator />

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Съвет:</strong> След успешна синхронизация, можете да работите директно 
                  в локалния Git repository и да push-вате промените. GitHub Spark може да се използва 
                  само за бърза разработка, а production кодът да се управлява през Git.
                </p>
              </div>

              <Alert variant="destructive">
                <Warning className="h-4 w-4" />
                <AlertDescription>
                  <strong>Внимание:</strong> Ако правите промени едновременно в Spark и локално, 
                  ще имате конфликти. Изберете един основен източник на истина - или Spark, или Git.
                </AlertDescription>
              </Alert>
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
