import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from '@/components/ui/sonner'
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
import type { QuestionnaireData, IrisImage, AnalysisReport } from '@/types'

type Screen = 'welcome' | 'questionnaire' | 'upload' | 'analysis' | 'report' | 'history' | 'admin' | 'about' | 'diagnostics'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome')
  const [questionnaireData, setQuestionnaireData] = useKV<QuestionnaireData | null>('questionnaire-data', null)
  const [leftIris, setLeftIris] = useState<IrisImage | null>(null)
  const [rightIris, setRightIris] = useState<IrisImage | null>(null)
  const [analysisReport, setAnalysisReport] = useKV<AnalysisReport | null>('analysis-report', null)
  const [history, setHistory] = useKV<AnalysisReport[]>('analysis-history', [])

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
    setQuestionnaireData(data)
    setCurrentScreen('upload')
  }

  const handleImagesComplete = (left: IrisImage, right: IrisImage) => {
    setLeftIris(left)
    setRightIris(right)
    setCurrentScreen('analysis')
  }

  const handleAnalysisComplete = (report: AnalysisReport) => {
    setAnalysisReport(report)
    setHistory((current) => [report, ...(current || [])])
    setCurrentScreen('report')
  }

  const handleViewReport = (report: AnalysisReport) => {
    setAnalysisReport(report)
    setCurrentScreen('report')
  }

  const handleRestart = () => {
    setQuestionnaireData(null)
    setLeftIris(null)
    setRightIris(null)
    setAnalysisReport(null)
    setCurrentScreen('welcome')
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
              initialLeft={leftIris || null}
              initialRight={rightIris || null}
            />
          </motion.div>
        )}
        {currentScreen === 'analysis' && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AnalysisScreen
              questionnaireData={questionnaireData!}
              leftIris={leftIris!}
              rightIris={rightIris!}
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
