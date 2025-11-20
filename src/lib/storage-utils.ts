import { getFromStorage, saveToStorage } from './multi-layer-storage'

// Size thresholds
const LOCALSTORAGE_SAFE_SIZE = 2.5 * 1024 * 1024 // 2.5MB - safe limit for localStorage
const INDEXEDDB_ONLY_SIZE = 1 * 1024 * 1024 // 1MB - store only in IndexedDB if larger

/**
 * Get current storage quota information
 */
export async function getStorageQuota(): Promise<{ usage: number; quota: number; available: number }> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage || 0
      const quota = estimate.quota || 0
      const available = quota - usage
      
      return { usage, quota, available }
    }
    return { usage: 0, quota: 0, available: 0 }
  } catch (error) {
    console.warn('⚠️ [STORAGE] Could not get storage quota:', error)
    return { usage: 0, quota: 0, available: 0 }
  }
}

/**
 * Estimate storage usage as percentage
 */
export async function estimateStorageUsage(): Promise<number> {
  try {
    const { usage, quota } = await getStorageQuota()
    const usagePercent = quota > 0 ? (usage / quota) * 100 : 0
    
    console.log(`💾 [STORAGE] Usage: ${Math.round(usage / 1024 / 1024)} MB / ${Math.round(quota / 1024 / 1024)} MB (${usagePercent.toFixed(1)}%)`)
    
    return usagePercent
  } catch (error) {
    console.warn('⚠️ [STORAGE] Could not estimate storage:', error)
    return 0
  }
}

/**
 * Check if there's enough storage available for the required bytes
 */
export async function checkStorageAvailable(requiredBytes: number): Promise<boolean> {
  try {
    const { available } = await getStorageQuota()
    
    console.log(`💾 [STORAGE] Required: ${Math.round(requiredBytes / 1024)} KB, Available: ${Math.round(available / 1024)} KB`)
    
    if (available < requiredBytes * 1.5) {
      console.warn('⚠️ [STORAGE] Not enough storage space!')
      return false
    }
    
    return true
  } catch (error) {
    console.warn('⚠️ [STORAGE] Could not check storage:', error)
    return true
  }
}

/**
 * Estimate the size of data in bytes
 */
export function estimateDataSize(data: any): number {
  try {
    const jsonString = JSON.stringify(data)
    return new Blob([jsonString]).size
  } catch (error) {
    console.error('❌ [STORAGE] Could not estimate data size:', error)
    return 0
  }
}

/**
 * Check if data size is safe for localStorage
 */
export function isSafeForLocalStorage(dataSize: number): boolean {
  return dataSize < LOCALSTORAGE_SAFE_SIZE
}

/**
 * Determine if data should be stored only in IndexedDB (too large for localStorage)
 */
export function shouldUseIndexedDBOnly(data: any): boolean {
  const size = estimateDataSize(data)
  
  if (size > INDEXEDDB_ONLY_SIZE) {
    console.log(`📦 [STORAGE] Data size ${Math.round(size / 1024)} KB exceeds threshold, will use IndexedDB only`)
    return true
  }
  
  return false
}

/**
 * Clear old analysis history to free space
 */
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
