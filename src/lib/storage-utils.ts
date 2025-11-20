import { getFromStorage, saveToStorage } from './multi-layer-storage'

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
