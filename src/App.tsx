import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import WelcomeScreen from '@/components/screens/WelcomeScreen'
import QuestionnaireScreen from '@/components/screens/QuestionnaireScreen'
import ImageUploadScreen from '@/components/screens/ImageUploadScreen'
import QuickDebugPanel from '@/components/QuickDebugPanel'
import { errorLogger } from '@/lib/error-logger'
import { uploadDiagnostics } from '@/lib/upload-diagnostics'
import { estimateStorageUsage, estimateDataSize } from '@/lib/storage-utils'
import { CHUNK_RELOAD_KEY } from '@/ErrorFallback'
import type { QuestionnaireData, IrisImage, AnalysisReport } from '@/types'

// Lazy load heavy components
const AnalysisScreen = lazy(() => import('@/components/screens/AnalysisScreen'))
const ReportScreen = lazy(() => import('@/components/screens/ReportScreen'))
const HistoryScreen = lazy(() => import('@/components/screens/HistoryScreen'))
const AdminScreen = lazy(() => import('@/components/screens/AdminScreen'))
const AboutAirisScreen = lazy(() => import('@/components/screens/AboutAirisScreen'))
const DiagnosticScreen = lazy(() => import('@/components/screens/DiagnosticScreen'))

// Loading component for lazy loaded screens
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Зареждане...</p>
    </div>
  </div>
)

type Screen = 'welcome' | 'questionnaire' | 'upload' | 'analysis' | 'report' | 'history' | 'settings' | 'about' | 'diagnostics'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome')
  const [questionnaireData, setQuestionnaireData] = useKVWithFallback<QuestionnaireData | null>('questionnaire-data', null)
  const leftIrisRef = useRef<IrisImage | null>(null)
  const rightIrisRef = useRef<IrisImage | null>(null)
  const [imagesReady, setImagesReady] = useState(false)
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null)
  const [history, setHistory] = useKVWithFallback<AnalysisReport[]>('analysis-history', [])
  const screenTransitionLockRef = useRef(false)
  const [isReanalysis, setIsReanalysis] = useState(false)

  useEffect(() => {
    errorLogger.info('APP_MOUNT', 'Application mounted successfully')
    
    const initializeApp = async () => {
      try {
        const { autoCleanupOnStartup } = await import('@/lib/storage-cleanup')
        const cleanupResult = await autoCleanupOnStartup()
        
        if (cleanupResult.cleaned > 0) {
          console.log(`✅ [APP] Автоматично изтрити ${cleanupResult.cleaned} стари изображения от storage`)
          errorLogger.info('APP_CLEANUP', `Auto-cleaned ${cleanupResult.cleaned} old images from storage`)
        }
      } catch (error) {
        console.error('❌ [APP] Грешка при auto-cleanup:', error)
      }
      
      estimateStorageUsage().then(usage => {
        if (usage > 80) {
          errorLogger.warning('APP_MOUNT', 'Storage usage is high', { usage: `${usage.toFixed(1)}%` })
          console.warn(`⚠️ [APP] Storage usage is high: ${usage.toFixed(1)}%`)
        }
      })
    }
    
    initializeApp()
    
    // Clear chunk-reload guard so future deployments can trigger auto-reload again
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    
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
    console.log('🔓 [APP] Admin access requested - granting access to settings panel')
    console.log('🔓 [APP] No ownership checks - all users can access settings')
    setCurrentScreen('settings')
    toast.success('Отваряне на настройките...', {
      description: 'Достъпът е разрешен за всички потребители',
      duration: 2000
    })
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
    uploadDiagnostics.log('APP_HANDLE_IMAGES_COMPLETE_START', 'start', {
      leftExists: !!left,
      rightExists: !!right,
      leftType: typeof left,
      rightType: typeof right,
      leftIsNull: left === null,
      rightIsNull: right === null,
      leftIsUndefined: left === undefined,
      rightIsUndefined: right === undefined
    })
    
    console.log('🔍 [APP] ========== handleImagesComplete CALLED ==========')
    console.log('🔍 [APP] left parameter:', left)
    console.log('🔍 [APP] right parameter:', right)
    console.log('🔍 [APP] left type:', typeof left)
    console.log('🔍 [APP] right type:', typeof right)
    console.log('🔍 [APP] left is null?', left === null)
    console.log('🔍 [APP] right is null?', right === null)
    console.log('🔍 [APP] left is undefined?', left === undefined)
    console.log('🔍 [APP] right is undefined?', right === undefined)
    
    if (!left || !right) {
      uploadDiagnostics.log('APP_IMAGES_COMPLETE_ERROR_MISSING_PARAMS', 'error', {
        left: !!left,
        right: !!right,
        leftType: typeof left,
        rightType: typeof right
      })
      errorLogger.error('APP_IMAGES_COMPLETE', 'CRITICAL: left or right parameter is null/undefined!', undefined, {
        left: !!left,
        right: !!right,
        leftType: typeof left,
        rightType: typeof right
      })
      console.error('❌ [APP] CRITICAL ERROR: left or right is null/undefined!')
      toast.error('Критична грешка: Липсват изображенията')
      return
    }
    
    if (!left.dataUrl || !right.dataUrl) {
      uploadDiagnostics.log('APP_IMAGES_COMPLETE_ERROR_MISSING_DATA_URL', 'error', {
        leftHasDataUrl: !!left?.dataUrl,
        rightHasDataUrl: !!right?.dataUrl,
        leftDataUrlType: typeof left?.dataUrl,
        rightDataUrlType: typeof right?.dataUrl
      })
      errorLogger.error('APP_IMAGES_COMPLETE', 'CRITICAL: dataUrl is missing from images!', undefined, {
        leftHasDataUrl: !!left?.dataUrl,
        rightHasDataUrl: !!right?.dataUrl,
        leftDataUrlType: typeof left?.dataUrl,
        rightDataUrlType: typeof right?.dataUrl
      })
      console.error('❌ [APP] CRITICAL ERROR: dataUrl is missing!')
      console.error('❌ [APP] left.dataUrl:', left?.dataUrl ? 'exists' : 'MISSING')
      console.error('❌ [APP] right.dataUrl:', right?.dataUrl ? 'exists' : 'MISSING')
      toast.error('Критична грешка: Невалидни данни на изображенията')
      return
    }
    
    uploadDiagnostics.log('APP_IMAGES_COMPLETE_VALIDATION_SUCCESS', 'success', {
      leftSize: Math.round(left.dataUrl.length / 1024),
      rightSize: Math.round(right.dataUrl.length / 1024),
      leftSide: left.side,
      rightSide: right.side,
      currentScreen,
      lockStatus: screenTransitionLockRef.current
    })
    
    errorLogger.info('APP_IMAGES_COMPLETE', 'handleImagesComplete called with VALID images', {
      leftSize: Math.round(left.dataUrl.length / 1024),
      rightSize: Math.round(right.dataUrl.length / 1024),
      leftSide: left.side,
      rightSide: right.side,
      currentScreen,
      lockStatus: screenTransitionLockRef.current
    })

    if (screenTransitionLockRef.current) {
      uploadDiagnostics.log('APP_IMAGES_COMPLETE_DUPLICATE_CALL', 'warning')
      errorLogger.warning('APP_IMAGES_COMPLETE', 'Screen transition already in progress, ignoring duplicate call')
      return
    }
    
    try {
      screenTransitionLockRef.current = true
      uploadDiagnostics.log('APP_LOCK_ACQUIRED', 'info')
      errorLogger.info('APP_IMAGES_COMPLETE', 'Lock acquired, starting image processing')
      
      if (!left?.dataUrl || !right?.dataUrl) {
        const error = new Error('Невалидни данни на изображенията')
        uploadDiagnostics.log('APP_VALIDATION_ERROR_NO_DATA_URL', 'error', undefined, error)
        throw error
      }

      if (!left.dataUrl.startsWith('data:image/') || !right.dataUrl.startsWith('data:image/')) {
        const error = new Error('Невалиден формат на изображението')
        uploadDiagnostics.log('APP_VALIDATION_ERROR_INVALID_FORMAT', 'error', {
          leftStartsWith: left.dataUrl.substring(0, 20),
          rightStartsWith: right.dataUrl.substring(0, 20)
        }, error)
        throw error
      }

      const leftSize = estimateDataSize(left)
      const rightSize = estimateDataSize(right)
      const totalSize = leftSize + rightSize

      uploadDiagnostics.log('APP_SIZE_CHECK', 'info', {
        totalSizeKB: Math.round(totalSize / 1024),
        leftSizeKB: Math.round(left.dataUrl.length / 1024),
        rightSizeKB: Math.round(right.dataUrl.length / 1024)
      })

      console.log(`📊 [APP] Total image data size: ${Math.round(totalSize / 1024)} KB`)
      console.log(`📊 [APP] Left image: ${Math.round(left.dataUrl.length / 1024)} KB`)
      console.log(`📊 [APP] Right image: ${Math.round(right.dataUrl.length / 1024)} KB`)

      if (left.dataUrl.length > 400 * 1024) {
        uploadDiagnostics.log('APP_ERROR_LEFT_TOO_LARGE', 'error', {
          size: Math.round(left.dataUrl.length / 1024)
        })
        errorLogger.warning('APP_IMAGES_COMPLETE', 'Left image is too large', {
          size: Math.round(left.dataUrl.length / 1024)
        })
        toast.error('Лявото изображение е твърде голямо (>400KB). Моля, опитайте с по-малка снимка.')
        screenTransitionLockRef.current = false
        return
      }

      if (right.dataUrl.length > 400 * 1024) {
        uploadDiagnostics.log('APP_ERROR_RIGHT_TOO_LARGE', 'error', {
          size: Math.round(right.dataUrl.length / 1024)
        })
        errorLogger.warning('APP_IMAGES_COMPLETE', 'Right image is too large', {
          size: Math.round(right.dataUrl.length / 1024)
        })
        toast.error('Дясното изображение е твърде голямо (>400KB). Моля, опитайте с по-малка снимка.')
        screenTransitionLockRef.current = false
        return
      }

      const storageUsage = await estimateStorageUsage()
      uploadDiagnostics.log('APP_STORAGE_CHECK', 'info', {
        storageUsage: storageUsage.toFixed(1)
      })
      
      if (storageUsage > 90) {
        const usagePercent = `${storageUsage.toFixed(1)}%`
        uploadDiagnostics.log('APP_ERROR_STORAGE_FULL', 'error', { usage: usagePercent })
        errorLogger.error('APP_IMAGES_COMPLETE', 'Storage is almost full', undefined, { usage: usagePercent })
        toast.error('Няма достатъчно място в паметта. Моля, изчистете стари анализи от историята.')
        screenTransitionLockRef.current = false
        return
      }

      uploadDiagnostics.log('APP_VALIDATION_COMPLETE', 'success')
      errorLogger.info('APP_IMAGES_COMPLETE', 'Image validation successful')
      
      uploadDiagnostics.log('APP_SAVING_TO_REFS', 'start')
      errorLogger.info('APP_IMAGES_COMPLETE', 'Saving images to refs...')
      leftIrisRef.current = left
      rightIrisRef.current = right
      uploadDiagnostics.log('APP_SAVED_TO_REFS', 'success')
      
      errorLogger.info('APP_IMAGES_COMPLETE', 'Forcing garbage collection hint...')
      if (typeof window !== 'undefined' && 'gc' in window && typeof (window as any).gc === 'function') {
        try {
          (window as any).gc()
          console.log('🗑️ [APP] Manual GC triggered')
        } catch (e) {
          console.log('ℹ️ [APP] Manual GC not available (expected in production)')
        }
      }
      
      uploadDiagnostics.log('APP_WAITING_MEMORY_STABILIZATION', 'info')
      errorLogger.info('APP_IMAGES_COMPLETE', 'Waiting 200ms for memory stabilization...')
      console.log('⏳ [APP] Buffer time - allowing browser to stabilize memory...')
      await sleep(200)
      
      uploadDiagnostics.log('APP_SET_IMAGES_READY', 'info')
      errorLogger.info('APP_IMAGES_COMPLETE', 'Setting imagesReady flag')
      setImagesReady(true)
      
      await sleep(50)
      
      uploadDiagnostics.log('APP_TRANSITION_TO_ANALYSIS', 'start')
      errorLogger.info('APP_IMAGES_COMPLETE', 'Transitioning to analysis screen')
      console.log('🚀 [APP] Transitioning to analysis screen...')
      setCurrentScreen('analysis')
      uploadDiagnostics.log('APP_TRANSITION_COMPLETE', 'success')
      errorLogger.info('APP_IMAGES_COMPLETE', 'Screen transition completed')
      console.log('✅ [APP] Screen transition successful')
      
      setTimeout(() => {
        screenTransitionLockRef.current = false
        uploadDiagnostics.log('APP_LOCK_RELEASED', 'info')
        errorLogger.info('APP_IMAGES_COMPLETE', 'Lock released')
      }, 1000)
    } catch (error) {
      screenTransitionLockRef.current = false
      uploadDiagnostics.log('APP_IMAGES_COMPLETE_ERROR', 'error', {
        leftValid: !!left?.dataUrl,
        rightValid: !!right?.dataUrl,
        leftSize: left?.dataUrl ? Math.round(left.dataUrl.length / 1024) : 0,
        rightSize: right?.dataUrl ? Math.round(right.dataUrl.length / 1024) : 0,
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)
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
      
      console.log('💾 [APP] Записване на ПЪЛЕН репорт в STATE (НЕ в storage, само в памет)...')
      setAnalysisReport(report)
      
      console.log('📋 [APP] Създаване на "лека" версия на репорт за история (БЕЗ изображения)...')
      const lightReport: AnalysisReport = {
        ...report,
        leftIrisImage: { dataUrl: '', side: 'left' },
        rightIrisImage: { dataUrl: '', side: 'right' }
      }
      
      console.log(`📊 [APP] Размер на "лек" репорт: ${JSON.stringify(lightReport).length} символа`)
      console.log('💾 [APP] Записване на "лек" репорт в история (persistent storage)...')
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
      setAnalysisReport(report)
      setTimeout(() => setCurrentScreen('report'), 50)
    } catch (error) {
      console.error('Грешка при показване на репорт:', error)
      toast.error('Грешка при показване на репорт')
    }
  }

  const handleRestart = () => {
    setIsReanalysis(false)
    setQuestionnaireData(null)
    leftIrisRef.current = null
    rightIrisRef.current = null
    setImagesReady(false)
    setAnalysisReport(null)
    setTimeout(() => setCurrentScreen('welcome'), 50)
  }

  const handleReanalyze = (report?: AnalysisReport) => {
    try {
      // Set reanalysis flag
      setIsReanalysis(true)
      
      // If report is provided, use its questionnaire data
      if (report) {
        setQuestionnaireData(report.questionnaireData)
        
        // Check if the current report has iris images
        if (analysisReport && 
            analysisReport.id === report.id && 
            analysisReport.leftIrisImage?.dataUrl && 
            analysisReport.rightIrisImage?.dataUrl) {
          // We have the images in memory, reuse them
          leftIrisRef.current = analysisReport.leftIrisImage
          rightIrisRef.current = analysisReport.rightIrisImage
          setImagesReady(true)
          
          // Skip to analysis
          setTimeout(() => setCurrentScreen('analysis'), 50)
          toast.success('Започване на повторен анализ с текущите изображения')
        } else {
          // No images available, need to upload new ones
          setTimeout(() => setCurrentScreen('upload'), 50)
          toast.info('Моля, качете изображения на ириси за повторен анализ')
        }
      } else if (analysisReport && 
                 analysisReport.leftIrisImage?.dataUrl && 
                 analysisReport.rightIrisImage?.dataUrl) {
        // Re-analyze current report with existing images
        leftIrisRef.current = analysisReport.leftIrisImage
        rightIrisRef.current = analysisReport.rightIrisImage
        setImagesReady(true)
        setQuestionnaireData(analysisReport.questionnaireData)
        setTimeout(() => setCurrentScreen('analysis'), 50)
        toast.success('Започване на повторен анализ')
      } else {
        // No images available at all, go to upload
        setTimeout(() => setCurrentScreen('upload'), 50)
        toast.info('Моля, качете изображения на ириси за повторен анализ')
      }
    } catch (error) {
      console.error('Грешка при стартиране на повторен анализ:', error)
      toast.error('Грешка при стартиране на повторен анализ')
      setIsReanalysis(false)
    }
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
              isReanalysis={isReanalysis}
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
            <Suspense fallback={<LoadingScreen />}>
              <AnalysisScreen
                questionnaireData={questionnaireData!}
                leftIris={leftIrisRef.current}
                rightIris={rightIrisRef.current}
                onComplete={handleAnalysisComplete}
              />
            </Suspense>
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
            <Suspense fallback={<LoadingScreen />}>
              <ReportScreen report={analysisReport} onRestart={handleRestart} onReanalyze={handleReanalyze} />
            </Suspense>
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
            <Suspense fallback={<LoadingScreen />}>
              <HistoryScreen onViewReport={handleViewReport} onBack={() => setCurrentScreen('welcome')} onReanalyze={handleReanalyze} />
            </Suspense>
          </motion.div>
        )}
        {currentScreen === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Suspense fallback={<LoadingScreen />}>
              <AdminScreen onBack={() => setCurrentScreen('welcome')} />
            </Suspense>
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
            <Suspense fallback={<LoadingScreen />}>
              <AboutAirisScreen onBack={() => setCurrentScreen('welcome')} />
            </Suspense>
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
            <Suspense fallback={<LoadingScreen />}>
              <DiagnosticScreen onBack={() => setCurrentScreen('welcome')} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
