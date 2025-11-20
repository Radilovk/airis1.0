import { getFromStorage, saveToStorage, deleteFromStorage } from './multi-layer-storage'

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
