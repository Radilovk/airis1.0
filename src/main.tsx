import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { autoRunStartupChecks } from './lib/startup-checks.ts'
import { errorLogger } from './lib/error-logger.ts'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

autoRunStartupChecks()

const handleError = (error: Error, errorInfo: { componentStack: string }) => {
  console.error('❌ [ERROR_BOUNDARY] ErrorBoundary caught error:', error)
  console.error('📍 [ERROR_BOUNDARY] Component stack:', errorInfo.componentStack)
  
  errorLogger.error(
    'ERROR_BOUNDARY',
    error.message,
    error,
    {
      componentStack: errorInfo.componentStack
    }
  )
  
  if (error.message.includes('useKV') || error.message.includes('storage') || error.message.includes('quota')) {
    console.error('⚠️ [ERROR_BOUNDARY] Storage related error detected! This might be caused by large images.')
    errorLogger.error('STORAGE_ERROR', 'Storage quota exceeded or KV error', error, {
      suggestion: 'Clear browser storage or use smaller images'
    })
  }
  
  if (error.message.includes('Canvas') || error.message.includes('canvas')) {
    console.error('⚠️ [ERROR_BOUNDARY] Canvas rendering error detected!')
    errorLogger.error('CANVAS_ERROR', 'Canvas rendering failed', error)
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback} onError={handleError}>
    <App />
   </ErrorBoundary>
)
