interface ErrorLog {
  timestamp: string
  type: 'error' | 'warning' | 'info'
  context: string
  message: string
  stack?: string
  data?: any
}

class ErrorLogger {
  private logs: ErrorLog[] = []
  private maxLogs = 100
  private kvAvailable = true

  private safeConsoleWarn(message: string, error?: any) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(message, error)
    }
  }

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
    // Don't try to persist if KV is known to be unavailable
    if (!this.kvAvailable) {
      return
    }

    try {
      await window.spark.kv.set('error-logs', this.logs)
    } catch (e) {
      // Silently disable KV persistence to prevent error cascades
      this.kvAvailable = false
      // Only log to console, don't create new error logs
      this.safeConsoleWarn('Could not persist error logs:', e)
    }
  }

  async loadLogs() {
    if (!this.kvAvailable) {
      return
    }

    try {
      const stored = await window.spark.kv.get<ErrorLog[]>('error-logs')
      if (stored && Array.isArray(stored)) {
        this.logs = stored
      }
    } catch (e) {
      this.kvAvailable = false
      this.safeConsoleWarn('Could not load error logs:', e)
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
