import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import WelcomeScreen from '@/components/screens/WelcomeScreen'
import QuestionnaireScreen from '@/components/screens/QuestionnaireScreen'
import ImageUploadScreen from '@/components/screens/ImageUploadScreen'
import AnalysisScreen from '@/components/screens/AnalysisScreen'
import ReportScreen from '@/components/screens/ReportScreen'
import HistoryScreen from '@/components/screens/HistoryScreen'
import AdminScreen from '@/components/screens/AdminScreen'
import AboutAirisScreen from '@/components/screens/AboutAirisScreen'
import DiagnosticScreen from '@/components/screens/DiagnosticScreen'
import QuickDebugPanel from '@/components/QuickDebugPanel'
import { errorLogger } from '@/lib/error-logger'
import { estimateStorageUsage, estimateDataSize } from '@/lib/storage-utils'
import type { QuestionnaireData, IrisImage, AnalysisReport } from '@/types'

type Screen = 'welcome' | 'questionnaire' | 'upload' | 'analysis' | 'report' | 'history' | 'admin' | 'about' | 'diagnostics'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome')
  const [questionnaireData, setQuestionnaireData] = useKV<QuestionnaireData | null>('questionnaire-data', null)
  const leftIrisRef = useRef<IrisImage | null>(null)
  const rightIrisRef = useRef<IrisImage | null>(null)
  const [imagesReady, setImagesReady] = useState(false)
  const [analysisReport, setAnalysisReport] = useKV<AnalysisReport | null>('analysis-report', null)
  const [history, setHistory] = useKV<AnalysisReport[]>('analysis-history', [])
  const screenTransitionLockRef = useRef(false)

  useEffect(() => {
    errorLogger.info('APP_MOUNT', 'Application mounted successfully')
    
    estimateStorageUsage().then(usage => {
      if (usage > 80) {
        errorLogger.warning('APP_MOUNT', 'Storage usage is high', { usage: `${usage.toFixed(1)}%` })
        console.warn(`⚠️ [APP] Storage usage is high: ${usage.toFixed(1)}%`)
      }
    })
    
    return () => {
      errorLogger.info('APP_UNMOUNT', 'Application unmounting')
    }
  }, [])

  const handleStartAnalysis = () => {
    setCurrentScreen('questionnaire')
  }

  const handleViewHistory = () => {
    setCurrentScreen('history')
  }

  const handleAdminAccess = () => {
    setCurrentScreen('admin')
  }

  const handleAboutAccess = () => {
    setCurrentScreen('about')
  }

  const handleDiagnosticsAccess = () => {
    setCurrentScreen('diagnostics')
  }

  const handleTestStart = () => {
    if (questionnaireData) {
      setCurrentScreen('upload')
    }
  }

  const handleQuestionnaireComplete = (data: QuestionnaireData) => {
    setQuestionnaireData(() => data)
    setTimeout(() => setCurrentScreen('upload'), 50)
  }

  const handleImagesComplete = async (left: IrisImage, right: IrisImage) => {
    errorLogger.info('APP_IMAGES_COMPLETE', 'handleImagesComplete called', {
      leftSize: Math.round(left.dataUrl.length / 1024),
      rightSize: Math.round(right.dataUrl.length / 1024),
      currentScreen,
      lockStatus: screenTransitionLockRef.current
    })

    if (screenTransitionLockRef.current) {
      errorLogger.warning('APP_IMAGES_COMPLETE', 'Screen transition already in progress, ignoring duplicate call')
      return
    }
    
    try {
      screenTransitionLockRef.current = true
      errorLogger.info('APP_IMAGES_COMPLETE', 'Lock acquired, starting image processing')
      
      if (!left?.dataUrl || !right?.dataUrl) {
        throw new Error('Невалидни данни на изображенията')
      }

      if (!left.dataUrl.startsWith('data:image/') || !right.dataUrl.startsWith('data:image/')) {
        throw new Error('Невалиден формат на изображението')
      }

      const leftSize = estimateDataSize(left)
      const rightSize = estimateDataSize(right)
      const totalSize = leftSize + rightSize

      console.log(`📊 [APP] Total image data size: ${Math.round(totalSize / 1024)} KB`)
      console.log(`📊 [APP] Left image: ${Math.round(left.dataUrl.length / 1024)} KB`)
      console.log(`📊 [APP] Right image: ${Math.round(right.dataUrl.length / 1024)} KB`)

      if (left.dataUrl.length > 200 * 1024) {
        errorLogger.warning('APP_IMAGES_COMPLETE', 'Left image is too large', {
          size: Math.round(left.dataUrl.length / 1024)
        })
        toast.error('Лявото изображение е твърде голямо (>200KB). Моля, опитайте с по-малка снимка.')
        screenTransitionLockRef.current = false
        return
      }

      if (right.dataUrl.length > 200 * 1024) {
        errorLogger.warning('APP_IMAGES_COMPLETE', 'Right image is too large', {
          size: Math.round(right.dataUrl.length / 1024)
        })
        toast.error('Дясното изображение е твърде голямо (>200KB). Моля, опитайте с по-малка снимка.')
        screenTransitionLockRef.current = false
        return
      }

      const storageUsage = await estimateStorageUsage()
      if (storageUsage > 90) {
        const usagePercent = `${storageUsage.toFixed(1)}%`
        errorLogger.error('APP_IMAGES_COMPLETE', 'Storage is almost full', undefined, { usage: usagePercent })
        toast.error('Няма достатъчно място в паметта. Моля, изчистете стари анализи от историята.')
        screenTransitionLockRef.current = false
        return
      }

      errorLogger.info('APP_IMAGES_COMPLETE', 'Image validation successful')
      
      errorLogger.info('APP_IMAGES_COMPLETE', 'Saving images to refs (no re-render for large data)...')
      leftIrisRef.current = left
      rightIrisRef.current = right
      
      errorLogger.info('APP_IMAGES_COMPLETE', 'Waiting 100ms before screen transition for browser stabilization...')
      console.log('⏳ [APP] Buffer time - allowing browser to stabilize...')
      await sleep(100)
      
      errorLogger.info('APP_IMAGES_COMPLETE', 'Setting imagesReady flag and transitioning to analysis screen')
      console.log('🚀 [APP] Transitioning to analysis screen...')
      setImagesReady(true)
      setCurrentScreen('analysis')
      errorLogger.info('APP_IMAGES_COMPLETE', 'Screen transition completed')
      console.log('✅ [APP] Screen transition successful')
      
      setTimeout(() => {
        screenTransitionLockRef.current = false
        errorLogger.info('APP_IMAGES_COMPLETE', 'Lock released')
      }, 500)
    } catch (error) {
      screenTransitionLockRef.current = false
      errorLogger.error('APP_IMAGES_COMPLETE', 'Error processing images', error as Error, {
        leftValid: !!left?.dataUrl,
        rightValid: !!right?.dataUrl,
        leftSize: left?.dataUrl ? Math.round(left.dataUrl.length / 1024) : 0,
        rightSize: right?.dataUrl ? Math.round(right.dataUrl.length / 1024) : 0
      })
      console.error('❌ [APP] Error processing images:', error)
      toast.error('Грешка при обработка на изображенията. Опитайте отново.')
    }
  }

  const handleAnalysisComplete = (report: AnalysisReport) => {
    try {
      console.log('📝 [APP] Запазване на репорт...')
      console.log(`📊 [APP] Размер на репорт: ${JSON.stringify(report).length} символа`)
      console.log(`📊 [APP] Размер на ляво изображение: ${report.leftIrisImage.dataUrl.length} символа`)
      console.log(`📊 [APP] Размер на дясно изображение: ${report.rightIrisImage.dataUrl.length} символа`)
      
      console.log('💾 [APP] Записване на ПЪЛЕН репорт в currentReport (с изображения)...')
      setAnalysisReport(() => report)
      
      console.log('📋 [APP] Създаване на "лека" версия на репорт за история (БЕЗ изображения)...')
      const lightReport: AnalysisReport = {
        ...report,
        leftIrisImage: { dataUrl: '', side: 'left' },
        rightIrisImage: { dataUrl: '', side: 'right' }
      }
      
      console.log(`📊 [APP] Размер на "лек" репорт: ${JSON.stringify(lightReport).length} символа`)
      console.log('💾 [APP] Записване на "лек" репорт в история...')
      setHistory((current) => [lightReport, ...(current || [])])
      
      console.log('⏳ [APP] Малка пауза преди преминаване към report екран...')
      setTimeout(() => {
        console.log('🚀 [APP] Преминаване към report екран...')
        setCurrentScreen('report')
      }, 100)
    } catch (error) {
      console.error('❌ [APP] ГРЕШКА при запазване на репорт:', error)
      toast.error('Грешка при запазване на репорт')
    }
  }

  const handleViewReport = (report: AnalysisReport) => {
    try {
      setAnalysisReport(() => report)
      setTimeout(() => setCurrentScreen('report'), 50)
    } catch (error) {
      console.error('Грешка при показване на репорт:', error)
      toast.error('Грешка при показване на репорт')
    }
  }

  const handleRestart = () => {
    setQuestionnaireData(() => null)
    leftIrisRef.current = null
    rightIrisRef.current = null
    setImagesReady(false)
    setAnalysisReport(() => null)
    setTimeout(() => setCurrentScreen('welcome'), 50)
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      <QuickDebugPanel />
      <AnimatePresence mode="wait">
        {currentScreen === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <WelcomeScreen onStart={handleStartAnalysis} onViewHistory={handleViewHistory} onAdmin={handleAdminAccess} onTestStart={handleTestStart} onAbout={handleAboutAccess} onDiagnostics={handleDiagnosticsAccess} />
          </motion.div>
        )}
        {currentScreen === 'questionnaire' && (
          <motion.div
            key="questionnaire"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <QuestionnaireScreen onComplete={handleQuestionnaireComplete} initialData={questionnaireData || null} />
          </motion.div>
        )}
        {currentScreen === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ImageUploadScreen 
              onComplete={handleImagesComplete}
            />
          </motion.div>
        )}
        {currentScreen === 'analysis' && leftIrisRef.current && rightIrisRef.current && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AnalysisScreen
              questionnaireData={questionnaireData!}
              leftIris={leftIrisRef.current}
              rightIris={rightIrisRef.current}
              onComplete={handleAnalysisComplete}
            />
          </motion.div>
        )}
        {currentScreen === 'report' && analysisReport && (
          <motion.div
            key="report"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ReportScreen report={analysisReport} onRestart={handleRestart} />
          </motion.div>
        )}
        {currentScreen === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <HistoryScreen onViewReport={handleViewReport} onBack={() => setCurrentScreen('welcome')} />
          </motion.div>
        )}
        {currentScreen === 'admin' && (
          <motion.div
            key="admin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AdminScreen onBack={() => setCurrentScreen('welcome')} />
          </motion.div>
        )}
        {currentScreen === 'about' && (
          <motion.div
            key="about"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AboutAirisScreen onBack={() => setCurrentScreen('welcome')} />
          </motion.div>
        )}
        {currentScreen === 'diagnostics' && (
          <motion.div
            key="diagnostics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DiagnosticScreen onBack={() => setCurrentScreen('welcome')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
