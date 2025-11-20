import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Enhanced storage hook for web deployment with multiple persistence layers:
 * 1. IndexedDB (primary - robust local storage with large capacity)
 * 2. localStorage (secondary - simple fallback, ONLY for small data <100KB)
 * 
 * КРИТИЧНО: 
 * - НЕ използваме useKV за НИЩО (предотвратява "Failed to set key")
 * - Използваме САМО IndexedDB и localStorage
 * - IndexedDB е основното съхранилище (няма ограничения)
 */

const DB_NAME = 'airis_storage'
const DB_VERSION = 1
const STORE_NAME = 'settings'
const MAX_LOCALSTORAGE_SIZE = 100 * 1024 // 100KB max for localStorage

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

async function getFromIndexedDB(key: string): Promise<any> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn(`[STORAGE] IndexedDB read error for ${key}:`, error)
    return null
  }
}

async function setInIndexedDB(key: string, value: any): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(value, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn(`[STORAGE] IndexedDB write error for ${key}:`, error)
    throw error
  }
}

function estimateSize(value: any): number {
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}

export function useKVWithFallback<T>(
  key: string,
  defaultValue: T
): [T | null, (value: T | ((current: T | null) => T)) => Promise<void>] {
  const [value, setValue_] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isInitialized = useRef(false)

  useEffect(() => {
    if (isInitialized.current) return
    
    const initializeStorage = async () => {
      try {
        console.log(`[STORAGE] Initializing ${key}...`)
        
        // Priority 1: IndexedDB
        const indexedDBValue = await getFromIndexedDB(key)
        if (indexedDBValue !== undefined && indexedDBValue !== null) {
          console.log(`[STORAGE] ✓ Loaded ${key} from IndexedDB`)
          setValue_(indexedDBValue)
          setIsLoading(false)
          isInitialized.current = true
          return
        }
        
        // Priority 2: localStorage (only for small data)
        const localStorageValue = localStorage.getItem(`airis_${key}`)
        if (localStorageValue && localStorageValue !== 'null' && localStorageValue !== 'undefined') {
          try {
            const parsed = JSON.parse(localStorageValue)
            console.log(`[STORAGE] ✓ Loaded ${key} from localStorage`)
            setValue_(parsed)
            
            try {
              await setInIndexedDB(key, parsed)
            } catch (e) {
              console.warn(`[STORAGE] Failed to sync ${key} to IndexedDB:`, e)
            }
            
            setIsLoading(false)
            isInitialized.current = true
            return
          } catch (e) {
            console.warn(`[STORAGE] Failed to parse localStorage ${key}:`, e)
          }
        }
        
        // Priority 3: Default value
        console.log(`[STORAGE] Using default value for ${key}`)
        setValue_(defaultValue)
        setIsLoading(false)
        isInitialized.current = true
        
      } catch (error) {
        console.error(`[STORAGE] Error initializing ${key}:`, error)
        setValue_(defaultValue)
        setIsLoading(false)
        isInitialized.current = true
      }
    }
    
    initializeStorage()
  }, [key, defaultValue])

  const setValue = useCallback(
    async (newValue: T | ((current: T | null) => T)) => {
      try {
        const currentValue = value
        const resolvedValue = typeof newValue === 'function' 
          ? (newValue as (current: T | null) => T)(currentValue)
          : newValue

        console.log(`[STORAGE] Saving ${key}...`)
        setValue_(resolvedValue)

        const savePromises: Promise<void>[] = []
        const dataSize = estimateSize(resolvedValue)

        console.log(`[STORAGE] Data size for ${key}: ${dataSize} bytes`)

        // 1. Save to localStorage ONLY if data is small (<100KB)
        if (dataSize < MAX_LOCALSTORAGE_SIZE) {
          savePromises.push(
            Promise.resolve().then(() => {
              try {
                localStorage.setItem(`airis_${key}`, JSON.stringify(resolvedValue))
                console.log(`[STORAGE] ✓ Saved ${key} to localStorage (${dataSize} bytes)`)
              } catch (error) {
                console.warn(`[STORAGE] Failed to save ${key} to localStorage:`, error)
              }
            })
          )
        } else {
          console.log(`[STORAGE] ⚠️ Skipping localStorage for ${key} (${dataSize} bytes > 100KB limit)`)
        }

        // 2. Save to IndexedDB (ALWAYS - this is our primary storage)
        savePromises.push(
          setInIndexedDB(key, resolvedValue)
            .then(() => console.log(`[STORAGE] ✓ Saved ${key} to IndexedDB (${dataSize} bytes)`))
            .catch((error) => console.warn(`[STORAGE] Failed to save ${key} to IndexedDB:`, error))
        )

        await Promise.allSettled(savePromises)
        console.log(`[STORAGE] ✓ Successfully saved ${key}`)
        
      } catch (error) {
        console.error(`[STORAGE] Critical error saving ${key}:`, error)
      }
    },
    [key, value]
  )

  return [isLoading ? null : value, setValue]
}
