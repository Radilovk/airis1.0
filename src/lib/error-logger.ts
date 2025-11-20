interface ErrorLog {
  timestamp: string
  type: 'error' | 'warning' | 'info'
  context: string
  message: string
  stack?: string
  data?: any
}

// Storage helper functions with fallback support
const DB_NAME = 'airis_storage'
const DB_VERSION = 1
const STORE_NAME = 'settings'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function getFromStorage(key: string): Promise<any> {
  // Priority 1: Try KV storage
  try {
    const kvValue = await window.spark.kv.get<any>(key)
    if (kvValue !== null && kvValue !== undefined) {
      return kvValue
    }
  } catch (error) {
    // Silent failure for error logger to avoid infinite loops
  }
  
  // Priority 2: Try IndexedDB
  try {
    const db = await openDB()
    const value = await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    if (value !== undefined && value !== null) {
      return value
    }
  } catch (error) {
    // Silent failure
  }
  
  // Priority 3: Try localStorage
  try {
    const localValue = localStorage.getItem(`airis_${key}`)
    if (localValue && localValue !== 'null' && localValue !== 'undefined') {
      return JSON.parse(localValue)
    }
  } catch (error) {
    // Silent failure
  }
  
  return null
}

async function saveToStorage(key: string, value: any): Promise<void> {
  const savePromises: Promise<void>[] = []
  
  // Save to localStorage (fastest, always available)
  savePromises.push(
    Promise.resolve().then(() => {
      localStorage.setItem(`airis_${key}`, JSON.stringify(value))
    }).catch(() => {})
  )
  
  // Save to IndexedDB
  savePromises.push(
    (async () => {
      try {
        const db = await openDB()
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], 'readwrite')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.put(value, key)
          
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      } catch (error) {
        // Silent failure
      }
    })()
  )
  
  // Save to KV storage
  savePromises.push(
    (async () => {
      try {
        await window.spark.kv.set(key, value)
      } catch (error) {
        // Silent failure
      }
    })()
  )
  
  await Promise.allSettled(savePromises)
}

class ErrorLogger {
  private logs: ErrorLog[] = []
  private maxLogs = 100

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
      await saveToStorage('error-logs', this.logs)
    } catch (e) {
      // Silent failure to avoid infinite error loops
    }
  }

  async loadLogs() {
    try {
      const stored = await getFromStorage('error-logs')
      if (stored && Array.isArray(stored)) {
        this.logs = stored
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
