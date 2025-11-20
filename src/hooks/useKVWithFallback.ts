import { useState, useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'

/**
 * A wrapper around useKV that provides localStorage fallback when KV storage is unavailable.
 * This ensures the app remains functional even when KV storage permissions are not configured.
 */
export function useKVWithFallback<T>(
  key: string,
  defaultValue: T
): [T | null, (value: T | ((current: T | null) => T)) => Promise<void>] {
  const [kvValue, setKvValue] = useKV<T>(key, defaultValue)
  const [localValue, setLocalValue] = useState<T | null>(() => {
    // Try to load from localStorage as fallback
    try {
      const stored = localStorage.getItem(`airis_${key}`)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.warn(`[KV_FALLBACK] Failed to load ${key} from localStorage:`, error)
    }
    return defaultValue
  })
  
  const [useLocalStorage, setUseLocalStorage] = useState(false)
  const [hasKVError, setHasKVError] = useState(false)

  // Try to detect KV storage failures
  useEffect(() => {
    const checkKVHealth = async () => {
      try {
        // If kvValue is null and we haven't set a localStorage flag, KV might be failing
        if (kvValue === null && defaultValue !== null && !hasKVError) {
          console.warn(`[KV_FALLBACK] KV storage may be unavailable for key: ${key}`)
          setHasKVError(true)
          setUseLocalStorage(true)
        } else if (kvValue !== null) {
          // KV is working, sync to localStorage as backup
          try {
            localStorage.setItem(`airis_${key}`, JSON.stringify(kvValue))
          } catch (e) {
            console.warn(`[KV_FALLBACK] Failed to backup to localStorage:`, e)
          }
        }
      } catch (error) {
        console.error(`[KV_FALLBACK] Error checking KV health:`, error)
        setHasKVError(true)
        setUseLocalStorage(true)
      }
    }

    checkKVHealth()
  }, [kvValue, defaultValue, key, hasKVError])

  const setValue = useCallback(
    async (value: T | ((current: T | null) => T)) => {
      const newValue = typeof value === 'function' 
        ? (value as (current: T | null) => T)(useLocalStorage ? localValue : kvValue)
        : value

      // Always try to save to localStorage first as fallback
      try {
        localStorage.setItem(`airis_${key}`, JSON.stringify(newValue))
        setLocalValue(newValue)
      } catch (error) {
        console.error(`[KV_FALLBACK] Failed to save to localStorage:`, error)
      }

      // Try to save to KV storage if available
      if (!useLocalStorage) {
        try {
          await setKvValue(newValue)
        } catch (error: any) {
          console.warn(`[KV_FALLBACK] KV storage failed for ${key}, using localStorage:`, error)
          
          // Check if it's a permission error
          if (error?.message?.includes('Forbidden') || error?.message?.includes('403')) {
            setHasKVError(true)
            setUseLocalStorage(true)
          }
        }
      }
    },
    [key, kvValue, localValue, useLocalStorage, setKvValue]
  )

  // Return the appropriate value based on storage availability
  const currentValue = useLocalStorage ? localValue : kvValue

  return [currentValue, setValue]
}
