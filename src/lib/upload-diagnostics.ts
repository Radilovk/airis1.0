interface UploadDiagnosticEvent {
  timestamp: string
  step: string
  status: 'start' | 'success' | 'error' | 'warning' | 'info'
  data?: any
  error?: Error
}

class UploadDiagnostics {
  private events: UploadDiagnosticEvent[] = []
  private sessionId: string = Date.now().toString()
  private isRecording: boolean = true

  startSession() {
    this.sessionId = Date.now().toString()
    this.events = []
    this.isRecording = true
    this.log('SESSION_START', 'info', { sessionId: this.sessionId })
  }

  endSession() {
    this.log('SESSION_END', 'info', { 
      sessionId: this.sessionId,
      totalEvents: this.events.length 
    })
    this.isRecording = false
  }

  log(
    step: string, 
    status: UploadDiagnosticEvent['status'],
    data?: any,
    error?: Error
  ) {
    if (!this.isRecording) return

    const event: UploadDiagnosticEvent = {
      timestamp: new Date().toISOString(),
      step,
      status,
      data,
      error
    }

    this.events.push(event)

    const emoji = {
      start: '🚀',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    }[status]

    const message = `${emoji} [UPLOAD_DIAG] [${step}]`
    
    if (status === 'error') {
      console.error(message, data, error)
    } else if (status === 'warning') {
      console.warn(message, data)
    } else {
      console.log(message, data || '')
    }

    this.persistEvents()
  }

  getEvents(): UploadDiagnosticEvent[] {
    return [...this.events]
  }

  getReport(): string {
    let report = `📊 UPLOAD DIAGNOSTICS REPORT\n`
    report += `Session ID: ${this.sessionId}\n`
    report += `Total Events: ${this.events.length}\n`
    report += `\n`

    const errors = this.events.filter(e => e.status === 'error')
    const warnings = this.events.filter(e => e.status === 'warning')
    const successes = this.events.filter(e => e.status === 'success')

    report += `✅ Successes: ${successes.length}\n`
    report += `⚠️  Warnings: ${warnings.length}\n`
    report += `❌ Errors: ${errors.length}\n`
    report += `\n`

    if (errors.length > 0) {
      report += `❌ ERRORS:\n`
      errors.forEach(e => {
        report += `  [${e.timestamp}] ${e.step}\n`
        if (e.data) report += `    Data: ${JSON.stringify(e.data, null, 2)}\n`
        if (e.error) report += `    Error: ${e.error.message}\n`
        if (e.error?.stack) report += `    Stack: ${e.error.stack}\n`
      })
      report += `\n`
    }

    if (warnings.length > 0) {
      report += `⚠️  WARNINGS:\n`
      warnings.forEach(e => {
        report += `  [${e.timestamp}] ${e.step}\n`
        if (e.data) report += `    Data: ${JSON.stringify(e.data, null, 2)}\n`
      })
      report += `\n`
    }

    report += `📋 FULL EVENT LOG:\n`
    this.events.forEach(e => {
      const emoji = {
        start: '🚀',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      }[e.status]
      report += `${emoji} [${e.timestamp}] ${e.step}\n`
      if (e.data) {
        const dataStr = JSON.stringify(e.data, null, 2)
        if (dataStr.length < 200) {
          report += `  ${dataStr}\n`
        } else {
          report += `  ${dataStr.substring(0, 200)}...\n`
        }
      }
    })

    return report
  }

  clear() {
    this.events = []
    this.persistEvents()
  }

  private async persistEvents() {
    try {
      await window.spark.kv.set('upload-diagnostics-events', this.events)
    } catch (e) {
      console.warn('[UPLOAD_DIAG] Could not persist events:', e)
    }
  }

  async loadEvents() {
    try {
      const stored = await window.spark.kv.get<UploadDiagnosticEvent[]>('upload-diagnostics-events')
      if (stored && Array.isArray(stored)) {
        this.events = stored
      }
    } catch (e) {
      console.warn('[UPLOAD_DIAG] Could not load events:', e)
    }
  }

  downloadReport() {
    const report = this.getReport()
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `upload-diagnostics-${this.sessionId}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  hasErrors(): boolean {
    return this.events.some(e => e.status === 'error')
  }

  getLastError(): UploadDiagnosticEvent | null {
    const errors = this.events.filter(e => e.status === 'error')
    return errors.length > 0 ? errors[errors.length - 1] : null
  }
}

export const uploadDiagnostics = new UploadDiagnostics()

uploadDiagnostics.loadEvents()
