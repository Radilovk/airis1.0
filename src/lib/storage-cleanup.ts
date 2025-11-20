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
    console.warn(`[CLEANUP] KV storage read failed for ${key}:`, error)
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
    console.warn(`[CLEANUP] IndexedDB read failed for ${key}:`, error)
  }
  
  // Priority 3: Try localStorage
  try {
    const localValue = localStorage.getItem(`airis_${key}`)
    if (localValue && localValue !== 'null' && localValue !== 'undefined') {
      return JSON.parse(localValue)
    }
  } catch (error) {
    console.warn(`[CLEANUP] localStorage read failed for ${key}:`, error)
  }
  
  return null
}

async function saveToStorage(key: string, value: any): Promise<void> {
  const savePromises: Promise<void>[] = []
  
  // Save to localStorage (fastest, always available)
  savePromises.push(
    Promise.resolve().then(() => {
      localStorage.setItem(`airis_${key}`, JSON.stringify(value))
    })
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
        console.warn(`[CLEANUP] IndexedDB write failed for ${key}:`, error)
      }
    })()
  )
  
  // Save to KV storage
  savePromises.push(
    (async () => {
      try {
        await window.spark.kv.set(key, value)
      } catch (error) {
        console.warn(`[CLEANUP] KV storage write failed for ${key}:`, error)
      }
    })()
  )
  
  await Promise.allSettled(savePromises)
}

export async function cleanupOldReportsWithImages() {
  try {
    console.log('🧹 [CLEANUP] Започване на почистване на стари репорти с изображения...')
    
    const history = await getFromStorage('analysis-history')
    
    if (!history || !Array.isArray(history)) {
      console.log('ℹ️ [CLEANUP] Няма история за почистване')
      return { cleaned: 0, errors: 0 }
    }
    
    console.log(`📊 [CLEANUP] Намерени ${history.length} репорта в историята`)
    
    let cleanedCount = 0
    let errorCount = 0
    
    const cleanedHistory = history.map((report, index) => {
      try {
        if (report.leftIrisImage && report.leftIrisImage.dataUrl && report.leftIrisImage.dataUrl.length > 100) {
          console.log(`🗑️ [CLEANUP] Изтриване на ляво изображение от репорт ${index + 1}`)
          report.leftIrisImage.dataUrl = ''
          cleanedCount++
        }
        
        if (report.rightIrisImage && report.rightIrisImage.dataUrl && report.rightIrisImage.dataUrl.length > 100) {
          console.log(`🗑️ [CLEANUP] Изтриване на дясно изображение от репорт ${index + 1}`)
          report.rightIrisImage.dataUrl = ''
          cleanedCount++
        }
        
        return report
      } catch (error) {
        console.error(`❌ [CLEANUP] Грешка при почистване на репорт ${index + 1}:`, error)
        errorCount++
        return report
      }
    })
    
    await saveToStorage('analysis-history', cleanedHistory)
    
    console.log(`✅ [CLEANUP] Почистени ${cleanedCount} изображения, ${errorCount} грешки`)
    
    return { cleaned: cleanedCount, errors: errorCount }
  } catch (error) {
    console.error('❌ [CLEANUP] Фатална грешка при почистване:', error)
    throw error
  }
}

async function deleteFromStorage(key: string): Promise<void> {
  const deletePromises: Promise<void>[] = []
  
  // Delete from localStorage
  deletePromises.push(
    Promise.resolve().then(() => {
      localStorage.removeItem(`airis_${key}`)
    })
  )
  
  // Delete from IndexedDB
  deletePromises.push(
    (async () => {
      try {
        const db = await openDB()
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], 'readwrite')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.delete(key)
          
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      } catch (error) {
        console.warn(`[CLEANUP] IndexedDB delete failed for ${key}:`, error)
      }
    })()
  )
  
  // Delete from KV storage
  deletePromises.push(
    (async () => {
      try {
        await window.spark.kv.delete(key)
      } catch (error) {
        console.warn(`[CLEANUP] KV storage delete failed for ${key}:`, error)
      }
    })()
  )
  
  await Promise.allSettled(deletePromises)
}

export async function clearOldAnalysisReport() {
  try {
    console.log('🧹 [CLEANUP] Изтриване на стар analysis report от storage...')
    
    const oldReport = await getFromStorage('analysis-report')
    
    if (oldReport) {
      const reportSize = JSON.stringify(oldReport).length
      console.log(`📊 [CLEANUP] Намерен стар репорт с размер: ${Math.round(reportSize / 1024)} KB`)
      
      await deleteFromStorage('analysis-report')
      
      console.log('✅ [CLEANUP] Стар репорт изтрит успешно')
      return true
    } else {
      console.log('ℹ️ [CLEANUP] Няма стар репорт за изтриване')
      return false
    }
  } catch (error) {
    console.error('❌ [CLEANUP] Грешка при изтриване на стар репорт:', error)
    throw error
  }
}

export async function estimateStorageSavings() {
  try {
    const history = await getFromStorage('analysis-history')
    
    if (!history || !Array.isArray(history)) {
      return { currentSize: 0, potentialSavings: 0, reports: 0 }
    }
    
    let currentSize = 0
    let potentialSavings = 0
    
    history.forEach((report) => {
      const reportSize = JSON.stringify(report).length
      currentSize += reportSize
      
      if (report.leftIrisImage && report.leftIrisImage.dataUrl) {
        potentialSavings += report.leftIrisImage.dataUrl.length
      }
      
      if (report.rightIrisImage && report.rightIrisImage.dataUrl) {
        potentialSavings += report.rightIrisImage.dataUrl.length
      }
    })
    
    return {
      currentSize: Math.round(currentSize / 1024),
      potentialSavings: Math.round(potentialSavings / 1024),
      reports: history.length
    }
  } catch (error) {
    console.error('❌ [CLEANUP] Грешка при оценка на спестявания:', error)
    throw error
  }
}

export async function autoCleanupOnStartup() {
  try {
    console.log('🚀 [AUTO-CLEANUP] Автоматично почистване при стартиране...')
    
    const savings = await estimateStorageSavings()
    
    console.log(`📊 [AUTO-CLEANUP] Текущ размер: ${savings.currentSize} KB`)
    console.log(`💰 [AUTO-CLEANUP] Потенциални спестявания: ${savings.potentialSavings} KB`)
    
    if (savings.potentialSavings > 100) {
      console.log('🧹 [AUTO-CLEANUP] Големи изображения открити - стартиране на почистване...')
      
      await clearOldAnalysisReport()
      
      const result = await cleanupOldReportsWithImages()
      
      console.log(`✅ [AUTO-CLEANUP] Завършено: ${result.cleaned} изображения изтрити`)
      
      return result
    } else {
      console.log('✅ [AUTO-CLEANUP] Няма нужда от почистване')
      return { cleaned: 0, errors: 0 }
    }
  } catch (error) {
    console.error('❌ [AUTO-CLEANUP] Грешка при автоматично почистване:', error)
    return { cleaned: 0, errors: 1 }
  }
}
