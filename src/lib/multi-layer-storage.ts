/**
 * Multi-layer storage with fallback support
 * Priority: GitHub KV Storage → IndexedDB → localStorage
 */

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

/**
 * Get data from storage with fallback support
 * @param key Storage key
 * @param silent If true, suppresses error logging (useful for error logger to avoid infinite loops)
 */
export async function getFromStorage(key: string, silent: boolean = false): Promise<any> {
  // Priority 1: Try KV storage
  try {
    const kvValue = await window.spark.kv.get<any>(key)
    if (kvValue !== null && kvValue !== undefined) {
      return kvValue
    }
  } catch (error) {
    if (!silent) {
      console.warn(`[STORAGE] KV storage read failed for ${key}:`, error)
    }
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
    if (!silent) {
      console.warn(`[STORAGE] IndexedDB read failed for ${key}:`, error)
    }
  }
  
  // Priority 3: Try localStorage
  try {
    const localValue = localStorage.getItem(`airis_${key}`)
    if (localValue && localValue !== 'null' && localValue !== 'undefined') {
      return JSON.parse(localValue)
    }
  } catch (error) {
    if (!silent) {
      console.warn(`[STORAGE] localStorage read failed for ${key}:`, error)
    }
  }
  
  return null
}

/**
 * Save data to all storage layers in parallel
 * @param key Storage key
 * @param value Data to save
 * @param silent If true, suppresses error logging
 */
export async function saveToStorage(key: string, value: any, silent: boolean = false): Promise<void> {
  const savePromises: Promise<void>[] = []
  
  // Save to localStorage (fastest, always available)
  savePromises.push(
    Promise.resolve().then(() => {
      localStorage.setItem(`airis_${key}`, JSON.stringify(value))
    }).catch((error) => {
      if (!silent) {
        console.warn(`[STORAGE] localStorage write failed for ${key}:`, error)
      }
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
        if (!silent) {
          console.warn(`[STORAGE] IndexedDB write failed for ${key}:`, error)
        }
      }
    })()
  )
  
  // Save to KV storage
  savePromises.push(
    (async () => {
      try {
        await window.spark.kv.set(key, value)
      } catch (error) {
        if (!silent) {
          console.warn(`[STORAGE] KV storage write failed for ${key}:`, error)
        }
      }
    })()
  )
  
  await Promise.allSettled(savePromises)
}

/**
 * Delete data from all storage layers
 * @param key Storage key
 * @param silent If true, suppresses error logging
 */
export async function deleteFromStorage(key: string, silent: boolean = false): Promise<void> {
  const deletePromises: Promise<void>[] = []
  
  // Delete from localStorage
  deletePromises.push(
    Promise.resolve().then(() => {
      localStorage.removeItem(`airis_${key}`)
    }).catch((error) => {
      if (!silent) {
        console.warn(`[STORAGE] localStorage delete failed for ${key}:`, error)
      }
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
        if (!silent) {
          console.warn(`[STORAGE] IndexedDB delete failed for ${key}:`, error)
        }
      }
    })()
  )
  
  // Delete from KV storage
  deletePromises.push(
    (async () => {
      try {
        await window.spark.kv.delete(key)
      } catch (error) {
        if (!silent) {
          console.warn(`[STORAGE] KV storage delete failed for ${key}:`, error)
        }
      }
    })()
  )
  
  await Promise.allSettled(deletePromises)
}
