export interface StartupCheck {
  name: string
  passed: boolean
  error?: string
}

export interface StartupResult {
  success: boolean
  checks: StartupCheck[]
  criticalErrors: string[]
}

export function performStartupChecks(): StartupResult {
  const checks: StartupCheck[] = []
  const criticalErrors: string[] = []

  try {
    if (typeof window === 'undefined') {
      criticalErrors.push('Window object not available')
      return { success: false, checks, criticalErrors }
    }

    checks.push({
      name: 'Window Object',
      passed: true
    })

    if (!window.spark) {
      checks.push({
        name: 'Spark API',
        passed: false,
        error: 'window.spark is not defined'
      })
      criticalErrors.push('Spark API липсва - приложението не може да работи')
    } else {
      checks.push({
        name: 'Spark API',
        passed: true
      })

      if (!window.spark.kv) {
        checks.push({
          name: 'KV Storage',
          passed: false,
          error: 'window.spark.kv is not defined'
        })
        criticalErrors.push('KV Storage липсва - данните не могат да се запазват')
      } else {
        checks.push({
          name: 'KV Storage',
          passed: true
        })
      }

      if (!window.spark.llm) {
        checks.push({
          name: 'LLM API',
          passed: false,
          error: 'window.spark.llm is not defined'
        })
        criticalErrors.push('LLM API липсва - анализът не може да работи')
      } else {
        checks.push({
          name: 'LLM API',
          passed: true
        })
      }

      if (!window.spark.user) {
        checks.push({
          name: 'User API',
          passed: false,
          error: 'window.spark.user is not defined'
        })
      } else {
        checks.push({
          name: 'User API',
          passed: true
        })
      }
    }

    const hasLocalStorage = typeof localStorage !== 'undefined'
    checks.push({
      name: 'LocalStorage',
      passed: hasLocalStorage,
      error: hasLocalStorage ? undefined : 'localStorage is not available'
    })

    const hasFetch = typeof fetch !== 'undefined'
    checks.push({
      name: 'Fetch API',
      passed: hasFetch,
      error: hasFetch ? undefined : 'fetch is not available'
    })
    if (!hasFetch) {
      criticalErrors.push('Fetch API липсва - мрежовите заявки няма да работят')
    }

    const hasPromise = typeof Promise !== 'undefined'
    checks.push({
      name: 'Promise Support',
      passed: hasPromise,
      error: hasPromise ? undefined : 'Promise is not available'
    })
    if (!hasPromise) {
      criticalErrors.push('Promise не се поддържа - използвайте по-нов браузър')
    }

  } catch (error) {
    criticalErrors.push(`Грешка при стартова проверка: ${error instanceof Error ? error.message : String(error)}`)
  }

  const success = criticalErrors.length === 0

  return {
    success,
    checks,
    criticalErrors
  }
}

export function logStartupResults(result: StartupResult): void {
  if (result.success) {
    console.log('%c✓ Startup checks passed', 'color: green; font-weight: bold')
    console.table(result.checks)
  } else {
    console.error('%c✗ Startup checks failed', 'color: red; font-weight: bold')
    console.table(result.checks)
    console.error('Critical errors:')
    result.criticalErrors.forEach(error => console.error(`  - ${error}`))
  }
}

export function autoRunStartupChecks(): void {
  const result = performStartupChecks()
  logStartupResults(result)
  
  if (!result.success) {
    console.error('%cПриложението може да не работи правилно!', 'color: red; font-size: 14px; font-weight: bold')
    console.log('%cИзползвайте QuickDebugPanel (жълт бутон долу вдясно) за повече информация', 'color: orange; font-size: 12px')
  }
}
