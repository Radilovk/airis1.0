import { useState, useEffect, useCallback, useRef } from 'react'
import { useKV } from '@github/spark/hooks'

/**
 * A wrapper around useKV that provides localStorage fallback when KV storage is unavailable.
 * This ensures the app remains functional even when KV storage permissions are not configured.
 * 
 * Priority: localStorage is the primary storage, KV is used as backup when available.
 */
export function useKVWithFallback<T>(
  key: string,
  defaultValue: T
): [T | null, (value: T | ((current: T | null) => T)) => Promise<void>] {
  const [kvValue, setKvValue] = useKV<T>(key, defaultValue)
  
  // Initialize from localStorage first (primary storage)
  const [value, setValue_] = useState<T | null>(() => {
    try {
      const stored = localStorage.getItem(`airis_${key}`)
      if (stored && stored !== 'null' && stored !== 'undefined') {
        const parsed = JSON.parse(stored)
        console.log(`[KV_FALLBACK] Loaded ${key} from localStorage:`, parsed)
        return parsed
      }
    } catch (error) {
      console.warn(`[KV_FALLBACK] Failed to load ${key} from localStorage:`, error)
    }
    
    // Try to get from KV if localStorage is empty
    if (kvValue !== null && kvValue !== undefined) {
      console.log(`[KV_FALLBACK] Using KV value for ${key}:`, kvValue)
      return kvValue
    }
    
    console.log(`[KV_FALLBACK] Using default value for ${key}:`, defaultValue)
    return defaultValue
  })
  
  const isInitialized = useRef(false)
  const [useLocalStorageOnly, setUseLocalStorageOnly] = useState(false)

  // Sync KV to localStorage on mount and when KV changes
  useEffect(() => {
    if (!isInitialized.current && kvValue !== null && kvValue !== undefined) {
      try {
        const stored = localStorage.getItem(`airis_${key}`)
        
        // If localStorage is empty but KV has data, use KV data
        if (!stored || stored === 'null' || stored === 'undefined') {
          console.log(`[KV_FALLBACK] Syncing KV to localStorage for ${key}`)
          localStorage.setItem(`airis_${key}`, JSON.stringify(kvValue))
          setValue_(kvValue)
        }
      } catch (e) {
        console.warn(`[KV_FALLBACK] Failed to sync KV to localStorage for ${key}:`, e)
      }
      
      isInitialized.current = true
    }
  }, [kvValue, key])

  const setValue = useCallback(
    async (newValue: T | ((current: T | null) => T)) => {
      try {
        // Get current value
        const currentValue = value
        
        // Compute new value if it's a function
        const resolvedValue = typeof newValue === 'function' 
          ? (newValue as (current: T | null) => T)(currentValue)
          : newValue

        console.log(`[KV_FALLBACK] Saving ${key}:`, resolvedValue)

        // ALWAYS save to localStorage first (primary storage)
        try {
          localStorage.setItem(`airis_${key}`, JSON.stringify(resolvedValue))
          setValue_(resolvedValue)
          console.log(`[KV_FALLBACK] ✓ Saved ${key} to localStorage`)
        } catch (error) {
          console.error(`[KV_FALLBACK] ✗ Failed to save ${key} to localStorage:`, error)
          throw error // Don't continue if localStorage fails
        }

        // Try to save to KV storage as backup (non-critical)
        if (!useLocalStorageOnly) {
          try {
            await setKvValue(resolvedValue)
            console.log(`[KV_FALLBACK] ✓ Backed up ${key} to KV storage`)
          } catch (error) {
            console.warn(`[KV_FALLBACK] ⚠ KV storage failed for ${key} (non-critical):`, error)
            
            // Check if it's a permission error - switch to localStorage-only mode
            if (error instanceof Error && (
              error.message?.includes('Forbidden') || 
              error.message?.includes('403') ||
              error.message?.includes('permissions')
            )) {
              console.log(`[KV_FALLBACK] Switching to localStorage-only mode for ${key}`)
              setUseLocalStorageOnly(true)
            }
            // Don't throw - localStorage save succeeded, that's what matters
          }
        }
      } catch (error) {
        console.error(`[KV_FALLBACK] Critical error saving ${key}:`, error)
        throw error
      }
    },
    [key, value, useLocalStorageOnly, setKvValue]
  )

  return [value, setValue]
}
