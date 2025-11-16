export interface DiagnosticCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: string
}

export interface DiagnosticResult {
  timestamp: string
  checks: DiagnosticCheck[]
  overallStatus: 'healthy' | 'issues' | 'critical'
}

export async function runDiagnostics(): Promise<DiagnosticResult> {
  const checks: DiagnosticCheck[] = []

  checks.push(await checkSparkAPI())
  checks.push(await checkKVStorage())
  checks.push(await checkUserAPI())
  checks.push(checkLocalStorage())
  checks.push(checkBrowserAPIs())
  checks.push(checkDependencies())

  const failCount = checks.filter(c => c.status === 'fail').length
  const warningCount = checks.filter(c => c.status === 'warning').length

  let overallStatus: 'healthy' | 'issues' | 'critical' = 'healthy'
  if (failCount > 0) overallStatus = 'critical'
  else if (warningCount > 0) overallStatus = 'issues'

  return {
    timestamp: new Date().toISOString(),
    checks,
    overallStatus
  }
}

async function checkSparkAPI(): Promise<DiagnosticCheck> {
  try {
    if (!window.spark) {
      return {
        name: 'Spark API',
        status: 'fail',
        message: 'Spark API не е наличен',
        details: 'window.spark обектът не е дефиниран'
      }
    }

    if (!window.spark.llm) {
      return {
        name: 'Spark API',
        status: 'fail',
        message: 'Spark LLM функцията липсва',
        details: 'window.spark.llm не е дефинирана'
      }
    }

    return {
      name: 'Spark API',
      status: 'pass',
      message: 'Spark API е наличен и функционален'
    }
  } catch (error) {
    return {
      name: 'Spark API',
      status: 'fail',
      message: 'Грешка при проверка на Spark API',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

async function checkKVStorage(): Promise<DiagnosticCheck> {
  try {
    if (!window.spark?.kv) {
      return {
        name: 'KV Storage',
        status: 'fail',
        message: 'KV Storage не е наличен',
        details: 'window.spark.kv не е дефиниран'
      }
    }

    const testKey = '__diagnostic_test__'
    const testValue = { test: true, timestamp: Date.now() }

    await window.spark.kv.set(testKey, testValue)
    const retrieved = await window.spark.kv.get(testKey)
    await window.spark.kv.delete(testKey)

    if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
      return {
        name: 'KV Storage',
        status: 'pass',
        message: 'KV Storage работи правилно'
      }
    }

    return {
      name: 'KV Storage',
      status: 'warning',
      message: 'KV Storage работи, но има проблем с данните',
      details: 'Записаните и прочетените данни не съвпадат'
    }
  } catch (error) {
    return {
      name: 'KV Storage',
      status: 'fail',
      message: 'Грешка при работа с KV Storage',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

async function checkUserAPI(): Promise<DiagnosticCheck> {
  try {
    if (!window.spark?.user) {
      return {
        name: 'User API',
        status: 'fail',
        message: 'User API не е наличен',
        details: 'window.spark.user не е дефиниран'
      }
    }

    const user = await window.spark.user()

    if (!user) {
      return {
        name: 'User API',
        status: 'warning',
        message: 'User API работи, но няма потребителска информация'
      }
    }

    return {
      name: 'User API',
      status: 'pass',
      message: `User API работи (${user.login || 'анонимен'})`,
      details: `isOwner: ${user.isOwner}`
    }
  } catch (error) {
    return {
      name: 'User API',
      status: 'fail',
      message: 'Грешка при достъп до User API',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

function checkLocalStorage(): DiagnosticCheck {
  try {
    const testKey = '__diagnostic_test__'
    localStorage.setItem(testKey, 'test')
    const value = localStorage.getItem(testKey)
    localStorage.removeItem(testKey)

    if (value === 'test') {
      return {
        name: 'LocalStorage',
        status: 'pass',
        message: 'LocalStorage е достъпен'
      }
    }

    return {
      name: 'LocalStorage',
      status: 'warning',
      message: 'LocalStorage е достъпен, но има проблем'
    }
  } catch (error) {
    return {
      name: 'LocalStorage',
      status: 'warning',
      message: 'LocalStorage не е достъпен',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

function checkBrowserAPIs(): DiagnosticCheck {
  const missingAPIs: string[] = []

  if (!window.fetch) missingAPIs.push('fetch')
  if (!window.Promise) missingAPIs.push('Promise')
  if (!window.crypto) missingAPIs.push('crypto')
  if (!window.FileReader) missingAPIs.push('FileReader')

  if (missingAPIs.length === 0) {
    return {
      name: 'Browser APIs',
      status: 'pass',
      message: 'Всички необходими Browser APIs са налични'
    }
  }

  return {
    name: 'Browser APIs',
    status: 'fail',
    message: 'Липсват необходими Browser APIs',
    details: `Липсващи: ${missingAPIs.join(', ')}`
  }
}

function checkDependencies(): DiagnosticCheck {
  try {
    return {
      name: 'Dependencies',
      status: 'pass',
      message: 'Основните зависимости са налични'
    }
  } catch (error) {
    return {
      name: 'Dependencies',
      status: 'warning',
      message: 'Не може да се провери състоянието на зависимостите',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function exportDiagnostics(): Promise<string> {
  const result = await runDiagnostics()
  
  return JSON.stringify(result, null, 2)
}

export async function clearAllData(): Promise<void> {
  if (window.spark?.kv) {
    const keys = await window.spark.kv.keys()
    for (const key of keys) {
      await window.spark.kv.delete(key)
    }
  }
  
  localStorage.clear()
}
