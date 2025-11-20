import { useState, useEffect, useCallback } from 'react'
import { estimateDataSize, isSafeForLocalStorage } from '@/lib/storage-utils'

// Types are defined in src/types/index.ts

/**
 * Custom hook for using KV storage with fallback to localStorage
 * Implements size checking to prevent QuotaExceededError
 */
export function useKVWithFallback<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => Promise<void>] {
  const [value, setValue] = useState<T>(defaultValue)

  // Load initial value
  useEffect(() => {
    const loadValue = async () => {
      try {
        // Try KV storage first
        if (window.spark?.kv) {
          const kvValue = await window.spark.kv.get<T>(key)
          if (kvValue !== null && kvValue !== undefined) {
            setValue(kvValue)
            return
          }
        }

        // Fallback to localStorage
        const localValue = localStorage.getItem(`airis_${key}`)
        if (localValue && localValue !== 'null' && localValue !== 'undefined') {
          setValue(JSON.parse(localValue))
        }
      } catch (error) {
        console.error(`[useKVWithFallback] Error loading ${key}:`, error)
      }
    }

    loadValue()
  }, [key])

  // Save value with size checking
  const updateValue = useCallback(
    async (newValue: T) => {
      try {
        setValue(newValue)

        // Check data size before saving
        const dataSize = estimateDataSize(newValue)
        const safeForLocalStorage = isSafeForLocalStorage(dataSize)

        if (!safeForLocalStorage) {
          console.warn(
            `[useKVWithFallback] Data size ${Math.round(dataSize / 1024)} KB exceeds localStorage safe limit, storing only in KV`
          )
        }

        // Save to KV storage (always)
        if (window.spark?.kv) {
          await window.spark.kv.set(key, newValue)
        }

        // Save to localStorage only if size is safe
        if (safeForLocalStorage) {
          try {
            localStorage.setItem(`airis_${key}`, JSON.stringify(newValue))
          } catch (error) {
            if (error instanceof Error && error.name === 'QuotaExceededError') {
              console.warn(`[useKVWithFallback] QuotaExceededError for ${key}, skipping localStorage`)
              // Remove from localStorage if it exists
              localStorage.removeItem(`airis_${key}`)
            } else {
              throw error
            }
          }
        } else {
          // Remove from localStorage if data is too large
          localStorage.removeItem(`airis_${key}`)
        }
      } catch (error) {
        console.error(`[useKVWithFallback] Error saving ${key}:`, error)
        throw error
      }
    },
    [key]
  )

  return [value, updateValue]
}
