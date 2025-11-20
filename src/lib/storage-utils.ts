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
    console.warn(`[STORAGE] KV storage read failed for ${key}:`, error)
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
    console.warn(`[STORAGE] IndexedDB read failed for ${key}:`, error)
  }
  
  // Priority 3: Try localStorage
  try {
    const localValue = localStorage.getItem(`airis_${key}`)
    if (localValue && localValue !== 'null' && localValue !== 'undefined') {
      return JSON.parse(localValue)
    }
  } catch (error) {
    console.warn(`[STORAGE] localStorage read failed for ${key}:`, error)
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
        console.warn(`[STORAGE] IndexedDB write failed for ${key}:`, error)
      }
    })()
  )
  
  // Save to KV storage
  savePromises.push(
    (async () => {
      try {
        await window.spark.kv.set(key, value)
      } catch (error) {
        console.warn(`[STORAGE] KV storage write failed for ${key}:`, error)
      }
    })()
  )
  
  await Promise.allSettled(savePromises)
}

export async function estimateStorageUsage(): Promise<number> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage || 0
      const quota = estimate.quota || 0
      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0
      
      console.log(`💾 [STORAGE] Usage: ${Math.round(usage / 1024 / 1024)} MB / ${Math.round(quota / 1024 / 1024)} MB (${usagePercent.toFixed(1)}%)`)
      
      return usagePercent
    }
    return 0
  } catch (error) {
    console.warn('⚠️ [STORAGE] Could not estimate storage:', error)
    return 0
  }
}

export async function checkStorageAvailable(requiredBytes: number): Promise<boolean> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage || 0
      const quota = estimate.quota || 0
      const available = quota - usage
      
      console.log(`💾 [STORAGE] Required: ${Math.round(requiredBytes / 1024)} KB, Available: ${Math.round(available / 1024)} KB`)
      
      if (available < requiredBytes * 1.5) {
        console.warn('⚠️ [STORAGE] Not enough storage space!')
        return false
      }
      
      return true
    }
    return true
  } catch (error) {
    console.warn('⚠️ [STORAGE] Could not check storage:', error)
    return true
  }
}

export function estimateDataSize(data: any): number {
  try {
    const jsonString = JSON.stringify(data)
    return new Blob([jsonString]).size
  } catch (error) {
    console.error('❌ [STORAGE] Could not estimate data size:', error)
    return 0
  }
}

export async function clearOldAnalysisHistory(): Promise<void> {
  try {
    console.log('🧹 [STORAGE] Clearing old analysis history to free space...')
    
    const history = await getFromStorage('analysis-history')
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(0, 5)
      await saveToStorage('analysis-history', recentHistory)
      console.log(`✅ [STORAGE] Kept ${recentHistory.length} most recent analyses, removed ${history.length - recentHistory.length}`)
    }
  } catch (error) {
    console.error('❌ [STORAGE] Error clearing old history:', error)
  }
}
