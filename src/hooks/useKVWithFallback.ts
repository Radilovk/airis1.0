import { useState, useEffect, useCallback, useRef } from 'react'
import { useKV } from '@github/spark/hooks'

/**
 * Enhanced storage hook for web deployment with multiple persistence layers:
 * 1. GitHub KV Storage (primary - persists across devices/browsers)
 * 2. IndexedDB (secondary - robust local storage with large capacity)
 * 3. localStorage (tertiary - simple fallback)
 * 
 * This ensures settings are remembered in web deployments (GitHub Pages).
 */

// IndexedDB helper functions
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

export function useKVWithFallback<T>(
  key: string,
  defaultValue: T
): [T | null, (value: T | ((current: T | null) => T)) => Promise<void>] {
  const [kvValue, setKvValue] = useKV<T>(key, defaultValue)
  const [value, setValue_] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isInitialized = useRef(false)
  const kvAvailable = useRef(true)

  // Initialize: Load from best available storage
  useEffect(() => {
    if (isInitialized.current) return
    
    const initializeStorage = async () => {
      try {
        console.log(`[STORAGE] Initializing ${key}...`)
        
        // Priority 1: Try KV storage (best for web deployment)
        if (kvValue !== null && kvValue !== undefined) {
          console.log(`[STORAGE] ✓ Using KV storage for ${key}`)
          setValue_(kvValue)
          
          // Backup to IndexedDB and localStorage
          try {
            await setInIndexedDB(key, kvValue)
            localStorage.setItem(`airis_${key}`, JSON.stringify(kvValue))
          } catch (e) {
            console.warn(`[STORAGE] Failed to backup ${key}:`, e)
          }
          
          setIsLoading(false)
          isInitialized.current = true
          return
        }
        
        // Priority 2: Try IndexedDB
        const indexedDBValue = await getFromIndexedDB(key)
        if (indexedDBValue !== undefined && indexedDBValue !== null) {
          console.log(`[STORAGE] ✓ Loaded ${key} from IndexedDB`)
          setValue_(indexedDBValue)
          setIsLoading(false)
          isInitialized.current = true
          return
        }
        
        // Priority 3: Try localStorage
        const localStorageValue = localStorage.getItem(`airis_${key}`)
        if (localStorageValue && localStorageValue !== 'null' && localStorageValue !== 'undefined') {
          const parsed = JSON.parse(localStorageValue)
          console.log(`[STORAGE] ✓ Loaded ${key} from localStorage`)
          setValue_(parsed)
          
          // Try to sync to better storage
          try {
            await setInIndexedDB(key, parsed)
          } catch (e) {
            console.warn(`[STORAGE] Failed to sync ${key} to IndexedDB:`, e)
          }
          
          setIsLoading(false)
          isInitialized.current = true
          return
        }
        
        // Priority 4: Use default value
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kvValue, defaultValue])

  const setValue = useCallback(
    async (newValue: T | ((current: T | null) => T)) => {
      try {
        const currentValue = value
        
        // Compute new value if it's a function
        const resolvedValue = typeof newValue === 'function' 
          ? (newValue as (current: T | null) => T)(currentValue)
          : newValue

        console.log(`[STORAGE] Saving ${key}:`, resolvedValue)

        // Update local state immediately
        setValue_(resolvedValue)

        // Save to all available storage layers in parallel
        const savePromises: Promise<void>[] = []

        // 1. Save to localStorage (fastest, always available)
        savePromises.push(
          Promise.resolve().then(() => {
            localStorage.setItem(`airis_${key}`, JSON.stringify(resolvedValue))
            console.log(`[STORAGE] ✓ Saved ${key} to localStorage`)
          })
        )

        // 2. Save to IndexedDB (more capacity, persistent)
        savePromises.push(
          setInIndexedDB(key, resolvedValue)
            .then(() => console.log(`[STORAGE] ✓ Saved ${key} to IndexedDB`))
            .catch((error) => console.warn(`[STORAGE] Failed to save ${key} to IndexedDB:`, error))
        )

        // 3. Save to KV storage (best for web deployment, persists across devices)
        if (kvAvailable.current) {
          savePromises.push(
            (async () => {
              try {
                await setKvValue(resolvedValue)
                console.log(`[STORAGE] ✓ Saved ${key} to KV storage`)
              } catch (error) {
                console.warn(`[STORAGE] KV storage failed for ${key}:`, error)
                // Disable KV for any error to prevent cascading failures
                kvAvailable.current = false
                if (error instanceof Error) {
                  console.log(`[STORAGE] KV storage disabled for future writes due to: ${error.message}`)
                }
                // Don't rethrow - this is handled by Promise.allSettled
              }
            })()
          )
        }

        // Wait for all saves to complete (don't fail if some fail)
        await Promise.allSettled(savePromises)
        console.log(`[STORAGE] ✓ Successfully saved ${key} to available storage layers`)
        
      } catch (error) {
        console.error(`[STORAGE] Critical error saving ${key}:`, error)
        throw error
      }
    },
    [key, value, setKvValue]
  )

  // Return null while loading to prevent using stale default values
  return [isLoading ? null : value, setValue]
}
