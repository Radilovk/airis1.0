interface ErrorLog {
  timestamp: string
  type: 'error' | 'warning' | 'info'
  context: string
  message: string
  stack?: string
  data?: any
}

// Extend window type to include spark.kv
declare global {
  interface Window {
    spark?: {
      kv?: {
        get<T = any>(key: string): Promise<T | null>
        set<T = any>(key: string, value: T): Promise<void>
        delete(key: string): Promise<void>
      }
    }
  }
}

class ErrorLogger {
  private logs: ErrorLog[] = []
  private maxLogs = 50 // Reduced from 100 to 50

  log(type: ErrorLog['type'], context: string, message: string, data?: any, error?: Error) {
    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      type,
      context,
      message,
      stack: error?.stack,
      data
    }

    this.logs.push(log)
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    const emoji = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'
    console.log(`${emoji} [${context}] ${message}`, data || '')
    
    if (error) {
      console.error(`Stack trace:`, error.stack)
    }

    this.persistLogs()
  }

  error(context: string, message: string, error?: Error, data?: any) {
    this.log('error', context, message, data, error)
  }

  warning(context: string, message: string, data?: any) {
    this.log('warning', context, message, data)
  }

  info(context: string, message: string, data?: any) {
    this.log('info', context, message, data)
  }

  getLogs(): ErrorLog[] {
    return [...this.logs]
  }

  getRecentLogs(count: number = 20): ErrorLog[] {
    return this.logs.slice(-count)
  }

  clearLogs() {
    this.logs = []
    this.persistLogs()
  }

  private async persistLogs() {
    try {
      // Keep only last 20 logs when persisting to save space
      const logsToSave = this.logs.slice(-20)
      
      // Use window.spark.kv directly if available
      if (window.spark?.kv) {
        await window.spark.kv.set('error-logs', logsToSave)
      }
    } catch (e) {
      // Silent failure to avoid infinite error loops
    }
  }

  async loadLogs() {
    try {
      // Use window.spark.kv directly if available
      if (window.spark?.kv) {
        const stored = await window.spark.kv.get<ErrorLog[]>('error-logs')
        if (stored && Array.isArray(stored)) {
          this.logs = stored
        }
      }
    } catch (e) {
      // Silent failure
    }
  }

  getLogsAsText(): string {
    return this.logs
      .map(log => {
        const emoji = log.type === 'error' ? '❌' : log.type === 'warning' ? '⚠️' : 'ℹ️'
        let text = `${emoji} [${log.timestamp}] [${log.context}] ${log.message}`
        if (log.data) {
          text += `\n  Data: ${JSON.stringify(log.data, null, 2)}`
        }
        if (log.stack) {
          text += `\n  Stack: ${log.stack}`
        }
        return text
      })
      .join('\n\n')
  }
}

export const errorLogger = new ErrorLogger()

errorLogger.loadLogs()

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorLogger.error(
      'GLOBAL_ERROR',
      event.message,
      event.error,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.error(
      'UNHANDLED_PROMISE',
      event.reason?.message || 'Unhandled promise rejection',
      event.reason,
      { reason: event.reason }
    )
  })
}
